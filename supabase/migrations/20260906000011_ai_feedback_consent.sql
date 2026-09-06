-- Phase 4 KURANG: AI draft feedback dengan consent config
-- (rencana docs/plan-ai-draft-feedback-consent.md; ADR-014/015/017).
--
-- 1) Consent per-org (ADR-014): kolom organizations.ai_feedback_consent
--    (default FALSE = fail closed) + ai_feedback_consent_at. Hanya guru
--    teacher AKTIF org yang bisa mengubah via private.set_org_ai_consent
--    (audit 'org.ai_consent').
-- 2) ai_feedback_drafts (ADR-015): draft AI TIDAK pernah ditulis ke
--    responses.feedback_json sebelum approval — tabel terpisah, RLS hanya
--    guru cohort response, TANPA policy murid/anon, tanpa hard delete.
-- 3) RPC definer (pola reissue/revoke): caller check + search_path tetap;
--    provider AI hanya dipanggil dari server action (ADR-017) — migration
--    ini hanya penyimpanan/persetujuan.

alter table public.organizations
  add column if not exists ai_feedback_consent boolean not null default false,
  add column if not exists ai_feedback_consent_at timestamptz;

create table public.ai_feedback_drafts (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null unique references public.responses(id) on delete cascade,
  body text not null,
  model text not null,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

alter table public.ai_feedback_drafts enable row level security;

-- Guru yang mengajar cohort dari response (via attempts -> enrollments).
-- Helper private.teacher_cohort_ids() security-definer (000008) dipakai
-- policy — TANPA RLS recursion.
create policy ai_drafts_teacher_select on public.ai_feedback_drafts for select to authenticated
  using (exists (
    select 1 from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = ai_feedback_drafts.response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));
create policy ai_drafts_teacher_insert on public.ai_feedback_drafts for insert to authenticated
  with check (exists (
    select 1 from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = ai_feedback_drafts.response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));
-- UPDATE wajib USING + WITH CHECK (aturan keamanan Phase 1).
create policy ai_drafts_teacher_update on public.ai_feedback_drafts for update to authenticated
  using (exists (
    select 1 from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = ai_feedback_drafts.response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ))
  with check (exists (
    select 1 from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = ai_feedback_drafts.response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- Tanpa hard delete (append-only jejak keputusan guru).
create rule no_delete_ai_drafts as on delete to public.ai_feedback_drafts do instead nothing;

-- ============ RPC: consent per-org (ADR-014) ============
create or replace function private.set_org_ai_consent(
  p_org_id uuid,
  p_consent boolean
)
returns boolean
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_before boolean;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  -- Hanya guru teacher AKTIF dari org tersebut.
  if not exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = 'teacher'
      and m.status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;

  select ai_feedback_consent into v_before from public.organizations where id = p_org_id;
  if v_before is null then raise exception 'NOT_FOUND'; end if;

  -- organizations TIDAK punya kolom updated_at (lihat DDL init) — hanya
  -- consent + timestamp; audit via audit_logs.
  update public.organizations
  set ai_feedback_consent = p_consent,
      ai_feedback_consent_at = case when p_consent then now() else ai_feedback_consent_at end
  where id = p_org_id;

  insert into public.audit_logs
    (organization_id, actor_id, action, target_type, target_id, before_json, after_json)
  values (
    p_org_id, auth.uid(), 'org.ai_consent', 'organization', p_org_id::text,
    jsonb_build_object('consent', v_before),
    jsonb_build_object('consent', p_consent)
  );
  return true;
end;
$$;

-- ============ RPC: upsert draft (satu draft per response) ============
create or replace function private.upsert_ai_draft(
  p_response_id uuid,
  p_body text,
  p_model text
)
returns uuid
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (
    select 1 from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = p_response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  insert into public.ai_feedback_drafts (response_id, body, model, status, created_by)
  values (p_response_id, p_body, p_model, 'draft', auth.uid())
  on conflict (response_id) do update
    set body = excluded.body,
        model = excluded.model,
        status = 'draft',
        created_by = auth.uid(),
        created_at = now(),
        approved_at = null,
        approved_by = null
  returning id into v_id;
  return v_id;
end;
$$;

-- ============ RPC: approve (AI draft -> feedback final + audit revisi) ============
-- Menulis feedback ke responses.feedback_json HANYA lewat persetujuan guru
-- eksplisit (ADR-015); dicatat sebagai grade_revisions reason
-- 'ai_draft:approved' (audit append-only) dan draft ditandai approved.
create or replace function private.apply_ai_feedback(
  p_response_id uuid,
  p_feedback text
)
returns boolean
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_attempt uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (
    select 1 from public.responses r
    join public.attempts a on a.id = r.attempt_id
    join public.enrollments e on e.id = a.enrollment_id
    where r.id = p_response_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  select attempt_id into v_attempt from public.responses where id = p_response_id;
  if v_attempt is null then raise exception 'NOT_FOUND'; end if;

  -- Merge (jangan timpa feedback manual guru): key 'ai_approved' berisi body+at.
  update public.responses
  set feedback_json = coalesce(feedback_json, '{}'::jsonb)
        || jsonb_build_object('ai_approved', jsonb_build_object('body', p_feedback, 'at', now()::text)),
      updated_at = now()
  where id = p_response_id;

  update public.ai_feedback_drafts
  set status = 'approved', approved_at = now(), approved_by = auth.uid()
  where response_id = p_response_id;

  insert into public.grade_revisions (attempt_id, previous_score, new_score, reason, changed_by)
  select v_attempt, r.manual_score, r.manual_score, 'ai_draft:approved', auth.uid()
  from public.responses r where r.id = p_response_id;

  return true;
end;
$$;

-- ============ Wrapper public + grants (pola issue/revoke/reissue) ============
create or replace function public.set_org_ai_consent(p_org_id uuid, p_consent boolean)
returns boolean
language sql security definer set search_path = private, public, pg_temp
as $$ select private.set_org_ai_consent(p_org_id, p_consent); $$;

create or replace function public.upsert_ai_draft(p_response_id uuid, p_body text, p_model text)
returns uuid
language sql security definer set search_path = private, public, pg_temp
as $$ select private.upsert_ai_draft(p_response_id, p_body, p_model); $$;

create or replace function public.apply_ai_feedback(p_response_id uuid, p_feedback text)
returns boolean
language sql security definer set search_path = private, public, pg_temp
as $$ select private.apply_ai_feedback(p_response_id, p_feedback); $$;

revoke all on function public.set_org_ai_consent(uuid, boolean) from public;
revoke all on function public.upsert_ai_draft(uuid, text, text) from public;
revoke all on function public.apply_ai_feedback(uuid, text) from public;
grant execute on function public.set_org_ai_consent(uuid, boolean) to authenticated;
grant execute on function public.upsert_ai_draft(uuid, text, text) to authenticated;
grant execute on function public.apply_ai_feedback(uuid, text) to authenticated;