-- Prompt: target mingguan & spaced review eksplisit (KURANG Phase 3) — MVP.
-- 1) weekly_plans : target mingguan per enrollment (unit = completions dulu;
--    'minutes' disiapkan untuk saat write path study_sessions hadir).
-- 2) review_items : antrian retrieval practice 1/3/7/14 hari (LEARNING_ENGINE.md).
--
-- Keputusan yang dipakai:
-- - Tanpa hard delete: TIDAK ADA policy delete → DELETE ditolak RLS untuk semua
--   role; hanya transisi status (scheduled → completed/dismissed).
-- - Tanpa trigger DB: baris dibuat lazy/get-or-create di server code.
-- - Policy memakai lookup satu arah ke enrollments (pola sama dengan
--   progress_snapshots 000004 yang sudah live-tested 38/38) — tidak ada jalur
--   referensi balik ke tabel baru, sehingga bebas siklus recursion (pelajaran
--   migration 000008).
-- - Guru read-only di MVP; guardian read belum termasuk scope.

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  week_start date not null, -- Senin minggu ISO, dihitung dalam timezone org
  goal_unit text not null default 'completions' check (goal_unit in ('completions','minutes')),
  goal_value int not null default 3 check (goal_value between 1 and 50),
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, week_start)
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  entity_type text not null check (entity_type in ('level')),
  entity_id uuid not null,
  due_at timestamptz not null,
  interval_idx int not null default 1 check (interval_idx >= 1),
  status text not null default 'scheduled' check (status in ('scheduled','completed','dismissed')),
  confidence int check (confidence between 1 and 5),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu antrian aktif per (enrollment, entity): mencegah duplikat saat
-- recompute/hook dijalankan ulang.
create unique index review_items_one_active
  on public.review_items (enrollment_id, entity_type, entity_id)
  where status = 'scheduled';

alter table public.weekly_plans enable row level security;
alter table public.review_items enable row level security;

-- ============ weekly_plans ============
-- Murid: baris enrollment-nya sendiri yang aktif (select/insert/update,
-- tanpa delete).
create policy weekly_plans_student_select on public.weekly_plans for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = weekly_plans.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

create policy weekly_plans_student_insert on public.weekly_plans for insert to authenticated
  with check (exists (
    select 1 from public.enrollments e
    where e.id = weekly_plans.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

create policy weekly_plans_student_update on public.weekly_plans for update to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = weekly_plans.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ))
  with check (exists (
    select 1 from public.enrollments e
    where e.id = weekly_plans.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

-- Guru: baca target cohort yang dia ampu (read-only di MVP).
create policy weekly_plans_teacher_select on public.weekly_plans for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = weekly_plans.enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ));

-- ============ review_items ============
-- Murid: antrian enrollment sendiri (scheduled → completed/dismissed).
create policy review_items_student_select on public.review_items for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = review_items.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

create policy review_items_student_insert on public.review_items for insert to authenticated
  with check (exists (
    select 1 from public.enrollments e
    where e.id = review_items.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

create policy review_items_student_update on public.review_items for update to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = review_items.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ))
  with check (exists (
    select 1 from public.enrollments e
    where e.id = review_items.enrollment_id and e.student_id = auth.uid() and e.status = 'active'
  ));

-- Guru: baca antrian cohort yang dia ampu (read-only di MVP).
create policy review_items_teacher_select on public.review_items for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = review_items.enrollment_id and e.cohort_id in (select private.teacher_cohort_ids())
  ));
