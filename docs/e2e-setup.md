# E2E Playwright — setup & seed yang dibutuhkan

Suite: `tests/e2e/critical.spec.ts` (`npm run e2e`, playwright 1.63, chromium).

## Mode berjalan

Suite membaca `GET /api/health` pada baseURL:

| Mode | Deteksi | Cakupan yang dijalankan |
|---|---|---|
| Tanpa env (mode demo) | `/api/health` `envConfigured:false` | Smoke publik + verifier (fallback demo 200) — selalu hijau. Test butuh-session **di-skip**. |
| Env placeholder, stack mati (mis. hasil `cp .env.example .env` tanpa `supabase start`) | `envConfigured:true` tapi Supabase tidak terjangkau | Smoke publik selalu hijau; verifier menerima `200 \| 404` tanpa PII; test butuh-session **di-skip** (probe koneksi `{SUPABASE_URL}/auth/v1/health`). |
| Backend hidup (Supabase lokal) | `envConfigured:true` **dan** `{SUPABASE_URL}/auth/v1/health` 200 | Seluruh suite: + login murid seed → dashboard `/learn`. |

Runbook ini = cara mencapai mode **backend hidup** sehingga tidak ada skip.

## 1. Prasyarat infrastruktur

- Docker Desktop (engine) berjalan — Supabase CLI tidak bisa `start` tanpa Docker.
- Supabase CLI: `npx supabase --version` (atau install global `supabase`).
- Chromium: `npx playwright install chromium` (sekali per environment).

## 2. Jalankan Supabase lokal + seed

```bash
npx supabase start        # build & start stack lokal (Postgres 54322, API 54321, Studio 54323)
npx supabase db reset     # terapkan 8 migration + supabase/seed.sql dari awal
```

`supabase/seed.sql` sekarang **self-contained untuk local/preview** dan idempotent
(`on conflict do nothing`). Isinya:

1. **auth seed** — `auth.users` + `auth.identities` (UUID tetap, bcrypt via `extensions.crypt`, `email_confirmed_at` diset, provider `email`).
2. **domain seed** — org, profiles, memberships, cohorts, course+levels, enrollments.
3. **demo certificate** — row `demo-valid-certificate` untuk verifier publik.

### Akun seed lokal (anonim, NON-RAHASIA — hanya untuk local)

| Role | Email | Password | UUID (FK ke domain seed) |
|---|---|---|---|
| Teacher | `guru@demo.local` | `DemoPass-2026!` | `a0000000-0000-0000-0000-000000000001` |
| Guardian (Wali) | `wali@demo.local` | `DemoPass-2026!` | `a5000000-0000-0000-0000-000000000001` |
| Student | `murid01@demo.local` | `DemoPass-2026!` | `b0000000-0000-0000-0000-000000000001` |
| Student | `murid02@demo.local` | `DemoPass-2026!` | `b0000000-0000-0000-0000-000000000002` |
| Student | `murid03@demo.local` | `DemoPass-2026!` | `b0000000-0000-0000-0000-000000000003` |

Wali (`wali@demo.local`) tertaut via **guardian link aktif** ke Murid 01, jadi
login dengannya → `/dashboard` → `/guardian` (Ringkasan anak).

Ubah password di clone Anda bila perlu; jangan pernah memakai akun demo ini di
environment non-local.

## 3. Environment app (`.env` lokal)

Salin placeholder dan isi nilai dari stack lokal Anda:

```bash
cp .env.example .env
```

Nilai yang dibutuhkan (ambil dari output `npx supabase status -o env`):

| Var | Nilai lokal |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key dari `supabase status` |
| `SUPABASE_SECRET_KEY` | service_role key dari `supabase status` |
| `CERTIFICATE_SIGNING_SECRET` | string dev ≥32 char (bukan secret nyata di `.env.example`; isi `.env` lokal) |
| `BLOCKCHAIN_ANCHOR_ENABLED` | `false` |

Jangan commit `.env`. `/api/health` memvalidasi var-var ini via `lib/env.ts`
(`envConfigured:true` hanya bila seluruhnya valid → suite naik ke mode hidup).

## 4. Jalankan suite

```bash
npm run dev -- -p 3000     # terminal 1 (webServer reuse kalau sudah jalan; PORT=0 di sandbox → wajib -p)
npm run e2e                # terminal 2 — playwright config: baseURL http://127.0.0.1:3000
```

Playwright me-reuse server yang sudah berjalan di :3000 (`reuseExistingServer:true`).
Di CI, set `E2E_BASE_URL` dan jalankan app + Supabase sebagai service terpisah.

Kredensial murid bisa dioverride per run:

```bash
E2E_STUDENT_EMAIL=murid01@demo.local E2E_STUDENT_PASSWORD='DemoPass-2026!' npm run e2e
```

## 5. Pemetaan test → requirement

| Test | Butuh | Tanpa backend |
|---|---|---|
| landing → login shell | — | jalan |
| keyboard-only (skip-link fokus) | — | jalan |
| student login → `/learn` dashboard | Supabase lokal + seed + `.env` valid | **skip** (alasan tertulis) |
| verifier demo tidak bocor PII | — | selalu jalan; tanpa PII; `200`+`valid` hanya saat `envConfigured:false` (fallback demo), selain itu toleransi `200 \| 404` |

Untuk test 3 detail alurnya: `/login` (form email/password) → Supabase Auth
(`signInWithPassword`) → redirect `/learn` → guard `requireActiveMembership(["student"])`
membaca claims → profil aktif → membership student aktif (seed sudah menyediakan) →
heading dashboard `Target hari ini`.

## 6. Known blocker untuk mode hidup (bukan bug test)

Verifier publik `GET /api/public/certificates/demo-valid-certificate` memakai server
client anon. `certificates_public` adalah view `security_invoker=true` di atas tabel
ber-RLS **tanpa policy `to anon`** → anon selalu mendapat 404 saat DB hidup, apa pun
row yang di-seed. Fallback demo deterministik hanya aktif saat query *throw* (DB mati).

Artinya sampai Phase 6 menambahkan akses baca anon minimal-PII (policy select `to anon`
untuk `status='active'` pada tabel base view, dibatasi kolom), verifier publik hanya
bisa diverifikasi lewat mode backend-mati. Test e2e sengaja menoleransi `200 | 404`
dengan **kontrak keras: tidak boleh ada PII** — jadi suite tetap hijau di kedua mode
dan mulai menuntut `200` begitu policy anon + row seed tersedia.

## 7. Troubleshooting

- `supabase start` gagal → Docker engine tidak jalan; cek `docker info`.
- Login murid gagal di e2e → `auth.users`/`identities` belum ada (jalankan ulang
  `supabase db reset` setelah seed.sql berubah) atau `.env` anon key salah.
- Test 3 tetap skip padahal Supabase hidup → `/api/health` belum `ready`: cek
  `CERTIFICATE_SIGNING_SECRET` ≥32 char & key Supabase terisi di `.env`.
- `npx playwright install chromium` belum dijalankan → error "Executable doesn't exist".
