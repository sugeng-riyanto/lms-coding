-- Autonomous Learning LMS — initial schema
-- NOTE: Supabase CLI tidak tersedia di environment build ini (tanpa docker),
-- sehingga file ini ditulis manual dengan format timestamp standar
-- YYYYMMDDHHMMSS_description.sql. Regenerasi via `supabase migration new init`
-- saat CLI tersedia, lalu diff sebelum apply ke preview/production.
-- Timezone: UTC di DB; Asia/Jakarta hanya presentasi.

create extension if not exists "pgcrypto";

-- ============ helpers: caller role (server-controlled, bukan user_metadata) ============
create schema if not exists private;

create or replace function private.caller_membership_ids()
returns table (organization_id uuid, role text)
language sql stable security definer
set search_path = private, public, pg_temp
as $$
  select m.organization_id, m.role
  from public.memberships m
  where m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function private.is_teacher_of(org uuid)
returns boolean
language sql stable security definer
set search_path = private, public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.organization_id = org
      and m.role = 'teacher' and m.status = 'active'
  );
$$;

-- teacher cohorts yang diajar
create or replace function private.teacher_cohort_ids()
returns setof uuid
language sql stable security definer
set search_path = private, public, pg_temp
as $$
  select c.id from public.cohorts c
  join public.memberships m on m.organization_id = c.organization_id
  where m.user_id = auth.uid() and m.role = 'teacher' and m.status = 'active'
    and c.teacher_id = auth.uid();
$$;

revoke all on schema private from public;
revoke all on function private.caller_membership_ids() from public;
revoke all on function private.is_teacher_of(uuid) from public;
revoke all on function private.teacher_cohort_ids() from public;
grant usage on schema private to authenticated;

-- ============ identity & tenancy ============
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  display_name text not null,
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','student','guardian')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  teacher_id uuid not null references auth.users(id),
  name text not null,
  academic_year text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cohort_members (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  primary key (cohort_id, student_id)
);

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (guardian_id, student_id)
);

-- ============ content (versioned) ============
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  owner_id uuid not null references auth.users(id),
  slug text not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  version int not null check (version >= 1),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, version)
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references public.course_versions(id) on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  passing_score numeric not null default 70 check (passing_score between 0 and 100),
  mastery_threshold numeric not null default 0.7 check (mastery_threshold between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_version_id, position)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  estimated_minutes int not null default 15 check (estimated_minutes >= 0),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position int not null check (position >= 0),
  type text not null check (type in ('article','video_link','resource','reflection','quiz','assignment_upload','roblox_challenge')),
  title text not null,
  content_json jsonb not null default '{}',
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position)
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.activity_competencies (
  activity_id uuid not null references public.activities(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  weight numeric not null default 1 check (weight >= 0),
  primary key (activity_id, competency_id)
);

create table public.prerequisites (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  required_type text not null,
  required_id uuid not null,
  rule_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============ enrollment & learning ============
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  student_id uuid not null references auth.users(id),
  cohort_id uuid not null references public.cohorts(id),
  status text not null default 'active' check (status in ('active','suspended','completed')),
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, student_id, cohort_id)
);

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid not null references auth.users(id),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  occurred_at timestamptz not null default now(),
  client_event_id text not null,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (student_id, client_event_id)
);

create table public.progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  status text not null,
  percent numeric not null default 0 check (percent between 0 and 100),
  mastery numeric not null default 0 check (mastery between 0 and 1),
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, entity_type, entity_id)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds int not null default 0 check (active_seconds >= 0),
  created_at timestamptz not null default now()
);

-- ============ assessment ============
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  settings_json jsonb not null default '{}',
  total_points numeric not null default 0 check (total_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  type text not null,
  prompt_json jsonb not null,
  explanation_json jsonb not null default '{}',
  difficulty text not null default 'medium',
  created_at timestamptz not null default now()
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version int not null check (version >= 1),
  grading_json jsonb not null,
  points numeric not null check (points >= 0),
  created_at timestamptz not null default now(),
  unique (question_id, version)
);

