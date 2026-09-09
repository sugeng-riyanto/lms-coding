import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Server-authoritative randomized pool roll (migration 20260909061251).
 *
 * Static evidence that:
 * 1. private.xmur3 / private.roll_pool port lib/shuffle.ts (xmur3 +
 *    mulberry32 + Fisher–Yates + pickPool) — same deterministic algorithm,
 *    so a stored seed reproduces the exact rolled order in JS.
 * 2. The BEFORE INSERT trigger `attempts_server_roll` overwrites any
 *    client-supplied question_order_json:
 *    - randomize=true  → server roll { seed, order: pickPool(pool, poolSize) }
 *    - randomize=false → question_order_json forced NULL (no pool slicing /
 *      reordering by students).
 * 3. Functions are private with EXECUTE revoked from PUBLIC; the trigger
 *    function is SECURITY DEFINER with a pinned search_path.
 */
const migration = readFileSync("supabase/migrations/20260909061251_server_roll_randomized_pool.sql", "utf8");

describe("server-authoritative randomized pool roll", () => {
  it("ports xmur3 exactly as lib/shuffle.ts (mod 2^32 arithmetic)", () => {
    expect(migration).toMatch(/create or replace function private\.xmur3\(p_input text\) returns bigint/);
    expect(migration).toMatch(/\(1779033703 # length\(p_input\)\)::bigint/);
    expect(migration).toMatch(/3432918353/);
    expect(migration).toMatch(/2246822507/);
    expect(migration).toMatch(/3266489909/);
  });

  it("ports mulberry32 + Fisher–Yates + pickPool with the same constants", () => {
    expect(migration).toMatch(/create or replace function private\.roll_pool\(p_seed text, p_ids uuid\[\], p_size int\) returns jsonb/);
    expect(migration).toMatch(/1831565813/); // 0x6d2b79f5
    expect(migration).toMatch(/b'00000000000000000000000000111101'/); // 61 | t
    expect(migration).toMatch(/arr\[1:take\]/);
  });

  it("creates the BEFORE INSERT trigger that overrides client question_order_json", () => {
    expect(migration).toMatch(/create or replace function private\.attempts_server_roll\(\) returns trigger/);
    expect(migration).toMatch(/security definer/);
    expect(migration).toMatch(/set search_path = private, public, pg_temp/);
    expect(migration).toMatch(/drop trigger if exists attempts_server_roll on public\.attempts/);
    expect(migration).toMatch(/create trigger attempts_server_roll\s+before insert on public\.attempts/);
  });

  it("rolls server-side for randomize=true and NULLs for non-randomized assessments", () => {
    expect(migration).toMatch(/v_randomize := coalesce\(\(v_settings->>'randomize'\)::boolean, false\)/);
    expect(migration).toMatch(/NEW\.question_order_json := null;/);
    expect(migration).toMatch(/gen_random_bytes\(16\)/);
    expect(migration).toMatch(/private\.roll_pool\(v_seed, v_ids, v_pool_size\)/);
  });

  it("keeps everything private with EXECUTE revoked from PUBLIC", () => {
    expect(migration).toMatch(/revoke all on function private\.xmur3\(text\) from public/);
    expect(migration).toMatch(/revoke all on function private\.roll_pool\(text, uuid\[\], int\) from public/);
    expect(migration).toMatch(/revoke all on function private\.attempts_server_roll\(\) from public/);
  });
});