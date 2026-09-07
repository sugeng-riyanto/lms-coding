-- 000022 — Koreksi 000021: helper policy di-key oleh kolom FK, bukan id baris.
--
-- Bug pada 000021: helper `*_owned_by_teacher(p_id)` mencari baris via
-- `where <table>.id = p_id`. Pada INSERT, WITH CHECK dievaluasi SEBELUM baris
-- baru masuk tabel — baris belum terlihat → EXISTS selalu false → 403
-- "new row violates row-level security policy". SELECT (USING) tetap jalan
-- karena baris sudah ada.
--
-- Perbaikan: helper divalidasi via kolom FK yang mereferensikan baris yang
-- SUDAH ADA (course_id / course_version_id / level_id / module_id / lesson_id
-- / activity_id / assessment_id). Policy USING dan WITH CHECK sama-sama memakai
-- kolom FK pada baris (lama/baru). Semantik authorization identik.
--
-- Idempoten: drop policy if exists + create policy; create or replace function;
-- drop function lama untuk signature asmtq (uuid, uuid).

-- ---------- drop helper lama (semua signature uuid / uuid,uuid) ----------
-- CASCADE: policy 000021 yang bergantung ikut ter-drop; file ini menciptakan
-- ulang policy di bagian bawah. Di-drop dulu karena `create or replace` tidak
-- boleh mengganti nama parameter (SQLSTATE 42P13).
drop function if exists private.cv_owned_by_teacher(uuid) cascade;
drop function if exists private.cv_visible_to_student(uuid) cascade;
drop function if exists private.level_owned_by_teacher(uuid) cascade;
drop function if exists private.level_visible_to_student(uuid) cascade;
drop function if exists private.module_owned_by_teacher(uuid) cascade;
drop function if exists private.module_visible_to_student(uuid) cascade;
drop function if exists private.lesson_owned_by_teacher(uuid) cascade;
drop function if exists private.lesson_visible_to_student(uuid) cascade;
drop function if exists private.activity_owned_by_teacher(uuid) cascade;
drop function if exists private.activity_visible_to_student(uuid) cascade;
drop function if exists private.assessment_owned_by_teacher(uuid) cascade;
drop function if exists private.assessment_visible_to_student(uuid) cascade;
drop function if exists private.asmtq_owned_by_teacher(uuid, uuid) cascade;
drop function if exists private.asmtq_visible_to_student(uuid, uuid) cascade;

