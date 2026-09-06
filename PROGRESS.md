# Implementation Progress

Dokumen ini diisi agent berdasarkan bukti aktual.

## Current phase

- Phase: Prompt — Guardian dashboard slice (Wali). Kapabilitas RBAC.md "Lihat ringkasan anak tertaut" kini punya UI + route: route group `(guardian)` di-guard `requireActiveMembership(["guardian"])`, `/guardian` menampilkan ringkasan anak via guardian link aktif (baca terbatas RLS: profiles/enrollments/progress_snapshots), hub peran `/dashboard` menggantikan redirect login statis `/learn` (guru→/teacher, wali→/guardian, murid→/learn). Seed bertambah `wali@demo.local` (a500…-001) tertaut aktif ke Murid 01.
- Branch: main — working tree berisi pekerjaan sesi yang BELUM di-commit (demo-mode preview, e2e probe, live-denial harness, migration 000008, guardian slice, PROGRESS.md).
- Blocker sama: Supabase CLI/Docker tidak ada → render `/guardian` berisi data hanya bisa dibuktikan di mesin ber-Docker (login wali seed → /guardian); tanpa session route terbukti redirect 307 → /login.

### Prompt — Guardian dashboard slice (Wali: UI + route coverage)

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-09-06 | `npm run test` | PASS 20 files / 113 tests | +4 test statis `tests/integration/guardian.test.ts` (guard route, permukaan data RLS, hub peran, seed wali) |
| 2026-09-06 | `npm run build` | PASS | route baru /guardian + /dashboard ikut ter-build (dynamic) |
| 2026-09-06 | `curl /guardian` & `/dashboard` (tanpa session) | 307 → /login | guard server berjalan (mode configured, tanpa Supabase live) |
| 2026-09-06 | `bash scripts/live-denial/run.sh` (seed berubah: +wali) | PASS 38/38 | seed.sql tetap idempotent & aman utk harness |
| 2026-09-06 | `npm run e2e` | PASS 3 passed / 1 skipped | alur login murid tetap skip (backend absent); redirect hub dipakai di test login bila backend hidup |
| 2026-09-06 | preview `/` | PASS | tautan "Ringkasan wali" render di landing (snapshot) |
- Blockers tersisa: Supabase CLI/Docker tetap tidak ada → alur E2E login (auth flow) & HTTP layer PostgREST/GoTrue belum teruji; itu ranah berbeda dari denial RLS yang kini sudah LIVE.

### Prompt — Live-DB denial (mengangkat batasan static-only, ADR-004)

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-09-06 | `bash scripts/live-denial/run.sh` | PASS — 38 PASS / 0 FAIL, exit 0 | shim → 9 migration VERBATIM → grants → seed.sql → fixture org-2/wali/storage → 20_denial.sql (role+identitas via GUC) pada Postgres 18.4 |
| 2026-09-06 | bukti isolasi: `t01_b_profile_hidden`/`t01_b_membership_hidden`/`t01_b_enrollment_hidden` | PASS | Murid A (b00…001) melihat 0 baris Murid B (b00…002) |
| 2026-09-06 | bukti isolasi: `t03_org2_cohort_hidden`/`t03_org2_course_hidden`/`t03_org2_student_profile_hidden`/`t03_org2_membership_hidden` | PASS | Guru org-1 (a00…001) melihat 0 baris org-2 (a20…002) |
| 2026-09-06 | `npm run db:typecheck` | PASS | DB advisor OK (34 tables, 1 views) setelah migration 000008 |
| 2026-09-06 | `npm run test` | PASS 19 files / 109 tests | static tests tetap hijau dengan migration 000008 (test membaca file migration tertentu) |

## Verification evidence

### Prompt 01 — Phase 0 (sesi sebelumnya)

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-09-06 | `npm run format:check` | PASS | prettier 3.9.6; 11 file working-tree tidak terformat dirapikan via prettier --write (tanpa ubah semantik) |
| 2026-09-06 | `npm run lint` | PASS | eslint 9.37.0 --max-warnings=0 |
| 2026-09-06 | `npm run typecheck` | PASS | tsc --noEmit, strict:true; fix TS2783 di cohort-manager.tsx (duplicate key spread) |
| 2026-09-06 | `npm run test` | PASS 19 files / 109 tests | kontrak delete test diselaraskan ke DATA_MODEL.md (no hard delete hanya utk attempt/revision/certificate/audit); deleteContent draft-only+tanpa-attempt diizinkan |
| 2026-09-06 | `npm run build` | PASS | 30+ routes, semua ƒ dynamic/○ static |
| 2026-09-06 | `npm run db:typecheck` | PASS | DB advisor OK (34 tables, 1 views) |
| 2026-09-06 | secret scan (grep sb_secret/service_role/private key di luar node_modules) | PASS | hanya placeholder `.env.example` + string guard di docs/scripts |
| 2026-09-06 | `date` / timezone check | PASS | `lib/time.ts` DISPLAY_TIMEZONE=Asia/Jakarta; simpan via `new Date().toISOString()` (UTC) & `now()` timestamptz |
| 2026-09-06 | wiring env validation | DONE | `getServerEnv()` (Zod) kini dipakai `/api/health` readiness; tidak membocorkan nilai env |

