-- Phase 3: Intervention queue workflow
-- Extends alerts with assignment, due dates, follow-up, and reopening.
-- Adds notifications table for in-app alerts.

-- 1. Extend alerts table
alter table public.alerts
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists due_at timestamptz,
  add column if not exists follow_up_assessment_id uuid references public.assessments(id) on delete set null,
  add column if not exists escalation_level smallint not null default 0;

-- Update status CHECK to include 'reopened'
alter table public.alerts drop constraint if exists alerts_status_check;
alter table public.alerts add constraint alerts_status_check
  check (status in ('open','acknowledged','snoozed','resolved','reopened'));

-- 2. Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Owner-only RLS: users see only their own notifications
create policy notifications_owner_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy notifications_owner_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid());

create policy notifications_owner_update on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- 3. Indexes for common queries
create index if not exists idx_alerts_assigned_to on public.alerts(assigned_to) where assigned_to is not null;
create index if not exists idx_alerts_due_at on public.alerts(due_at) where due_at is not null and status in ('open','acknowledged','snoozed');
create index if not exists idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
