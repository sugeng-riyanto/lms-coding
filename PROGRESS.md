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
- [x] Phase 7 Hardening/deployment — hardening tests + runbooks + release checklist + CSP/headers/rate-limit/upload guard + uji viewport responsif diformalkan (`tests/e2e/responsive.spec.ts`, 15 test @360/768/1440 pada 5 route publik). KURANG: live advisor, restore rehearsal, wiring e2e ke CI (perluasan cakupan browser).

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
- Responsive audit publik (/, /login, /health, /unauthorized, /verify) via Playwright chromium @360/768/1440px: 0 horizontal overflow di semua route & lebar; satu-satunya elemen ber-overflow internal adalah skip-link `sr-only` (by design). Screenshot: `.freebuff/responsive/*.png` (tool dir, tidak di-commit). CATATAN: `/verify` hanya teruji dalam state 404 (tanpa row demo + RLS anon Phase 6); state valid (dl flex justify-between) belum teruji @360px. UPDATE: audit diformalkan menjadi `tests/e2e/responsive.spec.ts` (di-commit, 5 route × 3 viewport): cek doc overflow, elemen melewati tepi kanan, container overflow-x meng-clip, viewport meta, dan non-vakum (konten di-skip bila HTTP non-200, mis. fallback 404 `/verify` di dev tanpa row — Next dev merender shell kosong). Verifikasi: e2e 18 passed / 1 skipped (15 baru), typecheck PASS.
- Live-denial harness: `scripts/live-denial/` (00_shim, 05_grants, 10_fixture, 20_denial, run.sh, README) — tooling dev, dipakai manual; migration `20260906000008_rls_recursion_fix.sql` berisi perbaikan 2 bug nyata yang hanya muncul saat eksekusi sungguhan (lihat README): recursion cycle policy dan grant EXECUTE helper private ke authenticated.
- CI kini menggates live-denial juga: job `live-denial` di `.github/workflows/ci.yml` (setelah `verify`, service container `postgres:18` di port 5432 + `postgresql-client` via apt, lalu `bash scripts/live-denial/run.sh` dengan env `PGHOST/PGPORT/PGUSER/PGPASSWORD` default). Divalidasi lokal: suite tetap 38/38 PASS dengan kontrak env yang sama.

## Verifikasi gate ulang — HEAD 17e2c26 (2026-09-06)

Seluruh gate dijalankan ulang terhadap HEAD `17e2c26` (tree bersih + 2 file uncommitted: `ci.yml`, `PROGRESS.md` — tidak memengaruhi gate):

| Gate | Exit | Hasil |
|---|---|---|
| `format:check` | 0 | PASS (semua file prettier-clean) |
| `lint` | 0 | PASS (`eslint . --max-warnings=0`) |
| `typecheck` | 0 | PASS (`tsc --noEmit`) |
| `test` | 0 | PASS 113/113 (20 files) |
| `build` | 0 | PASS (production build) |
| `db:typecheck` | 0 | PASS (DB advisor: 34 tables, 1 view) |
| `e2e` | 0 | PASS 18 passed / 1 skipped (login skip: tanpa Supabase live; +15 responsive layout spec) |

Log per gate: `/tmp/gate-{format,lint,typecheck,test,build,db,e2e}.log` (tool dir, tidak di-commit).

## Catatan sesi — MVP target mingguan & spaced review (slice 1 dari rencana docs/plan-weekly-target-spaced-review.md)

Slice 1 (migration + fungsi murni + unit test) selesai; action/UI/seed/live-denial t09 menyusul:

1. `supabase/migrations/20260906000009_learning_planning.sql` (baru) — tabel `weekly_plans` (target per enrollment per minggu ISO, `goal_unit completions|minutes`, goal 1–50, unik `(enrollment_id, week_start)`) dan `review_items` (antrian review `level`, ladder via `interval_idx`, status `scheduled→completed|dismissed`, partial unique index `review_items_one_active` anti-duplikat). RLS granular student select/insert/update (enrollment sendiri aktif) + teacher select (cohort via `private.teacher_cohort_ids()`), **tanpa policy delete** (no hard delete). Lookup satu arah ke enrollments (pola 000004 yang live-tested) — bebas siklus recursion (pelajaran 000008); guru read-only MVP.
2. `lib/progress-planning.ts` (baru, fungsi murni) — `isoWeekStart`/`isSameIsoWeek` (minggu ISO dalam timezone org; utji lintas-tz UTC vs Asia/Jakarta), `weeklyRollup` (clamp pct/achieved), `firstReviewDue` (+interval pertama), `nextReviewAfter` (confidence ≥4 maju/cap, =3 ulang, ≤2 reset), `orderedReviewQueue` (overdue → hari ini → berikutnya, tie-break due_at→mastery→id). Helper tz: `zonedYmd`/`zonedToUtc` (Intl, koreksi offset iteratif). `DEFAULT_REVIEW_INTERVALS_DAYS=[1,3,7,14]`.
3. `tests/unit/progress-planning.test.ts` (baru, 17 test) — ladder, reset/cap, rollup clamp, batas minggu lintas tz (Minggu 20:00Z = Senin WIB), batas "hari ini" (00:00 besok WIB), imutabilitas.
4. Keputusan kecil vs rencana: policy memakai subquery langsung ke `enrollments` (bukan helper baru) karena satu arah & bebas recursion — konsisten dengan `progress_*` 000004 yang live-tested; tidak menambah fungsi private baru.

