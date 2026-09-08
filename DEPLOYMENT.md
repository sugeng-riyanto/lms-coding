# Deployment and Operations

> **Status: preparation document for a pilot deployment.** This file makes the
> deployment plan concrete (environment matrix, domain/HTTPS, monitoring) so a
> human with access to the school's DNS/hosting can execute it. **No external
> resource has been modified by preparing this document.**

## 1. Target architecture

- **Application:** a single Next.js 16.3.4 Node server (`Node >=20 <25`; pin a
  Node LTS in the runtime, e.g. 22 LTS or 24 LTS). Not `output: standalone`.
  Build with `npm ci && npm run build`, run with `npm run start`.
- **Data/Auth/Storage:** one Supabase **hosted** project per environment
  (database + Auth + Storage). The current demo/pilot project is
  `jspmxdzgxevtfwvldwxy` and is **demo-seeded — never put real students in it**.
  Production must get a **separate, empty** Supabase project.
- **Auth flow:** email/password only, exchanged server-side via
  `supabase.auth.signInWithPassword` (@supabase/ssr). No OAuth providers and no
  callback route, so no OAuth redirect-URL allowlist is needed — but the
  Supabase **Site URL** must still be set to the real origin (see §4).
- **Background work:** none is scheduled at runtime today (certificate
  anchoring job and code runner are **off by default**; the anchoring batch is a
  manual teacher action behind `BLOCKCHAIN_ANCHOR_ENABLED`). A plain HTTP
  server suffices for the pilot; add a job runner only when scheduled work is
  enabled.
- **Deploy target options (pick one, then fill the placeholders below):**
  1. *PaaS* (Vercel, Railway, Fly.io, Render): least operations; HTTPS
     automatic; env vars set in the platform UI. This document assumes this is
     the default for the pilot.
  2. *School VPS* (Ubuntu + Caddy + systemd): full control; requires DNS + TLS
     management (§4) and a process manager (§6.2). Choose only if the school
     already operates servers.

## 2. Environment matrix

The full set of keys the application reads is defined in `.env.example`
(validated structurally by `scripts/check-env.mjs` before `dev`/`build`/`start`,
and semantically by `getServerEnv()` in `lib/env.ts` — the Zod schema is the
single source of truth). Fill one row set per environment; never reuse a
production secret in another environment.

### 2.1 Runtime keys

| Key | Local dev | Pilot (staging, demo data) | Production | Constraint |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://pilot.<your-domain>` | `https://learn.<your-domain>` | Absolute URL, **no trailing slash**; must equal the real HTTPS origin |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<pilot-ref>.supabase.co` | `https://<prod-ref>.supabase.co` | No trailing `/` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | local anon key | pilot publishable key | prod publishable key | Safe for browser (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | local service role | pilot service role | prod service role | **Server-only**; never `NEXT_PUBLIC_`; not sent to the browser |
| `CERTIFICATE_SIGNING_SECRET` | any dev string | fresh random ≥32 chars | **fresh random ≥32 chars, distinct from pilot** | Rotate on suspected leak; changing it invalidates nothing already issued (hash lives in the DB) but signs future PDF metadata |
| `CSP_REPORT_ONLY` | `true` (dev is always report-only) | `true` (rollout) | `false` only after the violation stream is clean (§4.7) | Nonce-based strict CSP: `true` = `Content-Security-Policy-Report-Only` + `/api/csp-report`; `false` = enforce |
| `BLOCKCHAIN_ANCHOR_ENABLED` | `false` | `false` | `false` until a provider is approved (ADR-018) | Must stay `false`; do not enable with `mock` on a real org |
| `BLOCKCHAIN_PROVIDER` / `_NETWORK` / `BLOCKCHAIN_ALGORAND_RPC_URL` / `_API_KEY` | empty | empty | empty (provider decision pending) | Empty = inert adapter, no transactions |
| `AI_FEEDBACK_ENABLED` | `false` | `false` | `false` until org consent + provider (ADR-014/017) | `true` also requires per-org consent and `AI_PROVIDER_*` |
| `AI_PROVIDER` / `AI_PROVIDER_BASE_URL` / `AI_PROVIDER_API_KEY` | empty | empty | empty | Server-only |
| `CODE_RUNNER_ENABLED` | `false` | `false` | `false` until an external sandbox (Piston-compatible) is chosen | `true` executes code in an **external** sandbox, never the LMS server |
| `CODE_RUNNER_PROVIDER` / `CODE_RUNNER_BASE_URL` / `CODE_RUNNER_API_KEY` | empty | empty | empty | `mock` is for local preview/tests only |
| `ROBLOX_WEBHOOK_SECRET` | empty | empty | empty | Roblox integration is off unless enabled |
| `SUPABASE_ACCESS_TOKEN` | optional PAT | optional PAT | **never set in production** | Provisioning only (`supabase login`/`db push`); do not deploy it |

