-- Activity comments for teacher-student discussion
create table public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_activity_comments_activity on public.activity_comments(activity_id, created_at);

-- RLS for comments
alter table public.activity_comments enable row level security;

-- Anyone enrolled in the course can read comments
create policy "enrolled_read_comments" on public.activity_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.activities a
      join public.lessons l on l.id = a.lesson_id
      join public.modules m on m.id = l.module_id
      join public.levels lv on lv.id = m.level_id
      join public.course_versions cv on cv.id = lv.course_version_id
      join public.courses c on c.id = cv.course_id
      join public.enrollments e on e.course_id = c.id
      where a.id = activity_comments.activity_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    ) or exists (
      select 1 from public.activities a
      join public.lessons l on l.id = a.lesson_id
      join public.modules m on m.id = l.module_id
      join public.levels lv on lv.id = m.level_id
      join public.course_versions cv on cv.id = lv.course_version_id
      join public.courses c on c.id = cv.course_id
      where a.id = activity_comments.activity_id
        and c.owner_id = auth.uid()
    )
  );

-- Enrolled users can post comments
create policy "enrolled_insert_comments" on public.activity_comments
  for insert to authenticated
  with check (
    user_id = auth.uid() and
    (
      exists (
        select 1 from public.activities a
        join public.lessons l on l.id = a.lesson_id
        join public.modules m on m.id = l.module_id
        join public.levels lv on lv.id = m.level_id
        join public.course_versions cv on cv.id = lv.course_version_id
        join public.courses c on c.id = cv.course_id
        join public.enrollments e on e.course_id = c.id
        where a.id = activity_comments.activity_id
          and e.student_id = auth.uid()
          and e.status = 'active'
      ) or exists (
        select 1 from public.activities a
        join public.lessons l on l.id = a.lesson_id
        join public.modules m on m.id = l.module_id
        join public.levels lv on lv.id = m.level_id
        join public.course_versions cv on cv.id = lv.course_version_id
        join public.courses c on c.id = cv.course_id
        where a.id = activity_comments.activity_id
          and c.owner_id = auth.uid()
      )
    )
  );

-- Enable realtime for comments
alter publication supabase_realtime add table public.activity_comments;

-- Intervention queue for at-risk students
create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id),
  cohort_id uuid not null references public.cohorts(id),
  teacher_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('none', 'pending', 'in_progress', 'resolved')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, cohort_id)
);

-- RLS for interventions
alter table public.interventions enable row level security;

-- Teachers can manage interventions for their cohorts
create policy "teacher_manage_interventions" on public.interventions
  for all to authenticated
  using (
    teacher_id = auth.uid() and
    exists (
      select 1 from public.cohorts c
      where c.id = interventions.cohort_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
  );

-- Teachers can read interventions for their cohorts
create policy "teacher_select_interventions" on public.interventions
  for select to authenticated
  using (
    exists (
      select 1 from public.cohorts c
      where c.id = interventions.cohort_id
        and c.teacher_id = auth.uid()
    )
  );
