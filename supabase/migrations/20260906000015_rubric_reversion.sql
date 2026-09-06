-- Re-versi rubrik: mengedit rubrik yang SUDAH terpasang cukup menaikkan
-- rubrics.version + menyalin kriteria (bukan wajib versi soal baru).
--
--   rubric_criteria.version        — kriteria milik versi rubrik tertentu (baru)
--   finalize_response_grades       — kini memakai kriteria versi SAAT INI saja
--   update_rubric_version(...)     — atomik: naik versi + tulis criteria baru;
--                                    kriteria lama DI-PERTAHANKAN (FK
--                                    criterion_scores, riwayat draf/nilai).

alter table public.rubric_criteria
  add column version int not null default 1;

-- Finalize versi aktif: kriteria harus dari versi rubrik sekarang.
create or replace function private.finalize_response_grades(p_response_id uuid)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt uuid;
  v_rubric uuid;
  v_version int;
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
  select version into v_version from public.rubrics where id = v_rubric;
  if v_version is null then raise exception 'NO_RUBRIC'; end if;

  -- Semua kriteria VERSI AKTIF harus punya skor final (draft=false).
  select count(*) into v_open
  from public.rubric_criteria cr
  where cr.rubric_id = v_rubric and cr.version = v_version
    and not exists (
      select 1 from public.criterion_scores cs
      where cs.criterion_id = cr.id and cs.response_id = p_response_id and cs.draft = false
    );
  if v_open > 0 then raise exception 'DRAFT_INCOMPLETE'; end if;

  select coalesce(sum(cr.max_points), 0) into v_total_max
  from public.rubric_criteria cr
  where cr.rubric_id = v_rubric and cr.version = v_version;
  select coalesce(sum(cs.score), 0) into v_total_score
  from public.criterion_scores cs
  join public.rubric_criteria cr on cr.id = cs.criterion_id
  where cs.response_id = p_response_id and cr.rubric_id = v_rubric and cr.version = v_version
    and cs.draft = false;
  if v_total_max <= 0 then raise exception 'EMPTY_RUBRIC'; end if;
  v_pct := least(100, greatest(0, round((v_total_score / v_total_max) * 100, 2)));

  select manual_score into v_prev from public.responses where id = p_response_id;
  select ch.organization_id into v_org
  from public.attempts a join public.enrollments e on e.id = a.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where a.id = v_attempt;
  update public.responses set manual_score = v_pct, updated_at = now()
  where id = p_response_id;

  if v_prev is null or v_prev <> v_pct then
    insert into public.grade_revisions (attempt_id, previous_score, new_score, reason, changed_by)
    values (v_attempt, v_prev, v_pct, 'rubric finalized', auth.uid());
    insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, after_json)
    values (v_org, auth.uid(), 'grade.finalized', 'response', p_response_id::text,
            jsonb_build_object('score', v_pct, 'previous', v_prev));
  end if;
end;
$$;

-- Atomik re-versi rubrik: p_criteria = JSON array [{title,maxPoints}].
-- Kriteria lama dipertahankan (riwayat); versi rubrik naik; criteria baru
-- ditulis dengan version = versi baru. Kembalikan nomor versi baru.
create or replace function private.update_rubric_version(
  p_rubric_id uuid, p_title text, p_criteria jsonb
) returns int
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_org uuid;
  v_new int;
  v_row record;
  v_n int;
  v_title text;
  v_max numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select organization_id into v_org from public.rubrics where id = p_rubric_id;
  if v_org is null then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.organization_id = v_org
      and m.role = 'teacher' and m.status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;

  if jsonb_typeof(p_criteria) <> 'array' or jsonb_array_length(p_criteria) < 1 then
    raise exception 'INVALID_CRITERIA';
  end if;
  v_n := 0;
  for v_row in select value from jsonb_array_elements(p_criteria) loop
    v_title := trim(both ' ' from coalesce(v_row.value ->> 'title', ''));
    v_max := (v_row.value ->> 'maxPoints')::numeric;
    if v_title = '' or char_length(v_title) > 200 or v_max is null
       or not (v_max > 0) or v_max > 1000 then
      raise exception 'INVALID_CRITERIA';
    end if;
    v_n := v_n + 1;
  end loop;
  if v_n < 1 then raise exception 'INVALID_CRITERIA'; end if;

  -- Kunci baris rubrik lalu naik versi.
  select version + 1 into v_new
  from public.rubrics where id = p_rubric_id for update;
  update public.rubrics set version = v_new, title = coalesce(trim(both ' ' from p_title), title),
    updated_at = now()
  where id = p_rubric_id;

  insert into public.rubric_criteria (rubric_id, title, max_points, position, version)
  select p_rubric_id, trim(both ' ' from value ->> 'title'),
         (value ->> 'maxPoints')::numeric, ord - 1, v_new
  from jsonb_array_elements(p_criteria) with ordinality as t(value, ord);
  return v_new;
end;
$$;

revoke all on function private.update_rubric_version(uuid, text, jsonb) from public;

create or replace function public.update_rubric_version(p_rubric_id uuid, p_title text, p_criteria jsonb)
returns int language sql security definer set search_path = private, public, pg_temp
as $$ select private.update_rubric_version(p_rubric_id, p_title, p_criteria); $$;