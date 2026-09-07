#!/usr/bin/env bash
# Restore rehearsal (runbook #5 "Database restore") — AMAN & terisolasi:
# tidak menyentuh hosted/produksi. Mengulang langkah nyata di Postgres lokal:
#   1. Bangun DB sumber "seperti produksi" (shim + migration repo VERBATIM +
#      grants + seed + fixture) — sama dengan live-denial.
#   2. Backup: pg_dump (format plain) → artefak backup.
#   3. Restore ke DB tujuan yang BARU & kosong (isolated) via psql.
#   4. Verifikasi hasil restore (RLS utuh, data hadir, anon tetap 0 baris).
#   5. Cleanup DB sumber+tujuan (kecuali RR_KEEP=1).
#
# Env: PGHOST PGPORT PGUSER PGPASSWORD PSQL PGDMP LMS_RR_SRC_DB LMS_RR_DST_DB RR_KEEP
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${LMS_RR_SRC_DB:-lms_rr_src}"
DST="${LMS_RR_DST_DB:-lms_rr_dst}"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
export PGDATABASE=postgres
export PGCLIENTENCODING=UTF8
export PGOPTIONS="-c check_function_bodies=off"

BIN="$(dirname "${PSQL:-}")"
PSQL="${PSQL:-}"
PGDMP="${PGDMP:-}"
if [[ -z "$PSQL" ]]; then
  for cand in psql "$PROGRAMFILES/PostgreSQL/18/bin/psql.exe" "/c/Program Files/PostgreSQL/18/bin/psql.exe"; do
    if command -v "$cand" >/dev/null 2>&1 || [[ -x "$cand" ]]; then PSQL="$cand"; break; fi
  done
fi
if [[ -z "$PSQL" ]]; then echo "psql tidak ditemukan. Set PSQL=" >&2; exit 2; fi
if [[ -z "$PGDMP" ]]; then PGDMP="$(dirname "$PSQL")/pg_dump.exe"; fi
[[ -x "$PGDMP" ]] || PGDMP="pg_dump"

echo "== restore rehearsal — src=$SRC dst=$DST @$PGHOST:$PGPORT =="
runq() { "$PSQL" -d postgres -v ON_ERROR_STOP=1 -c "$1"; }
runf() { "$PSQL" -d "$1" -v ON_ERROR_STOP=1 -f "$2"; }

# --- 1. Bangun sumber "seperti produksi" -----------------------------------
runq "drop database if exists $SRC with (force);"
runq "create database $SRC"
runf "$SRC" "$ROOT/scripts/live-denial/00_shim.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do runf "$SRC" "$m"; done
runf "$SRC" "$ROOT/scripts/live-denial/05_grants.sql"
runf "$SRC" "$ROOT/supabase/seed.sql"
runf "$SRC" "$ROOT/scripts/live-denial/10_fixture.sql"
echo "== 1. sumber siap: schema + migration + seed + fixture =="

# --- 2. Backup (artefak) ----------------------------------------------------
BACKUP="$ROOT/.freebuff/restore-rehearsal/backup-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p "$ROOT/.freebuff/restore-rehearsal"
"$PGDMP" -d "$SRC" --file="$BACKUP"
echo "== 2. backup selesai: $(wc -l < "$BACKUP") baris SQL ($(du -h "$BACKUP" | cut -f1)) =="

# --- 3. Restore ke DB baru (isolated) --------------------------------------
runq "drop database if exists $DST with (force);"
runq "create database $DST"
"$PSQL" -d "$DST" -v ON_ERROR_STOP=1 -f "$BACKUP"
echo "== 3. restore selesai =="

# --- 4. Verifikasi ----------------------------------------------------------
OUT="$("$PSQL" -d "$DST" -A -t -v ON_ERROR_STOP=1 -f "$ROOT/scripts/restore-rehearsal/verify.sql" 2>&1)"
printf '%s\n' "$OUT" | grep -E '^(rr|t|p)[a-zA-Z0-9_]*\|(PASS|FAIL)' | while IFS='|' read -r id res; do
  printf '  %-24s %s\n' "$id" "$res"
done || true
PASS=$(printf '%s\n' "$OUT" | grep -cE '^rr_[a-zA-Z0-9_]*\|PASS\|' || true)
FAIL=$(printf '%s\n' "$OUT" | grep -cE '^rr_[a-zA-Z0-9_]*\|FAIL\|' || true)
echo "== SUMMARY: restore verify PASS=$PASS FAIL=$FAIL =="
if [[ "$FAIL" -gt 0 ]]; then
  if [[ "${RR_KEEP:-0}" != "1" ]]; then runq "drop database if exists $SRC with (force); drop database if exists $DST with (force);"; fi
  exit 1
fi

# --- 5. Cleanup -------------------------------------------------------------
if [[ "${RR_KEEP:-0}" != "1" ]]; then
  runq "drop database if exists $SRC with (force);"
  runq "drop database if exists $DST with (force);"
  echo "== 5. cleanup selesai (set RR_KEEP=1 untuk inspeksi) =="
else
  echo "== RR_KEEP=1 — $SRC dan $DST dipertahankan =="
fi
echo "== restore rehearsal PASS (artefak: $BACKUP) =="
