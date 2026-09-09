-- Migration: Guardian read access to attempts + study_sessions
-- Allows guardians to view quiz scores and study time for linked children.
-- Uses the same guardian_links → enrollments → target_table chain.

-- ── Attempts: guardian can read attempts of linked children ─────────────
create policy guardian_attempts_select on public.attempts for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    join public.guardian_links gl on gl.student_id = e.student_id
    where e.id = attempts.enrollment_id
      and gl.guardian_id = auth.uid()
      and gl.status = 'active'
  ));

-- ── Study sessions: guardian can read sessions of linked children ───────
create policy guardian_sessions_select on public.study_sessions for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    join public.guardian_links gl on gl.student_id = e.student_id
    where e.id = study_sessions.enrollment_id
      and gl.guardian_id = auth.uid()
      and gl.status = 'active'
  ));

-- ── Assessments: guardian can read assessments via child's enrollment ───
-- Join: assessments → activities → lessons → modules → levels → enrollments → guardian_links
create policy guardian_assessments_select on public.assessments for select to authenticated
  using (exists (
    select 1 from public.activities a
    join public.lessons le on le.id = a.lesson_id
    join public.modules m on m.id = le.module_id
    join public.levels l on l.id = m.level_id
    join public.enrollments e on e.level_id = l.id
    join public.guardian_links gl on gl.student_id = e.student_id
    where a.id = assessments.activity_id
      and gl.guardian_id = auth.uid()
      and gl.status = 'active'
  ));
