-- 000021 — Ganti policy content-tree bertingkat dengan helper security definer.
--
-- Defect (dari smoke live): policy inline dengan join-chain 4 tabel dievaluasi
-- berlapis — subquery policy membaca tabel yang MEMILIKI policy berlapis sendiri,
-- sehingga RLS mengevaluasi ulang bertingkat (eksponensial per level). Di hosted
-- `lessons` ~1.5–2.8 dtk, `activities`/`assessments` timeout (>8 dtk) padahal
-- data 1–5 baris. Index (000020) membantu tapi tidak cukup.
--
-- Solusi: helper `private.*` security definer (pola SECURITY_PRIVACY.md: schema
-- private, search_path di-pin, caller divalidasi via auth.uid(), tidak
-- executable oleh PUBLIC). Policy menjadi pemanggilan fungsi tunggal per baris —
-- satu evaluasi index-scan, TANPA RLS berlapis (security definer membaca tabel
-- sebagai pemilik; helper hanya mengembalikan boolean, tidak membocorkan data).
-- Semantik identik dengan policy lama: guru = pemilik course; murid = published
-- + enrollment aktif.

-- ---------- course_versions ----------
create or replace function private.cv_owned_by_teacher(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.course_versions cv join public.courses c on c.id = cv.course_id
    where cv.id = p_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.cv_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.course_versions cv join public.enrollments e on e.course_id = cv.course_id
    where cv.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- levels ----------
create or replace function private.level_owned_by_teacher(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where l.id = p_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.level_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where l.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- modules ----------
create or replace function private.module_owned_by_teacher(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id join public.courses c on c.id = cv.course_id
    where m.id = p_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.module_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where m.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- lessons ----------
create or replace function private.lesson_owned_by_teacher(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where le.id = p_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.lesson_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where le.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- activities ----------
create or replace function private.activity_owned_by_teacher(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id join public.courses c on c.id = cv.course_id
    where a.id = p_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.activity_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id join public.courses co on co.id = cv.course_id
    join public.enrollments e on e.course_id = co.id
    where a.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- assessments ----------
create or replace function private.assessment_owned_by_teacher(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where asmt.id = p_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.assessment_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where asmt.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- assessment_questions (PK komposit: assessment_id, question_version_id) ----------
create or replace function private.asmtq_owned_by_teacher(p_assessment_id uuid, p_question_version_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.assessment_questions aq join public.assessments asmt on asmt.id = aq.assessment_id
    join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where aq.assessment_id = p_assessment_id and aq.question_version_id = p_question_version_id
      and c.owner_id = auth.uid()
  );
$$;
create or replace function private.asmtq_visible_to_student(p_assessment_id uuid, p_question_version_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.assessment_questions aq join public.assessments asmt on asmt.id = aq.assessment_id
    join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where aq.assessment_id = p_assessment_id and aq.question_version_id = p_question_version_id
      and cv.published_at is not null and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- Hak akses helper: hanya authenticated (dipakai policy); PUBLIC tidak.
revoke all on function private.cv_owned_by_teacher(uuid) from public;
revoke all on function private.cv_visible_to_student(uuid) from public;
revoke all on function private.level_owned_by_teacher(uuid) from public;
revoke all on function private.level_visible_to_student(uuid) from public;
revoke all on function private.module_owned_by_teacher(uuid) from public;
revoke all on function private.module_visible_to_student(uuid) from public;
revoke all on function private.lesson_owned_by_teacher(uuid) from public;
revoke all on function private.lesson_visible_to_student(uuid) from public;
revoke all on function private.activity_owned_by_teacher(uuid) from public;
revoke all on function private.activity_visible_to_student(uuid) from public;
revoke all on function private.assessment_owned_by_teacher(uuid) from public;
revoke all on function private.assessment_visible_to_student(uuid) from public;
revoke all on function private.asmtq_owned_by_teacher(uuid, uuid) from public;
revoke all on function private.asmtq_visible_to_student(uuid, uuid) from public;
grant execute on function private.cv_owned_by_teacher(uuid) to authenticated;
grant execute on function private.cv_visible_to_student(uuid) to authenticated;
grant execute on function private.level_owned_by_teacher(uuid) to authenticated;
grant execute on function private.level_visible_to_student(uuid) to authenticated;
grant execute on function private.module_owned_by_teacher(uuid) to authenticated;
grant execute on function private.module_visible_to_student(uuid) to authenticated;
grant execute on function private.lesson_owned_by_teacher(uuid) to authenticated;
grant execute on function private.lesson_visible_to_student(uuid) to authenticated;
grant execute on function private.activity_owned_by_teacher(uuid) to authenticated;
grant execute on function private.activity_visible_to_student(uuid) to authenticated;
grant execute on function private.assessment_owned_by_teacher(uuid) to authenticated;
grant execute on function private.assessment_visible_to_student(uuid) to authenticated;
grant execute on function private.asmtq_owned_by_teacher(uuid, uuid) to authenticated;
grant execute on function private.asmtq_visible_to_student(uuid, uuid) to authenticated;

-- ---------- Ganti policy lama dengan helper ----------
drop policy if exists versions_teacher_rw on public.course_versions;
drop policy if exists versions_student_published on public.course_versions;
create policy versions_teacher_rw on public.course_versions for all to authenticated
  using (private.cv_owned_by_teacher(id)) with check (private.cv_owned_by_teacher(id));
create policy versions_student_published on public.course_versions for select to authenticated
  using (private.cv_visible_to_student(id));

drop policy if exists levels_teacher_rw on public.levels;
drop policy if exists levels_student_published on public.levels;
create policy levels_teacher_rw on public.levels for all to authenticated
  using (private.level_owned_by_teacher(id)) with check (private.level_owned_by_teacher(id));
create policy levels_student_published on public.levels for select to authenticated
  using (private.level_visible_to_student(id));

drop policy if exists modules_teacher_rw on public.modules;
drop policy if exists modules_student_published on public.modules;
create policy modules_teacher_rw on public.modules for all to authenticated
  using (private.module_owned_by_teacher(id)) with check (private.module_owned_by_teacher(id));
create policy modules_student_published on public.modules for select to authenticated
  using (private.module_visible_to_student(id));

drop policy if exists lessons_teacher_rw on public.lessons;
drop policy if exists lessons_student_published on public.lessons;
create policy lessons_teacher_rw on public.lessons for all to authenticated
  using (private.lesson_owned_by_teacher(id)) with check (private.lesson_owned_by_teacher(id));
create policy lessons_student_published on public.lessons for select to authenticated
  using (private.lesson_visible_to_student(id));

drop policy if exists activities_teacher_rw on public.activities;
drop policy if exists activities_student_published on public.activities;
create policy activities_teacher_rw on public.activities for all to authenticated
  using (private.activity_owned_by_teacher(id)) with check (private.activity_owned_by_teacher(id));
create policy activities_student_published on public.activities for select to authenticated
  using (private.activity_visible_to_student(id));

drop policy if exists assessments_teacher_rw on public.assessments;
drop policy if exists assessments_student_published on public.assessments;
create policy assessments_teacher_rw on public.assessments for all to authenticated
  using (private.assessment_owned_by_teacher(id)) with check (private.assessment_owned_by_teacher(id));
create policy assessments_student_published on public.assessments for select to authenticated
  using (private.assessment_visible_to_student(id));

drop policy if exists asmtq_teacher_rw on public.assessment_questions;
drop policy if exists asmtq_student_published on public.assessment_questions;
create policy asmtq_teacher_rw on public.assessment_questions for all to authenticated
  using (private.asmtq_owned_by_teacher(assessment_id, question_version_id))
  with check (private.asmtq_owned_by_teacher(assessment_id, question_version_id));
create policy asmtq_student_published on public.assessment_questions for select to authenticated
  using (private.asmtq_visible_to_student(assessment_id, question_version_id));