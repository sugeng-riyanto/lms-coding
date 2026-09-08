# Credential & Demo-Data Audit

> Generated 2026-09-09. Every reference to `DemoPass-2026!` and `*@demo.local`
> across the repository, classified by risk tier.

---

## Risk tiers

| Tier | Meaning |
|---|---|
| **🟢 LOCAL-ONLY** | Executable code that only runs against a local/CI Supabase instance (seed, test fixtures, demo mode). Never reaches a live database. |
| **🟡 DOCUMENTATION** | Markdown files that mention credentials for human reference. Not executable; risk is only if someone copy-pastes blindly. |
| **🔴 LIVE-RISK** | Executable code or configuration that could run against a hosted/production Supabase and use the old password or demo accounts. |

---

## Tier 🟢 LOCAL-ONLY (safe — no action required)

### `supabase/seed.sql` (lines 7–43)
- **What:** `auth.users` inserts with `crypt('DemoPass-2026!', gen_salt('bf'))` for 5 demo accounts.
- **Why safe:** Header comment says `HANYA untuk supabase db reset lokal`. The file is only run via `supabase db reset` (local) or `supabase db query --linked --file` (CI test harness). Never run against hosted in the deploy pipeline.
- **Hosted state:** Accounts exist on hosted but password was rotated to `Demo-Rot8-exJmoqO5Aph!` on 2026-09-08. The seed.sql still uses the old password — this is correct for local resets.

### `lib/supabase/demo.ts` (line 21)
- **What:** `DEMO_USER_ID = "00000000-0000-0000-0000-00000000dead"` — a fake UUID for the offline demo backend.
- **Why safe:** Only activated when `isDemoBackend === true` (no Supabase env vars). Production env always sets real credentials → `isDemoBackend = false`.

### `lib/auth/guards.ts` (line 5, 24)
- **What:** Imports `DEMO_USER_ID` / `isDemoBackend` and returns a fake auth context when demo mode is on.
- **Why safe:** Same guard — dead path when real env vars are set.

### `lib/bulk-template.ts` (lines 30–31, 66)
- **What:** Sample rows in XLSX template downloads: `murid01@demo.local`, `murid02@demo.local`.
- **Why safe:** These are example data in downloadable Excel templates. The import action validates against real accounts; if the email doesn't exist, the import rejects the row. No password involved.

### `tests/e2e/critical.spec.ts` (line 15)
- **What:** `E2E_STUDENT_EMAIL ?? "murid01@demo.local"` — email fallback.
- **Why safe:** The password is now a lazy getter that throws if `E2E_STUDENT_PASSWORD` is unset. The email fallback is harmless (it's just the username; the password gate prevents accidental auth).

### `tests/e2e/shell.spec.ts` (lines 47, 56, 67, 75, 84, 91)
- **What:** Hardcoded `murid01@demo.local`, `guru@demo.local`, `wali@demo.local` in `login()` calls and assertions.
- **Why safe:** Module-scope guard throws if `E2E_STUDENT_PASSWORD` is unset. These tests only run against a seeded local/CI backend.

### `tests/e2e/responsive-authed.spec.ts` (lines 69, 72, 81)
- **What:** Same hardcoded demo emails in `ROLE_ROUTES` fixture.
- **Why safe:** Same password guard as shell.spec.ts.

### `scripts/live-denial/` (run.sh, 10_fixture.sql, README.md)
- **What:** Test harness that applies seed.sql + denial fixtures against a local Postgres.
- **Why safe:** Only runs via `bash scripts/live-denial/run.sh` in CI. Never touches hosted.

### `scripts/restore-rehearsal/run.sh` (line 48)
- **What:** Applies seed.sql during a restore rehearsal.
- **Why safe:** Rehearsal against a throwaway local database.

### `tests/integration/guardian.test.ts` (line 14)
- **What:** `readFileSync("supabase/seed.sql")` — reads seed to set up test fixtures.
- **Why safe:** Unit/integration test against a mock or local database.

---

## Tier 🟡 DOCUMENTATION (informational — update recommended)

### `README.md` (lines 7, 11–15)
- **What:** Documents 5 demo accounts with `DemoPass-2026!` password and their routes.
- **Action:** Add a note that the hosted password was rotated; the listed password is for local `supabase db reset` only.

### `docs/e2e-setup.md` (lines 41–45, 88)
- **What:** Credential table + example command `E2E_STUDENT_PASSWORD='DemoPass-2026!'`.
- **Action:** Update the example to use a placeholder and note that the e2e specs now require `E2E_STUDENT_PASSWORD` to be set.

### `docs/release-checklist.md` (line 68)
- **What:** `rotasi kredensial demo (DemoPass-2026!)` — already notes rotation is needed.
- **Action:** Mark as completed; the rotation happened on 2026-09-08.

### `docs/pilot-deployment.md` (lines 115–116)
- **What:** Notes that seed.sql creates demo accounts with shared public password.
- **Action:** Add note that hosted uses rotated credentials.

### `DEPLOYMENT.md` (lines 66, 205–206, 338)
- **What:** Env matrix mentions `E2E_*_PASSWORD`; §6 notes demo accounts; §7.3 mentions rotation.
- **Action:** Mark rotation as completed in §7.3.

### `ACCEPTANCE_CRITERIA.md` (line 117)
- **What:** `rotasi kredensial demo (DemoPass-2026!)` — acceptance criterion.
- **Action:** Mark as completed.

### `CHANGELOG.md` (line 47)
- **What:** Historical mention of `wali@demo.local` seed.
- **Action:** No change needed — changelog is historical record.

### `PROGRESS.md` (multiple lines)
- **What:** Extensive evidence log with demo credentials in test results.
- **Action:** No change needed — progress log is historical record.

---

## Tier 🔴 LIVE-RISK (must be resolved before launch)

**None.** All executable references are local-only. The password rotation on
hosted (2026-09-08) means the old `DemoPass-2026!` hash in seed.sql no longer
matches the hosted accounts. The e2e specs require `E2E_STUDENT_PASSWORD` to be
set explicitly — no silent fallback.

---

## Release gate

`.freebuff/release-gate.sh` enforces this audit mechanically:

1. **No hardcoded password in executable code** — scans `.ts`/`.tsx`/`.mjs` files
   (excluding `seed.sql`, `*.md`, `*.test.*`, `*.spec.*`) for literal `DemoPass-2026!`.
   Any match → FAIL (the old password must never be used in app code).

2. **No `demo.local` in server actions** — scans `features/actions.ts` and
   `app/**/page.tsx` for `demo.local` emails. Any match → FAIL (server code must
   never assume demo accounts exist on hosted).

3. **Seed.sql is local-only** — asserts the file header contains `HANYA untuk`.
   Missing → FAIL (the guardrail comment was removed).

4. **E2E specs have no password fallback** — scans `tests/e2e/*.spec.ts` for
   `?? "DemoPass` or `fill("DemoPass`. Any match → FAIL (the silent fallback
   was removed; specs must require the env var).

5. **No `DemoPass` in CI env defaults** — scans `.github/workflows/*.yml` for
   `DemoPass`. Any match → FAIL (CI must never default to the old password).

Run before every release: `bash scripts/release-gate.sh`
Exit 0 = safe to launch. Exit 1 = block launch, fix the flagged reference.
