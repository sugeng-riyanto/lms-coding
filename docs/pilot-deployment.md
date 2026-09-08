# Pilot Deployment — Dry-Run Playbook

> **Scope: a dry run.** This playbook prepares everything a human with access to
> DNS/hosting needs to stand up the **pilot** environment (staging, demo data
> only). **No external resource has been modified** by writing this file — the
> Supabase project, DNS, and hosting are all left untouched. The only commands
> executed during this rehearsal were **local and isolated**: the restore
> rehearsal and live RLS/denial on the local Postgres 18 (see §4 evidence).
>
> Status: **REHEARSED** (restore 9/9, live-denial 95/95, gates green on the
> exact commit). Ready for a human to execute §3 against a fresh pilot project.

## 0. What a fresh pilot needs (one-time inventory)

| # | Resource | Owner | Where |
|---|---|---|---|
| 1 | Supabase **pilot** project (database + Auth + Storage) | school ops | supabase.com dashboard — **must NOT be the demo project `jspmxdzgxevtfwvldwxy`** |
| 2 | Canonical host `pilot.<your-domain>` | school DNS | CNAME/A record → hosting |
| 3 | Hosting (PaaS default: Vercel/Railway/Fly/Render; VPS optional) | school ops | env vars set in platform UI |
| 4 | One operator account (named in §7 of DEPLOYMENT.md) | school ops | receives CSP alerts, owns the runbook |

## 1. Pilot environment set

Copy `.env.example` and fill the **pilot** column. Secrets are generated at
provisioning time and set in the hosting platform — **never committed**. The
template below uses placeholders; `node scripts/check-env.mjs` structurally
validates the file, and the production build's `lib/env.ts` Zod schema validates
values semantically (`/api/health` reports only the failing field *names*).

### 1.1 `.env.pilot` template (fill values, keep the file out of git)

```bash
# --- Public origin (must match the real HTTPS origin, no trailing slash) ---
NEXT_PUBLIC_APP_URL=https://pilot.<your-domain>

# --- Supabase pilot project (fresh, empty — NOT the demo ref) ---
NEXT_PUBLIC_SUPABASE_URL=https://<pilot-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<pilot-anon>   # safe for browser
SUPABASE_SECRET_KEY=eyJ...<pilot-service-role>                     # server-only, never NEXT_PUBLIC_

# --- Certificate signing (fresh random >= 32 chars) ---
CERTIFICATE_SIGNING_SECRET=<openssl rand -hex 32>

# --- CSP: report-only during rollout, enforce only after a clean window ---
CSP_REPORT_ONLY=true
CSP_ALERT_THRESHOLD_PER_MIN=20
CSP_ALERT_WEBHOOK_URL=            # optional: webhook for csp-alert ACTIVE/CLEARED

# --- Feature flags: all OFF for the pilot (production posture) ---
BLOCKCHAIN_ANCHOR_ENABLED=false
BLOCKCHAIN_PROVIDER=
BLOCKCHAIN_NETWORK=
BLOCKCHAIN_ALGORAND_RPC_URL=
BLOCKCHAIN_ALGORAND_API_KEY=
AI_FEEDBACK_ENABLED=false
AI_PROVIDER=
AI_PROVIDER_BASE_URL=
AI_PROVIDER_API_KEY=
CODE_RUNNER_ENABLED=false
CODE_RUNNER_PROVIDER=
CODE_RUNNER_BASE_URL=
CODE_RUNNER_API_KEY=
ROBLOX_WEBHOOK_SECRET=

# --- Provisioning only; never deployed with the app ---
SUPABASE_ACCESS_TOKEN=           # PAT for `supabase db push`, set in the deploy shell, not the app env
```

### 1.2 Render helper

`scripts/pilot-env-render.mjs` (in this repo) turns the template into a
`.env.pilot` file from a small set of inputs — **no secrets hardcoded**:

```bash
PILOT_REF=abcdefghijklmnopqrst PILOT_DOMAIN=pilot.example.org \
  PILOT_PUBLISHABLE=sb_publishable_xxx PILOT_SERVICE_ROLE=eyJ... \
  node scripts/pilot-env-render.mjs > .env.pilot
node scripts/check-env.mjs --env-file .env.pilot   # structural gate
```

## 2. Pre-flight gates (exact commit that will be deployed)

Run from a clean checkout of the **same commit** deployed:

```bash
npm ci
npm run format:check && npm run lint && npm run typecheck && npm test
npm run build
npm run db:typecheck            # DB advisor: 30 migrations scanned
bash scripts/live-denial/run.sh # PASS=95 FAIL=0 (real Postgres, migrations verbatim)
bash scripts/restore-rehearsal/run.sh  # PASS=9 FAIL=0
npm run e2e                    # hermetic public/responsive specs; full suite with hosted creds
```

CI (`.github/workflows/ci.yml`) runs code gates + live-denial + restore-rehearsal
+ hermetic e2e on every push/PR to `main`; these are the same commands, run
locally as the final manual gate.

## 3. Exact db push + smoke sequence (fresh pilot project)

Execute in this order. **Nothing below touches the demo project** — every
command is scoped to the pilot ref.

