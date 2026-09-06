import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Static DB advisor: gate murah sebelum `supabase db lint` (butuh docker/CLI). */
const dir = "supabase/migrations";
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n");
const errors = [];

// 1. Semua tabel public harus RLS
const created = [...sql.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]);
for (const t of new Set(created)) {
  if (!new RegExp(`alter table public\\.${t} enable row level security`, "i").test(sql)) {
    errors.push(`missing RLS: ${t}`);
  }
}
// 2. Secret tidak boleh di migration
if (/service_role|secret_key|sb_secret/i.test(sql)) errors.push("possible secret in migration");
// 3. View harus security_invoker
const views = [...sql.matchAll(/create .*? view public\.(\w+)([\s\S]*?);/gi)];
for (const [, name, body] of views) {
  if (!/security_invoker\s*=\s*true/i.test(body)) errors.push(`view ${name} missing security_invoker=true`);
}
// 4. Function private harus set search_path
const fns = [...sql.matchAll(/create or replace function private\.(\w+)[\s\S]*?set search_path/gi)];
if (fns.length < 4) errors.push("expected privileged functions with fixed search_path");

if (errors.length > 0) {
  console.error("DB advisor FAILED:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`DB advisor OK (${created.length} tables, ${views.length} views checked).`);
