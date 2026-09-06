-- Prompt 05: draft autosave murid (hanya attempt in_progress miliknya).

create policy responses_student_update on public.responses for update to authenticated
  using (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = responses.attempt_id and e.student_id = auth.uid() and a.status = 'in_progress'
  ))
  with check (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = responses.attempt_id and e.student_id = auth.uid() and a.status = 'in_progress'
  ));