Gates slice: unit 17/17, **test 130/130 (21 files, +17)** , typecheck PASS, lint PASS, format:check PASS, `db:typecheck` PASS (advisor kini 36 tables), **live-denial 38/38 PASS dengan migration 000009 diaplikasikan verbatim di atas 000000–000008** (grant wildcard 05_grants menjangkau tabel baru). Belum: build tidak disentuh (lib belum diimpor route mana pun).

## Catatan sesi — Item analysis & misconception map (slice metrik, rencana docs/plan-item-analysis-misconception-map.md)

Slice fungsi murni + unit test selesai (tanpa migration/policy baru — baca lintas guru sudah ada via `responses_owner_select`/`attempts_teacher_select`):

1. `lib/analytics-item.ts` (baru) — `ITEM_METRIC_DEFINITIONS_VERSION="2026-09-06/v1"`, `ATTEMPT_DRAFT_STATUSES` (not_started/in_progress difilter DI DALAM fungsi agar penyebut metrik konsisten), `isCorrectResponse` (exact-match pilihan vs kunci; subset multiple_choice salah — konsisten `autoGrade`), `itemStatistics` (per soal: n, correct, difficulty p, omit rate, discrimination upper–lower tercile dengan `null` saat kelompok < minGroupN default 3), `distractorMap` (cluster opsi salah terpilih: picked, shareOfIncorrect, studentIds/Names; opsi benar & jawaban kosong tidak masuk). Output deterministik (urutan questionId; tie studentId/attemptId/optionId). Keputusan kecil vs rencana: kolom `autoScore`/`questionVersionId` dihapus dari interface — fungsi menghitung dari isi jawaban (correctOptionIds vs chosenOptionIds), bukan skor; pemfilteran draft di dalam fungsi demi konsistensi denominator.
2. `tests/unit/analytics-item.test.ts` (baru, 13 test) — eligibilitas draft, exact-match termasuk subset MC, difficulty/omit, discrimination positif & null (cohort kecil), cluster distractor (single_choice/true_false + MC, kosong dikecualikan), determinisme, reconciliation hitung-manual dari baris raw.

Gates slice: unit 13/13, **test 143/143 (22 files, +13)** , typecheck PASS (0 error), lint PASS, prettier PASS. Belum: halaman `/teacher/analytics` + link dashboard, export `kind=item-analysis` (D2), t10_* live-denial opsional — sesuai rencana.

## Catatan sesi — Phase 6 reissue: migration 000010 (slice migration, rencana docs/plan-certificate-persist-reissue.md)

1. `supabase/migrations/20260906000010_certificate_reissue.sql` (baru): drop `certificates_enrollment_id_level_id_key` (unique LINTAS STATUS — sumber reissue impossible) → partial unique index `certificates_one_active (enrollment_id, level_id) where status='active'` (satu ACTIVE per pair; riwayat revoked boleh banyak). Fungsi baru `private.reissue_certificate(cert_id, reason, idempotency_key)` definer + search_path + caller check: revoke lama + issue baru + SATU audit `certificate.reissued` (old/new/reason) dalam satu transaksi; retry-safe — panggilan kedua saat lama sudah revoked mengembalikan active yang ada utk pair sama; status TETAP active/revoked (verifier view/RLS tak berubah, D1 rencana). Wrapper public + grant authenticated.
2. **Bug live yang migration ini ungkap**: drop constraint lama memutus `issue_certificate` — `on conflict (enrollment_id, level_id)` tak bisa match index PARTIAL tanpa predikat → amandemen `private.issue_certificate` di migration yang sama: `on conflict (enrollment_id, level_id) where status='active' do nothing` (issuance biasa skip hanya bila ada ACTIVE; issue ulang pasca-revoke kini sah). Hanya muncul di Postgres sungguhan.
3. Bukti live (Postgres 18, lms_rls_test, identitas guru a00…001 / murid b00…001): reissue → old revoked + new1 aktif, `retry_same=t` (panggilan ulang balas id sama), `active_count=1`; insert active kedua → `duplicate key ... certificates_one_active`; reissue oleh murid → `FORBIDDEN`.