```bash
# 3.1 Link the CLI to the PILOT project (once)
cd <checkout>
npx --yes supabase@latest link --project-ref <pilot-ref>

# 3.2 Push ALL migrations (order = migration file order, idempotent)
npx --yes supabase@latest db push --linked
#   Expect: "Remote database is up to date" after the first run.
#   Confirm the full list: npx --yes supabase@latest migration list --linked

# 3.3 Seed policy — pilot = demo org ONLY (anonymous demo data)
#   supabase/seed.sql creates guru@demo.local + murid01-03 + wali@demo.local
#   with the shared public password DemoPass-2026!. This is REQUIRED for the
#   smoke loop. The accounts are deleted/rotated in step 3.8 before any real
#   participant is invited. Production: NO seed — invite real users.

# 3.4 Set the Supabase Site URL to the pilot origin (dashboard → Auth → URL
#   Configuration) so password-reset/email links point at pilot.<domain>.

# 3.5 Deploy the app (PaaS UI or `vercel --prod` / equivalent) with the
#   §1.1 env set. First check: GET /api/health → {"status":"ready",
#   "envConfigured":true,"validationError":null}.

# 3.6 Run the pilot smoke loop (the full study loop, idempotent, no growth):
SMOKE_APP_URL=https://pilot.<your-domain> node .freebuff/smoke-pilot-loop.mjs
#   Expect: "PILOT SMOKE GREEN — N/N PASS". It replays:
#   guru sign-in → content present → author question (fixed-id, idempotent) →
#   murid01 study (attempt, server scoring 100, submit) → grading sees 100 →
#   wali min-disclosure summary → certificate artifacts (JSON record + verifier
#   + 2-page PDF via the app route) → /api/health.

# 3.7 Re-run CSP review (§4.7 of DEPLOYMENT.md): confirm the hosts the pilot
#   lessons actually embed are in the frame-src allowlist; re-run e2e public/
#   responsive specs; only then consider CSP_REPORT_ONLY=false after a clean
#   violation window (zero real violations, only the e2e spec's synthetic probes).

# 3.8 ROTATE OR DELETE demo accounts BEFORE inviting any participant
#   (README.md warning + DEPLOYMENT.md §5 seed policy).
```

Rollback of 3.2: `supabase db reset --linked` is **destructive** — use only on
the pilot project with consent; the forward-fix is a new migration, and the
revert path for any commit is `git revert` per atomic commit.

## 4. Restore procedure (mapped + rehearsed)

### 4.1 The procedure (runbook §5, made concrete)

1. **Backup**: Supabase dashboard → point-in-time recovery (PITR) snapshot, or
   `pg_dump` for a logical clone:
   ```bash
   pg_dump -d <pilot-db> --file=backup-$(date +%Y%m%d).sql
   ```
2. **Restore to an ISOLATED database first** — never straight to production.
   Local rehearsal proves the exact steps on a plain Postgres:
   ```bash
   createdb lms_restore_target
   psql -d lms_restore_target -f backup-<date>.sql
   ```
3. **Verify**: RLS still active on every exposed table, primary rows present,
   anon still sees 0 rows on private tables — `scripts/restore-rehearsal/verify.sql`.
4. **Swap** only after smoke is green: `npm run db:typecheck` + login + submit +
   dashboard + PDF + verifier smoke (§3.6 loop) on the restored target.
5. Store the backup artifact + run log somewhere safe (example artifact path:
   `.freebuff/restore-rehearsal/backup-*.sql`).

### 4.2 Rehearsal evidence (this dry run, 08 Sep 2026)

The rehearsal is **isolated by design** — it builds a "like production" source DB
(shim + all 30 migrations verbatim + grants + seed + fixture), `pg_dump`s it,
restores into a brand-new empty DB, verifies, then drops both local DBs. It never
touches hosted.

```
== restore rehearsal PASS (artefak: .freebuff/restore-rehearsal/backup-20260908-132728.sql) ==
  rr_rls_exposed          PASS | RLS aktif
  rr_rows_org             PASS | organizations>=1
  rr_rows_profiles        PASS | profiles>=5
  rr_rows_courses         PASS | courses>=2
  rr_rows_enrollments     PASS | enrollments>=4
  rr_rows_certificates    PASS | certificates>=2
  rr_rows_levels          PASS | levels>=4
  rr_anon_profiles_0      PASS | anon 0 profil
  rr_anon_certs_0         PASS | anon 0 sertifikat
== SUMMARY: restore verify PASS=9 FAIL=0 ==
```

**Defect found and fixed by this rehearsal:** migration
`20260908000001_csp_events_persistence.sql` (csp_events RLS) targets role
`service_role`, which the plain-Postgres shim (`scripts/live-denial/00_shim.sql`)
never created — the rehearsal failed at that migration. Fix: the shim now
creates `service_role nologin` (needed only for the role to exist; denial tests
never `SET ROLE service_role`). Re-run after the fix: **restore 9/9 + live-denial
95/95 PASS**. Without the rehearsal the pilot's first `db push` to a fresh
project would have failed the same way only in production.

### 4.3 Restore operational thresholds

| Condition | Action |
|---|---|
| Restore rehearsal fails in CI or manual run | Do not ship DB changes until green (§3 pre-flight) |
| PITR needed | Choose the restore point before the bad change; restore to isolated DB; verify; swap |
| Backup artifact missing | Block release — no release without a verified backup path |

## 5. Outcome recording

After the human executes §3 on the real pilot project, record in `PROGRESS.md`
under a new "Pilot deployment" entry: host type + origin, pilot Supabase ref,
env set used (names only), smoke result, restore artifact id, operator on-call.

## History

- 2026-09-08: playbook written. Rehearsals executed locally: restore 9/9,
  live-denial 95/95, gates green (lint 0 · tsc 0 · 561 passed / 1 skipped ·
  build 0). Shim `service_role` defect found + fixed by the rehearsal. No
  external resource touched.