create table public.assessment_questions (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id),
  position int not null check (position >= 0),
  points numeric not null check (points >= 0),
  primary key (assessment_id, question_version_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id),
  enrollment_id uuid not null references public.enrollments(id),
  attempt_no int not null check (attempt_no >= 1),
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  raw_score numeric check (raw_score between 0 and 100),
  final_score numeric check (final_score between 0 and 100),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, assessment_id, attempt_no)
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id),
  answer_json jsonb,
  auto_score numeric check (auto_score between 0 and 100),
  manual_score numeric check (manual_score between 0 and 100),
  feedback_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_version_id)
);

create table public.grade_revisions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  previous_score numeric,
  new_score numeric,
  reason text not null,
  changed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null,
  created_at timestamptz not null default now()
);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id) on delete cascade,
  title text not null,
  max_points numeric not null check (max_points >= 0),
  created_at timestamptz not null default now()
);

-- ============ certificates & ops ============
create table public.chain_anchors (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  network text not null,
  transaction_ref text,
  merkle_root text not null,
  status text not null default 'pending',
  anchored_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  enrollment_id uuid not null references public.enrollments(id),
  level_id uuid not null references public.levels(id),
  serial_no text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  payload_json jsonb not null,
  payload_hash text not null,
  pdf_path text,
  qr_path text,
  chain_anchor_id uuid references public.chain_anchors(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, level_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  payload_json jsonb not null default '{}',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  before_json jsonb,
  after_json jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

-- ============ RLS: enable everywhere ============
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
alter table public.guardian_links enable row level security;
alter table public.courses enable row level security;
alter table public.course_versions enable row level security;
alter table public.levels enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.activities enable row level security;
alter table public.competencies enable row level security;
alter table public.activity_competencies enable row level security;
alter table public.prerequisites enable row level security;
alter table public.enrollments enable row level security;
alter table public.learning_events enable row level security;
alter table public.progress_snapshots enable row level security;
alter table public.study_sessions enable row level security;
alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.question_versions enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.grade_revisions enable row level security;
alter table public.rubrics enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.certificates enable row level security;
alter table public.chain_anchors enable row level security;
alter table public.jobs enable row level security;
alter table public.audit_logs enable row level security;

-- ============ RLS policies (deny-by-default + least privilege) ============
-- profiles: own read; teacher reads students of own cohorts
create policy profiles_own_select on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_teacher_select on public.profiles for select to authenticated
  using (exists (
    select 1 from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    where cm.student_id = profiles.id and c.teacher_id = auth.uid()
  ));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships: own read only (role resolution via security-definer helpers)
create policy memberships_own_select on public.memberships for select to authenticated
  using (user_id = auth.uid());

-- enrollments: student sees own active; teacher manages own cohorts
create policy enrollments_student_select on public.enrollments for select to authenticated
  using (student_id = auth.uid());
create policy enrollments_teacher_select on public.enrollments for select to authenticated
  using (cohort_id in (select private.teacher_cohort_ids()));
create policy enrollments_teacher_insert on public.enrollments for insert to authenticated
  with check (cohort_id in (select private.teacher_cohort_ids()));
create policy enrollments_teacher_update on public.enrollments for update to authenticated
  using (cohort_id in (select private.teacher_cohort_ids()))
  with check (cohort_id in (select private.teacher_cohort_ids()));

-- cohorts: teacher own; student member read
create policy cohorts_teacher_select on public.cohorts for select to authenticated
  using (teacher_id = auth.uid());
create policy cohorts_member_select on public.cohorts for select to authenticated
  using (exists (select 1 from public.cohort_members cm where cm.cohort_id = cohorts.id and cm.student_id = auth.uid()));
create policy cohorts_teacher_update on public.cohorts for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- courses: teacher own org; student only with active enrollment (via course_versions chain enforced in app + policy)
create policy courses_teacher_all on public.courses for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy courses_student_select on public.courses for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.course_id = courses.id and e.student_id = auth.uid() and e.status = 'active'
  ));

