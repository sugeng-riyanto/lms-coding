-- Seed demo ANONIM: 1 guru, 1 kelas, 3 murid, 1 course, 3 level.
-- Jalankan HANYA di local/preview. UUID tetap agar fixture tests deterministik.
-- Password/SEED dikelola via Supabase Auth admin API; file ini hanya data domain.

-- org
insert into public.organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Sekolah Demo', 'sekolah-demo')
on conflict (id) do nothing;

-- NOTE: auth.users dibuat via dashboard/CLI; id di bawah merujuk user seed tersebut.
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