### Prompt 02 — Phase 1 (sesi ini)

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-09-06 | `npm run db:typecheck` | PASS | DB advisor OK (34 tables, 1 view) — semua exposed table RLS |
| 2026-09-06 | `npm run format:check` | PASS | prettier 3.9.6 |
| 2026-09-06 | `npm run lint` | PASS | eslint --max-warnings=0 |
| 2026-09-06 | `npm run typecheck` | PASS | tsc --noEmit strict |
| 2026-09-06 | `npm run test` | PASS 19 files / 109 tests | phase1 12, rls 21 (memetakan 8 denial RBAC.md), security 4 |
| 2026-09-06 | `npm run build` | PASS | 30+ routes + Proxy |
| 2026-09-06 | grep keamanan: role dari user_metadata, `getSession()` di server, service client di file `use client`, secret ber-prefix NEXT_PUBLIC | PASS | kosong; `SUPABASE_SECRET_KEY` hanya di `lib/env.ts` + `lib/supabase/service.ts` (server-only) |
| 2026-09-06 | denial bukti: policy `student_id = auth.uid()` (11x) & `owner_id = auth.uid()`/`is_teacher_of` (26x) | PASS | isolasi Murid A↔B dan Guru lintas-org; role CHECK hanya teacher/student/guardian (ADR-008) |

## Phase checklist

- [x] Phase 0 Foundation — Next 16.3.4 + TS strict + Tailwind v4 + ESLint + Prettier + Vitest (unit/integration/component) + Playwright + CI (+format:check) + `.env.example` + shell publik/auth/murid/guru + `/api/health` + `/health` + `error.tsx`/`not-found.tsx` + `lib/time.ts` (Asia/Jakarta tampil, UTC simpan) + `supabase/config.toml` (dokumen; CLI belum ada). Exit: install bersih, build lolos, no secret — TERPENUHI per bukti di atas.
- [x] Phase 1 Identity/RBAC — schema + RLS least-privilege + denial tests 8/8 RBAC.md + 12 tests Phase 1 (`tests/integration/phase1.test.ts`: audit trigger, wali-tertaut, cross-org denial, published-read, answer-key protection, predicate check 20+ policy, service-only jobs/anchors) + guards server (`lib/auth/guards.ts`, layout murid/guru force-dynamic) + halaman login/logout/unauthorized/inactive/profile + audit trigger memberships/profiles + policy wali/org/cohort_member + RLS content-tree + `20260906000002_phase1_hardening.sql` + db-advisor kini memindai semua migration. Exit: static PASS **+ live-DB denial TERJALAN 38/38 PASS** (`scripts/live-denial/` pada Postgres 18 tanpa Docker).
- [x] Phase 2 Authoring/enrollment — + editor level/module/lesson/activity via UI (JSON konten tervalidasi, HTML ditolak), reorder semua sibling, preview, katalog live.
- [x] Phase 3 Learning/progress — resume live + autosave + retry queue sync + `recomputeProgress` idempotent + unlock server-side. KURANG: target mingguan/spaced review eksplisit.
- [x] Phase 4 Assessment — bank soal berversi + builder + limit/cooldown/timer server + sanitasi kunci + auto-grade server (service bypass) + release policy + grading queue + upload + revision audit. KURANG: AI draft feedback (butuh consent config).
- [x] Phase 5 Analytics — live overview/matrix/detail + alerts persist + CSV export + reconciliation tests. Item analysis & misconception map: belum.
- [x] Phase 6 Certificates — eligibility server + PDF A4 on-demand (ADR-009) + QR + revoke + chain OFF. KURANG: persist PDF ke bucket + UI reissue khusus.
- [x] Phase 7 Hardening/deployment — hardening tests + runbooks + release checklist + CSP/headers/rate-limit/upload guard. KURANG: live advisor, restore rehearsal, uji 2 viewport, E2E browser.

## Catatan sesi Prompt 01 (Phase 0)

Perubahan yang dibuat sesi ini (minimal, root-cause):

1. `app/(teacher)/teacher/cohorts/cohort-manager.tsx` — fix TS2783: spread berisi key `student`/`course` eksplisit + key dinamis yang sama; default dipindah ke dalam spread `?? {}`.
2. `tests/integration/authoring.test.ts` — test lama melarang `.delete()` di mana pun di `features/actions.ts`, lebih ketat dari kontrak dokumen. DATA_MODEL.md hanya melarang hard delete utk attempt/revision/certificate/audit log. `deleteContent` (working tree, belum commit) hanya menghapus node versi DRAFT yang subtree-nya TANPA attempt (guard PUBLISHED_IMMUTABLE + HAS_ATTEMPTS). Test diselaraskan: tepat 1 `.delete()` yang diizinkan + tanpa hard delete tabel append-only.
3. `app/api/health/route.ts` — readiness kini memvalidasi seluruh env server via `getServerEnv()` (Zod); 503 + `validationError` berisi nama field (tanpa nilai) saat env malformed. `lib/env.ts` sebelumnya dead code (tidak diimpor siapa pun).
4. 11 file working-tree paralel dirapikan format dengan prettier --write (proyek mewajibkan `format:check`); tanpa perubahan semantik.