Gates: **live-denial 38/38 PASS** (migration 000010 verbatim di atas 000000–000009), **test 143/143 (22 files)** tetap hijau, typecheck/lint PASS, `db:typecheck` OK (36 tables — tanpa tabel baru). Belum (slice lain sesuai rencana): `lib/certificate-store.ts` + persist/signed-URL route pdf, aksi & UI reissue teacher, t10_* live-denial formal.

## Catatan sesi — Hook review level-completion (ADR-011, rencana spaced-review slice)

1. `lib/progress-planning.ts`: + `FirstReviewInsertRow` & `firstReviewInsertRows(enrollmentId, entityIds, now, intervals)` — baris review pertama (due = interval pertama ladder, status scheduled), id unik + urut stabil, deterministik.
2. `features/actions.ts` `recomputeProgress`: hook aplikasi setelah loop level — level `done` dijadwalkan HANYA bila pasangan (enrollment, level) belum punya baris review apa pun (recompute ulang tidak menggandakan; review completed/dismissed tidak dijadwalkan ulang); insert gagal → `REVIEW_SCHEDULE_FAILED` (recompute idempotent, retry menyusul). Hasil kini memuat `reviewScheduled`. Index parsial `review_items_one_active` (migration 000009) sebagai jaminan DB terakhir.
3. `tests/unit/progress-planning.test.ts` +3 (builder: due +1 hari, dedupe/sort, kosong); `tests/integration/learning-planning.test.ts` (baru, 5 test statis): wiring import + filter existing + insert tanpa delete di scope recompute + migration partial index/status + ekspor builder.

Gates: unit 20/20, **test 151/151 (23 files, +5)** , typecheck 0, lint PASS, prettier PASS. Bukti live perilaku penuh menunggu Supabase (recompute adalah TS + HTTP); index & tabel sudah live-verified 38/38.

## Verifikasi gate ulang — HEAD 9f67999 (2026-09-06, tree + uncommitted Phase 6/hook)

Seluruh gate dijalankan terhadap HEAD `9f67999` (== origin/main, sudah di-push) + 7 path uncommitted di working tree (migration 000010, hook review, ADR-012/013, PROGRESS):

| Gate | Exit | Hasil |
|---|---|---|
| `format:check` | 0 | PASS |
| `lint` | 0 | PASS (`--max-warnings=0`) |
| `typecheck` | 0 | PASS (`tsc --noEmit`) |
| `test` | 0 | PASS 151/151 (23 files) |
| `build` | 0 | PASS (production build) |
| `db:typecheck` | 0 | PASS (DB advisor: 36 tables, 1 view) |
| `e2e` | 0 | PASS 18 passed / 1 skipped |
| `live-denial` | 0 | PASS 38/38 (migration 000000–000010 verbatim) |

Catatan operasional: e2e sempat gagal karena dev server :3000 mati (terbunuh saat `next build`) dan `npm run dev` menolak start karena server next dev lain (sisa webServer playwright dari run e2e yang gagal, pid 21116@53194) memegang lock — setelah `taskkill` + start eksplisit `npm run dev -- -p 3000`, server hidup di pid 6564 dan e2e hijau. Pelajaran: `next dev` di mesin ini bisa memilih port acak bila port default bermasalah; start eksplisit `-p 3000`. Log per gate: `/tmp/g2-*.log`.

## Verifikasi gate refresh — HEAD f0f7d1e (2026-09-06, tree bersih)

Tree bersih di `f0f7d1e` (== state commit dad0e70 + f0f7d1e). Urutan run: read-only gates → test → db:typecheck → live-denial → e2e (server :3000 pid 6564 hidup) → build (server tetap hidup, root 200 setelah build):

| Gate | Exit | Hasil |
|---|---|---|
| `format:check` | 0 | PASS |
| `lint` | 0 | PASS |
| `typecheck` | 0 | PASS |
| `test` | 0 | PASS 151/151 (23 files) |
| `db:typecheck` | 0 | PASS (36 tables, 1 view) |
| `live-denial` | 0 | PASS 38/38 (migration 000000–000010 verbatim) |
| `e2e` | 0 | PASS 18 passed / 1 skipped |
| `build` | 0 | PASS (production build; dev server tetap 200) |

Log per gate: `/tmp/g3-*.log`.
