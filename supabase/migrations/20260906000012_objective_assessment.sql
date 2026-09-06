-- Phase 4 objective assessment (gap closure):
--   1. attempts.question_order_json — pool+urutan soal ditentukan SERVER saat
--      startAttempt (seed kriptografis + shuffle reproducible via lib/shuffle.ts).
--      Nilai disimpan agar grading memakai subset yang sama dan order dapat
--      direproduksi (verifikasi). NULL = assessment tidak dirandomisasi
--      (back-compat: urutan posisi assessment_questions).
--   2. private.finalize_attempt — deadline kini di-enforce DI RPC (bukan hanya
--      action): client yang memalsukan pemanggilan langsung tidak bisa
--      mem-finalize attempt yang lewat batas waktu. Idempotensi dipertahankan:
--      attempt yang sudah bukan in_progress dikembalikan tanpa efek.

alter table public.attempts
  add column question_order_json jsonb;

create or replace function private.finalize_attempt(p_attempt_id uuid, p_idempotency_key text)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_enrollment uuid;
  v_student uuid;
  v_status text;
  v_assessment uuid;
  v_duration_seconds int;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select a.enrollment_id, a.status, a.assessment_id
    into v_enrollment, v_status, v_assessment
  from public.attempts a
  where a.id = p_attempt_id;
  if v_enrollment is null then raise exception 'NOT_FOUND'; end if;

  -- submit ganda = idempotent: tidak ada perubahan bila sudah bukan in_progress.
  -- (DICEK dulu — retry attempt yang sudah submitted tidak boleh kena deadline.)
  if v_status is distinct from 'in_progress' then return; end if;

  select e.student_id into v_student from public.enrollments e where e.id = v_enrollment;
  -- hanya pemilik attempt atau guru cohort yang boleh finalize
  if v_student <> auth.uid() and not exists (
    select 1 from public.enrollments e
    where e.id = v_enrollment and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  -- Deadline server-authoritative: settings_json.durationSeconds > 0 dan lewat -> tolak.
  select coalesce((s.settings_json ->> 'durationSeconds')::int, 0)
    into v_duration_seconds
  from public.assessments s
  where s.id = v_assessment;
  if v_duration_seconds > 0
     and now() > (select started_at + make_interval(secs => v_duration_seconds)
                  from public.attempts where id = p_attempt_id) then
    raise exception 'TIME_EXPIRED';
  end if;

  update public.attempts
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_attempt_id and status = 'in_progress';
  -- scoring objektif + agregasi dikerjakan job recompute (idempotent) agar transaction kecil.
end;
$$;