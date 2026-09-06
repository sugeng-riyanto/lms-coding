-- Prompt 04: recompute progress menulis projection (derived, aman diulang).
-- Murid menulis snapshot enrollment-nya sendiri; guru menulis cohort-nya.

create policy progress_student_write on public.progress_snapshots for all to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = progress_snapshots.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ))
  with check (exists (
    select 1 from public.enrollments e
    where e.id = progress_snapshots.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

create policy progress_teacher_write on public.progress_snapshots for all to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = progress_snapshots.enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ))
  with check (exists (
    select 1 from public.enrollments e
    where e.id = progress_snapshots.enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ));
