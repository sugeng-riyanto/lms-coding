# Production Deployment Checklist

> Step-by-step guide to deploy the LMS to production. Each section has
> checkboxes, expected time, and verification commands. Print this file
> and check off items as you go.

---

## Prerequisites

| Item | Owner | Status |
|---|---|---|
| Supabase project created (Database + Auth + Storage) | School ops | ☐ |
| Domain registered + DNS configured | School ops | ☐ |
| Hosting platform account (Vercel/Railway/Fly) | School ops | ☐ |
| Operator account created (receives alerts) | School ops | ☐ |
| Git access to `sugeng-riyanto/lms-coding` | Developer | ☐ |

---

## Phase 1: Supabase Project (30 min)

### 1.1 Create fresh project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project** → choose organization → name: `lms-production`
3. Set database password (save in password manager)
4. Wait for project to initialize (~2 min)

### 1.2 Configure Auth

1. **Authentication → Providers**: Enable Email provider
2. **Authentication → Settings → Email**: Disable "Confirm email" for pilot (enable for production with real students)
3. **Authentication → Settings → Security**: Set minimum password length to 8

### 1.3 Configure Storage

1. **Storage → New bucket**: `certificates` (private, no public access)
2. **Storage → New bucket**: `submissions` (private, student uploads)
3. Set bucket policies via SQL (already in migration `20260906000001_storage.sql`)

### 1.4 Push schema

```bash
# Link to new project
npx supabase link --project-ref <your-project-ref>

# Push all migrations (42 files)
npx supabase db push --linked

# Verify
npx supabase db typecheck  # should show ~40 tables, ~5 views
```

### 1.5 Seed demo data (optional for pilot)

```bash
# Push seed data (demo accounts + content)
npx supabase db query --linked --file supabase/seed.sql

# Verify seed
curl -s "https://<ref>.supabase.co/rest/v1/profiles?select=id,display_name&limit=5" \
  -H "apikey: <anon-key>"
```

### 1.6 Rotate demo passwords

```bash
# Via Supabase dashboard: Authentication → Users
# Change all 5 demo account passwords to unique strong passwords
# Record new passwords in a secure location (NOT in git)
```

---

## Phase 2: Domain & HTTPS (15 min)

### 2.1 DNS configuration

| Record | Type | Name | Value | TTL |
|---|---|---|---|---|
| Root | A or CNAME | `@` | `<hosting-ip-or-cname>` | 300 |
| Subdomain | CNAME | `lms` | `<hosting-cname>` | 300 |

### 2.2 SSL/TLS

Most hosting platforms (Vercel, Railway, Fly) auto-provision SSL certificates. Verify:

```bash
curl -I https://lms.<your-domain>  # should show HTTP/2 200 + strict-transport-security
```

If using Cloudflare or similar CDN:
1. Enable **Full (Strict)** SSL mode
2. Enable **Always Use HTTPS**
3. Set **Minimum TLS Version** to 1.2

---

## Phase 3: Hosting Setup (20 min)

### 3.1 Connect repository

1. Import `sugeng-riyanto/lms-coding` into hosting platform
2. Set build command: `npm run build`
3. Set start command: `npm start`
4. Set Node.js version: 20+ (check `.nvmrc` or `package.json` engines)

### 3.2 Environment variables

Set these in the hosting platform's environment variable UI:

```bash
# ── Public (safe for browser) ──
NEXT_PUBLIC_APP_URL=https://lms.<your-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<real-key>

# ── Server-only (NEVER expose to browser) ──
SUPABASE_SECRET_KEY=eyJ<real-service-role-key>
CERTIFICATE_SIGNING_SECRET=<random-32-byte-base64url>

# ── Security ──
CSP_REPORT_ONLY=true          # Start in report-only, switch to enforce later
CSP_ALERT_THRESHOLD_PER_MIN=20

# ── Features ──
BLOCKCHAIN_ANCHOR_ENABLED=false  # Keep false for pilot
CODE_RUNNER_ENABLED=false        # Enable after sandbox is configured
NEXT_PUBLIC_CODE_RUNNER_IN_BROWSER=false
AI_FEEDBACK_ENABLED=false

# ── Production ──
NODE_ENV=production
```

### 3.3 Generate secrets

```bash
# Certificate signing secret (32 bytes, base64url)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Record this value — it's used for PDF watermarking
```

### 3.4 First build

```bash
# Trigger a build on the hosting platform
# Check build logs for errors
# Verify /api/health returns {"status":"ready","envConfigured":true}
curl -s https://lms.<your-domain>/api/health
```

---

## Phase 4: Smoke Test (15 min)

### 4.1 Public pages

| URL | Expected | Status |
|---|---|---|
| `/` | Landing page renders (English) | ☐ |
| `/login` | Sign-in form | ☐ |
| `/health` | `{"status":"ready"}` | ☐ |
| `/unauthorized` | Error page | ☐ |

### 4.2 Auth flow