-- ---------- course_versions (via course_id) ----------
create or replace function private.cv_owned_by_teacher(p_course_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (select 1 from public.courses c where c.id = p_course_id and c.owner_id = auth.uid());
$$;
create or replace function private.cv_visible_to_student(p_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.course_versions cv join public.enrollments e on e.course_id = cv.course_id
    where cv.id = p_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- levels (via course_version_id) ----------
create or replace function private.level_owned_by_teacher(p_course_version_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.course_versions cv join public.courses c on c.id = cv.course_id
    where cv.id = p_course_version_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.level_visible_to_student(p_course_version_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.course_versions cv join public.courses co on co.id = cv.course_id
    join public.enrollments e on e.course_id = co.id
    where cv.id = p_course_version_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- modules (via level_id) ----------
create or replace function private.module_owned_by_teacher(p_level_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where l.id = p_level_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.module_visible_to_student(p_level_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where l.id = p_level_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- lessons (via module_id) ----------
create or replace function private.lesson_owned_by_teacher(p_module_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id join public.courses c on c.id = cv.course_id
    where m.id = p_module_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.lesson_visible_to_student(p_module_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where m.id = p_module_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- activities (via lesson_id) ----------
create or replace function private.activity_owned_by_teacher(p_lesson_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where le.id = p_lesson_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.activity_visible_to_student(p_lesson_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where le.id = p_lesson_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- assessments (via activity_id) ----------
create or replace function private.assessment_owned_by_teacher(p_activity_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id join public.courses c on c.id = cv.course_id
    where a.id = p_activity_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.assessment_visible_to_student(p_activity_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id join public.courses co on co.id = cv.course_id
    join public.enrollments e on e.course_id = co.id
    where a.id = p_activity_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  );
$$;

-- ---------- assessment_questions (via assessment_id) ----------
create or replace function private.asmtq_owned_by_teacher(p_assessment_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where asmt.id = p_assessment_id and c.owner_id = auth.uid()
  );
$$;
create or replace function private.asmtq_visible_to_student(p_assessment_id uuid)
returns boolean language sql security definer set search_path = private, public, pg_temp as $$
  select exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where asmt.id = p_assessment_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
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
revoke all on function private.asmtq_owned_by_teacher(uuid) from public;
revoke all on function private.asmtq_visible_to_student(uuid) from public;
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
grant execute on function private.asmtq_owned_by_teacher(uuid) to authenticated;
grant execute on function private.asmtq_visible_to_student(uuid) to authenticated;

-- ---------- Rebuild policy dengan kolom FK ----------
drop policy if exists versions_teacher_rw on public.course_versions;
drop policy if exists versions_student_published on public.course_versions;
create policy versions_teacher_rw on public.course_versions for all to authenticated
  using (private.cv_owned_by_teacher(course_id)) with check (private.cv_owned_by_teacher(course_id));
create policy versions_student_published on public.course_versions for select to authenticated
  using (private.cv_visible_to_student(id));

drop policy if exists levels_teacher_rw on public.levels;
drop policy if exists levels_student_published on public.levels;
create policy levels_teacher_rw on public.levels for all to authenticated
  using (private.level_owned_by_teacher(course_version_id)) with check (private.level_owned_by_teacher(course_version_id));
create policy levels_student_published on public.levels for select to authenticated
  using (private.level_visible_to_student(course_version_id));

drop policy if exists modules_teacher_rw on public.modules;
drop policy if exists modules_student_published on public.modules;
create policy modules_teacher_rw on public.modules for all to authenticated
  using (private.module_owned_by_teacher(level_id)) with check (private.module_owned_by_teacher(level_id));
create policy modules_student_published on public.modules for select to authenticated
  using (private.module_visible_to_student(level_id));

drop policy if exists lessons_teacher_rw on public.lessons;
drop policy if exists lessons_student_published on public.lessons;
create policy lessons_teacher_rw on public.lessons for all to authenticated
  using (private.lesson_owned_by_teacher(module_id)) with check (private.lesson_owned_by_teacher(module_id));
create policy lessons_student_published on public.lessons for select to authenticated
  using (private.lesson_visible_to_student(module_id));

drop policy if exists activities_teacher_rw on public.activities;
drop policy if exists activities_student_published on public.activities;
create policy activities_teacher_rw on public.activities for all to authenticated
  using (private.activity_owned_by_teacher(lesson_id)) with check (private.activity_owned_by_teacher(lesson_id));
create policy activities_student_published on public.activities for select to authenticated
  using (private.activity_visible_to_student(lesson_id));

drop policy if exists assessments_teacher_rw on public.assessments;
drop policy if exists assessments_student_published on public.assessments;
create policy assessments_teacher_rw on public.assessments for all to authenticated
  using (private.assessment_owned_by_teacher(activity_id)) with check (private.assessment_owned_by_teacher(activity_id));
create policy assessments_student_published on public.assessments for select to authenticated
  using (private.assessment_visible_to_student(activity_id));

drop policy if exists asmtq_teacher_rw on public.assessment_questions;
drop policy if exists asmtq_student_published on public.assessment_questions;
create policy asmtq_teacher_rw on public.assessment_questions for all to authenticated
  using (private.asmtq_owned_by_teacher(assessment_id)) with check (private.asmtq_owned_by_teacher(assessment_id));
create policy asmtq_student_published on public.assessment_questions for select to authenticated
  using (private.asmtq_visible_to_student(assessment_id));