### 2.2 CI / tooling keys (not read by the runtime)

| Key | Where | Purpose |
|---|---|---|
| `E2E_BASE_URL` | CI/PR previews only | Point Playwright at a deployed preview instead of spawning a dev server |
| `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD` (+ guru/wali variants as used by specs) | CI secrets | Run the session/login e2e specs against a hosted backend; when absent the specs skip explicitly |
| `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD` | CI (postgres service) | Live-denial + restore-rehearsal jobs |

### 2.3 Provisioning checklist per environment

```bash
# 1. Structure guard (run before start/build — wired as predev/prebuild/prestart)
node scripts/check-env.mjs

# 2. Semantic validation (what /api/health reports)
npm run build   # fails fast if lib/env.ts schema rejects a value
```

A malformed env set makes `/api/health` return `503` with a `validationError`
listing only the failing field *names* (never values) — treat that as the first
post-deploy check.

## 3. Pre-flight gates (each deploy candidate must pass)

Run on the exact commit that will be deployed, from a clean checkout:

| Gate | Command | Exit requirement |
|---|---|---|
| Format | `npm run format:check` | 0 |
| Lint | `npm run lint` | 0 (`--max-warnings=0`) |
| Typecheck | `npm run typecheck` | 0 |
| Unit/integration | `npm test` | all passed (suite currently 520 + 1 skip) |
| Production build | `npm run build` | 0 |
| DB advisor | `npm run db:typecheck` | OK (all migrations scanned) |
| Live RLS denial | `bash scripts/live-denial/run.sh` | `PASS=… FAIL=0` against real Postgres, all migrations verbatim |
| Restore rehearsal | `bash scripts/restore-rehearsal/run.sh` | `PASS=9 FAIL=0` |
| E2E | `npm run e2e` (with `E2E_BASE_URL` + hosted creds for the full suite) | 0 failures (public/responsive specs run hermetic even without creds) |

CI (`.github/workflows/ci.yml`) already runs the code gates, live-denial,
restore-rehearsal and hermetic e2e on every push/PR to `main`.

## 4. Domain & HTTPS

1. **Choose the canonical host** (e.g. `learn.<your-domain>` for production,
   `pilot.<your-domain>` for staging). Single canonical origin — never let users
   reach the app on two domains.
2. **DNS:** point the host to the platform/VPS (PaaS: their CNAME/A record;
   VPS: A/AAAA to the server IP). Keep TTL low until the switchover settles.
3. **TLS:**
   - PaaS: HTTPS is automatic; enforce it (redirect HTTP → HTTPS).
   - VPS: install Caddy (auto-HTTPS) in front of the Node server
     (§6.2), or nginx + certbot. Add HSTS only after HTTPS is confirmed stable.
4. **Set `NEXT_PUBLIC_APP_URL`** to the canonical `https://` origin **before**
   building. It feeds absolute links (certificate verify URLs, QR payloads, PDF
   links) — a mismatch silently breaks certificate verification links.
