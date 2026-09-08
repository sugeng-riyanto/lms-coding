#!/usr/bin/env bash
# release-gate.sh — Block launch while any live-risk credential reference remains.
# Run: bash scripts/release-gate.sh
# Exit 0 = safe to launch.  Exit 1 = fix the flagged reference first.
#
# See docs/credential-audit.md for the full classification.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

pass() { printf "  ✅ %s\n" "$1"; }
fail() { printf "  ❌ %s\n" "$1"; FAIL=1; }
warn() { printf "  ⚠️  %s\n" "$1"; }

echo "🔒 Release gate — credential & demo-data audit"
echo "================================================"
echo ""

# ── Gate 1: No hardcoded password in executable app code ──────────────
echo "Gate 1: No DemoPass-2026! in executable app code (.ts/.tsx/.mjs)"
HITS=$(grep -rn "DemoPass-2026" "$ROOT" \
  --include="*.ts" --include="*.tsx" --include="*.mjs" \
  --exclude-dir=node_modules --exclude-dir=.next \
  --exclude="*.test.ts" --exclude="*.test.tsx" --exclude="*.spec.ts" \
  --exclude="seed.sql" 2>/dev/null || true)

if [ -n "$HITS" ]; then
  fail "Found hardcoded DemoPass-2026! in executable code:"
  echo "$HITS" | head -10 | sed 's/^/    /'
  [ "$(echo "$HITS" | wc -l)" -gt 10 ] && echo "    ... ($(echo "$HITS" | wc -l) total matches)"
else
  pass "No hardcoded password in app code"
fi
echo ""

# ── Gate 2: No demo.local in server actions ──────────────────────────
echo "Gate 2: No demo.local emails in server actions"
SERVER_HITS=$(grep -n "demo\.local" "$ROOT/features/actions.ts" 2>/dev/null || true)

if [ -n "$SERVER_HITS" ]; then
  fail "Found demo.local in server actions (features/actions.ts):"
  echo "$SERVER_HITS" | sed 's/^/    /'
else
  pass "No demo.local in server actions"
fi
echo ""

# ── Gate 3: seed.sql is local-only (header guard) ────────────────────
echo "Gate 3: seed.sql header contains local-only guard"
if grep -q "HANYA untuk" "$ROOT/supabase/seed.sql" 2>/dev/null; then
  pass "seed.sql has local-only guard comment"
else
  fail "seed.sql is missing the 'HANYA untuk' local-only guard comment"
fi
echo ""

# ── Gate 4: E2E specs have no password fallback ─────────────────────
echo "Gate 4: E2E specs have no silent password fallback"
E2E_HITS=$(grep -rn '?? "DemoPass\|fill("DemoPass' "$ROOT/tests/e2e/" 2>/dev/null || true)

if [ -n "$E2E_HITS" ]; then
  fail "Found silent DemoPass fallback in e2e specs:"
  echo "$E2E_HITS" | sed 's/^/    /'
else
  pass "No silent password fallback in e2e specs"
fi
echo ""

# ── Gate 5: No DemoPass in CI env defaults ───────────────────────────
echo "Gate 5: No DemoPass in CI workflow env defaults"
CI_HITS=$(grep -rn "DemoPass" "$ROOT/.github/workflows/" 2>/dev/null || true)

if [ -n "$CI_HITS" ]; then
  fail "Found DemoPass in CI workflow:"
  echo "$CI_HITS" | sed 's/^/    /'
else
  pass "No DemoPass in CI workflows"
fi
echo ""

# ── Gate 6: No demo.local in page-level server components ────────────
echo "Gate 6: No demo.local in app/**/page.tsx (server components)"
PAGE_HITS=$(grep -rn "demo\.local" "$ROOT/app/" --include="page.tsx" 2>/dev/null || true)

if [ -n "$PAGE_HITS" ]; then
  fail "Found demo.local in server page components:"
  echo "$PAGE_HITS" | sed 's/^/    /'
else
  pass "No demo.local in page components"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────
echo "================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ RELEASE GATE PASSED — safe to launch"
  exit 0
else
  echo "❌ RELEASE GATE FAILED — fix the flagged references before launch"
  echo "   See docs/credential-audit.md for classification and remediation."
  exit 1
fi
