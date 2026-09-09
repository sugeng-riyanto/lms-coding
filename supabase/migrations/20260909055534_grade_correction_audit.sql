-- Alur koreksi nilai pasca-release: guru mengubah skor essay/file yang SUDAH
-- dinilai/finalized. Dua celah audit yang ditutup:
--
-- 1) grade_response_manual (quick grade) mencatat grade_revisions dengan
--    previous_score = NULL SELALU — bahkan saat mengoreksi nilai yang sudah ada,
--    sehingga jejak lama→baru hilang.
-- 2) quick grade tidak pernah menulis audit_logs (hanya rubric finalize yang
--    menulis audit). Koreksi nilai adalah keputusan yang harus bisa diaudit
--    (konstitusi: koreksi nilai menghasilkan revision/audit event).
--
-- Perbaikan:
-- - Tangkap v_prev = manual_score saat ini SEBELUM update; grade_revisions
--   mencatat previous = v_prev (NULL hanya untuk penilaian pertama).
-- - audit_logs: action 'grade.manual' saat penilaian pertama, 'grade.corrected'
--   saat nilai lama berubah (post-release correction). Keduanya menyertakan
--   skor lama → baru.
-- - Guard UNAUTHENTICATED / FORBIDDEN / INVALID_SCORE dan recompute attempt
--   (auto + manual, poin) dipertahankan — murid melihat skor terbaru.

create or replace function private.grade_response_manual(p_response_id uuid, p_manual_score numeric, p_feedback text)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt uuid;
  v_prev numeric;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select r.attempt_id into v_attempt from public.responses r where r.id = p_response_id;
  if v_attempt is null then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = v_attempt and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;
  if p_manual_score < 0 or p_manual_score > 100 then raise exception 'INVALID_SCORE'; end if;

  select r.manual_score, ch.organization_id into v_prev, v_org
  from public.responses r
  join public.attempts a on a.id = r.attempt_id
  join public.enrollments e on e.id = a.enrollment_id
  join public.cohorts ch on ch.id = e.cohort_id
  where r.id = p_response_id;

  update public.responses set manual_score = p_manual_score,
    feedback_json = jsonb_build_object('comment', p_feedback), updated_at = now()
  where id = p_response_id;

  -- Append-only: previous = nilai lama (NULL hanya penilaian pertama).
  insert into public.grade_revisions (attempt_id, previous_score, new_score, reason, changed_by)
  values (v_attempt, v_prev, p_manual_score, 'manual grade', auth.uid());

  -- Audit: penilaian pertama vs koreksi pasca-release dibedakan action-nya.
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, after_json)
  values (v_org, auth.uid(),
          case when v_prev is null or v_prev = p_manual_score then 'grade.manual' else 'grade.corrected' end,
          'response', p_response_id::text,
          jsonb_build_object('score', p_manual_score, 'previous', v_prev));

  -- Skor attempt ikut ter-recompute (auto + manual, dalam poin) — murid
  -- langsung melihat nilai terbaru di panel hasil / kelayakan sertifikat.
  perform private.recompute_attempt_score(v_attempt);
end;
$$;