-- attempts: student own; teacher of cohort; NO direct update of scores by student (update policy hanya teacher)
create policy attempts_student_select on public.attempts for select to authenticated
  using (exists (select 1 from public.enrollments e where e.id = attempts.enrollment_id and e.student_id = auth.uid()));
create policy attempts_student_insert on public.attempts for insert to authenticated
  with check (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));
create policy attempts_teacher_select on public.attempts for select to authenticated
  using (exists (
    select 1 from public.enrollments e where e.id = attempts.enrollment_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));
create policy attempts_teacher_update on public.attempts for update to authenticated
  using (exists (
    select 1 from public.enrollments e where e.id = attempts.enrollment_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ))
  with check (exists (
    select 1 from public.enrollments e where e.id = attempts.enrollment_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- responses: same ownership as attempts (tanpa answer key ke murid sebelum release → kolom grading disembunyikan via view)
create policy responses_owner_select on public.responses for select to authenticated
  using (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = responses.attempt_id
      and (e.student_id = auth.uid() or e.cohort_id in (select private.teacher_cohort_ids()))
  ));
create policy responses_student_insert on public.responses for insert to authenticated
  with check (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = attempt_id and e.student_id = auth.uid() and a.status = 'in_progress'
  ));
create policy responses_teacher_update on public.responses for update to authenticated
  using (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = responses.attempt_id and e.cohort_id in (select private.teacher_cohort_ids())
  ))
  with check (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = responses.attempt_id and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- learning_events: student insert own; teacher read own cohorts
create policy events_student_insert on public.learning_events for insert to authenticated
  with check (student_id = auth.uid());
create policy events_student_select on public.learning_events for select to authenticated
  using (student_id = auth.uid());
create policy events_teacher_select on public.learning_events for select to authenticated
  using (exists (
    select 1 from public.enrollments e where e.id = learning_events.enrollment_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- certificates: student own download; teacher manage own cohorts; NO delete
create policy certs_student_select on public.certificates for select to authenticated
  using (exists (select 1 from public.enrollments e where e.id = certificates.enrollment_id and e.student_id = auth.uid()));
create policy certs_teacher_all on public.certificates for all to authenticated
  using (exists (
    select 1 from public.enrollments e where e.id = certificates.enrollment_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ))
  with check (exists (
    select 1 from public.enrollments e where e.id = certificates.enrollment_id
      and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- guardian: hanya via active link
create policy guardian_links_own on public.guardian_links for select to authenticated
  using (guardian_id = auth.uid() and status = 'active');

-- audit_logs & grade_revisions & jobs: read teacher own org / insert via functions; no update/delete
create policy audit_teacher_select on public.audit_logs for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = 'teacher' and m.status = 'active'
      and m.organization_id = audit_logs.organization_id
  ));
create policy revisions_reader_select on public.grade_revisions for select to authenticated
  using (exists (
    select 1 from public.attempts a join public.enrollments e on e.id = a.enrollment_id
    where a.id = grade_revisions.attempt_id
      and (e.student_id = auth.uid() or e.cohort_id in (select private.teacher_cohort_ids()))
  ));

-- anti hard-delete: tolak DELETE pada tabel audit-append-only
create rule no_delete_attempts as on delete to public.attempts do instead nothing;
create rule no_delete_revisions as on delete to public.grade_revisions do instead nothing;
create rule no_delete_certs as on delete to public.certificates do instead nothing;
create rule no_delete_audit as on delete to public.audit_logs do instead nothing;

-- ============ public verifier view (security_invoker, minimal PII) ============
create or replace view public.certificates_public
with (security_invoker = true) as
select
  c.public_id,
  c.status,
  p.display_name,
  co.title as course_title,
  l.title as level_title,
  c.issued_at,
  c.serial_no,
  c.payload_hash,
  (c.chain_anchor_id is not null) as chain_anchored
from public.certificates c
join public.enrollments e on e.id = c.enrollment_id
join public.profiles p on p.id = e.student_id
join public.courses co on co.id = e.course_id
join public.levels l on l.id = c.level_id
where c.status in ('active','revoked');

-- ============ privileged functions (schema private) ============
create or replace function private.finalize_attempt(p_attempt_id uuid, p_idempotency_key text)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_enrollment uuid;
  v_student uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select a.enrollment_id into v_enrollment from public.attempts a where a.id = p_attempt_id;
  if v_enrollment is null then raise exception 'NOT_FOUND'; end if;
  select e.student_id into v_student from public.enrollments e where e.id = v_enrollment;
  -- hanya pemilik attempt atau guru cohort yang boleh finalize
  if v_student <> auth.uid() and not exists (
    select 1 from public.enrollments e
    where e.id = v_enrollment and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;

  update public.attempts
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_attempt_id and status = 'in_progress';
  -- scoring objektif + agregasi dikerjakan job recompute (idempotent) agar transaction kecil.
end;
$$;

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
end;
$$;

create or replace function private.issue_certificate(p_enrollment_id uuid, p_level_id uuid, p_idempotency_key text)
returns uuid
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  -- eligibility dievaluasi server (disederhanakan di migration; full evaluator di lib/mastery + job)
  insert into public.certificates (public_id, enrollment_id, level_id, serial_no, payload_json, payload_hash)
  values (
    replace(gen_random_uuid()::text, '-', ''),
    p_enrollment_id, p_level_id,
    'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6),
    jsonb_build_object('enrollmentId', p_enrollment_id, 'levelId', p_level_id),
    encode(digest(p_enrollment_id::text || p_level_id::text || now()::text, 'sha256'), 'hex')
  )
  on conflict (enrollment_id, level_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.revoke_certificate(p_certificate_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (
    select 1 from public.certificates c join public.enrollments e on e.id = c.enrollment_id
    where c.id = p_certificate_id and e.cohort_id in (select private.teacher_cohort_ids())
  ) then raise exception 'FORBIDDEN'; end if;
  update public.certificates set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = p_certificate_id and status = 'active';
  insert into public.audit_logs (actor_id, action, target_type, target_id, after_json)
  values (auth.uid(), 'certificate.revoked', 'certificate', p_certificate_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- public wrappers (caller check di dalam)
create or replace function public.finalize_attempt(p_attempt_id uuid, p_idempotency_key text)
returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.finalize_attempt(p_attempt_id, p_idempotency_key); $$;
create or replace function public.grade_response_manual(p_response_id uuid, p_manual_score numeric, p_feedback text)
returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.grade_response_manual(p_response_id, p_manual_score, p_feedback); $$;
create or replace function public.issue_certificate(p_enrollment_id uuid, p_level_id uuid, p_idempotency_key text)
returns uuid language sql security definer set search_path = private, public, pg_temp
as $$ select private.issue_certificate(p_enrollment_id, p_level_id, p_idempotency_key); $$;
create or replace function public.revoke_certificate(p_certificate_id uuid, p_reason text)
returns void language sql security definer set search_path = private, public, pg_temp
as $$ select private.revoke_certificate(p_certificate_id, p_reason); $$;

revoke all on function public.finalize_attempt(uuid, text) from public;
revoke all on function public.grade_response_manual(uuid, numeric, text) from public;
revoke all on function public.issue_certificate(uuid, uuid, text) from public;
revoke all on function public.revoke_certificate(uuid, text) from public;
grant execute on function public.finalize_attempt(uuid, text) to authenticated;
grant execute on function public.grade_response_manual(uuid, numeric, text) to authenticated;
grant execute on function public.issue_certificate(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_certificate(uuid, text) to authenticated;
