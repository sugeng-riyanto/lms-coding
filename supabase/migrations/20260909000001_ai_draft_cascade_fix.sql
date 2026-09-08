-- Replace no_delete_ai_drafts RULE with a trigger-based guard.
--
-- Problem: the ON DELETE DO INSTEAD NOTHING rule on ai_feedback_drafts
-- silently swallows ALL deletes, including CASCADE deletes from the parent
-- responses table. This makes response cleanup impossible without
-- SET session_replication_role = replica — a dangerous superuser workaround.
--
-- Solution: drop the rule, add a BEFORE DELETE trigger that only blocks
-- direct deletes (pg_trigger_depth() = 0) while allowing cascade deletes
-- (pg_trigger_depth() > 0) from the parent responses table. The FK ON DELETE
-- CASCADE now works as intended, and the append-only audit trail is preserved
-- for application-level deletes.

-- 1. Drop the old rule.
drop rule if exists no_delete_ai_drafts on public.ai_feedback_drafts;

-- 2. Create the guard function in private schema.
create or replace function private.block_direct_ai_draft_delete()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  -- pg_trigger_depth() = 0 → direct DELETE FROM ai_feedback_drafts (block).
  -- pg_trigger_depth() > 0 → CASCADE from responses DELETE (allow).
  if pg_trigger_depth() = 0 then
    raise exception 'ai_feedback_drafts is append-only: direct DELETE is not allowed (use soft-delete or status change instead).';
  end if;
  return old;
end;
$$;

-- 3. Attach the trigger.
create trigger guard_ai_draft_delete
  before delete on public.ai_feedback_drafts
  for each row
  execute function private.block_direct_ai_draft_delete();

-- 4. Verify: the FK ON DELETE CASCADE on ai_feedback_drafts.response_id
--    should now work without session_replication_role = replica.
--    (Verified by integration test in tests/integration/ai-feedback-cascade.test.ts)
