-- Prompt 07: alert guru yang persisten (acknowledge/snooze/resolve + intervensi).
-- Sinyal dihitung live dari events/attempts; tabel ini menyimpan STATUS tindak lanjut.

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','acknowledged','snoozed','resolved')),
  snoozed_until timestamptz,
  resolved_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

create policy alerts_teacher_rw on public.alerts for all to authenticated
  using (cohort_id in (select private.teacher_cohort_ids()))
  with check (cohort_id in (select private.teacher_cohort_ids()));
