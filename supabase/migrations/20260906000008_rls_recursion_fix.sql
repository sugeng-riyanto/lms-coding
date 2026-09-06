-- Live RLS fixes (temuan live denial suite 2026-09-06):
-- 1) Infinite recursion: siklus profiles_teacher_select → cohort_members →
--    cohorts_member_select → cohort_members. SELECT profil/cohort_members oleh
--    user mana pun gagal di Postgres sungguhan ("infinite recursion detected in
--    policy"; statis tak menangkapnya). Penelusuran relasi dipindah ke helper
--    security-definer (bypass RLS pada tabel antara), akses tetap sama.
-- 2) Executor: helper private (caller_membership_ids/is_teacher_of/
--    teacher_cohort_ids) di-REVOKE dari PUBLIC di 000000 tanpa GRANT EXECUTE ke
--    authenticated → setiap policy yang memakainya gagal "permission denied for
--    function" saat dieksekusi sungguhan. Grant eksplisit ditambahkan di sini.

-- Executor untuk helper security-definer yang dipakai policy (RLS berjalan
-- sebagai role pemanggil → butuh EXECUTE, bukan hanya definer).
grant execute on function private.caller_membership_ids() to authenticated;
grant execute on function private.is_teacher_of(uuid) to authenticated;
grant execute on function private.teacher_cohort_ids() to authenticated;

create or replace function private.auth_is_cohort_member(p_cohort_id uuid)
returns boolean
language sql stable security definer
set search_path = private, public, pg_temp
as $$
  select exists (
    select 1 from public.cohort_members cm
    where cm.cohort_id = p_cohort_id and cm.student_id = auth.uid() and cm.status = 'active'
  );
$$;

create or replace function private.auth_is_teacher_of_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = private, public, pg_temp
as $$
  select exists (
    select 1 from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    where cm.student_id = p_student_id and c.teacher_id = auth.uid()
  );
$$;

revoke all on function private.auth_is_cohort_member(uuid) from public;
revoke all on function private.auth_is_teacher_of_student(uuid) from public;
grant execute on function private.auth_is_cohort_member(uuid) to authenticated;
grant execute on function private.auth_is_teacher_of_student(uuid) to authenticated;

-- profiles: guru hanya membaca murid di cohort yang dia ajar (via helper).
drop policy if exists profiles_teacher_select on public.profiles;
create policy profiles_teacher_select on public.profiles for select to authenticated
  using (private.auth_is_teacher_of_student(profiles.id));

-- cohort_members: guru cohort-nya / murid baris miliknya (tanpa baca cohorts via RLS).
drop policy if exists cohort_members_teacher_select on public.cohort_members;
create policy cohort_members_teacher_select on public.cohort_members for select to authenticated
  using (
    cohort_members.cohort_id in (select private.teacher_cohort_ids())
    or cohort_members.student_id = auth.uid()
  );

drop policy if exists cohort_members_teacher_insert on public.cohort_members;
create policy cohort_members_teacher_insert on public.cohort_members for insert to authenticated
  with check (cohort_members.cohort_id in (select private.teacher_cohort_ids()));

drop policy if exists cohort_members_teacher_update on public.cohort_members;
create policy cohort_members_teacher_update on public.cohort_members for update to authenticated
  using (cohort_members.cohort_id in (select private.teacher_cohort_ids()))
  with check (cohort_members.cohort_id in (select private.teacher_cohort_ids()));

-- cohorts: anggota membaca via helper, bukan subquery RLS ke cohort_members.
drop policy if exists cohorts_member_select on public.cohorts;
create policy cohorts_member_select on public.cohorts for select to authenticated
  using (private.auth_is_cohort_member(cohorts.id));
