-- Spaced repetition scheduling for quiz review items
-- Uses SM-2 algorithm: interval adjusts based on quality of recall (0-5)
-- Students see questions due for review at optimal intervals

create table public.spaced_repetition (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id),
  question_version_id uuid not null references public.question_versions(id),
  enrollment_id uuid not null references public.enrollments(id),
  
  -- SM-2 parameters
  easiness_factor numeric not null default 2.5,  -- EF >= 1.3, starts at 2.5
  interval_days int not null default 0,           -- days until next review
  repetition_count int not null default 0,        -- successful reviews in a row
  next_review_at timestamptz not null default now(),  -- when to review next
  last_review_at timestamptz,                     -- last review timestamp
  last_quality smallint check (last_quality between 0 and 5),  -- last quality rating
  
  -- Performance tracking
  total_reviews int not null default 0,
  correct_count int not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- One record per student per question per enrollment
  unique (student_id, question_version_id, enrollment_id)
);

-- Indexes for fast due-for-review queries
-- Note: cannot use now() in partial index predicate (volatile), so plain index.
create index idx_sr_next_review on public.spaced_repetition(next_review_at);
create index idx_sr_student_enrollment on public.spaced_repetition(student_id, enrollment_id);
create index idx_sr_student_question on public.spaced_repetition(student_id, question_version_id);

-- RLS policies
alter table public.spaced_repetition enable row level security;

-- Students can read their own spaced repetition records
create policy "student_select_sr" on public.spaced_repetition
  for select to authenticated
  using (student_id = auth.uid());

-- Students can insert new records (when they answer a question)
create policy "student_insert_sr" on public.spaced_repetition
  for insert to authenticated
  with check (student_id = auth.uid());

-- Students can update their own records (after reviewing)
create policy "student_update_sr" on public.spaced_repetition
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Teachers can read spaced repetition data for students in their cohorts
create policy "teacher_select_sr" on public.spaced_repetition
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      where e.student_id = spaced_repetition.student_id
        and c.teacher_id = auth.uid()
    )
  );

-- Function to update spaced repetition after a review (SM-2 algorithm)
create or replace function public.update_spaced_repetition(
  p_student_id uuid,
  p_question_version_id uuid,
  p_enrollment_id uuid,
  p_quality smallint  -- 0-5: 0=complete blackout, 5=perfect recall
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.spaced_repetition%rowtype;
  v_new_ef numeric;
  v_new_interval int;
  v_new_rep_count int;
  v_next_review timestamptz;
begin
  -- Get current record or create new one
  SELECT * INTO v_current
  FROM public.spaced_repetition
  WHERE student_id = p_student_id
    AND question_version_id = p_question_version_id
    AND enrollment_id = p_enrollment_id;
  
  IF NOT FOUND THEN
    -- Create new record
    INSERT INTO public.spaced_repetition (
      student_id, question_version_id, enrollment_id,
      easiness_factor, interval_days, repetition_count,
      next_review_at, last_quality, total_reviews, correct_count
    ) VALUES (
      p_student_id, p_question_version_id, p_enrollment_id,
      CASE WHEN p_quality >= 3 THEN 2.5 ELSE 2.0 END,  -- EF
      CASE WHEN p_quality >= 3 THEN 1 ELSE 0 END,      -- interval
      CASE WHEN p_quality >= 3 THEN 1 ELSE 0 END,      -- rep count
      now() + CASE WHEN p_quality >= 3 THEN interval '1 day' ELSE interval '0' END,
      p_quality,
      1,
      CASE WHEN p_quality >= 3 THEN 1 ELSE 0 END
    );
    RETURN;
  END IF;
  
  -- SM-2 Algorithm
  -- Quality: 0=blackout, 1=wrong, 2=hard, 3=good, 4=easy, 5=perfect
  
  -- Update easiness factor: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  v_new_ef := v_current.easiness_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
  IF v_new_ef < 1.3 THEN v_new_ef := 1.3; END IF;
  
  -- Update repetition count and interval
  IF p_quality < 3 THEN
    -- Failed recall: reset to beginning
    v_new_rep_count := 0;
    v_new_interval := 0;
  ELSE
    -- Successful recall
    v_new_rep_count := v_current.repetition_count + 1;
    CASE v_new_rep_count
      WHEN 1 THEN v_new_interval := 1;
      WHEN 2 THEN v_new_interval := 6;
      ELSE v_new_interval := round(v_current.interval_days * v_new_ef)::int;
    END CASE;
  END IF;
  
  -- Calculate next review time
  v_next_review := now() + (v_new_interval || ' days')::interval;
  
  -- Update the record
  UPDATE public.spaced_repetition
  SET easiness_factor = v_new_ef,
      interval_days = v_new_interval,
      repetition_count = v_new_rep_count,
      next_review_at = v_next_review,
      last_review_at = now(),
      last_quality = p_quality,
      total_reviews = total_reviews + 1,
      correct_count = correct_count + CASE WHEN p_quality >= 3 THEN 1 ELSE 0 END,
      updated_at = now()
  WHERE id = v_current.id;
END;
$$;

-- Grant execute to authenticated users (students update their own records via RLS)
grant execute on function public.update_spaced_repetition(uuid, uuid, uuid, smallint) to authenticated;
