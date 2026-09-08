-- Per-user UI language preference (full English / full Indonesian) applied to
-- every RBAC surface. Default 'id' keeps current users on Bahasa Indonesia;
-- switching is a self-service action (RLS profiles_own_update already guards
-- own-row updates, so no new policy is needed).

alter table public.profiles
  add column language text not null default 'id'
  check (language in ('id', 'en'));