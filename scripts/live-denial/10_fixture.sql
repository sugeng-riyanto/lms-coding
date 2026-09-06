-- Fixture tambahan untuk denial lintas-organisasi & wali (seed.sql hanya 1 org).
-- UUID tetap + anonim. Dijalankan sebagai postgres (bypass RLS).

-- Org 2 + guru 2 + murid X (untuk denial #3 guru lintas organisasi)
insert into auth.users (id) values
  ('a2000000-0000-0000-0000-000000000002'),
  ('b2000000-0000-0000-0000-000000000009')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug) values
  ('22222222-2222-2222-2222-222222222222', 'Sekolah Lain', 'sekolah-lain')
on conflict (id) do nothing;

insert into public.profiles (id, organization_id, display_name) values
  ('a2000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Guru Lain'),
  ('b2000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Murid X')
on conflict (id) do nothing;

insert into public.memberships (organization_id, user_id, role) values
  ('22222222-2222-2222-2222-222222222222', 'a2000000-0000-0000-0000-000000000002', 'teacher'),
  ('22222222-2222-2222-2222-222222222222', 'b2000000-0000-0000-0000-000000000009', 'student')
on conflict do nothing;

insert into public.cohorts (id, organization_id, teacher_id, name, academic_year) values
  ('c2000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'a2000000-0000-0000-0000-000000000002', 'Kelas 9Z', '2026/2027')
on conflict (id) do nothing;
insert into public.cohort_members (cohort_id, student_id) values
  ('c2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000009')
on conflict do nothing;

insert into public.courses (id, organization_id, owner_id, slug, title, status) values
  ('d2000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'a2000000-0000-0000-0000-000000000002', 'fisika-lain', 'Fisika Lain', 'draft')
on conflict (id) do nothing;

-- Wali (guardian) aktif tertaut ke Murid 01 (A); Murid 03 (C) TIDAK tertaut.
insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-0000000000aa')
on conflict (id) do nothing;
insert into public.guardian_links (guardian_id, student_id, status, consent_at) values
  ('aaaaaaaa-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'active', now())
on conflict (guardian_id, student_id) do nothing;

-- Rantai konten minimal di bawah level demo (untuk fixture attempt):
-- level f0000000-…-001 (course demo) → module → lesson → activity → assessment
insert into public.modules (id, level_id, position, title) values
  ('a1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 0, 'Modul 1')
on conflict (id) do nothing;
insert into public.lessons (id, module_id, position, title, estimated_minutes, required) values
  ('a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 0, 'Pelajaran 1', 10, true)
on conflict (id) do nothing;
insert into public.activities (id, lesson_id, position, type, title, required) values
  ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 0, 'quiz', 'Kuis 1', true)
on conflict (id) do nothing;
insert into public.assessments (id, activity_id, settings_json, total_points) values
  ('a1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', '{}', 10)
on conflict (id) do nothing;

-- Attempt milik Murid 01 (A) pada enrollment demo — bahan uji "murid tidak bisa
-- mengubah score" dengan baris yang benar-benar ada.
insert into public.attempts (assessment_id, enrollment_id, attempt_no, status, idempotency_key, started_at)
select 'a1000000-0000-0000-0000-000000000004', e.id, 1, 'in_progress', 'fixture-attempt-A', now()
from public.enrollments e
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
  and e.course_id = 'd0000000-0000-0000-0000-000000000001'
limit 1
on conflict (idempotency_key) do nothing;

-- Tabel hasil denial (tanpa RLS; grant luas agar semua role bisa mencatat hasil).
create table if not exists public.harness_results (
  id serial primary key,
  check_id text not null,
  passed boolean not null,
  detail text not null default ''
);
grant all on public.harness_results to anon, authenticated;
grant usage, select on sequence public.harness_results_id_seq to anon, authenticated;