| Action | Expected | Status |
|---|---|---|
| Sign in as `guru@demo.local` | Redirects to `/teacher` | ☐ |
| Sign in as `murid01@demo.local` | Redirects to `/learn` | ☐ |
| Sign in as `wali@demo.local` | Redirects to `/guardian` | ☐ |
| Sign out | Clears session, redirects to `/login` | ☐ |

### 4.3 Teacher dashboard

| Feature | Expected | Status |
|---|---|---|
| `/teacher` | Dashboard with cohort matrix | ☐ |
| `/teacher/analytics` | Charts render | ☐ |
| `/teacher/courses` | Course list | ☐ |
| `/teacher/grading` | Grading queue | ☐ |
| `/teacher/questions` | Question bank + filter | ☐ |

### 4.4 Student flow

| Feature | Expected | Status |
|---|---|---|
| `/learn` | Level map + quiz scores | ☐ |
| `/catalog` | Course catalog | ☐ |
| `/quiz/{id}` | Quiz renders, submit works | ☐ |
| `/certificates` | Certificate list + download | ☐ |

### 4.5 Guardian flow

| Feature | Expected | Status |
|---|---|---|
| `/guardian` | Child progress + quiz scores + study time | ☐ |
| Certificate download | PDF opens | ☐ |
| Verify link | Public verifier renders | ☐ |

### 4.6 Security

| Check | Expected | Status |
|---|---|---|
| CSP header present | `Content-Security-Policy` in response | ☐ |
| RLS active | `npm run db:typecheck` PASS | ☐ |
| No secrets in browser | `grep -r "NEXT_PUBLIC.*SECRET" .env` returns nothing | ☐ |

---

## Phase 5: Go-Live (10 min)

### 5.1 Switch CSP to enforce

```bash
# In hosting platform env vars:
CSP_REPORT_ONLY=false

# Monitor /api/csp-report for 24h for false positives
```

### 5.2 Enable monitoring

1. Set up uptime monitoring (e.g., UptimeRobot, Checkly)
2. Monitor `/api/health` every 5 minutes
3. Set up CSP alert email/webhook (if configured)

### 5.3 Create operator account

1. Create a real teacher account (not demo)
2. Assign to the pilot cohort
3. Verify they can access all teacher features

### 5.4 Final password rotation

1. Rotate all demo account passwords to unique strong passwords
2. Delete or disable any accounts not needed for pilot
3. Record rotation in `PROGRESS.md`

---

## Phase 6: Post-Launch (24 hours)

### 6.1 Monitor

| Metric | Tool | Frequency |
|---|---|---|
| Uptime | UptimeRobot | Every 5 min |
| Error rate | Hosting logs | Every hour |
| CSP violations | `/api/csp-report` | Every hour |
| Auth failures | Supabase dashboard | Every 4 hours |

### 6.2 Backup

1. Enable point-in-time recovery in Supabase dashboard
2. Test restore procedure (see `docs/runbooks.md` §5)
3. Schedule daily `pg_dump` to secure storage (optional)

### 6.3 Documentation

1. Update `PROGRESS.md` with deployment evidence
2. Record domain, Supabase project ref, and operator contact
3. Share login credentials via secure channel (NOT email)

---

## Rollback Procedure

If something goes wrong:

1. **Code rollback**: `git revert <commit>` → push → hosting auto-deploys
2. **Database rollback**: Restore from point-in-time backup (Supabase dashboard)
3. **DNS rollback**: Point domain back to previous hosting

```bash
# Emergency: revert to last known good commit
git log --oneline -5  # find the good commit
git revert HEAD       # revert current
git push origin main  # auto-deploys
```

---

## Environment Matrix

| Variable | Pilot | Production |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://lms.pilot.example.com` | `https://lms.example.com` |
| `NODE_ENV` | `production` | `production` |
| `CSP_REPORT_ONLY` | `true` (first 24h) → `false` | `false` |
| `BLOCKCHAIN_ANCHOR_ENABLED` | `false` | `false` (until provider approved) |
| `CODE_RUNNER_ENABLED` | `false` | `false` (until sandbox ready) |
| `AI_FEEDBACK_ENABLED` | `false` | `false` (until consent configured) |
| `CERTIFICATE_SIGNING_SECRET` | Random 32 bytes | Random 32 bytes |
| `CSP_ALERT_THRESHOLD_PER_MIN` | `20` | `20` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health` returns 503 | Missing env vars | Check hosting env UI, run `node scripts/check-env.mjs` |
| Login fails with 500 | Seed users not created | Run seed SQL or create users via Supabase dashboard |
| PDF download fails | Storage bucket missing | Create `certificates` bucket (private) |
| CSP blocks scripts | Nonce not set | Ensure `CSP_REPORT_ONLY=true` during testing |
| Guardian sees "—" | Missing RLS policy | Run `npx supabase db push --linked` |
| 404 on all routes | Build failed | Check hosting build logs, fix TypeScript errors |
