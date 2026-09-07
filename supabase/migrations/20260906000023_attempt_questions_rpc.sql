-- 000023 — RPC tersanitasi untuk menyajikan soal attempt ke murid pemilik.
--
-- Defect (ditemukan via smoke live di hosted): halaman kuis selalu KOSONG untuk
-- murid. `getAttemptQuestions` membaca `assessment_questions` → `question_versions`
-- → `questions` dengan strict client (RLS user), tetapi kedua tabel soal HANYA
-- punya policy teacher (`questions_teacher_rw`, `qversions_teacher_rw` — perlindungan
-- kunci jawaban). Akibatnya murid mendapat 0 baris: seluruh loop study
-- (jawab → submit → nilai) mati di UI, untuk SEMUA konten, bukan hanya seed.
--
-- Perbaikan (pola khas repo: private definer + public wrapper + revoke/grant,
-- seperti finalize_attempt/issue_certificate): RPC security definer yang
-- mengembalikan HANYA kolom tersanitasi (id versi, position, points, type,
-- prompt_json) untuk attempt `in_progress` MILIK caller. `grading_json` dan
-- `explanation_json` TIDAK PERNAH masuk return type — kunci jawaban tidak bisa
-- bocor lewat jalur ini apa pun isi barisnya. Policy teacher-only pada tabel
-- soal TETAP (tidak diubah): guru membaca bank via RLS seperti semula.
-- Server action `getAttemptQuestions` kini memanggil RPC ini (satu round trip,
-- tanpa N+1), lalu mengurutkan via `question_order_json` di TS seperti semula.

create or replace function private.get_attempt_questions(p_attempt_id uuid)
returns table(
  question_version_id uuid,
  "position" int,
  points numeric,
  qtype text,
  prompt_json jsonb
)
language sql security definer set search_path = private, public, pg_temp as $$
  with att as (
    select a.assessment_id
    from public.attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = p_attempt_id
      and e.student_id = auth.uid()
      and a.status = 'in_progress'
  )
  select aq.question_version_id, aq.position, aq.points, q.type, q.prompt_json
  from att
  join public.assessment_questions aq on aq.assessment_id = att.assessment_id
  join public.question_versions qv on qv.id = aq.question_version_id
  join public.questions q on q.id = qv.question_id
  order by aq.position;
$$;

-- Wrapper publik tipis (caller check di dalam fungsi private).
create or replace function public.get_attempt_questions(p_attempt_id uuid)
returns table(
  question_version_id uuid,
  "position" int,
  points numeric,
  qtype text,
  prompt_json jsonb
)
language sql security definer set search_path = private, public, pg_temp
as $$ select * from private.get_attempt_questions(p_attempt_id); $$;

revoke all on function private.get_attempt_questions(uuid) from public;
revoke all on function public.get_attempt_questions(uuid) from public;
grant execute on function public.get_attempt_questions(uuid) to authenticated;
