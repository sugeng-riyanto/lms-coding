-- Messages table for teacher-student messaging
-- Teachers can send to students in their cohorts/courses
-- Students can read messages addressed to them and reply

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  enrollment_id uuid references public.enrollments(id), -- optional: link to specific course context
  subject text not null default '',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index for fast inbox queries
create index idx_messages_recipient on public.messages(recipient_id, created_at desc);
create index idx_messages_sender on public.messages(sender_id, created_at desc);
create index idx_messages_enrollment on public.messages(enrollment_id) where enrollment_id is not null;

-- RLS policies
alter table public.messages enable row level security;

-- Teacher can send messages to students in their courses
create policy "teacher_insert_messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      where e.student_id = messages.recipient_id
        and c.teacher_id = auth.uid()
    )
  );

-- Teacher can read messages they sent or received
create policy "teacher_select_messages" on public.messages
  for select to authenticated
  using (
    sender_id = auth.uid() or
    (recipient_id = auth.uid() and exists (
      select 1 from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      where e.student_id = messages.sender_id
        and c.teacher_id = auth.uid()
    ))
  );

-- Teacher can mark messages as read
create policy "teacher_update_messages" on public.messages
  for update to authenticated
  using (
    recipient_id = auth.uid() and exists (
      select 1 from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      where e.student_id = messages.sender_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    recipient_id = auth.uid()
  );

-- Student can read messages sent to them
create policy "student_select_messages" on public.messages
  for select to authenticated
  using (
    recipient_id = auth.uid() or
    sender_id = auth.uid()
  );

-- Student can reply (send messages to their teachers)
create policy "student_insert_messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      where e.student_id = auth.uid()
        and c.teacher_id = messages.recipient_id
    )
  );

-- Student can mark messages as read
create policy "student_update_messages" on public.messages
  for update to authenticated
  using (
    recipient_id = auth.uid()
  )
  with check (
    recipient_id = auth.uid()
  );

-- Enable Realtime for messages table
alter publication supabase_realtime add table public.messages;
