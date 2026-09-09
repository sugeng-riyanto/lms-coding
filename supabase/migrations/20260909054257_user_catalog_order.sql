-- Preferensi urutan kartu katalog per pengguna per scope (RLS own-row).
-- RBAC: murid mengurutkan katalog yang mereka IKUTI (student_catalog);
--       guru mengurutkan daftar kursus yang mereka CREATE (teacher_courses).
-- Hanya preferensi penyajian pribadi — bukan data otoritatif; urutan kartu
-- tidak pernah menjadi dasar otorisasi (course_order hanya dipakai render).

create table if not exists public.user_catalog_order (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('student_catalog', 'teacher_courses')),
  course_order uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, scope)
);

alter table public.user_catalog_order enable row level security;

create policy user_catalog_order_own_select on public.user_catalog_order
  for select to authenticated
  using (user_id = auth.uid());

create policy user_catalog_order_own_insert on public.user_catalog_order
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_catalog_order_own_update on public.user_catalog_order
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_catalog_order_own_delete on public.user_catalog_order
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.user_catalog_order from anon;
revoke all on public.user_catalog_order from public;
grant select, insert, update, delete on public.user_catalog_order to authenticated;