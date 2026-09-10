# Production Readiness Checklist

> **Purpose:** Single-source printable checklist for launching the LMS from pilot/demo to production.
> Every item has an owner, verification command, and pass/fail checkbox.
> Print this file, check off items as you go, and record evidence in `PROGRESS.md`.

---

## 0. Pre-flight Gates (must ALL pass before any deployment)

Run on the exact commit that will be deployed, from a clean checkout:

| # | Gate | Command | Expected | Owner | ✅ |
|---|------|---------|----------|-------|----|
| 0.1 | Working tree clean | `git status --short` | Empty output | Dev | ☐ |
| 0.2 | Format | `npm run format:check` | Exit 0 | Dev | ☐ |
| 0.3 | Lint | `npx eslint . --max-warnings=0` | 0 errors, 0 warnings | Dev | ☐ |
| 0.4 | Typecheck | `npx tsc --noEmit` | 0 errors | Dev | ☐ |
| 0.5 | Unit/Integration tests | `npx vitest run` | All pass (880+) | Dev | ☐ |
| 0.6 | Production build | `npm run build` | Exit 0, all routes | Dev | ☐ |
| 0.7 | Release gate script | `bash scripts/release-gate.sh` | 6/6 pass | Dev | ☐ |
| 0.8 | DB typecheck | `npx supabase db typecheck` | OK (all migrations) | Dev | ☐ |
| 0.9 | Env validation | `node scripts/check-env.mjs` | "check-env OK" | Dev | ☐ |

**Do NOT proceed past this point unless all 9 gates are green.**

---

## 1. Domain & DNS Setup

| # | Task | Details | Owner | Status |
|---|------|---------|-------|--------|
| 1.1 | Register domain | Purchase/confirm domain ownership (e.g. `your-school.edu`) | Ops | ☐ |
| 1.2 | Choose canonical host | `learn.<domain>` for production, `pilot.<domain>` for staging | Ops/Dev | ☐ |
| 1.3 | DNS A/CNAME record | Point canonical host to hosting platform | Ops | ☐ |
| 1.4 | DNS propagation verified | `dig learn.<domain>` returns correct IP | Ops | ☐ |
| 1.5 | TTL set low (300s) | Keep low until switchover settles | Ops | ☐ |
| 1.6 | Wildcard or additional records | Add any preview/staging subdomains | Ops | ☐ |

### DNS record template

| Record | Type | Name | Value | TTL |
|--------|------|------|-------|-----|
| Root | A or CNAME | `@` | `<hosting-ip-or-cname>` | 300 |
| Production | CNAME | `learn` | `<hosting-cname>` | 300 |
| Pilot (optional) | CNAME | `pilot` | `<hosting-cname>` | 300 |

---

## 2. HTTPS / TLS

| # | Task | Verification | Owner | Status |
|---|------|-------------|-------|--------|
| 2.1 | TLS certificate issued | `curl -sI https://learn.<domain>` → HTTP/2 200 | Ops | ☐ |
| 2.2 | HTTP → HTTPS redirect | `curl -sI http://learn.<domain>` → 301 to https:// | Ops | ☐ |
| 2.3 | HSTS header present | `curl -sI https://learn.<domain> \| grep strict-transport` | Ops | ☐ |
| 2.4 | Minimum TLS 1.2 | SSL Labs test ≥ A rating | Ops | ☐ |
| 2.5 | No mixed content | Browser console shows no "mixed content" warnings | QA | ☐ |
| 2.6 | Supabase Site URL updated | Dashboard → Auth → URL Configuration → Site URL = `https://learn.<domain>` | Dev | ☐ |
| 2.7 | Supabase Redirect URLs | Add `https://learn.<domain>/*` to allowed redirects | Dev | ☐ |

### PaaS vs VPS

| Approach | HTTPS | Notes |
|----------|-------|-------|
| **PaaS** (Vercel, Railway, Fly) | Automatic | Least ops work |
| **VPS** (Ubuntu + Caddy) | Auto via Caddy | Use `caddy reverse_proxy 127.0.0.1:3000` |
| **VPS** (nginx + certbot) | Manual certbot | More config, same result |

