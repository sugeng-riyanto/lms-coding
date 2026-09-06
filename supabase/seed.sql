-- Seed demo ANONIM: 1 guru, 1 kelas, 3 murid, 1 course, 3 level.
-- Jalankan HANYA di local/preview. UUID tetap agar fixture tests deterministik.

-- ============================================================================
-- Auth seed LOKAL (E2E/demo) — auth.users + auth.identities, idempotent.
-- HANYA untuk `supabase db reset` lokal; data anonim, password demo non-rahasia.
--   guru@demo.local     / DemoPass-2026!   (uuid a0000000-…-001, teacher)
--   murid01@demo.local  / DemoPass-2026!   (uuid b0000000-…-001, student)
--   murid02@demo.local  / DemoPass-2026!   (uuid b0000000-…-002, student)
--   murid03@demo.local  / DemoPass-2026!   (uuid b0000000-…-003, student)
-- Ganti password di clone Anda; jangan pernah pakai akun ini di production.
-- ============================================================================
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'guru@demo.local',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', now(), now()),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'murid01@demo.local',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'murid02@demo.local',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', now(), now()),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'murid03@demo.local',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', now(), now())
on conflict (id) do nothing;

-- identities wajib untuk email/password sign-in di GoTrue modern.
insert into auth.identities
  (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('guru@demo.local', 'murid01@demo.local', 'murid02@demo.local', 'murid03@demo.local')
on conflict (provider, provider_id) do nothing;

-- org
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Sekolah Demo', 'sekolah-demo')
on conflict (id) do nothing;

-- NOTE: auth.users + identities sudah dibuat di blok atas dengan UUID tetap yang sama.
-- teacher
insert into public.profiles (id, organization_id, display_name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Guru Demo')
on conflict (id) do nothing;
insert into public.memberships (organization_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'teacher')
on conflict do nothing;

-- students
insert into public.profiles (id, organization_id, display_name) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Murid 01'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Murid 02'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Murid 03')
on conflict (id) do nothing;
insert into public.memberships (organization_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'student'),
  ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000002', 'student'),
  ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000003', 'student')
on conflict do nothing;

-- cohort
insert into public.cohorts (id, organization_id, teacher_id, name, academic_year) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Kelas 7A', '2026/2027')
on conflict (id) do nothing;
insert into public.cohort_members (cohort_id, student_id) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- course + version + 3 levels + 1 module/lesson/activity each (minimal vertical slice)
insert into public.courses (id, organization_id, owner_id, slug, title, description, status) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'matematika-dasar', 'Matematika Dasar', 'Kursus demo anonim', 'published')
on conflict (id) do nothing;
insert into public.course_versions (id, course_id, version, published_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, now())
on conflict (id) do nothing;
insert into public.levels (id, course_version_id, position, title) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 0, 'Level 1 — Fondasi'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 1, 'Level 2 — Penerapan'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 2, 'Level 3 — Proyek')
on conflict (id) do nothing;

-- enrollments aktif untuk 3 murid
insert into public.enrollments (course_id, student_id, cohort_id, status) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'active'),
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'active'),
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'active')
on conflict do nothing;

-- Demo certificate untuk verifier publik (E2E test 4 / /verify).
-- CATATAN: view certificates_public security_invoker + RLS base-table tanpa policy
-- `to anon` membuat anon mendapat 404 selama Phase 6 belum menambah policy baca
-- minimal-PII untuk status active. Row ini siap dipakai begitu policy tersebut ada.
insert into public.certificates
  (public_id, enrollment_id, level_id, serial_no, status, issued_at, payload_json, payload_hash)
select 'demo-valid-certificate', e.id, lv.id, 'DEMO-0001', 'active', '2026-01-15T00:00:00Z',
       jsonb_build_object('publicId', 'demo-valid-certificate'),
       lpad('', 64, '0')
from public.enrollments e
join public.courses c on c.id = e.course_id and c.slug = 'matematika-dasar'
join public.course_versions cv on cv.course_id = c.id
join public.levels lv on lv.course_version_id = cv.id and lv.position = 0
where e.student_id = 'b0000000-0000-0000-0000-000000000001'
limit 1
on conflict (public_id) do nothing;