## Catatan sesi Prompt — Guardian dashboard slice

Perubahan sesi ini:

1. `app/(guardian)/layout.tsx` (baru) + `app/(guardian)/guardian/page.tsx` (baru) — route `/guardian` di-guard `requireActiveMembership(["guardian"])`; halaman membaca guardian_links aktif milik user lalu ringkasan per anak (profil, enrollment aktif, rollup progress_snapshots level) — hanya tabel ber-policy guardian RLS, tanpa attempts/responses.
2. `app/dashboard/page.tsx` (baru) — hub peran server-side: membership aktif → guru /teacher, wali /guardian, murid /learn; tanpa membership → /profile. `app/(auth)/login/page.tsx` kini `router.push("/dashboard")` (sebelumnya selalu `/learn` — guru/wali berakhir di /unauthorized). Keputusan kecil, dicatat di sini (tanpa ADR formal).
3. `supabase/seed.sql` — akun demo `wali@demo.local` (uuid `a5000000-…-001`, role guardian) + guardian link aktif → Murid 01 (`b0000000-…-001`); idempotent. `docs/e2e-setup.md` tabel akun diperbarui.
4. `tests/integration/guardian.test.ts` (baru, 4 test statis) + tautan "Ringkasan wali" di landing (`app/page.tsx`).



- Migration `20260906000000_init.sql` / `20260906000001_storage.sql` manual (tanpa CLI) — regenerasi via `supabase migration new` + diff sebelum apply.
- `tsconfig.json` disentuh otomatis oleh Next build (jsx react-jsx, esModuleInterop); strict:true terjaga.
- Playwright 1.57.1 tidak ada di registry → dipin 1.63.0; chromium terinstall (`npx playwright install chromium`).
- UPDATE: seluruh pekerjaan paralel (cohorts, edit-node, certificates, issue-button, edit-profile + actions/validation) sudah di-commit f19ba9e — working tree bersih.
- Halaman demo murid/guru memakai data fallback hard-coded berlabel demo (temuan Prompt Verifikasi: ditandai eksplisit, diganti query live saat Supabase tersedia). UPDATE: /learn, /catalog, /teacher kini live query + empty state; fallback demo hanya bila tanpa enrollment.
- Migration manual kini 9 file (000000–000008); db-advisor memindai semuanya.
- Phase 1 exit criteria: TERPENUHI STATIS **dan LIVE** — denial 38/38 PASS pada Postgres 18 via `scripts/live-denial/` (shim Supabase + migration verbatim + seed + fixture; lihat `scripts/live-denial/README.md`). Supabase CLI/Docker tetap tidak ada → hanya lapisan HTTP (PostgREST/GoTrue) yang belum teruji.
- Mode demo DEV-ONLY (preview tanpa Supabase): `lib/supabase/demo.ts` + `createClient()` demo-aware + guard demo identity + banner amber di root layout — halaman guarded (/learn, /teacher, /profile, cohorts, questions, dll) RENDER state kosong alih-alih error boundary saat `next dev` tanpa env. `createStrictClient` di server actions & 3 API handlers (export, pdf, public verifier) menjaga write/API tetap fail keras; NODE_ENV=production tidak pernah masuk mode demo (fail closed). File: `lib/supabase/demo.ts` (baru), `lib/supabase/server.ts`, `lib/auth/guards.ts`, `app/layout.tsx`, `features/actions.ts`, 3 route handlers, `.prettierignore` (+next-env.d.ts).
- Responsive audit publik (/, /login, /health, /unauthorized, /verify) via Playwright chromium @360/768/1440px: 0 horizontal overflow di semua route & lebar; satu-satunya elemen ber-overflow internal adalah skip-link `sr-only` (by design). Screenshot: `.freebuff/responsive/*.png` (tool dir, tidak di-commit). CATATAN: `/verify` hanya teruji dalam state 404 (tanpa row demo + RLS anon Phase 6); state valid (dl flex justify-between) belum teruji @360px.
- Live-denial harness: `scripts/live-denial/` (00_shim, 05_grants, 10_fixture, 20_denial, run.sh, README) — tooling dev, dipakai manual; tidak bagian CI (CI tanpa Postgres). Migration `20260906000008_rls_recursion_fix.sql` berisi perbaikan 2 bug nyata yang hanya muncul saat eksekusi sungguhan (lihat README): recursion cycle policy dan grant EXECUTE helper private ke authenticated.