---

## 3. Environment Variables

### 3.1 Runtime keys (set in hosting platform UI)

| Key | Pilot Value | Production Value | Source | ✅ |
|-----|-------------|------------------|--------|----|
| `NEXT_PUBLIC_APP_URL` | `https://pilot.<domain>` | `https://learn.<domain>` | — | ☐ |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<pilot-ref>.supabase.co` | `https://<prod-ref>.supabase.co` | Supabase dashboard | ☐ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pilot anon key | prod anon key | Supabase dashboard → API | ☐ |
| `SUPABASE_SECRET_KEY` | pilot service role | prod service role | **Server-only, never in git** | ☐ |
| `CERTIFICATE_SIGNING_SECRET` | fresh random ≥32 chars | fresh random ≥32 chars (distinct) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | ☐ |
| `NODE_ENV` | `production` | `production` | — | ☐ |

### 3.2 Feature flags

| Key | Pilot | Production | Notes |
|-----|-------|------------|-------|
| `CSP_REPORT_ONLY` | `true` | `false` (after clean report window) | Start report-only, switch to enforce |
| `CSP_ALERT_THRESHOLD_PER_MIN` | `20` | `20` | Spike detection threshold |
| `BLOCKCHAIN_ANCHOR_ENABLED` | `false` | `false` | Keep off until provider approved |
| `BLOCKCHAIN_PROVIDER` | empty | empty | No provider for pilot |
| `AI_FEEDBACK_ENABLED` | `false` | `false` | Requires org consent + provider |
| `CODE_RUNNER_ENABLED` | `false` | `false` | Requires external sandbox |
| `NEXT_PUBLIC_CODE_RUNNER_IN_BROWSER` | `false` | `false` | Pyodide WASM, opt-in |
| `ROBLOX_WEBHOOK_SECRET` | empty | empty | Integration off |

### 3.3 Secrets generation

```bash
# Certificate signing secret (32 bytes, base64url)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Record in password manager — never commit to git
```

### 3.4 Verification

```bash
# After setting env vars, verify:
curl -s https://learn.<domain>/api/health
# Expected: {"status":"ready","envConfigured":true,...}

# If validationError is present, the env set is incomplete
# Check node logs for the specific failing field names (never values)
```

---

## 4. Supabase Project Setup

### 4.1 Create fresh project (per environment)

| # | Task | Command/Dashboard | Owner | Status |
|---|------|-------------------|-------|--------|
| 4.1.1 | Create project | supabase.com/dashboard → New Project | Ops | ☐ |
| 4.1.2 | Set DB password | Save in password manager | Ops | ☐ |
| 4.1.3 | Enable Email provider | Auth → Providers → Email | Dev | ☐ |
| 4.1.4 | Configure password policy | Auth → Settings → Min length ≥ 8 | Dev | ☐ |
| 4.1.5 | Create Storage buckets | `certificates` (private), `submissions` (private) | Dev | ☐ |

### 4.2 Push schema

```bash
# Link to new project
npx supabase link --project-ref <new-project-ref>

# Push all migrations
npx supabase db push --linked

# Verify
npx supabase db typecheck
```

### 4.3 Seed data (pilot only)

```bash
# Pilot: seed demo accounts
npx supabase db query --linked --file supabase/seed.sql

# Production: NO seed — invite real users through normal path
```

---

## 5. Demo Data Cleanup (CRITICAL before real students)

> ⚠️ **Never put real student data in a demo-seeded project.**

