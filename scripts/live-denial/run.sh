#!/usr/bin/env bash
# Live RLS/denial suite — butuh Postgres sungguhan (tanpa Docker):
#   1. 00_shim.sql   — tiruan permukaan Supabase (roles, auth.uid, storage, pgcrypto)
#   2. migrations/*  — migration repo DIJALANKAN VERBATIM
#   3. 05_grants.sql — grant tiruan default Supabase (agar RLS yang memutuskan)
#   4. seed.sql      — seed anonim repo
#   5. 10_fixture.sql— org ke-2, wali tertaut, chain konten + attempt
#   6. 20_denial.sql — denial RBAC.md sebagai SQL sungguhan
# Konfigurasi via env: PGHOST PGPORT PGUSER PGPASSWORD PSQL
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${LMS_DENIAL_DB:-lms_rls_test}"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
export PGDATABASE=postgres
export PGCLIENTENCODING=UTF8
# Migration mendefinisikan fungsi SQL sebelum tabelnya dibuat (urutan normal di
# Supabase). Cegah validasi-body saat CREATE FUNCTION: check_function_bodies=off.
export PGOPTIONS="-c check_function_bodies=off"

PSQL="${PSQL:-}"
if [[ -z "$PSQL" ]]; then
  if command -v psql >/dev/null 2>&1; then
    PSQL=psql
  elif [[ -n "${PROGRAMFILES:-}" && -x "$PROGRAMFILES/PostgreSQL/18/bin/psql.exe" ]]; then
    PSQL="$PROGRAMFILES/PostgreSQL/18/bin/psql.exe"
  else
    echo "psql tidak ditemukan. Set PSQL= ke path psql." >&2
    exit 2
  fi
fi

echo "== database: $DB pada $PGHOST:$PGPORT user=$PGUSER =="
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists $DB with (force);"
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -c "create database $DB"

apply() { echo "-- apply: $1"; "$PSQL" -d "$DB" -v ON_ERROR_STOP=1 -f "$1"; }

apply "$ROOT/scripts/live-denial/00_shim.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do apply "$m"; done
apply "$ROOT/scripts/live-denial/05_grants.sql"
apply "$ROOT/supabase/seed.sql"
apply "$ROOT/scripts/live-denial/10_fixture.sql"

echo "-- denial suite ..."
# -A -t: keluaran unaligned (tanpa spasi leading) agar regex runner cocok.
OUT="$("$PSQL" -d "$DB" -A -t -v ON_ERROR_STOP=1 -f "$ROOT/scripts/live-denial/20_denial.sql" 2>&1)"

PASS=$(printf '%s\n' "$OUT" | grep -cE '^(p|t)[a-zA-Z0-9_]*\|PASS$' || true)
FAIL=$(printf '%s\n' "$OUT" | grep -cE '^(p|t)[a-zA-Z0-9_]*\|FAIL$' || true)

printf '%s\n' "$OUT" | grep -E '^(p|t)[a-zA-Z0-9_]*\|(PASS|FAIL)$' | while IFS='|' read -r id res; do
  printf '  %-42s %s\n' "$id" "$res"
done || true

echo
echo "== SUMMARY: PASS=$PASS FAIL=$FAIL (db $DB dipertahankan untuk inspeksi) =="
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi

exit 0
