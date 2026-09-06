# Implementation Progress

Dokumen ini diisi agent berdasarkan bukti aktual.

## Current phase

- Phase: Prompt 03 SELESAI (static gates) — siap Prompt 04
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

## Phase checklist

- [x] Phase 0 Foundation — Next 16.3.4 + TS strict + Tailwind v4 + ESLint + Prettier + Vitest (unit/integration/component) + Playwright + CI (+format:check) + `.env.example` + shell publik/auth/murid/guru + `/api/health` + `/health` + `error.tsx`/`not-found.tsx` + `lib/time.ts` (Asia/Jakarta tampil, UTC simpan) + `supabase/config.toml` (dokumen; CLI belum ada). Exit: install bersih, build lolos, no secret — TERPENUHI per bukti di atas.
- [x] Phase 1 Identity/RBAC — schema + RLS least-privilege + denial tests 8/8 RBAC.md + 12 tests Phase 1 (`tests/integration/phase1.test.ts`: audit trigger, wali-tertaut, cross-org denial, published-read, answer-key protection, predicate check 20+ policy, service-only jobs/anchors) + guards server (`lib/auth/guards.ts`, layout murid/guru force-dynamic) + halaman login/logout/unauthorized/inactive/profile + audit trigger memberships/profiles + policy wali/org/cohort_member + RLS content-tree + `20260906000002_phase1_hardening.sql` + db-advisor kini memindai semua migration. Exit: static PASS; live-DB PENDING (butuh CLI/Docker).
- [~] Phase 2 Authoring/enrollment — hierarchy versioned + seed anonim + `validateCourseDraft` (6 kode issue) + `createCourse`/`publishCourseVersion`/`reorderSiblings`/`duplicateCourse`/`archiveCourse` + form course baru + halaman kelola (naik/turun, publish + checklist validasi, duplikat, arsip) + preview-as-student + katalog/level-map murid (live query, unlock server-side). KURANG: editor tambah level/lesson/activity via UI, reorder drag-drop.
- [~] Phase 3 Learning/progress — unlock server-side, next-best-action beralasan, autosave+offline player, event idempotent. KURANG: recompute job, retry queue sync, realtime/polling.
- [~] Phase 4 Assessment — auto-grade 7 tipe + fixtures, attempt idempotent, manual grade → revision via RPC. KURANG: quiz builder UI, release policy UI, rubric UI.
- [~] Phase 5 Analytics — matrix + risk explainable + CSV anti-injection. KURANG: drill-down, export route, item analysis.
- [~] Phase 6 Certificates — SHA-256 + QR + `/verify` minimal-PII + cetak A4 + revoke + chain stub OFF. KURANG: PDF server-side + signed download.
- [ ] Phase 7 Hardening/deployment — runbooks + CSP ada; KURANG: live advisor, restore rehearsal, dep audit, a11y scan.

## Known issues

- Migration `20260906000000_init.sql` / `20260906000001_storage.sql` manual (tanpa CLI) — regenerasi via `supabase migration new` + diff sebelum apply.
- `tsconfig.json` disentuh otomatis oleh Next build (jsx react-jsx, esModuleInterop); strict:true terjaga.
- Playwright 1.57.1 tidak ada di registry → dipin 1.63.0.
- Halaman demo murid/guru masih memakai data fallback hard-coded berlabel demo (temuan Prompt Verifikasi: ditandai eksplisit, diganti query live saat Supabase tersedia).
