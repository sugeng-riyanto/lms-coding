-- Prompt 10 Tahap B: append-only receipts event Roblox + replay protection.
-- Ditulis via service key (server-to-server); tanpa policy authenticated.

create table public.roblox_receipts (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  nonce text not null unique,
  place_id text not null,
  roblox_user_id text not null,
  challenge_id uuid not null,
  score numeric not null check (score between 0 and 100),
  issued_at timestamptz not null,
  enrollment_id uuid references public.enrollments(id),
  created_at timestamptz not null default now()
);

alter table public.roblox_receipts enable row level security;
-- Sengaja tanpa policy untuk authenticated: baca/tulis hanya service role.
