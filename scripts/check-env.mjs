#!/usr/bin/env node
// check-env.mjs — self-check struktural file env (dijalankan via predev/prebuild/prestart).
//
// Mencegah korupsi ala paste onboarding: key DUPLIKAT (last-wins menimpa nilai
// asli), key yang TIDAK dibaca aplikasi (mis. SUPABASE_URL polos, host/port/
// database/user dari halaman Connect), dan baris bukan KEY=value (prosa
// tutorial, code block, backtick).
//
// Daftar key yang SAH tidak di-hardcode di sini — diambil dari `.env.example`
// (template = satu sumber kebenaran). Bila file target tidak ada (mis. CI
// clean checkout yang memakai env dari runner), check di-skip, tidak gagal.
//
// Pakai: node scripts/check-env.mjs [file...]   (default: .env)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EXAMPLE = join(ROOT, ".env.example");

/** Kumpulkan nama key dari baris KEY=value; abaikan komentar/prosa. */
function parseKeys(src) {
  const keys = [];
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function lintFile(file, allowed) {
  const problems = [];
  if (!existsSync(file)) {
    return { ok: true, checked: false, problems };
  }
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const seen = new Map(); // key -> [lineNo, ...]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, "");
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (m) {
      const key = m[1];
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(i + 1);
      if (!allowed.has(key)) {
        problems.push(
          `${file}:${i + 1}: key tak dikenal '${key}' — aplikasi tidak membaca key ini. ` +
            `Gunakan nama persis dari .env.example (mis. NEXT_PUBLIC_SUPABASE_URL, bukan SUPABASE_URL).`,
        );
      }
    } else {
      problems.push(`${file}:${i + 1}: baris bukan KEY=value (terlihat paste/prosa): "${t.slice(0, 100)}"`);
    }
  }
  for (const [key, nos] of seen) {
    if (nos.length > 1) {
      problems.push(
        `${file}: key duplikat '${key}' pada baris ${nos.join(", ")} — nilai TERAKHIR menang ` +
          `(last-wins) dan bisa menimpa nilai asli. Sisakan satu kemunculan saja.`,
      );
    }
  }
  return { ok: problems.length === 0, checked: true, problems };
}

const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [".env"];

if (!existsSync(EXAMPLE)) {
  console.error(`check-env: .env.example tidak ditemukan (${EXAMPLE}) — template wajib ada.`);
  process.exit(1);
}
const allowed = new Set(parseKeys(readFileSync(EXAMPLE, "utf8")));

const results = targets.map((f) => lintFile(f, allowed));
const problems = results.flatMap((r) => r.problems);
const checked = results.filter((r) => r.checked);

if (problems.length > 0) {
  console.error("ENV FILE CHECK FAILED — perbaiki struktur file env (lihat panduan di header .env.example):");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "Cek cepat: grep -c '^[A-Z]' <file> (harus 9 untuk .env) dan tidak ada duplikat via `sort | uniq -d`.",
  );
  process.exit(1);
}

if (checked.length === 0) {
  console.log("check-env: tidak ada file env di disk (env dari runner/CI) — dilewati.");
} else {
  console.log(`check-env OK: ${checked.length} file, tanpa duplikat/key asing/garbage.`);
}
process.exit(0);
