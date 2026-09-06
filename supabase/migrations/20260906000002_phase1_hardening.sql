-- Phase 1 hardening (Prompt 02): audit triggers, guardian linked-read,
-- organization/cohort_member policies, dan RLS content-tree.
-- NOTE: file manual (tanpa Supabase CLI); regenerasi via `supabase migration new`
-- + diff sebelum apply. Role Owner/Guru = satu kapabilitas (ADR-008):
-- tidak ada role 'owner' terpisah; kepemilikan via courses.owner_id.

-- ============ 1. Audit trigger role/membership (server-side, append-only) ============
create or replace function private.audit_role_change()
returns trigger
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
begin
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, before_json, after_json)
  values (
    coalesce((to_jsonb(NEW) ->> 'organization_id')::uuid, (to_jsonb(OLD) ->> 'organization_id')::uuid),
    auth.uid(),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    coalesce((to_jsonb(NEW) ->> 'id'), (to_jsonb(OLD) ->> 'id')),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke all on function private.audit_role_change() from public;

drop trigger if exists trg_memberships_audit on public.memberships;
create trigger trg_memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_role_change();

drop trigger if exists trg_profiles_audit on public.profiles;
create trigger trg_profiles_audit
  after update or delete on public.profiles
  for each row execute function private.audit_role_change();

-- ============ 2. Guardian: baca ringkasan HANYA via link aktif ============
create policy profiles_guardian_select on public.profiles for select to authenticated
  using (exists (
    select 1 from public.guardian_links g
    where g.guardian_id = auth.uid() and g.student_id = profiles.id and g.status = 'active'
  ));

create policy enrollments_guardian_select on public.enrollments for select to authenticated
  using (exists (
    select 1 from public.guardian_links g
    where g.guardian_id = auth.uid() and g.student_id = enrollments.student_id and g.status = 'active'
  ));

create policy progress_guardian_select on public.progress_snapshots for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    join public.guardian_links g on g.student_id = e.student_id
    where e.id = progress_snapshots.enrollment_id
      and g.guardian_id = auth.uid() and g.status = 'active'
  ));

-- ============ 3. Organizations & cohort members ============
create policy organizations_member_select on public.organizations for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.status = 'active'
  ));

create policy cohort_members_teacher_select on public.cohort_members for select to authenticated
  using (
    (select c.teacher_id from public.cohorts c where c.id = cohort_members.cohort_id) = auth.uid()
    or cohort_members.student_id = auth.uid()
  );
create policy cohort_members_teacher_insert on public.cohort_members for insert to authenticated
  with check (
    (select c.teacher_id from public.cohorts c where c.id = cohort_members.cohort_id) = auth.uid()
  );
create policy cohort_members_teacher_update on public.cohort_members for update to authenticated
  using ((select c.teacher_id from public.cohorts c where c.id = cohort_members.cohort_id) = auth.uid())
  with check ((select c.teacher_id from public.cohorts c where c.id = cohort_members.cohort_id) = auth.uid());

create policy cohorts_teacher_insert on public.cohorts for insert to authenticated
  with check (teacher_id = auth.uid());

-- ============ 4. Content tree: teacher-owner kelola, murid baca published ============
-- course_versions
create policy versions_teacher_rw on public.course_versions for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_versions.course_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_versions.course_id and c.owner_id = auth.uid()));
create policy versions_student_published on public.course_versions for select to authenticated
  using (
    course_versions.published_at is not null
    and exists (
      select 1 from public.enrollments e
      where e.course_id = course_versions.course_id and e.student_id = auth.uid() and e.status = 'active'
    )
  );

-- levels
create policy levels_teacher_rw on public.levels for all to authenticated
  using (exists (
    select 1 from public.course_versions cv join public.courses c on c.id = cv.course_id
    where cv.id = levels.course_version_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.course_versions cv join public.courses c on c.id = cv.course_id
    where cv.id = levels.course_version_id and c.owner_id = auth.uid()
  ));
create policy levels_student_published on public.levels for select to authenticated
  using (exists (
    select 1 from public.course_versions cv join public.courses co on co.id = cv.course_id
    join public.enrollments e on e.course_id = co.id
    where cv.id = levels.course_version_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  ));

-- modules (via level)
create policy modules_teacher_rw on public.modules for all to authenticated
  using (exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where l.id = modules.level_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where l.id = modules.level_id and c.owner_id = auth.uid()
  ));
create policy modules_student_published on public.modules for select to authenticated
  using (exists (
    select 1 from public.levels l join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where l.id = modules.level_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  ));

-- lessons (via module -> level)
create policy lessons_teacher_rw on public.lessons for all to authenticated
  using (exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where m.id = lessons.module_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where m.id = lessons.module_id and c.owner_id = auth.uid()
  ));
create policy lessons_student_published on public.lessons for select to authenticated
  using (exists (
    select 1 from public.modules m join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where m.id = lessons.module_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  ));