5. **Supabase Auth settings** (dashboard → Authentication → URL Configuration):
   - **Site URL** = the canonical origin (e.g. `https://learn.<your-domain>`).
   - Add the canonical origin and any preview URLs to **Redirect URLs**.
   - Configure the **email sender** (custom SMTP recommended) so confirmation /
     password-reset mail links carry the real domain and don't land in spam.
6. **Storage:** bucket objects are private and served through short-lived signed
   URLs generated by the app against the project's Supabase URL — no bucket
   CNAME is required for the pilot.
7. **CSP review for embedded media (§4.7):** the Content-Security-Policy in
   `next.config.ts` ships a **per-host `frame-src` allowlist** that media
   embeds must match (iframe rendering is the only frame surface —
   `components/media-embed.tsx`):

   | Directive | Allowed | Covers |
   |---|---|---|
   | `frame-src` | `'self'`, `https://www.youtube-nocookie.com`, `https://docs.google.com`, `https://*.supabase.co` | YouTube embeds (src is **reconstructed from the video id**, never a raw URL), Google Drive PDF viewer, PDFs served from the private Storage bucket via short-lived signed URLs |
   | `media-src` | `'self'`, `https:` | `embed_audio` (`<audio>` elements don't execute code) |
   | `object-src` / `base-uri` / `form-action` / `frame-ancestors` | `'none'` / `'self'` / `'self'` / `'none'` | Plugin objects, base-URL hijack, off-origin form posts, clickjacking |

   Consequences and rules:
   - **Arbitrary-host frames are blocked by policy.** A PDF/audio URL on a host
     outside the allowlist will not render — that is intentional. Teachers
     must upload PDFs/files to the LMS Storage bucket (same-origin signed URLs)
     or use an allowlisted host (YouTube, Google Drive).
   - **Extending the allowlist is a deliberate code change:** edit the
     `frame-src`/`media-src` list in `lib/csp.ts`, document why the host is
     trusted, and re-run `npm run e2e` — `tests/e2e/csp.spec.ts` (hermetic,
     runs in CI) asserts the served header contains the exact `frame-src`
     allowlist and hardening directives, that every script tag carries a
     nonce, and that the report endpoint still behaves — plus a manual render
     of each new embed kind on a lesson page.
   **Nonce-based `script-src` (no `'unsafe-inline'`):** the CSP is generated
   per-request in `proxy.ts` (`lib/csp.ts` is the single source of the policy
   string). Every request gets a fresh nonce via `x-nonce`, Next.js applies it
   automatically to its own inline scripts/styles during SSR, and `script-src`
   carries `'nonce-…' 'strict-dynamic'` — no `'unsafe-inline'` for scripts,
   no `'unsafe-eval'` in production. One authored inline script (the dark-mode
   bootstrap in `app/layout.tsx`) reads `x-nonce` explicitly and sets the
   `nonce` attribute itself, because `dangerouslySetInnerHTML` scripts are not
   auto-nonced — keep that pattern for any future inline script. This requires
   **dynamic rendering**: the five shell pages that used to be static (`/`,
   `/login`, `/account-inactive`, `/unauthorized`, `/_not-found`) now export
   `dynamic = "force-dynamic"` — do not revert them to static while nonces
   are in use.

   **Report-only rollout (default):** with `CSP_REPORT_ONLY=true` (or unset)
   the proxy sends `Content-Security-Policy-Report-Only` plus
   `Reporting-Endpoints: csp-endpoint="/api/csp-report"`; nothing is blocked.
   The `/api/csp-report` route logs redacted violations (URIs stripped of
   query strings, `script-sample` never extracted; rate-limited 60/min/IP;
   body ≤ 64 KB) and feeds a rolling spike aggregator (`lib/csp-alerts.ts`):
   when the violation rate in the 60 s window reaches
   `CSP_ALERT_THRESHOLD_PER_MIN` (default 20/min, validated in `lib/env.ts`),
   a single-line `csp-alert ACTIVE` log entry is emitted, and `csp-alert
   CLEARED` when it subsides — wire a log/alerting rule (journald, PaaS log
   stream, uptime check) on `type="csp-alert"`. Aggregate state (counts,
   rate, sample size, threshold — **no URIs/PII**) is readable by teachers at
   `GET /api/operator/csp-alerts`. State is per-process; multi-instance
   deployments must move the aggregation to Redis/Supabase.
   Development is **always** report-only and keeps `'unsafe-eval'` (required
   by React dev tooling — per the official Next.js CSP guide). To enforce: set `CSP_REPORT_ONLY=false` on the target
   environment, watch `/api/csp-report` logs for a clean stream first, then
   re-run the e2e suite. Known, deliberate trade-off: `style-src` keeps
   `'unsafe-inline'` because the chart/dashboard components set dynamic
   `style` attributes (sizes from data) that cannot become classes; inline
   styles cannot execute code, but a future refactor to CSS variables would
   allow removing it. `upgrade-insecure-requests` is intentionally omitted
   (local dev uses `http://127.0.0.1:*` Supabase; HTTPS is enforced at the
   reverse proxy).
   - Re-run the CSP check after any dependency that injects inline scripts or
     new embed host:
     `curl -sI <origin> | grep -iE "content-security-policy|x-nonce"` — expect
     `x-nonce` plus either the `Report-Only` or enforced policy, and verify a
     fresh nonce on every request (the value must differ between two curls).

## 5. Migration & release order

Migrations are applied **only** with the Supabase CLI to the **linked** project.
Never edit an already-applied migration; fix forward with a new one.

```bash
# One-time per environment
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"      # provisioning token only
npx supabase link --project-ref <project-ref>

# Apply pending migrations (order is the migration file order)
npx supabase db push

# Seed policy — ANONYMOUS demo data only, and only where a demo org is wanted:
#   pilot:  supabase/seed.sql creates guru@demo.local + murid01-03 + wali@demo.local
#           (all share the public password DemoPass-2026! — rotate or delete the
#           demo accounts BEFORE inviting any real participant)
#   production: NO seed. Invite real users through the normal path.
```

Order for a pilot cutover:

1. Merge to `main`; CI is green (gates of §3).
2. Point the **pilot** Supabase project at the migration set: `supabase db push`.
3. Run the post-DB checks from `docs/runbooks.md` §8 (advisor, live-denial,
   restore rehearsal) against that exact DB.
4. Build + deploy the app to the pilot host with the pilot env set (§2.1).
5. Smoke test the full loop on pilot (from `docs/release-checklist.md`):
   guru creates content → student enrolls/learns → assessment → grade →
   certificate issued → PDF (2 pages) → public verify → JSON record.
6. Only after the pilot loop is green, prepare the **production** Supabase
   project + host the same way, then run the production smoke suite.

**Rollback policy:** revert the app commit and redeploy; DB rollback is a
forward-fix migration (never `db reset` against a live project). The rehearsed
restore procedure (`scripts/restore-rehearsal/`, `docs/runbooks.md` §5) is the
last-resort path and is tested in CI.

## 6. Running the server

### 6.1 PaaS

Build command: `npm ci && npm run build`. Start command: `npm run start`.
Set the env keys of §2.1 in the platform UI; **do not** commit a `.env` file to
the repository.

### 6.2 VPS (if chosen)

Sample systemd unit (adjust paths/user):

```ini
# /etc/systemd/system/lms.service
[Unit]
Description=Autonomous Learning LMS
After=network.target

[Service]
Type=simple
User=lms
WorkingDirectory=/srv/lms
EnvironmentFile=/etc/lms.env        # keys of §2.1, mode 600, owner lms
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Reverse proxy (Caddy):

```text
learn.your-domain.example {
    reverse_proxy 127.0.0.1:3000
}
```

Node listens on `127.0.0.1:3000` only; TLS terminates at Caddy. Set
`NEXT_PUBLIC_APP_URL` to the public `https://` origin (not `127.0.0.1`).

## 7. Monitoring basics (pilot)

### 7.1 Readiness/liveness

- **Endpoint:** `GET /api/health` → `200 {"status":"ready",…}` when the env set
  is valid; `503` with a field-name-only `validationError` when not.
- **Probe:** external uptime check every 60 s on
  `https://<canonical-origin>/api/health` (PaaS healthcheck or a free uptime
  service). Alert on anything other than `200`/`ready`.
- **Deep check once per hour** (cheap script): log in as a demo teacher and GET
  `/teacher` and the public verify page for a known certificate — guards
  "healthy but broken" states (DB auth, RLS, certificate route).

### 7.2 Logs

- Capture application stdout/stderr; on a VPS ship to `journald` or a file the
  operator rotates. Structured lines are preferable but not yet enforced.
- **Redaction rule (from runbooks):** never log tokens, service keys, student
  emails, grades/answers, or certificate private data. When a failure needs
  those for diagnosis, log the id + a reference, not the value.

### 7.3 Alert thresholds (start here, tune after a week)

| Signal | Threshold | Action |
|---|---|---|
| Health probe | any non-`200` for 3 consecutive checks | page operator, check logs + `/api/health` |
| 5xx rate | >1% of requests over 5 min | page operator |
| p95 latency | >3 s over 5 min | investigate (DB query, export, PDF render) |
| Auth failures | spike >5× baseline | check for brute force; review Auth logs |
| Certificate route errors | any failure in `/api/certificates/…/pdf` | verify storage bucket + signing secret intact |
| CSP violations (`csp-alert`) | rate ≥ `CSP_ALERT_THRESHOLD_PER_MIN`/min (default 20) in a 60 s window | possible injection attempt — review `/api/csp-report` log; aggregate state at `GET /api/operator/csp-alerts` (teacher-only, rate-limited) |
| Backup/restore | rehearsal job fails in CI or manual run | do not ship DB changes until green |

### 7.4 Supabase observability

- Use the project dashboard: database health/metrics, Auth (GoTrue) logs, and
  Storage usage. Enable the built-in log retention.
- There is **no scheduled job** to supervise in the pilot (anchoring off, code
  runner off). Revisit when `BLOCKCHAIN_ANCHOR_ENABLED` or scheduled review
  digests are introduced.

### 7.5 On-call

- Name a single pilot operator; keep their contact in the uptime/alert tool.
- The runbooks (`docs/runbooks.md`) cover: compromised teacher account,
  accidental grade change, failed certificate generation, stuck job queue,
  database restore, revoke exposed secret, privacy/data-correction request.

## 8. Pilot release checklist (execution order)

- [ ] Pick host type (§1) and canonical domain (§4.1–4.3); DNS + HTTPS live.
- [ ] Create/assign the **pilot** Supabase project; record its ref in the pilot
      env set; do not reuse the demo project for real data.
- [ ] Set the full §2.1 env set in the host (pilot column) + Supabase Site URL.
- [ ] `supabase db push` to the pilot project; run `db:typecheck` + live-denial
      + restore-rehearsal against it.
- [ ] Deploy app; confirm `/api/health` returns `ready`.
- [ ] Smoke the §5.5 loop with demo accounts — run
      `SMOKE_APP_URL=<deployed-origin> node .freebuff/smoke-pilot-loop.mjs`
      (replays guru→study→grade→guardian→certificate→PDF→record→health
      against the pilot Supabase project; expects **PILOT SMOKE GREEN**);
      then **rotate or delete** the public `DemoPass-2026!` demo accounts
      before inviting participants.
- [ ] Wire §7 monitoring (probe, thresholds, operator contact, log retention).
- [ ] Re-run the CSP review (§4.7) with the hosts lessons actually use
      (add any new trusted host to the `frame-src` allowlist + re-run e2e
      public/responsive specs before enabling that content).
- [ ] Record the outcome (host, refs, env set used, smoke results) in
      `PROGRESS.md` under a new "Pilot deployment" entry.