| # | Task | Command | Owner | Status |
|---|------|---------|-------|--------|
| 5.1 | **Rotate all demo passwords** | Dashboard → Auth → Users → change passwords | Dev/Ops | ☐ |
| 5.2 | **Or delete demo accounts** | Dashboard → Auth → Users → delete guru/murid/wali | Dev/Ops | ☐ |
| 5.3 | Verify old passwords rejected | `curl -X POST .../auth/v1/token -d '{"email":"murid01@demo.local","password":"DemoPass-2026!"}'` → 400 | Dev | ☐ |
| 5.4 | Verify rotated passwords work | Same curl with new password → 200 + JWT | Dev | ☐ |
| 5.5 | No `DemoPass-2026!` in app code | `bash scripts/release-gate.sh` gate 1 passes | Dev | ☐ |
| 5.6 | No `demo.local` in server actions | `bash scripts/release-gate.sh` gate 2 passes | Dev | ☐ |
| 5.7 | `.env` file NOT committed | `git ls-files .env` → empty | Dev | ☐ |
| 5.8 | `SUPABASE_ACCESS_TOKEN` NOT in production env | Verify it's absent from hosting platform | Ops | ☐ |

### Demo account inventory

| Email | Password (local) | Password (hosted) | Route |
|-------|-------------------|-------------------|-------|
| guru@demo.local | DemoPass-2026! | PhysDemo-2026! (rotated) | /teacher |
| murid01@demo.local | DemoPass-2026! | PhysDemo-2026! (rotated) | /learn |
| murid02@demo.local | DemoPass-2026! | PhysDemo-2026! (rotated) | /learn |
| murid03@demo.local | DemoPass-2026! | PhysDemo-2026! (rotated) | /learn |
| wali@demo.local | DemoPass-2026! | PhysDemo-2026! (rotated) | /guardian |

---

## 6. Deployment

### 6.1 Application deployment

| # | Task | Command | Owner | Status |
|---|------|---------|-------|--------|
| 6.1.1 | Merge to main | `git push origin main` (CI must be green) | Dev | ☐ |
| 6.1.2 | Push migrations to target DB | `npx supabase db push --linked` | Dev | ☐ |
| 6.1.3 | Build application | `npm ci && npm run build` | Platform | ☐ |
| 6.1.4 | Deploy to hosting | Platform auto-deploy or `npm run start` | Platform | ☐ |
| 6.1.5 | Health check | `curl -s https://learn.<domain>/api/health` → 200 | Dev/QA | ☐ |

### 6.2 Post-deploy smoke test (15 min)

| # | Check | Expected | Result |
|---|-------|----------|--------|
| 6.2.1 | `/` landing page | 200, hero renders | ☐ |
| 6.2.2 | `/login` page | 200, form visible | ☐ |
| 6.2.3 | `/api/health` | 200, `envConfigured: true` | ☐ |
| 6.2.4 | `/unauthorized` page | 200, error page renders | ☐ |
| 6.2.5 | Login guru → `/teacher` | 200, dashboard renders | ☐ |
| 6.2.6 | Login murid → `/learn` | 200, dashboard renders | ☐ |
| 6.2.7 | Login wali → `/guardian` | 200, dashboard renders | ☐ |
| 6.2.8 | Sign out → `/login` | Session cleared, redirected | ☐ |
| 6.2.9 | Certificate verify page | 200, public verifier works | ☐ |
| 6.2.10 | CSP header present | `curl -sI \| grep content-security-policy` | ☐ |
| 6.2.11 | No console errors | Browser DevTools → clean | ☐ |
| 6.2.12 | Mobile viewport (375px) | No horizontal overflow | ☐ |

---

## 7. Monitoring & Alerting

### 7.1 Health monitoring

| # | What | How | Threshold | Owner | Status |
|---|------|-----|-----------|-------|--------|
| 7.1.1 | Uptime check | External service on `/api/health` every 60s | Alert if not 200 | Ops | ☐ |
| 7.1.2 | Response time | Log p95/p99 from proxy timing headers | p95 < 800ms | Ops | ☐ |
| 7.1.3 | Error rate | Hosting platform logs/alerts | < 1% | Ops | ☐ |

### 7.2 CSP monitoring

