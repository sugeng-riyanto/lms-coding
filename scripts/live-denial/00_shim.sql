-- Shim Supabase-on-plain-Postgres (HANYA untuk live RLS/denial tests).
-- Meniru permukaan yang dipakai migration: role anon/authenticated,
-- auth.uid() membaca GUC request.jwt.claims, auth.users/identities minimal,
-- storage.buckets/objects + storage.foldername(), pgcrypto di schema extensions.
-- BUKAN instance Supabase: tidak ada GoTrue/PostgREST — denial diuji via
-- SET ROLE + set_config('request.jwt.claims', ...) pada Postgres sungguhan.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Wrapper public.digest agar fungsi security-definer (search_path private,public)
-- tetap bisa memanggil digest() tanpa mengubah migration.
create or replace function public.digest(text, text) returns bytea
language sql stable as $$ select extensions.digest($1, $2) $$;
grant execute on function public.digest(text, text) to anon, authenticated;

-- ============ auth shim ============
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

-- ============ storage shim ============
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(path text) returns text[]
language sql immutable
as $$ select string_to_array(path, '/') $$;

grant usage on schema storage to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on function storage.foldername(text) to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
