-- CSP digest view: security_invoker = true (constitution: "View yang terekspos
-- harus security_invoker = true"). The view lives in the exposed schema but is
-- only consumed by the security-definer RPC private.get_csp_daily_digest(),
-- which runs as the function owner; setting security_invoker means direct reads
-- by anon/authenticated are subject to the underlying csp_events RLS (zero rows
-- without service_role) — defense in depth, same posture as certificates_public.

create or replace view public.csp_events_daily_digest with (security_invoker = true) as
  select
    kind,
    count(*) as event_count,
    date_trunc('hour', recorded_at) as hour_bucket
  from public.csp_events
  where recorded_at > now() - interval '24 hours'
  group by kind, date_trunc('hour', recorded_at)
  order by hour_bucket asc;