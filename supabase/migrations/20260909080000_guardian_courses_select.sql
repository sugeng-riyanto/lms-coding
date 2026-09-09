-- Migration: Add guardian read access to courses table
-- Guardian needs to read course titles for quiz score grouping.

create policy guardian_courses_select on public.courses for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    join public.guardian_links gl on gl.student_id = e.student_id
    where e.course_id = courses.id
      and gl.guardian_id = auth.uid()
      and gl.status = 'active'
  ));
