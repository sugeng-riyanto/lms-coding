-- CSP events persistence: replaces in-memory ring buffer for multi-instance and restart-safe alerting.
-- Only the service client (server-only) inserts/reads; no user-facing RLS access.

create table public.csp_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('violation', 'blocked')),
  recorded_at timestamptz not null default now(),
  -- No URI, no script-sample, no PII — aggregate only (DEPLOYMENT.md §7.3).
  created_at timestamptz not null default now()
);

-- Index for the 60-second rolling window query (the hot path).
create index idx_csp_events_recorded_at on public.csp_events (recorded_at desc);

-- Index for the nightly digest (24h range).
create index idx_csp_events_kind_recorded on public.csp_events (kind, recorded_at);

alter table public.csp_events enable row level security;

-- Only service-role can insert (the report endpoint uses createServiceClient).
-- No user-facing policies — anon/authenticated get zero rows via RLS.
create policy csp_events_service_insert on public.csp_events
  for insert to service_role
  with check (true);

create policy csp_events_service_select on public.csp_events
  for select to service_role
  using (true);

-- Nightly digest view: aggregates 24h of events by kind.
-- Exposed via a security-definer RPC that only teachers can call.
create or replace view public.csp_events_daily_digest with (security_invoker = false) as
  select
    kind,
    count(*) as event_count,
    date_trunc('hour', recorded_at) as hour_bucket
  from public.csp_events
  where recorded_at > now() - interval '24 hours'
  group by kind, date_trunc('hour', recorded_at)
  order by hour_bucket asc;

-- Nightly digest RPC: returns 24h aggregate for teachers.
-- Security-definer + search_path pinned; EXECUTE revoked from PUBLIC.
create or replace function private.get_csp_daily_digest()
returns jsonb
language plpgsql
security definer
set search_path = private
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_teacher boolean;
  result jsonb;
begin
  -- Caller must be a teacher (same guard as /api/operator/csp-alerts).
  select exists(
    select 1 from public.memberships
    where user_id = v_user_id and role = 'teacher' and status = 'active'
  ) into v_is_teacher;

  if not v_is_teacher then
    raise exception 'FORBIDDEN: not a teacher';
  end if;

  select jsonb_build_object(
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'hour', to_char(hour_bucket, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'kind', kind,
        'count', event_count
      )), '[]'::jsonb)
      from public.csp_events_daily_digest
    ),
    'total_24h', (
      select count(*)::int from public.csp_events
      where recorded_at > now() - interval '24 hours'
    ),
    'total_violations_24h', (
      select count(*)::int from public.csp_events
      where kind = 'violation' and recorded_at > now() - interval '24 hours'
    ),
    'total_blocked_24h', (
      select count(*)::int from public.csp_events
      where kind = 'blocked' and recorded_at > now() - interval '24 hours'
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function private.get_csp_daily_digest() from public;
grant execute on function private.get_csp_daily_digest() to authenticated;