| # | What | How | Threshold | Owner | Status |
|---|------|-----|-----------|-------|--------|
| 7.2.1 | CSP violations | `GET /api/operator/csp-alerts` | Spike > 20/min = alert | Dev/Ops | ☐ |
| 7.2.2 | Violation log | `/api/csp-report` endpoint | Review weekly | Dev | ☐ |
| 7.2.3 | Enforcement flip | Set `CSP_REPORT_ONLY=false` | Only after clean window | Dev | ☐ |

### 7.3 Database monitoring

| # | What | How | Frequency | Owner | Status |
|---|------|-----|-----------|-------|--------|
| 7.3.1 | Connection pool | Supabase dashboard → Database | Daily | Ops | ☐ |
| 7.3.2 | Slow queries | Supabase dashboard → Logs | Weekly | Dev | ☐ |
| 7.3.3 | Storage usage | Supabase dashboard → Storage | Weekly | Ops | ☐ |
| 7.3.4 | RLS denial tests | `bash scripts/live-denial/run.sh` | Before each deploy | Dev | ☐ |

### 7.4 Application monitoring

| # | What | How | Frequency | Owner | Status |
|---|------|-----|-----------|-------|--------|
| 7.4.1 | Build failures | CI notification (GitHub) | On every push | Dev | ☐ |
| 7.4.2 | Test failures | CI notification (GitHub) | On every push | Dev | ☐ |
| 7.4.3 | Lighthouse audit | Manual run on landing + dashboards | Monthly | Dev | ☐ |

---

## 8. Security Checklist

| # | Item | Verification | Owner | Status |
|---|------|-------------|-------|--------|
| 8.1 | No `SUPABASE_SECRET_KEY` in browser | `grep -r "SUPABASE_SECRET" app/` → empty | Dev | ☐ |
| 8.2 | No hardcoded passwords in code | `bash scripts/release-gate.sh` → 6/6 | Dev | ☐ |
| 8.3 | RLS enabled on all exposed tables | `npx supabase db typecheck` | Dev | ☐ |
| 8.4 | Denial tests pass | 95/95 via `scripts/live-denial/` | Dev | ☐ |
| 8.5 | CSP enforced (or report-only reviewed) | `curl -sI \| grep content-security-policy` | Dev | ☐ |
| 8.6 | Nonce-based script-src | `curl -sI \| grep x-nonce` → fresh nonce per request | Dev | ☐ |
| 8.7 | TLS enforced | HSTS header present | Ops | ☐ |
| 8.8 | Demo passwords rotated or deleted | Old password rejected (400) | Dev/Ops | ☐ |
| 8.9 | `.env` not in git | `git ls-files .env` → empty | Dev | ☐ |
| 8.10 | Service key server-only | Audit env vars on hosting platform | Ops | ☐ |

---

## 9. Rollback Plan

### If deployment fails

1. **App rollback:** `git revert <commit>` → push → platform auto-redeploys
2. **DB rollback:** Create a forward-fix migration (NEVER `db reset` on live)
3. **Last resort:** Restore from backup via `scripts/restore-rehearsal/`

### Rollback triggers

| Trigger | Action | R负责人 |
|---------|--------|--------|
| Health check fails | Revert last deploy | Dev |
| Login broken for any role | Revert + investigate | Dev |
| Data corruption suspected | Stop writes → restore rehearsal | Dev/Ops |
| CSP violations spike | Check `/api/operator/csp-alerts` → investigate | Dev |
| Error rate > 5% | Revert + investigate | Dev/Ops |

---

## 10. Pilot → Production Promotion

When the pilot is stable (2+ weeks, no critical issues):

| # | Task | Owner | Status |
|---|------|-------|--------|
| 10.1 | Create fresh Supabase project (production) | Ops | ☐ |
| 10.2 | Push schema to production DB | Dev | ☐ |
| 10.3 | Set production env vars (distinct secrets) | Ops | ☐ |
| 10.4 | Deploy app to production host | Platform | ☐ |
| 10.5 | Configure DNS for production domain | Ops | ☐ |
| 10.6 | Run full smoke test on production | QA | ☐ |
| 10.7 | Enable monitoring/alerting on production | Ops | ☐ |
| 10.8 | Invite real teachers (no demo accounts) | Ops | ☐ |
| 10.9 | Configure email provider (SMTP) | Ops | ☐ |
| 10.10 | Set `CSP_REPORT_ONLY=false` after clean window | Dev | ☐ |
| 10.11 | Disable demo mode entirely | Dev | ☐ |
| 10.12 | Archive pilot data | Ops | ☐ |

