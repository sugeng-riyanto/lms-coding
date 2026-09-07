-- 000020 — Index FK pada seluruh join-chain yang dipakai policy RLS.
--
-- Defect (ditemukan via smoke test live di hosted): query ber-token
-- authenticated pada `lessons` dan `activities` (policy dengan join-chain
-- 4 tabel: modules→levels→course_versions→courses) timeout (~8–9 dtk, 57014)
-- padahal data hanya 1–5 baris. Akar masalah: TIDAK ADA index pada kolom FK
-- join (Postgres tidak membuat index otomatis untuk FK), sehingga evaluasi
-- policy RLS berlapis jatuh ke nested-loop scan. Index di bawah membuat
-- subquery policy memakai index scan. Idempoten (IF NOT EXISTS) dan aman
-- untuk db push ulang.
--
-- Aman utk produksi: index FK tidak mengubah semantik, hanya mempercepat
-- join RLS yang dievaluasi di setiap request terautentikasi.

-- Content tree (join-chain policy guru/murid: modules→levels→course_versions→courses)
create index if not exists course_versions_course_id_idx on public.course_versions (course_id);
create index if not exists levels_course_version_id_idx on public.levels (course_version_id);
create index if not exists modules_level_id_idx on public.modules (level_id);
create index if not exists lessons_module_id_idx on public.lessons (module_id);
create index if not exists activities_lesson_id_idx on public.activities (lesson_id);
create index if not exists assessments_activity_id_idx on public.assessments (activity_id);

-- Enrollments / cohort / membership (policy murid, guru, wali)
create index if not exists enrollments_course_id_idx on public.enrollments (course_id);
create index if not exists enrollments_student_id_idx on public.enrollments (student_id);
create index if not exists enrollments_cohort_id_idx on public.enrollments (cohort_id);
create index if not exists cohort_members_cohort_id_idx on public.cohort_members (cohort_id);
create index if not exists cohort_members_student_id_idx on public.cohort_members (student_id);
create index if not exists memberships_organization_id_idx on public.memberships (organization_id);
create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists guardian_links_guardian_id_idx on public.guardian_links (guardian_id);
create index if not exists guardian_links_student_id_idx on public.guardian_links (student_id);

-- Assessment / attempt / response / bank soal (policy guru + murid)
create index if not exists attempts_assessment_id_idx on public.attempts (assessment_id);
create index if not exists attempts_enrollment_id_idx on public.attempts (enrollment_id);
create index if not exists responses_attempt_id_idx on public.responses (attempt_id);
create index if not exists responses_question_version_id_idx on public.responses (question_version_id);
create index if not exists question_versions_question_id_idx on public.question_versions (question_id);
create index if not exists assessment_questions_assessment_id_idx on public.assessment_questions (assessment_id);
create index if not exists assessment_questions_question_version_id_idx on public.assessment_questions (question_version_id);
create index if not exists questions_organization_id_idx on public.questions (organization_id);
create index if not exists rubrics_organization_id_idx on public.rubrics (organization_id);
create index if not exists rubric_criteria_rubric_id_idx on public.rubric_criteria (rubric_id);