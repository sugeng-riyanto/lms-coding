-- Prompt 03 lanjutan: kolom objective agar publish validation bisa lolos.
-- Objective terukur adalah syarat publish (EMPTY_OBJECTIVE).

alter table public.levels add column if not exists objective text not null default '';
alter table public.lessons add column if not exists objective text not null default '';