-- activities (via lesson)
create policy activities_teacher_rw on public.activities for all to authenticated
  using (exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where le.id = activities.lesson_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where le.id = activities.lesson_id and c.owner_id = auth.uid()
  ));
create policy activities_student_published on public.activities for select to authenticated
  using (exists (
    select 1 from public.lessons le join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where le.id = activities.lesson_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  ));

-- assessments + assessment_questions: murid baca metadata (tanpa kunci), guru kelola
create policy assessments_teacher_rw on public.assessments for all to authenticated
  using (exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where a.id = assessments.activity_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where a.id = assessments.activity_id and c.owner_id = auth.uid()
  ));
create policy assessments_student_published on public.assessments for select to authenticated
  using (exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where a.id = assessments.activity_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  ));

create policy asmtq_teacher_rw on public.assessment_questions for all to authenticated
  using (exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where asmt.id = assessment_questions.assessment_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where asmt.id = assessment_questions.assessment_id and c.owner_id = auth.uid()
  ));
create policy asmtq_student_published on public.assessment_questions for select to authenticated
  using (exists (
    select 1 from public.assessments asmt join public.activities a on a.id = asmt.activity_id
    join public.lessons le on le.id = a.lesson_id join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id join public.course_versions cv on cv.id = l.course_version_id
    join public.courses co on co.id = cv.course_id join public.enrollments e on e.course_id = co.id
    where asmt.id = assessment_questions.assessment_id and cv.published_at is not null
      and e.student_id = auth.uid() and e.status = 'active'
  ));

-- questions + question_versions: GURU org saja (answer key tidak boleh ke murid).
-- TIDAK ADA policy SELECT untuk student — pengiriman soal ke browser dikontrol
-- release policy di lapisan aplikasi (Prompt 05), bukan via RLS tabel ini.
create policy questions_teacher_rw on public.questions for all to authenticated
  using (private.is_teacher_of(questions.organization_id))
  with check (private.is_teacher_of(questions.organization_id));
create policy qversions_teacher_rw on public.question_versions for all to authenticated
  using (exists (
    select 1 from public.questions q where q.id = question_versions.question_id
      and private.is_teacher_of(q.organization_id)
  ))
  with check (exists (
    select 1 from public.questions q where q.id = question_versions.question_id
      and private.is_teacher_of(q.organization_id)
  ));

-- competencies + activity_competencies: anggota org baca, guru org kelola
create policy competencies_member_select on public.competencies for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = competencies.organization_id and m.user_id = auth.uid() and m.status = 'active'
  ));
create policy competencies_teacher_rw on public.competencies for all to authenticated
  using (private.is_teacher_of(competencies.organization_id))
  with check (private.is_teacher_of(competencies.organization_id));
create policy acomp_member_select on public.activity_competencies for select to authenticated
  using (exists (
    select 1 from public.competencies co join public.memberships m on m.organization_id = co.organization_id
    where co.id = activity_competencies.competency_id and m.user_id = auth.uid() and m.status = 'active'
  ));
create policy acomp_teacher_rw on public.activity_competencies for all to authenticated
  using (exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where a.id = activity_competencies.activity_id and c.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.activities a join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id join public.levels l on l.id = m.level_id
    join public.course_versions cv on cv.id = l.course_version_id
    join public.courses c on c.id = cv.course_id
    where a.id = activity_competencies.activity_id and c.owner_id = auth.uid()
  ));

-- prerequisites: guru aktif atau murid enrollment aktif (struktur, bukan jawaban)
create policy prereq_reader_select on public.prerequisites for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role = 'teacher'
  ) or exists (
    select 1 from public.enrollments e where e.student_id = auth.uid() and e.status = 'active'
  ));
create policy prereq_teacher_rw on public.prerequisites for all to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role = 'teacher'
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.role = 'teacher'
  ));

-- progress_snapshots + study_sessions: murid via enrollment sendiri, guru via cohort
create policy progress_student_select on public.progress_snapshots for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = progress_snapshots.enrollment_id and e.student_id = auth.uid()
  ));
create policy progress_teacher_select on public.progress_snapshots for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = progress_snapshots.enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ));
create policy sessions_student_rw on public.study_sessions for all to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = study_sessions.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ))
  with check (exists (
    select 1 from public.enrollments e
    where e.id = study_sessions.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));
create policy sessions_teacher_select on public.study_sessions for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = study_sessions.enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- rubrics: guru org kelola + baca
create policy rubrics_teacher_rw on public.rubrics for all to authenticated
  using (private.is_teacher_of(rubrics.organization_id))
  with check (private.is_teacher_of(rubrics.organization_id));
create policy rcriteria_teacher_rw on public.rubric_criteria for all to authenticated
  using (exists (
    select 1 from public.rubrics r where r.id = rubric_criteria.rubric_id
      and private.is_teacher_of(r.organization_id)
  ))
  with check (exists (
    select 1 from public.rubrics r where r.id = rubric_criteria.rubric_id
      and private.is_teacher_of(r.organization_id)
  ));
