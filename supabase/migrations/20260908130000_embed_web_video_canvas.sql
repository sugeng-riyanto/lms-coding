-- 20260908130000 — Embed web/video + kanvas anotasi sains/math.
--
-- Bagian A: tipe aktivitas baru untuk media kaya (materi & kuis):
--   embed_web    — iframe generic HANYA host allowlist (PhET, oPhysics, Drive)
--   embed_video  — Google Drive preview (iframe) atau file video langsung
-- Validasi URL/host di lib/content-blocks.ts (single source); rendering di
-- components/media-embed.tsx (EmbedWeb/EmbedVideo). Tidak ada HTML arbitrer.
--
-- Bagian B: kanvas anotasi untuk jawaban/umpan balik (sains & math).
-- Murid menggambar jawabannya (author_role='student') pada butir esai; guru
-- melihat kanvas murid + menggambar umpan balik (author_role='teacher').
-- Kunci (attempt_id, question_version_id, author_role) — satu kanvas per peran.
-- Strokes disanitasi server (lib/canvas.ts); RLS membatasi per peran.

-- ---------- Bagian A: tipe aktivitas ----------
alter table public.activities drop constraint activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in (
    'article','video_link','resource','reflection','quiz',
    'assignment_upload','roblox_challenge',
    'code_board','embed_youtube','embed_pdf','embed_audio','embed_file',
    'embed_web','embed_video'
  ));

-- ---------- Bagian B: kanvas anotasi ----------
create table public.canvas_annotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  author_role text not null check (author_role in ('student','teacher')),
  strokes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_version_id, author_role)
);

comment on table public.canvas_annotations is
  'Kanvas anotasi per (attempt, soal, peran). Murid: jawaban coretan sains/math. '
  'Guru: umpan balik. Strokes divalidasi server (lib/canvas.ts).';

alter table public.canvas_annotations enable row level security;

-- SELECT: murid pemilik attempt / guru cohort enrollment-nya.
create policy canvas_student_select on public.canvas_annotations for select to authenticated
  using (exists (
    select 1 from public.attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = canvas_annotations.attempt_id
      and e.student_id = auth.uid()
  ));

create policy canvas_teacher_select on public.canvas_annotations for select to authenticated
  using (exists (
    select 1 from public.attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = canvas_annotations.attempt_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- INSERT/UPDATE murid: attempt in_progress MILIK murid, peran student saja.
create policy canvas_student_insert on public.canvas_annotations for insert to authenticated
  with check (
    author_role = 'student'
    and exists (
      select 1 from public.attempts a
      join public.enrollments e on e.id = a.enrollment_id
      where a.id = attempt_id
        and e.student_id = auth.uid()
        and a.status = 'in_progress'
    )
  );

create policy canvas_student_update on public.canvas_annotations for update to authenticated
  using (exists (
    select 1 from public.attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = canvas_annotations.attempt_id
      and e.student_id = auth.uid()
      and a.status = 'in_progress'
  ))
  with check (
    author_role = 'student'
    and exists (
      select 1 from public.attempts a
      join public.enrollments e on e.id = a.enrollment_id
      where a.id = attempt_id
        and e.student_id = auth.uid()
        and a.status = 'in_progress'
    )
  );

-- INSERT/UPDATE guru: cohort guru (private.teacher_cohort_ids), peran teacher.
create policy canvas_teacher_insert on public.canvas_annotations for insert to authenticated
  with check (
    author_role = 'teacher'
    and exists (
      select 1 from public.attempts a
      join public.enrollments e on e.id = a.enrollment_id
      where a.id = attempt_id
        and e.cohort_id in (select private.teacher_cohort_ids())
    )
  );

create policy canvas_teacher_update on public.canvas_annotations for update to authenticated
  using (exists (
    select 1 from public.attempts a
    join public.enrollments e on e.id = a.enrollment_id
    where a.id = canvas_annotations.attempt_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ))
  with check (
    author_role = 'teacher'
    and exists (
      select 1 from public.attempts a
      join public.enrollments e on e.id = a.enrollment_id
      where a.id = attempt_id
        and e.cohort_id in (select private.teacher_cohort_ids())
    )
  );

-- Tidak ada policy DELETE: kanvas adalah jejak kerja (audit), bukan hard-delete.