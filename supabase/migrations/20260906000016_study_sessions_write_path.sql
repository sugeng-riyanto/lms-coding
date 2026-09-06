-- Menutup ADR-010: write path `study_sessions` (waktu belajar jujur) +
-- flip target mingguan ke unit 'minutes'.
--
-- 1) study_sessions: tulis hanya lewat jalur PRIVILEGED (server action →
--    fungsi definer); murid/guru hanya SELECT (RLS). Policy lama
--    `sessions_student_rw` (for all) dihapus — murid tidak boleh menulis
--    study_sessions langsung (mencegah pemalsuan menit).
-- 2) private.append_study_session: menambah activeMs (milidetik, di-clamp
--    ≤120 s lalu dikonversi ke detik) ke sesi terbaru enrollment bila masih
--    lanjutan (gap ≤ 10 mnt), atau membuka sesi baru; active_seconds per sesi
--    di-clamp (≤ 6 jam) sebagai batas keamanan.
-- 3) weekly_plans.goal_value kini unit-aware: completions 1..50, minutes
--    1..2000 (~33 jam/minggu) — CHECK lama `between 1 and 50` terlalu kecil
--    untuk target menit (rencana docs/plan-minutes-weekly-goals.md §2).

-- ---------- RLS study_sessions: read-only untuk user ----------
drop policy if exists sessions_student_rw on public.study_sessions;
create policy sessions_student_select on public.study_sessions for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = study_sessions.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));
-- sessions_teacher_select (cohort) tetap dari 000002.

-- ---------- Fungsi priveliged: append sesi belajar ----------
create or replace function private.append_study_session(
  p_enrollment_id uuid,
  p_active_ms int,
  p_occurred_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_latest public.study_sessions;
  v_ms int;
  v_at timestamptz;
begin
  -- Clamp server-side: delta per panggilan ≤ 120 s; tolak input tak sah.
  if p_active_ms is null or p_active_ms <= 0 then
    return;
  end if;
  -- activeMs dalam MILIDETIK; study_sessions.active_seconds dalam DETIK.
  v_ms := floor(least(p_active_ms, 120000) / 1000);
  if v_ms <= 0 then
    return;
  end if;
  -- occurred_at di-clamp ke jendela wajar (anti backdate/future spam);
  -- default now() dipakai action (server time = sumber kebenaran).
  v_at := coalesce(p_occurred_at, now());
  if v_at > now() + interval '5 minutes' then v_at := now(); end if;
  if v_at < now() - interval '24 hours' then v_at := now(); end if;

  select * into v_latest
    from public.study_sessions
   where enrollment_id = p_enrollment_id
   order by coalesce(ended_at, started_at) desc, started_at desc
   limit 1
   for update;

  if v_latest.id is null
     or v_at - coalesce(v_latest.ended_at, v_latest.started_at) > interval '10 minutes'
  then
    -- Sesi baru (atau gap > 10 mnt dari sesi terakhir).
    insert into public.study_sessions (enrollment_id, started_at, ended_at, active_seconds)
    values (p_enrollment_id, v_at, v_at, v_ms);
  else
    -- Lanjutan sesi: tambahkan delta (atomic) + perpanjang ended_at.
    update public.study_sessions
       set active_seconds = least(active_seconds + v_ms, 21600), -- clamp 6 jam/sesi
           ended_at = greatest(ended_at, v_at)
     where id = v_latest.id;
  end if;
end $$;

-- Wrapper publik untuk service client (server-only). Tidak di-grant ke
-- anon/authenticated → tidak bisa dipanggil langsung dari browser.
create or replace function public.append_study_session(
  p_enrollment_id uuid,
  p_active_ms int,
  p_occurred_at timestamptz default null
) returns void
language sql security definer set search_path = '' as $$
  select private.append_study_session(p_enrollment_id, p_active_ms, p_occurred_at)
$$;

revoke all on function public.append_study_session(uuid, int, timestamptz) from public, anon, authenticated;

-- ---------- weekly_plans: goal unit-aware ----------
alter table public.weekly_plans
  drop constraint if exists weekly_plans_goal_value_check,
  add constraint weekly_plans_goal_value_unit_aware check (
    (goal_unit = 'completions' and goal_value between 1 and 50)
    or (goal_unit = 'minutes' and goal_value between 1 and 2000)
  );