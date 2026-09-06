-- Private buckets: submissions (tugas) & certificates (PDF).
-- Download hanya via short-lived signed URL setelah permission check di server.

insert into storage.buckets (id, name, public) values
  ('submissions', 'submissions', false),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- submissions: murid tulis di folder miliknya (/<uid>/...); guru baca folder murid cohort-nya.
-- Mencegah upload menimpa file pengguna lain (denial test 8).
create policy submissions_student_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy submissions_owner_select on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.enrollments e
        where e.cohort_id in (select private.teacher_cohort_ids())
          and (storage.foldername(name))[1] = e.student_id::text
      )
    )
  );
create policy submissions_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);

-- certificates: TIDAK ada policy INSERT/UPDATE/DELETE untuk authenticated.
-- PDF dibuat server-side (service key) setelah issue_certificate; murid mengunduh
-- via short-lived signed URL yang diterbitkan setelah permission check di Server Action.
-- Kebijakan SELECT di bawah eksplisit-deny agar default tetap tertutup dan teraudit.
create policy certificates_authenticated_deny_select on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and false);