---

## 11. Environment Variable Quick Reference

Copy this block and fill in real values:

```bash
# ── Production Environment Variables ──
NEXT_PUBLIC_APP_URL=https://learn.YOUR-DOMAIN.edu
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SECRET_KEY=YOUR_SERVICE_ROLE_KEY
CERTIFICATE_SIGNING_SECRET=YOUR_RANDOM_32_BYTES
NODE_ENV=production

# Security (start report-only, flip to false after clean window)
CSP_REPORT_ONLY=true
CSP_ALERT_THRESHOLD_PER_MIN=20

# Features (all OFF for pilot)
BLOCKCHAIN_ANCHOR_ENABLED=false
BLOCKCHAIN_PROVIDER=
AI_FEEDBACK_ENABLED=false
CODE_RUNNER_ENABLED=false
NEXT_PUBLIC_CODE_RUNNER_IN_BROWSER=false
ROBLOX_WEBHOOK_SECRET=

# Do NOT set in production:
# SUPABASE_ACCESS_TOKEN  (provisioning only)
# E2E_BASE_URL           (CI only)
# E2E_STUDENT_PASSWORD   (CI only)
```

---

## 12. Monitoring Dashboard Quick Links

| Service | URL | Purpose |
|---------|-----|---------|
| Supabase Dashboard | `https://supabase.com/dashboard` | DB, Auth, Storage, Logs |
| Hosting Dashboard | `<platform-url>` | Build logs, env vars, metrics |
| CSP Alerts | `https://learn.<domain>/api/operator/csp-alerts` | Violation spike monitoring |
| Health Check | `https://learn.<domain>/api/health` | Application readiness |
| Lighthouse | `https://pagespeed.web.dev/` | Performance audit |
| SSL Labs | `https://www.ssllabs.com/ssltest/` | TLS configuration audit |

---

## Appendix A: Supabase Project-per-Environment

| Environment | Supabase Project | Domain | Notes |
|-------------|-----------------|--------|-------|
| Local dev | `127.0.0.1:54321` | `localhost:3000` | `supabase start` |
| Pilot | `<pilot-ref>.supabase.co` | `pilot.<domain>` | Demo-seeded, rotated passwords |
| Production | `<prod-ref>.supabase.co` | `learn.<domain>` | Clean, no demo data |

## Appendix B: Critical Path Verification Commands

```bash
# Full pre-deploy verification
git status --short && \                           # Clean tree
npx eslint . --max-warnings=0 && \                 # Lint clean
npx tsc --noEmit && \                              # Type clean
npx vitest run && \                                 # Tests pass
npm run build && \                                  # Build succeeds
bash scripts/release-gate.sh && \                  # Gate 6/6
node scripts/check-env.mjs && \                    # Env valid
echo "✅ ALL GATES PASS"

# Post-deploy verification
curl -s https://learn.<domain>/api/health | node -e "
  const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);
  console.log(j.status==='ready'?'✅ Health OK':'❌ Health FAIL:',j);
"

# Full login test (each role)
for role in guru@demo.local murid01@demo.local wali@demo.local; do
  curl -s -X POST "https://<ref>.supabase.co/auth/v1/token?grant_type=password" \
    -H "Content-Type: application/json" -H "apikey: <key>" \
    -d "{\"email\":\"$role\",\"password\":\"<rotated-pw>\"}" | \
    grep -o '"access_token":"[^"]*"' | head -1 && echo "  ✅ $role" || echo "  ❌ $role"
done
```

---

**Document version:** 2026-09-10
**Maintained by:** Buffy (Codebuff agent)
**Review cycle:** Before each deployment
