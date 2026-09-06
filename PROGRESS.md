# Implementation Progress

Dokumen ini diisi agent berdasarkan bukti aktual.

## Current phase

- Phase: SEMUA PROMPT 00–12 SELESAI (static gates) — tersisa blockers eksternal: live Supabase, E2E browser, data murid nyata
- Branch: main (origin https://github.com/sugeng-riyanto/lms-coding.git)
- Last verified commit: 75e502b first commit (102 files; node_modules/.next/.env excluded via .gitignore)
- Blockers:
  - Supabase CLI + Docker tidak tersedia → migration manual, BELUM di-apply ke live Postgres; RLS terbukti statis, bukan live-DB.
  - `supabase/seed.sql` butuh auth.users via Auth admin API sebelum insert data domain.
  - Playwright E2E tertulis (`tests/e2e/critical.spec.ts`) tapi belum dijalankan (butuh `npx playwright install`).
  - CATATAN 2026-09-06: refresh dokumen root me-reset file ini ke template; dipulihkan dari bukti aktual di bawah. Disarankan `git init` + commit agar tracking tidak hilang lagi (butuh otorisasi).

## Verification evidence

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-09-06 | `npm run typecheck` | PASS | tsc --noEmit, strict:true |
| 2026-09-06 | `npm run lint` | PASS | eslint --max-warnings=0 |
| 2026-09-06 | `npm run test` | PASS 9 files / 60 tests | +publish-validation (8 tests) |
| 2026-09-06 | `npm run build` | PASS | 12 routes, termasuk /teacher/courses/new |
| 2026-09-06 | `npm run db:typecheck` | PASS | 32 tables RLS, 1 view security_invoker |
| 2026-09-06 | `npm run format:check` | PASS | prettier 3.9.6; *.md dikecualikan (ADR-007) |
| 2026-09-06 | `npm run test` | PASS 11 files / 65 tests | +time (4), +component print-button (1) |
| 2026-09-06 | `npm run build` | PASS | 14 routes (+/api/health, /health) |
| 2026-09-06 | secret scan (grep sb_secret/service_role/private key di luar node_modules) | PASS | hanya string guard di db-advisor; hanya `.env.example` berisi placeholder |
| 2026-09-06 | Prompt 02 gates | PASS semua | format, lint, typecheck, test 12 files/77 tests, build 16 routes, db advisor (3 migrations) |
| 2026-09-06 | Prompt 03 gates | PASS semua | format, lint, typecheck, test 14 files/85 tests, build 18 routes (+manage, preview, catalog), db advisor |
| 2026-09-06 | Prompt 03-sisa/04/05 gates | PASS | test 16 files/94 tests, build 21 routes (editor, quiz, bank, assessment) |
| 2026-09-06 | Prompt 06/07 gates | PASS | test 96, grading queue, live analytics, CSV export |
| 2026-09-06 | Prompt 08/09/10 gates | PASS | test 102, eligibility, PDF A4, merkle, roblox receipts |
| 2026-09-06 | Prompt 11/12 gates | PASS | test 109 (hardening 7), `docs/release-checklist.md`, rekomendasi CONDITIONAL GO |

## Phase checklist

- [x] Phase 0 Foundation — Next 16.3.4 + TS strict + Tailwind v4 + ESLint + Prettier + Vitest (unit/integration/component) + Playwright + CI (+format:check) + `.env.example` + shell publik/auth/murid/guru + `/api/health` + `/health` + `error.tsx`/`not-found.tsx` + `lib/time.ts` (Asia/Jakarta tampil, UTC simpan) + `supabase/config.toml` (dokumen; CLI belum ada). Exit: install bersih, build lolos, no secret — TERPENUHI per bukti di atas.
- [x] Phase 1 Identity/RBAC — schema + RLS least-privilege + denial tests 8/8 RBAC.md + 12 tests Phase 1 (`tests/integration/phase1.test.ts`: audit trigger, wali-tertaut, cross-org denial, published-read, answer-key protection, predicate check 20+ policy, service-only jobs/anchors) + guards server (`lib/auth/guards.ts`, layout murid/guru force-dynamic) + halaman login/logout/unauthorized/inactive/profile + audit trigger memberships/profiles + policy wali/org/cohort_member + RLS content-tree + `20260906000002_phase1_hardening.sql` + db-advisor kini memindai semua migration. Exit: static PASS; live-DB PENDING (butuh CLI/Docker).
- [x] Phase 2 Authoring/enrollment — + editor level/module/lesson/activity via UI (JSON konten tervalidasi, HTML ditolak), reorder semua sibling, preview, katalog live.
- [x] Phase 3 Learning/progress — resume live + autosave + retry queue sync + `recomputeProgress` idempotent + unlock server-side. KURANG: target mingguan/spaced review eksplisit.
- [x] Phase 4 Assessment — bank soal berversi + builder + limit/cooldown/timer server + sanitasi kunci + auto-grade server (service bypass) + release policy + grading queue + upload + revision audit. KURANG: AI draft feedback (butuh consent config).
- [x] Phase 5 Analytics — live overview/matrix/detail + alerts persist + CSV export + reconciliation tests. Item analysis & misconception map: belum.
- [x] Phase 6 Certificates — eligibility server + PDF A4 on-demand (ADR-009) + QR + revoke + chain OFF. KURANG: persist PDF ke bucket + UI reissue khusus.
- [x] Phase 7 Hardening/deployment — hardening tests + runbooks + release checklist + CSP/headers/rate-limit/upload guard. KURANG: live advisor, restore rehearsal, uji 2 viewport, E2E browser.

## Known issues

- Migration `20260906000000_init.sql` / `20260906000001_storage.sql` manual (tanpa CLI) — regenerasi via `supabase migration new` + diff sebelum apply.
- `tsconfig.json` disentuh otomatis oleh Next build (jsx react-jsx, esModuleInterop); strict:true terjaga.
- Playwright 1.57.1 tidak ada di registry → dipin 1.63.0.
- Halaman demo murid/guru memakai data fallback hard-coded berlabel demo (temuan Prompt Verifikasi: ditandai eksplisit, diganti query live saat Supabase tersedia). UPDATE: /learn, /catalog, /teacher kini live query + empty state; fallback demo hanya bila tanpa enrollment.
- Migration manual kini 8 file (000000–000007); db-advisor memindai semuanya.
