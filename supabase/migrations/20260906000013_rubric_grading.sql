-- Phase 4 manual assessment (lanjutan): versioned rubric & criteria, per-criterion
-- draft score + feedback, finalize → manual_score + grade_revision + audit.
--
-- Model:
--   rubrics(version, updated_at, created_by)  — root; naik versi tiap edit (immutable per versi)
--   rubric_criteria(position)                 — criteria MILIK versi rubrics saat ini
--   question_versions.rubric_id               — rubrik diikat ke versi soal (file/essay manual)
--   criterion_scores(response_id, criterion_id, score, feedback, draft)
--                                              — skor per-kriteria; draft=false = final
--
-- Alur: guru menyimpan skor per kriteria (draft) → semua kriteria final → RPC
-- finalize menghitung manual_score (0..100, bobot max_points) → tulis
-- grade_revisions (prev/new/actor) + audit_logs. Skor browser TIDAK dipakai;
-- RLS criterion_scores deny-by-default (tulis hanya lewat RPC security definer).

alter table public.rubrics
  add column version int not null default 1,
  add column created_by uuid references auth.users(id),
  add column updated_at timestamptz not null default now();

alter table public.rubric_criteria
  add column position int not null default 0;

alter table public.question_versions
  add column rubric_id uuid references public.rubrics(id);

-- Per-criterion score (append-only; tidak ada policy INSERT/UPDATE langsung).
create table public.criterion_scores (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria(id) on delete cascade,
  score numeric not null check (score >= 0),
  feedback text not null default '',
  draft boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (response_id, criterion_id)
);
alter table public.criterion_scores enable row level security;

-- Guru dari cohort attempt (yang response-nya) boleh MEMBACA skor kriteria.
create policy cscores_teacher_select on public.criterion_scores for select to authenticated
  using (exists (
    select 1 from public.responses r join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = criterion_scores.response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- Append-only: tolak hard-delete (selaras grade_revisions / audit_logs).
create rule no_delete_criterion_scores as on delete to public.criterion_scores do instead nothing;

-- Simpan skor satu kriteria (draft default). Validasi: guru cohort attempt,
-- kriteria milik rubrik yang SAMA dengan rubrik soal, skor <= max_points.
create or replace function private.save_criterion_grade(
  p_response_id uuid, p_criterion_id uuid, p_score numeric, p_feedback text, p_draft boolean
) returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt uuid;
  v_rubric_response uuid;
  v_rubric_criterion uuid;
  v_max numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_score < 0 then raise exception 'INVALID_SCORE'; end if;
  select r.attempt_id into v_attempt from public.responses r where r.id = p_response_id;
  if v_attempt is null then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = v_attempt and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  -- Rubrik soal (lewat question_versions.rubric_id) harus == rubrik kriteria.
  select qv.rubric_id into v_rubric_response
  from public.responses r join public.question_versions qv on qv.id = r.question_version_id
  where r.id = p_response_id;
  select cr.rubric_id, cr.max_points into v_rubric_criterion, v_max
  from public.rubric_criteria cr where cr.id = p_criterion_id;
  if v_rubric_response is null or v_rubric_criterion is distinct from v_rubric_response then
    raise exception 'RUBRIC_MISMATCH';
  end if;
  if p_score > v_max then raise exception 'SCORE_EXCEEDS_MAX'; end if;

  insert into public.criterion_scores (response_id, criterion_id, score, feedback, draft, created_by)
  values (p_response_id, p_criterion_id, p_score, coalesce(p_feedback, ''), coalesce(p_draft, true), auth.uid())
  on conflict (response_id, criterion_id) do update
    set score = excluded.score, feedback = excluded.feedback, draft = excluded.draft,
        updated_at = now();
end;
$$;

-- Finalize: semua kriteria rubrik soal harus sudah final (draft=false), lalu
-- manual_score = Σscore/Σmax_points × 100 (0..100). Menulis grade_revisions
-- (prev/new/actor/reason) + audit_logs. Idempoten: nilai sama → tanpa revisi baru.
create or replace function private.finalize_response_grades(p_response_id uuid)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt uuid;
  v_rubric uuid;
  v_total_max numeric := 0;
  v_total_score numeric := 0;
  v_prev numeric;
  v_pct numeric;
  v_open int;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select r.attempt_id into v_attempt from public.responses r where r.id = p_response_id;
  if v_attempt is null then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = v_attempt and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  select qv.rubric_id into v_rubric
  from public.responses r join public.question_versions qv on qv.id = r.question_version_id
  where r.id = p_response_id;
  if v_rubric is null then raise exception 'NO_RUBRIC'; end if;

  -- Semua kriteria rubrik harus punya skor final (draft=false).
  select count(*) into v_open
  from public.rubric_criteria cr
  where cr.rubric_id = v_rubric
    and not exists (
      select 1 from public.criterion_scores cs
      where cs.criterion_id = cr.id and cs.response_id = p_response_id and cs.draft = false
    );
  if v_open > 0 then raise exception 'DRAFT_INCOMPLETE'; end if;

  select coalesce(sum(cr.max_points), 0) into v_total_max
  from public.rubric_criteria cr where cr.rubric_id = v_rubric;
  select coalesce(sum(cs.score), 0) into v_total_score
  from public.criterion_scores cs join public.rubric_criteria cr on cr.id = cs.criterion_id
  where cs.response_id = p_response_id and cr.rubric_id = v_rubric and cs.draft = false;
  if v_total_max <= 0 then raise exception 'EMPTY_RUBRIC'; end if;
  v_pct := least(100, greatest(0, round((v_total_score / v_total_max) * 100, 2)));

  select manual_score into v_prev from public.responses where id = p_response_id;
  select ch.organization_id into v_org
  from public.attempts a join public.enrollments e on e.id = a.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where a.id = v_attempt;
  update public.responses set manual_score = v_pct, updated_at = now()
  where id = p_response_id;

  -- Revisi + audit HANYA bila nilai berubah (idempotent re-finalize).
  -- organization_id diisi agar audit_teacher_select (filter org) melihat baris.
  if v_prev is null or v_prev <> v_pct then
    insert into public.grade_revisions (attempt_id, previous_score, new_score, reason, changed_by)
    values (v_attempt, v_prev, v_pct, 'rubric finalized', auth.uid());
    insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, after_json)
    values (v_org, auth.uid(), 'grade.finalized', 'response', p_response_id::text,
            jsonb_build_object('score', v_pct, 'previous', v_prev));
  end if;
end;
$$;

revoke all on function private.save_criterion_grade(uuid, uuid, numeric, text, boolean) from public;
revoke all on function private.finalize_response_grades(uuid) from public;

-- public wrappers (caller check di dalam)
create or replace function public.save_criterion_grade(
  p_response_id uuid, p_criterion_id uuid, p_score numeric, p_feedback text default '', p_draft boolean default true
) returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.save_criterion_grade(p_response_id, p_criterion_id, p_score, p_feedback, p_draft); $$;
create or replace function public.finalize_response_grades(p_response_id uuid)
returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.finalize_response_grades(p_response_id); $$;