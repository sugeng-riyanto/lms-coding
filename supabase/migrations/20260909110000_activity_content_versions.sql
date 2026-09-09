-- Activity content versioning
-- Tracks all content changes with who changed what and when
-- Enables undo, restore, and audit trail for teacher content

create table public.activity_content_versions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  version_number int not null,
  content_json jsonb not null,
  title text not null,
  changed_by uuid not null references auth.users(id),
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (activity_id, version_number)
);

-- Index for fast version lookups
create index idx_activity_versions_activity on public.activity_content_versions(activity_id, version_number desc);

-- RLS policies
alter table public.activity_content_versions enable row level security;

-- Teachers can read versions of their own activities
create policy "teacher_select_activity_versions" on public.activity_content_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.activities a
      join public.lessons l on l.id = a.lesson_id
      join public.modules m on m.id = l.module_id
      join public.levels lv on lv.id = m.level_id
      join public.course_versions cv on cv.id = lv.course_version_id
      join public.courses c on c.id = cv.course_id
      where a.id = activity_content_versions.activity_id
        and c.teacher_id = auth.uid()
    )
  );

-- Teachers can insert new versions
create policy "teacher_insert_activity_versions" on public.activity_content_versions
  for insert to authenticated
  with check (
    changed_by = auth.uid() and
    exists (
      select 1 from public.activities a
      join public.lessons l on l.id = a.lesson_id
      join public.modules m on m.id = l.module_id
      join public.levels lv on lv.id = m.level_id
      join public.course_versions cv on cv.id = lv.course_version_id
      join public.courses c on c.id = cv.course_id
      where a.id = activity_content_versions.activity_id
        and c.teacher_id = auth.uid()
    )
  );

-- Function to create a new version when activity content changes
create or replace function public.create_activity_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
begin
  -- Get next version number
  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.activity_content_versions
  where activity_id = NEW.id;
  
  -- Only create version if content actually changed
  if OLD.content_json is distinct from NEW.content_json or OLD.title is distinct from NEW.title then
    insert into public.activity_content_versions (
      activity_id, version_number, content_json, title, changed_by, change_summary
    ) values (
      NEW.id, v_next_version, NEW.content_json, NEW.title, NEW.updated_by, 
      case 
        when OLD.title is distinct from NEW.title then 'Title updated'
        when OLD.content_json is distinct from NEW.content_json then 'Content updated'
        else 'Activity updated'
      end
    );
  end if;
  
  return NEW;
end;
$$;

-- Add updated_by column to activities if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'activities' and column_name = 'updated_by'
  ) then
    alter table public.activities add column updated_by uuid references auth.users(id);
  end if;
end $$;

-- Create trigger for automatic versioning
create trigger trigger_create_activity_version
  after update on public.activities
  for each row
  execute function public.create_activity_version();

-- Also create initial version for existing activities
insert into public.activity_content_versions (activity_id, version_number, content_json, title, changed_by, change_summary)
select 
  id, 
  1, 
  content_json, 
  title, 
  (select teacher_id from courses c join course_versions cv on cv.course_id = c.id join levels lv on lv.course_version_id = cv.id join modules m on m.level_id = lv.id join lessons l on l.module_id = m.id where l.id = lesson_id limit 1),
  'Initial version'
from public.activities
where not exists (
  select 1 from public.activity_content_versions where activity_id = activities.id
);
