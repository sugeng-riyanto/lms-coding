-- Defect live: assessments.total_points tidak pernah dihitung ulang setelah
-- addQuestionToAssessment — publish validation membaca kolom ini dan menolak
-- quiz yang sebenarnya sudah punya soal (INVALID_POINTS, total 0).
-- Solusi server-side: trigger AFTER INSERT/UPDATE/DELETE pada assessment_questions
-- yang menulis ulang assessments.total_points (security definer agar UPDATE
-- internal tidak terhalang RLS; search_path dipatok; tidak callable oleh PUBLIC).

create or replace function private.recompute_assessment_total_points()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  v_assessment_id uuid;
  v_total numeric;
begin
  v_assessment_id := coalesce(new.assessment_id, old.assessment_id);
  if v_assessment_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(aq.points), 0)
    into v_total
    from public.assessment_questions aq
   where aq.assessment_id = v_assessment_id;

  update public.assessments
     set total_points = v_total,
         updated_at = now()
   where id = v_assessment_id;

  return coalesce(new, old);
end;
$$;

revoke all on function private.recompute_assessment_total_points() from public;

drop trigger if exists trg_assessment_total_points on public.assessment_questions;
create trigger trg_assessment_total_points
  after insert or update or delete on public.assessment_questions
  for each row execute function private.recompute_assessment_total_points();

-- Backfill baris yang sudah ada (smoke rows dan quiz demo yang totalnya masih 0).
update public.assessments a
   set total_points = coalesce((
         select sum(aq.points)
           from public.assessment_questions aq
          where aq.assessment_id = a.id
       ), 0),
       updated_at = now()
 where a.total_points = 0
   and exists (
     select 1 from public.assessment_questions aq
      where aq.assessment_id = a.id
   );