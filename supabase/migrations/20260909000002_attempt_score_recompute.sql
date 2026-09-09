-- Defect live: nilai manual (quick grade ATAU rubric) tidak pernah masuk ke
-- attempts.final_score — murid melihat skor AUTO saja meski guru sudah menilai
-- essay. Dampak: (a) panel hasil murid salah; (b) kelayakan sertifikat yang
-- membaca attempts.final_score (quiz 100% / ujian >= 70%) tidak pernah terpenuhi
-- untuk asesmen ber-essay.
--
-- Perbaikan:
-- 1) private.recompute_attempt_score(p_attempt_id) — hitung ulang raw/final
--    dari responses (earned = min(auto_score + manual_score, points) per soal,
--    SAMA dgn lib/grading.ts questionScore), hormati subset soal randomisasi
--    (attempts.question_order_json.order) seperti submitAttempt.
-- 2) grade_response_manual (quick grade) — setelah manual_score disimpan,
--    panggil recompute (manual_score sudah dalam POIN soal sejak awal).
-- 3) finalize_response_grades (rubric) — manual_score kini disimpan dalam POIN
--    soal (pct% × question_versions.points), bukan persen 0-100, agar konsisten
--    dengan auto_score (poin) dan questionScore. Sebelumnya manual_score=90
--    (persen) dicampur dengan auto_score=10 (poin) → hasil tak koheren.
--    Recompute attempt setelahnya. Guard DRAFT_INCOMPLETE / RUBRIC_MISMATCH /
--    EMPTY_RUBRIC dipertahankan; grade_revisions + audit tetap append-only.

create or replace function private.recompute_attempt_score(p_attempt_id uuid)
returns numeric
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt record;
  v_order_ids uuid[];
  v_link record;
  v_resp record;
  v_qp numeric;
  v_total numeric := 0;
  v_earned numeric := 0;
  v_percent numeric;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if v_attempt.id is null then raise exception 'NOT_FOUND'; end if;

  -- Asesmen yang di-randomisasi (question_order_json.order) hanya menilai
  -- subset pool yang di-roll SERVER saat startAttempt — sama dengan submitAttempt.
  if v_attempt.question_order_json is not null
     and jsonb_typeof(v_attempt.question_order_json -> 'order') = 'array'
     and jsonb_array_length(v_attempt.question_order_json -> 'order') > 0 then
    select array(
      select jsonb_array_elements_text(v_attempt.question_order_json -> 'order')::uuid
    ) into v_order_ids;
  end if;

  for v_link in
    select aq.question_version_id, aq.points
    from public.assessment_questions aq
    where aq.assessment_id = v_attempt.assessment_id
      and (v_order_ids is null or aq.question_version_id = any (v_order_ids))
  loop
    select r.auto_score, r.manual_score into v_resp
    from public.responses r
    where r.attempt_id = p_attempt_id
      and r.question_version_id = v_link.question_version_id
    limit 1;
    v_qp := coalesce(v_link.points, 0);
    v_total := v_total + v_qp;
    -- questionScore: min(auto + manual, points), floor 0. Auto/manual sama-sama POIN.
    v_earned := v_earned
      + greatest(0, least(v_qp, coalesce(v_resp.auto_score, 0) + coalesce(v_resp.manual_score, 0)));
  end loop;

  if v_total <= 0 then v_percent := 0;
  else
    v_percent := least(100, greatest(0, round((v_earned / v_total) * 100, 2)));
  end if;

  update public.attempts
     set raw_score = v_percent, final_score = v_percent, updated_at = now()
   where id = p_attempt_id;
  return v_percent;
end;
$$;

revoke all on function private.recompute_attempt_score(uuid) from public;

-- ── quick grade: nilai manual dalam POIN soal (semantik lama dipertahankan) ──
create or replace function private.grade_response_manual(p_response_id uuid, p_manual_score numeric, p_feedback text)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select r.attempt_id into v_attempt from public.responses r where r.id = p_response_id;
  if v_attempt is null then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = v_attempt and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;
  if p_manual_score < 0 or p_manual_score > 100 then raise exception 'INVALID_SCORE'; end if;
  update public.responses set manual_score = p_manual_score,
    feedback_json = jsonb_build_object('comment', p_feedback), updated_at = now()
  where id = p_response_id;
  insert into public.grade_revisions (attempt_id, previous_score, new_score, reason, changed_by)
  values (v_attempt, null, p_manual_score, 'manual grade', auth.uid());
  -- Defect fix: skor attempt ikut ter-recompute (auto + manual, dalam poin).
  perform private.recompute_attempt_score(v_attempt);
end;
$$;

-- ── rubric grade: manual_score disimpan dalam POIN soal + recompute attempt ──
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
  v_manual_points numeric;
  v_qv_points numeric;
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

  -- Defect fix: manual_score disimpan dalam POIN soal (konsisten dgn auto_score),
  -- bukan persen 0-100 yang dicampur dengan poin.
  select qv.points into v_qv_points
  from public.responses r join public.question_versions qv on qv.id = r.question_version_id
  where r.id = p_response_id;
  v_manual_points := round((v_pct / 100) * coalesce(v_qv_points, 0), 2);

  select manual_score into v_prev from public.responses where id = p_response_id;
  select ch.organization_id into v_org
  from public.attempts a join public.enrollments e on e.id = a.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where a.id = v_attempt;
  update public.responses set manual_score = v_manual_points, updated_at = now()
  where id = p_response_id;

  if v_prev is null or v_prev <> v_manual_points then
    insert into public.grade_revisions (attempt_id, previous_score, new_score, reason, changed_by)
    values (v_attempt, v_prev, v_manual_points, 'rubric finalized', auth.uid());
    insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, after_json)
    values (v_org, auth.uid(), 'grade.finalized', 'response', p_response_id::text,
            jsonb_build_object('score', v_manual_points, 'previous', v_prev, 'percent', v_pct));
  end if;

  -- Defect fix: skor attempt ikut ter-recompute (auto + manual, dalam poin).
  perform private.recompute_attempt_score(v_attempt);
end;
$$;

-- Wrapper publik tetap (tidak berubah) — hanya body private yang diperbarui.
create or replace function public.grade_response_manual(p_response_id uuid, p_manual_score numeric, p_feedback text)
returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.grade_response_manual(p_response_id, p_manual_score, p_feedback); $$;
create or replace function public.finalize_response_grades(p_response_id uuid)
returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.finalize_response_grades(p_response_id); $$;

revoke all on function public.grade_response_manual(uuid, numeric, text) from public;
revoke all on function public.finalize_response_grades(uuid) from public;
grant execute on function public.grade_response_manual(uuid, numeric, text) to authenticated;
grant execute on function public.finalize_response_grades(uuid) to authenticated;