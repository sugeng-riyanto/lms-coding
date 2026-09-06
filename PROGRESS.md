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
- [x] Phase 3 Learning/progress — resume live + autosave + retry queue sync + `recomputeProgress` idempotent + unlock server-side + **target mingguan + spaced review + confidence check live** (blok target mingguan di /learn, halaman /review dengan confidence 1–5, action `submitReview` ladder 1/3/7/14 + `startOfNextDayInTz`) + **active-time jujur** (`lib/active-time.ts`: clamp heartbeat 120 s + jarak min 20 s + visibility/idle gating di player; server memvalidasi ulang metadata heartbeat/draft, bukan percaya client) + level map 4 state (locked/available/in_progress/completed) + aksesibilitas (prefers-reduced-motion di globals.css + font scaling A−/A+/reset di layout murid). Catatan sesi di bawah.
- [x] Phase 4 Assessment — bank soal berversi + builder + limit/cooldown/timer server + sanitasi kunci + auto-grade server (service bypass) + release policy + grading queue + upload + revision audit. Gap objektif ditutup: **randomisasi pool/urutan server-generated + seed reproducible** (migration 000012 `attempts.question_order_json`, `lib/shuffle.ts` mulberry32+xmur3, startAttempt roll seed kriptografis → grading & kuis memakai subset/urutan yang sama) + **normalisasi unit numerik** (rule `unit.expectedUnit/unitFactors`; "5000 g" → basis sebelum toleransi) + **kebijakan partial credit MC eksplisit** (`exact` default / `fractional` opt-in) + **deadline kini di-enforce di RPC `finalize_attempt`** (TIME_EXPIRED, bukan hanya action) + toggle randomize/poolSize di builder teacher. **Manual assessment (lanjutan): rubrik berversi + criteria** (`rubrics.version`/`rubric_criteria.position`/`question_versions.rubric_id`) + **per-kriteria draft score & feedback** (`criterion_scores` RPC-only, append-only, RLS teacher-cohort) + **finalize** → `manual_score` tertimbang + `grade_revisions` (prev/new/actor/reason) + `audit_logs` `grade.finalized` (migration 000013) + server actions `createRubricVersion`/`saveCriterionGrade`/`finalizeResponseGrades` + live-denial t13 (8). Catatan sesi di bawah.
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

## Catatan sesi — Reissue: action server + UI dialog teacher (slice aksi/UI, rencana docs/plan-certificate-persist-reissue.md)

1. `features/actions.ts`: evaluator eligibility level di-refactor dari `issueCertificate` ke helper bersama `evaluateLevelEligibility(supabase, enrollmentId, levelId)` → dipakai issueCertificate DAN reissueCertificate (ADR-013: reissue memakai evaluator TS penuh yang sama, SEBELUM revoke). Action baru `reissueCertificate({ certificateId, reason })` (schema `reissueCertificateSchema` — uuid + reason 5..2000, mirror revoke): muat cert via strict client (RLS `certs_teacher_all` — guru cohort saja) → tolak bila bukan active (`NOT_ACTIVE`) → evaluasi ulang eligibility (tak eligible → `NOT_ELIGIBLE` + alasan, TANPA efek pada cert lama) → `rpc("reissue_certificate")` (p_reason + p_idempotency_key random server-side; RPC retry-safe by state) → `REISSUE_FAILED`.
2. UI `app/(teacher)/teacher/students/[studentId]/reissue-button.tsx` (baru): tombol "Reissue" per cert **active** di riwayat → native `<dialog>` aksesibel (`aria-labelledby`, label + textarea alasan wajib min 5, `role="status"`, `aria-busy`) → konfirmasi → action → `router.refresh()`. Alasan NOT_ELIGIBLE ditampilkan di dialog (daftar alasan), sertifikat lama tetap utuh. Halaman student-detail: select cert kini memuat `id`; status pair di daftar "Penerbitan" memakai baris TERBARU (setelah reissue satu pair punya revoked+active, jangan tampilkan tombol Terbitkan di atas yang sudah diganti); riwayat menandai cert revoked ber-pasangan-active sebagai badge "diganti" (rantai revoked → active baru).
3. `tests/integration/certificate-reissue.test.ts` (baru, 9 test statis): schema validasi; action strict-client + NOT_ACTIVE; **urutan eligibility SEBELUM rpc reissue** di dalam tubuh action + tak memakai jalur `issue_certificate`; kedua action berbagi `evaluateLevelEligibility`; migration 000010 (drop constraint, index partial, conflict target partial di `issue_certificate`, definer/search_path/revoke-PUBLIC/audit); UI (halaman mengimpor + render hanya pada active, dialog alasan wajib + aksesibel).

Gates: **test 160/160 (24 files, +9)** , typecheck 0, lint PASS, prettier PASS, format:check PASS. Masih belum (sesuai rencana): `lib/certificate-store.ts` + persist/signed-URL route pdf; verifikasi visual reissue butuh backend hidup (state matrix (c) `docs/e2e-setup.md`).

## Catatan sesi — t10_* live-denial reissue sertifikat (penutup rencana Phase 6)

Suite live-denial kini punya grup `t10_*`/`p10_*` formal (rencana §4 butir (a)/(b)) — SQL sungguhan melawan Postgres 18:

1. `scripts/live-denial/10_fixture.sql`: rantai org-2 untuk denial lintas-org cert — course version terbit + level + enrollment Murid X + sertifikat ACTIVE ber-id tetap `33330000-…-0aa` (id dipakai denial RPC karena RLS menyembunyikan barisnya dari guru org-1, tak bisa di-select klien).
2. `scripts/live-denial/20_denial.sql` (blok baru setelah p07; pasangan target = enrollment Murid 01 × level pos 1 yang BELUM punya cert, karena p07 sudah me-revoke demo-valid):
   - **Positif T1 (guru org-1)**: `t10_issue_active_count_1` (issue → tepat 1 ACTIVE); `t10_reissue_history_revoked_plus_active` (reissue → riwayat pair = 2 baris: c1 revoked + c2 active baru); `t10_reissue_retry_same_active` (panggilan ulang atas c1 yang sudah revoked → mengembalikan c2 yang SAMA — retry-safe by state).
   - **Index**: `t10_second_active_insert_denied` — insert ACTIVE kedua untuk pair sama → `duplicate key … certificates_one_active` (23505).
   - **Lintas-org**: `t10_org2_cert_hidden` (T1 melihat 0 baris cert org-2); `t10_crossorg_reissue_denied` — RPC `reissue_certificate` atas cert org-2 (id fixture) → `FORBIDDEN`.
   - **Murid**: `t10_reissue_by_student_denied` — A mencoba reissue cert ACTIVE miliknya sendiri → `FORBIDDEN` (hanya guru cohort).
   - **Simetri org-2**: `p10_org2_own_cert_visible` + `p10_org2_reissue_ok` (guru org-2 lihat & reissue cert org-2 sendiri → riwayat 2, satu ACTIVE); `t10_org1_cert_hidden_from_org2` (denial simetris).

Hasil: **live-denial 48/48 PASS (38 lama + 10 baru, FAIL=0)** — dijalankan `bash scripts/live-denial/run.sh` (migration 000000–000010 verbatim; DB dipertahankan untuk inspeksi). README coverage table diperbarui. Total check suite kini 48; e2e/static tak berubah (160/160).

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

## Catatan sesi — Self-check struktural .env (guard anti-paste onboarding)

Setelah kejadian `.env` ditimpa paste onboarding Supabase (key asing, duplikat, prosa tutorial), ditambahkan guard startup:

1. `scripts/check-env.mjs` (baru): structural lint file env — key DUPLIKAT (last-wins, pesan sebut baris), key TAK DIKENAL (aplikasi tidak membacanya, mis. `SUPABASE_URL` polos / `host`/`port`/`database`/`user` dari halaman Connect), dan baris bukan `KEY=value` (paste/prosa). Daftar key SAH tidak di-hardcode: diambil dari `.env.example` (template = satu sumber kebenaran). File target tidak ada (CI, env dari runner) → skip, exit 0; `.env.example` hilang → error eksplisit. Nilai boleh memuat `=`/`#` (bukan garbage). Pesan kegagalan terbaca + arahan cek cepat.
2. `package.json`: script `check:env` + pre-hook `predev`/`prebuild`/`prestart` → gagal cepat sebelum `next dev`/`build`/`start` jalan (e2e `npm run dev` ikut ter-guard via predev).
3. `.env.example`: header ATURAN STRUKTUR + checklist key + perintah verifikasi (edisi sebelumnya).

Tests: `tests/unit/env-file-check.test.ts` (baru, 7 test — fixture temp dir, spawn nyata script): bersih lolos; duplikat → exit 1 + pesan last-wins; key asing `SUPABASE_URL`/`host` → exit 1; prosa tutorial → exit 1; tanpa `.env` → skip exit 0; tanpa `.env.example` → error; nilai ber-`=`/`#` bukan garbage.

Gates: **test 167/167 (25 files, +7)** , typecheck 0, lint PASS, prettier PASS. Bukti nyata: `node scripts/check-env.mjs` pada `.env` bersih saat ini → `check-env OK` (exit 0).

## Catatan sesi — Wiring env hosted + smoke test sign-in (status: BLOCKER provisioning)

Bukti wiring aplikasi → project Supabase HOSTED (`jspmxdzgxevtfwvldwxy`, nilai dari paste pengguna; `.env` dibersihkan 14 baris, tanpa placeholder; guard struktural `scripts/check-env.mjs` + predev/prebuild/prestart aktif — lihat catatan check-env):

1. **Env & restart**: `next dev` restart (pid 4760, `-p 3000`) — log memuat `predev → npm run check:env` sebelum boot. `/api/health` → `{"status":"ready","envConfigured":true,"validationError":null}`.
2. **Auth hosted hidup**: `GET <url>/auth/v1/health` (apikey publishable) → `{"version":"v2.196.0","name":"GoTrue"}`.
3. **Smoke sign-in via UI** (`/login`, server action SSR): submit `guru@demo.local` / `DemoPass-2026!` → balasan GoTrue ditampilkan verbatim `Invalid login credentials` (role=alert) — membuktikan jalur SSR auth→GoTrue hosted benar; penolakan murni karena seed user belum ada. Mode demo (`isDemoBackend`) OFF (env ada) → `/learn`,`/teacher`,`/guardian` tanpa session redirect `/login` (terverifikasi).
4. **BLOCKER provisioning**: public schema project masih KOSONG — REST probe (service key) `organizations/profiles/memberships/cohorts/courses/enrollments/certificates/alerts/roblox_receipts/weekly_plans/review_items` → semua `404 PGRST205` (berulang, beberapa menit jeda; bukan lag cache). Setelah klaim user "db push + seed selesai" → probe ulang tetap 404. Belum ada kredensial DB (password project) untuk verifikasi/eksekusi mandiri (opsi: koneksi Session pooler `--db-url` atau `supabase link` + password).
5. **Dry-run hosted-compat** (000001 storage + seed + migration set): TIDAK ada blocker keras. Catatan: `create policy on storage.objects` sah (postgres superuser); seed `auth.users`/`auth.identities` kompatibel dua varian layout identities (composite PK vs surrogate id + unique pair); pgcrypto via `extensions.crypt`; butuh Email provider ON; **5 akun demo ber-password publik `DemoPass-2026!`** — hanya utk preview, rotasi/hapus sebelum produksi. `cat supabase/.temp/project-ref` harus `jspmxdzgxevtfwvldwxy` (kalau beda, push mendarat di project lain).

Langkah selanjutnya saat blocker terangkat: re-probe tabel + seed, lalu sign-in guru→`/teacher`, murid01→`/learn`, wali→`/guardian`.

### UPDATE — Provisioning hosted DITUNDA (2026-09-06)

Diputuskan menunda track hosted sampai ada bukti/artefak nyata. Probe berulang (ke-6, termasuk OpenAPI PostgREST dengan 0 path tabel) tetap `404 PGRST205` pada `jspmxdzgxevtfwvldwxy` meski ada klaim "db push + seed selesai". Semua pesan lanjutan berisi teks placeholder dari suggestion-card (bukan koneksi string/terminal output/project-ref asli) — tidak ada kredensial DB yang valid untuk verifikasi atau eksekusi mandiri. Lihat bagian "Wiring env hosted + smoke test sign-in" di atas untuk bukti lengkap.

Kriteria lanjut (salah satu, dikirim sebagai teks biasa, bukan klik card): (1) `cat supabase/.temp/project-ref` = `jspmxdzgxevtfwvldwxy`; atau (2) tail output `npx supabase db push` yang berakhir `Finished supabase db push.`; atau (3) URL Session pooler ber-password asli. Setelah itu: `npx supabase db push --db-url <url>` + `psql <url> -f supabase/seed.sql` → re-probe → sign-in guru/murid/wali.

## Verifikasi gate refresh — HEAD be7b127 (2026-09-06, tree bersih)

Seluruh gate dijalankan terhadap tree bersih `be7b127` (4 commit workstream: env guard, reissue action/UI, t10 suite, bukti sesi). Urutan aman: e2e SEBELUM build (hindari kontensi `.next`); dev server tetap hidup setelah build.

| Gate | Exit | Hasil |
|---|---|---|
| `format:check` | 0 | PASS |
| `lint` | 0 | PASS |
| `typecheck` | 0 | PASS |
| `test` | 0 | PASS 167/167 (25 files) |
| `db:typecheck` | 0 | PASS (36 tables, 1 view) |
| `live-denial` | 0 | PASS **48/48** (migrations 000000–000010 verbatim) |
| `e2e` | 0 | PASS 18 passed / 1 skipped |
| `build` | 0 | PASS (production build; dev server tetap 200) |

Log per gate: `/tmp/g4-*.log`.

## Catatan sesi — AI draft feedback: migration 000011 (slice migration, rencana docs/plan-ai-draft-feedback-consent.md, ADR-014/015/017)

1. `supabase/migrations/20260906000011_ai_feedback_consent.sql` (baru): consent per-org `organizations.ai_feedback_consent` default FALSE (fail closed) + `ai_feedback_consent_at`; tabel `ai_feedback_drafts` (unique response_id; status draft/approved/rejected; RLS HANYA guru cohort via `teacher_cohort_ids` — select/insert/update USING+WITH CHECK, TANPA policy murid/anon, rule `no_delete_ai_drafts`); RPC definer `set_org_ai_consent` (guru teacher aktif org; audit `org.ai_consent`), `upsert_ai_draft` (satu draft per response), `apply_ai_feedback` (merge ke `feedback_json.ai_approved` + `grade_revisions` reason `ai_draft:approved` + draft approved — approval eksplisit guru, ADR-015); wrapper public + revoke PUBLIC + grant authenticated.
2. Bug live yang migration ini ungkap: RPC consent semula menulis `updated_at = now()` — tabel `organizations` TIDAK punya kolom itu (DDL init) → error runtime hanya muncul di Postgres sungguhan; diperbaiki (hapus referensi updated_at; audit via audit_logs).
3. Live-denial: fixture + rantai AI (soal/versi/response Murid 01, id tetap) + 11 check baru `t11_*`/`p11_*`: consent default false; guru org-1 set consent (audit ≥1); guru insert+baca draft; apply → `ai_approved` + revisi + draft approved; guru org-1 set consent org-2 → FORBIDDEN; murid set consent/upsert → FORBIDDEN; murid 0 baris draft + insert draft → 42501; guru org-2 0 baris draft.

Gates: **live-denial 59/59 PASS** (migrations 000000–000011 verbatim; 48 lama + 11 baru), **test 172/172 (26 files, +5)** (`tests/integration/ai-feedback.test.ts` statis: kolom consent, tabel+status+unique, RLS teacher-only tanpa anon/delete, definer+search_path+revoke/grant, apply hanya lewat approval), typecheck 0, lint PASS, **`db:typecheck` PASS (37 tables** — AC-10 rencana). Belum (slice berikut sesuai rencana): `lib/ai-feedback.ts` (buildPrompt + provider adapter mock/http), env `AI_*` + `.env.example`, aksi request/approve/reject, UI queue, t11 sudah ada.

## Catatan sesi — Provisioning HOSTED BERHASIL + 2 perbaikan root-cause

**Status: PROVISIONED** — project `jspmxdzgxevtfwvldwxy` (coding999a's Project) kini punya schema + seed lengkap, diverifikasi end-to-end lewat UI.

### Apa yang terjadi
- Token PAT (`SUPABASE_ACCESS_TOKEN`, dari .env user) dipakai: `supabase link` + `supabase db push` → **12 migration (000000–000011) applied** (``Finished supabase db push.``), seed via `supabase db query --linked --file supabase/seed.sql`.
- REST probe (service key): 16 tabel 200, seed utuh (organizations 1, profiles 5, memberships 5, cohorts 1, cohort_members 3, guardian_links 1, courses 1, course_versions 1, levels 3, enrollments 3, certificates 1).

### Bug #1 — migration 000000 gagal di hosted (42P01)
`supabase db push` gagal di statement 2: `relation "public.memberships" does not exist`.
- **Root cause:** 3 helper `LANGUAGE sql` (`private.caller_membership_ids`, `is_teacher_of`, `teacher_cohort_ids`) dibuat SEBELUM tabel `memberships`/`cohorts` dalam file yang sama. Postgres memvalidasi body fungsi SQL saat CREATE (GUC `check_function_bodies` default **on**), jadi apply di DB kosong gagal. Harness lokal menutupinya dengan `PGOPTIONS="-c check_function_bodies=off"` di `run.sh`.
- **Fix:** blok helper dipindah ke SETELAH semua `create table` (sebelum bagian RLS) di `20260906000000_init.sql`; komentar `run.sh` diperbarui (GUC kini defensif). Dibuktikan: semua 12 migration apply bersih dengan setting DEFAULT (tanpa GUC) di Postgres lokal, lalu push hosted sukses.

### Bug #2 — akun seed tidak bisa login di hosted (500 "Database error querying schema")
Setelah push, `guru@demo.local` dkk login → `500 unexpected_failure: Database error querying schema` (padahal user GoTrue-created bisa login).
- **Root cause:** kolom auth.users `email_change` (+ `phone_change`) NULL pada insert SQL langsung. GoTrue me-scan kolom ini sebagai string; NULL memicu "converting NULL to string is unsupported" → 500 saat sign-in (supabase/auth#1940; docs troubleshooting). `confirmation_token`/`recovery_token`/`email_change_token_new` dll. juga ikut di-''-kan.
- **Fix di hosted:** `update auth.users set email_change=coalesce(email_change,''), phone_change=coalesce(phone_change,''), ...` → **5/5 akun login OK** (guru, wali, murid01–03).
- **Fix di repo:** `supabase/seed.sql` kini mengisi 8 kolom token/change = `''` eksplisit + komentar penjelas; `scripts/live-denial/00_shim.sql` menambah kolom tsb agar seed tetap jalan di harness.

### Flow UI terverifikasi (hosted, seed users)
| Alur | Hasil |
|---|---|
| guru@demo.local → /teacher | Dashboard kelas: Kelas 7A, 3 murid, matriks cohort, sinyal risiko |
| murid01@demo.local → /learn | Target hari ini, peta level 3 level (Matematika Dasar), mastery 0% |
| wali@demo.local → /guardian | Ringkasan anak: Murid 01 tertaut aktif, enrollment aktif 1 |

### Gates (setelah fix)
- `format:check` 0 · `lint` 0 · `typecheck` 0 · `test` **172/172** · `db:typecheck` 0 (37 tables, 1 view) · `live-denial` **59/59**

## Catatan sesi — Phase 2 (verifikasi) + Phase 3 gap ditutup (target mingguan, spaced review, active-time, a11y)

### Phase 2 — terverifikasi TERPENUHI (bukan re-implementasi)
Request Phase 2 diulang; bukti sudah ada: hierarchy + authoring actions lengkap (`createCourse`, draft edit, `reorderSiblings`, `archiveCourse`, `duplicateCourse`, `publishCourseVersion` + versioning), `lib/publish-validation.ts` (`validateCourseDraft` incl. prereq-cycle, answer-key, a11y, point total) + `lib/reorder.ts`, 7 tipe activity MVP, structured content blocks (JSON, HTML ditolak), enrollment/status + katalog + level map live, RLS content-tree oleh live-denial. Tidak ada implementasi baru yang diperlukan.

### Phase 3 — gap yang ditutup sesi ini
1. **Target mingguan eksplisit** — blok "Target mingguan" di `/learn`: goal dari `weekly_plans` (default 3), progress = `activity_completed` pada minggu ISO berjalan (tz Asia/Jakarta) via `weeklyRollup` (progressbar + X/Y + status achieved).
2. **Spaced review + confidence check** — halaman `/review` (list jatuh tempo hari ini/terlambat, urut `orderedReviewQueue`), form confidence 1–5, action `submitReview` server: hanya baris enrollment sendiri (RLS) + `NOT_DUE` di luar batas `startOfNextDayInTz` + transisi scheduled→completed + baris scheduled baru via `nextReviewAfter` (≥4 maju, 3 ulang, ≤2 reset) — append-only, tanpa hapus.
3. **Active-time jujur (jangan hitung dari halaman terbuka)** — `lib/active-time.ts` murni: clamp 120 s/heartbeat, jarak min 20 s; hook `useEngagementHeartbeat` di lesson player kirim hanya saat tab visible + aktivitas pointer/keyboard (idle 60 s berhenti); **server memvalidasi ulang** metadata heartbeat & draft (`validateHeartbeatMetadata`/`validateDraftMetadata` → `EVENT_REJECTED`; clamp server-side). Gagal online → `enqueueEvent`; `useOfflineFlush` mengirim ulang saat `online` (tanpa duplikasi via client_event_id).
4. **Autosave draft + indikator** — `ReflectionBox`: refresh recovery dari localStorage (lazy initializer), indikator saving/saved/offline/error, max 4.000 char, minimisasi data (event hanya `chars`).
5. **Level map 4 state** — locked / available / in_progress / completed (status snapshot + mastery), pill + label berbeda.
6. **Aksesibilitas** — `@media (prefers-reduced-motion: reduce)` di globals.css; kontrol font scaling A−/A+/% di header layout murid (persist localStorage, terapkan di `html`).

### Perbaikan infrastruktur yang ditemukan (bukan Phase 3 murni)
- **e2e login selalu di-skip** — probe `auth/v1/health` hosted butuh header `apikey` (401 tanpa itu); `critical.spec.ts` kini mengirim anon key → test "student login → /learn" **benar-benar jalan melawan hosted & PASS** (e2e 18+1 skip → **19/19**).
- **Hidrasi gagal di 127.0.0.1** — Next dev memblokir HMR/font dev (403) untuk host tak dikenal → JS tak terhidrasi → form login submit native (URL `/login?`). Fix: `allowedDevOrigins: ["127.0.0.1"]` di `next.config.ts`. Terbukti: login murid01@demo.local di 127.0.0.1 kini mendarat di `/learn`.

### Gates (HEAD sesi ini)
format 0 · lint 0 · typecheck 0 · test **194/194** (28 file; +12 active-time, +5 reflection-box component, +7 learning-planning submitReview statis) · db:typecheck 0 (37 tabel, 1 view — tanpa migration baru) · live-denial **59/59** · e2e **19/19** (login live-hosted) · build 0 (dev server tetap hidup).

## Catatan sesi — Phase 4 objective assessment: randomisasi seed, unit numeric, partial credit, deadline di RPC

Gap request "Kerjakan Phase 4 bagian objective assessment" terhadap kode yang sudah ada (bank soal berversi + builder + limit/cooldown/timer + sanitasi + auto-grade server + release policy sudah live) → 4 gap nyata ditutup:

1. **Randomisasi pool/urutan — server-generated, seed reproducible** (baru). `lib/shuffle.ts`: xmur3 `hashSeed` + `mulberry32` + `shuffleWithSeed`/`pickPool` murni + `randomSeedHex()` (crypto 128-bit, server-only). `startAttempt` membuat seed kriptografis dan menyimpan `{seed, order}` di `attempts.question_order_json` (migration 000012) — client tidak pernah memilih seed/urutan. `submitAttempt` menilai HANYA subset/urutan hasil roll server (soal luar pool tak bisa disisipkan via response palsu); `getAttemptQuestions` menyajikan urutan tersimpan (fallback posisi untuk attempt lama). Builder teacher: toggle "Acak urutan per attempt" + "Jumlah soal per attempt" (`randomize`/`poolSize` di settings_json).
2. **Normalisasi unit numerik** (`lib/grading.ts`): rule `unit: { expectedUnit, unitFactors }` — jawaban `"5000 g"`/`"5 kg"` dikonversi ke basis (kg) sebelum cek toleransi; unit tak dikenal → 0 (tidak menebak); number polos dianggap basis. Back-compat: tanpa rule unit, string ber-unit tidak lolos (perilaku lama).
3. **Kebijakan partial credit MC eksplisit**: default `exact` (set pas, 0 untuk subset/superset — perilaku lama), opt-in `fractional` = poin × (benar terpilih/total benar), tanpa penalti opsi salah.
4. **Deadline server-authoritative di RPC**: `private.finalize_attempt` kini menolak `TIME_EXPIRED` bila `started_at + durationSeconds` lewat — client yang memanggil RPC langsung (tanpa action) tidak bisa menembus timer. Cek idempoten-return DIDAHULUKAN agar retry submit yang sudah sukses tidak kena deadline.

### Tests baru
- `tests/unit/shuffle.test.ts` (11): determinisme seed, permutasi lengkap, input tak berubah, reproducible lintas panggilan, subset pool, size invalid → semua, seed hex unik.
- `tests/unit/grading.test.ts` (+19): unit normalization (basis/konversi/unknown/back-compat/parse), boundary inklusif `|diff| == tol` absolut & relatif, toleransi = max(abs, rel), MC partial credit exact & fractional.
- `scripts/live-denial/20_denial.sql` **t12_* (+5, live Postgres)**: `t12_own_finalize_allowed`, `t12_duplicate_submit_noop` (panggilan kedua no-op, submitted_at sama), `t12_deadline_rejected` (attempt mulai 1 jam lalu di assessment `durationSeconds:5` → TIME_EXPIRED), `t12_cross_student_read_hidden` (RLS: Murid 02 melihat 0 baris attempt Murid 01), `t12_cross_student_finalize_denied` (RPC FORBIDDEN walau id diketahui).

### Bukti gates
format 0 · lint 0 · typecheck 0 · test **222/222** (30 file; +28) · db:typecheck 0 (37 tabel — migration 000012 hanya kolom baru) · live-denial **64/64** (+5) · build 0.

Migration `20260906000012_objective_assessment.sql` **belum di-push ke hosted** (hosted sempat down di sesi sebelumnya) — jalankan `supabase db push` saat project pulih.

## Catatan sesi — Verifikasi 4-blok (objektif Phase 4 / manual Phase 4 / Phase 5 / Phase 6 baseline)

### A. Phase 4 objective assessment — TERVERIFIKASI (committed a06f400, turn sebelumnya)
Semua item request sudah terpenuhi & teruji: bank soal + versioned questions 5 tipe (single/MC/TF/numeric abs+rel tol+**unit normalization**/short-text normalisasi eksplisit); builder + point validation; **randomized pool/order seed server reproducible** (000012); attempt limit/cooldown/timer server-side (**deadline di RPC**, bukan hanya action); draft autosave; submit idempotent; release policy; kunci jawaban tak ke client; skor ditentukan server; grading/kompetensi/progress/eligibility transactional-idempotent di trusted server. Fixtures + expected score manual ada; test boundary tolerance inklusif, MC partial-credit (exact/fractional), duplicate submit, deadline race, forged score (unit + t12 live). Tidak ada implementasi baru — hanya dicatat.

### B. Phase 4 manual assessment (lanjutan) — GAP DITUTUP: migration 000013 + actions + t13
Yang sudah ada sebelumnya: storage bucket privat `submissions` (INSERT/SELECT/UPDATE policy kepemilikan folder, MIME/size guard client), bucket `certificates` deny-select + signed URL pendek setelah permission check, grade queue guru (single-score + feedback + `grade_revisions` anti-delete), AI draft feedback consent-gated (000011 + t11 + ADR-014/015/017), `audit_logs` append-only. **Yang belum ada dan kini dibangun:**
- **Rubrik berversi**: `rubrics.version/created_by/updated_at` + `rubric_criteria.position` + `question_versions.rubric_id` (rubrik diikat ke versi soal essay/file).
- **Per-kriteria draft score & feedback**: tabel `criterion_scores` (RLS teacher-cohort SELECT saja; tulis HANYA lewat RPC security definer; anti hard-delete). RPC `save_criterion_grade` memvalidasi guru-cohort attempt, `RUBRIC_MISMATCH` (kriteria ≠ rubrik soal), `SCORE_EXCEEDS_MAX`.
- **Finalize**: RPC `finalize_response_grades` menolak `DRAFT_INCOMPLETE`, menghitung `manual_score` = Σscore/Σmax_points ×100 (0..100), menulis `grade_revisions` (prev/new/reason/actor) + `audit_logs` `grade.finalized` **ber-organization_id** (agar policy audit_teacher_select melihatnya — bug ditemukan & diperbaiki saat uji); idempoten (nilai sama → tanpa revisi ganda).
- **Actions server**: `createRubricVersion` (guru org soal, validasi memberships), `saveCriterionGrade`, `finalizeResponseGrades`. UI guru (form rubrik + penilaian per kriteria) = slice berikutnya.
- **t13 live-denial (8, total 64 → 72)**: draft tersimpan & manual lama utuh, RUBRIC_MISMATCH lintas-org ditolak, finalize draft-belum-lengkap ditolak, finalize menulis revision+audit (nilai 70→86), re-finalize no-op, guru org-2 ditolak (FORBIDDEN), murid tak bisa baca skor (RLS) & tak bisa menilai (FORBIDDEN).

### C. Phase 5 Analytics — TERVERIFIKASI dengan catatan
Sudah live: overview cards, progress distribution, mastery heatmap, cohort matrix + drill-down (halaman student), timeline/attempt/evidence/feedback/cert history, alerts acknowledge/snooze/resolve (UI + RLS), CSV export anti-formula-injection (escape `=+-@`), metrik ber-definisi + reconciliation terhadap fixture (lib/analytics.ts + tests reconciliation), teacher page tanpa public ranking, status tak hanya warna. **Item analysis & misconception map**: metrik + reconciliation SUDAH ada di `lib/analytics-item.ts` + test; **UI peta miskonsepsi/analisis butir + bottleneck + weekly digest guru BELUM** — direncanakan sebagai KURANG berikutnya (rencana item-analysis di docs/plan-item-analysis-misconception-map.md, slice metrik committed).

### D. Phase 6 baseline — TERVERIFIKASI dengan catatan
Sudah live & teruji (unit + t10 + UI): eligibility evaluator server (`lib/eligibility.ts` + `evaluateLevelEligibility`), issuance idempotent (idempotency_key RPC), payload canonical + hash SHA-256, PDF A4 landscape + QR → `/verify/{public_id}` (route on-demand, ADR-009), verification page minimum-disclosure (nama, status, fingerprint pendek), status active/revoked/reissued (reissue pertahankan sejarah + partial unique index), reason internal + audit + `grade_revisions`-style append-only. Revocation reason internal. **KURANG yang tersisa**: persist PDF ke bucket `certificates` (pdf_path diisi saat issuance) + visual inspection A4 sudah on-demand; reissue UI & action committed (reissue-button.tsx + ADR-012/013 + t10). Blockchain sengaja belum diaktifkan (sesuai instruksi "jangan aktifkan dahulu").

### Bukti gates (HEAD sesi ini)
format 0 · lint 0 · typecheck 0 · test **222/222** (30 file) · db:typecheck 0 (**38 tabel** — +`criterion_scores`) · live-denial **72/72** (+8 t13) · build 0.

Migration `20260906000012_objective_assessment.sql` DAN `20260906000013_rubric_grading.sql` **belum di-push ke hosted** (outage) — `supabase db push` saat project pulih.

## Catatan sesi — UI standard LMS: dark/light mode + konten LMS coding (code board & media embed)

Permintaan "perbaiki redaksional, responsif semua device, dark/light mode, LMS coding dengan menu copy-board code & embed pdf/audio/youtube/files" → dibedah menjadi 3 paket:

### 1. Tema terang/gelap (seluruh aplikasi)
- `globals.css`: `@custom-variant dark` (class strategy) + `color-scheme` per mode + **peta override palet netral** ter-scope `.dark` (permukaan `bg-white/slate-50/100/200`, teks `text-slate-300…900`, batas/pemisah, input/textarea, badge semantik 100↔900, zebra `odd:bg-white`) — semua halaman (~51 file) ikut gelap tanpa menyentuh tiap file; aksen biru & tombol solid dipertahankan.
- `app/layout.tsx`: script init tanpa FOUC (localStorage `lms-theme` → fallback `prefers-color-scheme`), `suppressHydrationWarning`.
- `components/theme-toggle.tsx`: tombol ikon (CSS-switch, tanpa setState-dalam-effect agar lint/hydration bersih) — dipasang di home publik, login, header murid, dasbor guru, portal wali.

### 2. Konten LMS coding (migration 000014) — activity types baru
`code_board`, `embed_youtube`, `embed_pdf`, `embed_audio`, `embed_file`:
- DB: CHECK `activities.type` diperluas (000014).
- Authoring guru: daftar tipe + hint JSON per tipe di level-manager.
- Render murid di activity-view: `components/code-block.tsx` (blok kode monospace, scroll-x baris panjang, **tombol Salin** + status Tersalin, clipboard API + fallback) dan `components/media-embed.tsx` (YouTube iframe **youtube-nocookie** dengan src di-rebuild dari id & host allowlist eksplisit — host lain/`notyoutube.com` ditolak; PDF/Audio/File https-only; transkrip untuk audio & code).
- Tidak ada HTML arbitrer: field yang dibaca hanya `code/language/url/title/transcript`, URL dibatasi http(s).

### 3. Redaksional & standar sekolah (fokus permukaan bersama)
Home publik, login, header murid ("Area Belajar Murid"), dasbor guru ("Dasbor Kelas"), portal wali (menghapus sapaan informal/emoji, keterangan kebijakan akses), metadata/title situs "Coding School LMS". Penyapuan penuh 51 file dicatat sebagai pekerjaan lanjutan bertahap (tiap halaman).

### Bukti gates
format 0 · lint 0 · typecheck 0 · test **228/228** (31 file; +6 media-embed: isSafeHttpUrl/youtube parse termasuk host-allowlist) · db:typecheck 0 (38 tabel) · live-denial **72/72** (000014 apply bersih) · build 0.

Migration `20260906000014_coding_media_activities.sql` belum di-push ke hosted (outage) — bersama 000012 & 000013, `supabase db push` saat pulih.

## Catatan sesi — Wiring rubrik ke UI guru (builder + panel nilai per kriteria)

Backend rubrik (migration 000013 + actions + RPC + t13) kini ter-wire ke antarmuka:
- **Bank soal** (`/teacher/questions`): data server menambah rubrik per versi soal (bulk fetch rubrics + criteria; tanpa N+1 per kriteria). `components/rubric-editor.tsx` di baris soal essay/file — buat rubrik (judul + kriteria dinamis + poin maks) via `createRubricVersion` ke versi terbaru; bila sudah terpasang → ringkasan + keterangan berversi. Tipe non-manual tidak menampilkan panel.
- **Antrian penilaian** (`/teacher/grading`): `QueueItem` kini membawa `rubric` (kriteria + skor/feedback/draf yang sudah ada) bila question_version terikat rubrik. `components/rubric-grade-panel.tsx`: input skor per kriteria (0..maks, readonly bila final) + feedback per kriteria, tombol **Simpan sebagai draf** (draft=true) dan **Finalize nilai** (semua kriteria draft=false → RPC menghitung manual_score + grade_revisions + audit); badge status draf/final. Tanpa rubrik → form skor tunggal lama tetap.

Gates: format 0 · lint 0 · typecheck 0 · test **228/228** · build 0. Schema/denial tidak berubah (live-denial tetap 72/72 sesi ini).

## Catatan sesi — Re-versi rubrik (migration 000015): edit rubrik terpasang tanpa versi soal baru

Mengedit rubrik yang SUDAH terpasang kini cukup menaikkan versi (tidak wajib membuat versi soal baru):
- **Schema**: `rubric_criteria.version`; `finalize_response_grades` ditulis ulang agar hanya memakai kriteria **versi aktif** rubrik (v_prev audit/revision tetap).
- **RPC atomik** `public.update_rubric_version(rubric_id, title, criteria jsonb)`: validasi guru-owner org (`FORBIDDEN`), payload kriteria (>=1, 0<max<=1000, judul <=200 → `INVALID_CRITERIA`), kunci baris + `version+1`, tulis kriteria baru ber-version; **kriteria lama dipertahankan** (riwayat & FK criterion_scores aman).
- **UI** `RubricEditor`: ringkasan rubrik terpasang kini punya tombol **"Edit → versi N+1"** dengan form ter-prefill (judul+kriteria); simpan memanggil `updateRubricVersion`; data bank soal & antrian nilai memfilter kriteria versi aktif.
- **t14 live-denial +7 (79 total)**: bump v1→v2 (return 2), kriteria lama dipertahankan + baru ter-version (2/3), finalize menuntut skor versi aktif (DRAFT_INCOMPLETE pada response yang sudah final v1), skor v2 = 90/100, guru org-2 FORBIDDEN, murid FORBIDDEN, kriteria kosong INVALID_CRITERIA.

Gates: format/lint/typecheck 0 · test **228/228** · db:typecheck 0 (38 tabel) · live-denial **79/79** (+7) · build 0. Migration 000015 belum di-push ke hosted (outage).

## Catatan sesi — Bulk upload XLSX (murid & materi) + konektivitas + rencana offline bridge

### Konektivitas Supabase (jawaban "apakah sudah terhubung?")
Env `.env` MENUNJUK ke hosted (`jspmxdzgxevtfwvldwxy`) tetapi layanan hosted
SEDANG DOWN (probe berulang: `/auth/v1/health` 504, PostgREST timeout 000).
Login: teks "Demo lokal: gunakan user dari supabase/seed.sql" kini HANYA tampil
di mode demo (`isDemoBackend()`); saat env hosted terpasang tampil "Terhubung
ke server sekolah...". Rencana jembatan offline/poor-internet + sinkronisasi
otomatis: `docs/plan-offline-local-bridge.md` (cache-baca IndexedDB, watchdog
30s + auto-flush antrian idempoten, perluasan antrian tulis, opsi Supabase
lokal) — prekondisi sebagian sudah ada (retry queue learning events).

### Bulk upload murid (XLSX, oleh guru)
- `lib/bulk-import.ts`: validator murni baris (kolom fleksibel Email/Nama,
  normalisasi email, baris rusak per-baris) + unit test 7.
- Action `bulkImportStudents` (FormData): teacher → cohort miliknya (RLS),
  parse XLSX server-side (`xlsx`), resolusi email→user via service client
  (auth.users), provisioning profil+membership = jalur privileged (memberships
  TIDAK punya policy insert guru by design), keanggotaan cohort via RLS guru.
  Hasil: {added, existing, notFound, errors}.
- UI: kartu upload di `/teacher/cohorts` (pilih cohort + file + ringkasan).
- Ekspor roster: route `/api/export/cohorts/[cohortId]` (CSV anti
  formula-injection via lib/csv, guru own-cohort) + link per cohort.

### Bulk upload materi (XLSX)
- Action `bulkImportContent` (FormData): course owner + level milik kursus
  (RLS), baris Module/Lesson/Objective/Activity Type/Activity Title/Content
  JSON (tipe di-allowlist incl. jenis coding), posisi otomatis, masuk draf.
  Hasil: {modules, lessons, activities, errors}.
- UI: kartu upload di halaman level (`/teacher/courses/[id]/levels/[levelId]`).

### RBAC / CRUD / approval / export
Bulk paths menghormati RBAC eksisting: guru hanya cohort/course miliknya
(action check + RLS), provisioning akun via service client (privileged, tanpa
policy insert guru), export dibatasi teacher own-cohort. Approval (release
nilai, issue/reissue sertifikat) & export data sudah ada; tidak ada perubahan
kebijakan. Tidak ada migration baru — skema & RLS Supabase tidak berubah.

Gates: format/lint/typecheck 0 · test **235/235** (+7) · db:typecheck 0 (38
tabel) · live-denial **79/79** · build 0. Dep baru: `xlsx` (server-side).

## Catatan sesi — Pengaman server bulk upload (XLSX)
File guard + kapasitas + insert chunked pada kedua jalur bulk impor (`bulkImportStudents`, `bulkImportContent`):

- **File guard** (`lib/bulk-import.ts` `xlsxFileError`): ekstensi wajib `.xlsx`, ukuran >0, maks **5 MB**, MIME di-allowlist (spreadsheet / octet-stream / zip; MIME kosong diizinkan karena browser kadang kosong) — error dikembalikan sebelum parsing.
- **Row cap**: **500 murid** / **1000 baris materi** (`rowsOverCap` + `ROWS_OVER_CAP` dengan `cap` di respons) — gagal cepat dengan pesan jelas, bukan parsing raksasa.
- **Chunked inserts**:
  - Murid: resolusi email tetap chunked (100); upsert `profiles` & `memberships` kini **batch 100**; insert `cohort_members` **batch 50** dengan fallback per-baris saat batch gagal agar error tetap diatribusikan per email.
  - Materi: module dihitung posisinya sekali di JS lalu **insert batch** (1 request); lesson per module **insert batch** dengan `.select("id,title")`; aktivitas per lesson **chunk 50** + fallback per-baris.
- **UI**: kedua kartu impor menampilkan hint kapasitas, validasi file client-side (pesan segera, tanpa upload), dan memetakan kode error ke kalimat jelas (`FILE_TOO_LARGE`, `ROWS_OVER_CAP`, dsb).

Gates: format/lint/typecheck 0 · test **241/241** (+6: `xlsxFileError` 5 kasus + `rowsOverCap`) · db:typecheck 0 (38 tabel) · live-denial **79/79** · build 0.

## Catatan sesi — Offline plan slice 1: read-cache IndexedDB + banner offline
Implementasi slice 1 `docs/plan-offline-local-bridge.md` (AC-1/AC-2/AC-6 parsial):

- **`lib/offline-cache.ts`** — cache-baca IndexedDB (`lms-offline-cache`/`pages`): TTL 24 jam, budget 5 MB dengan **eviction LRU** (`evictToBudget` murni), estimasi ukuran, kunci per entitas (`activity:`/`lesson:`/`level:`), dan **fail-soft total** (no-op/null di Node, private-mode, atau error apa pun — cache tak pernah memecahkan render). Hanya menyimpan data dari respons yang sudah lolos RLS (AC-6).
- **Komponen**: `OfflineBanner` (status online/offline via event + "salinan tersimpan" dengan waktu cache, teks+ikon bukan warna saja), `ActivityCacheSeed` (simpan activity yang berhasil dimuat → AC-1), `OfflineActivityFallback` (fetch gagal → baca cache → render `ActivityView` dari salinan + banner, atau pesan jelas "belum pernah dibuka" → AC-2).
- **Wiring** di `app/(student)/activities/[activityId]/page.tsx`: seed saat sukses; catch → fallback cache.
- **Unit test** `offline-cache.test.ts`: kunci, `estimateSize`, `isExpired`, `evictToBudget` (LRU, deterministik, entri > budget) + blok IndexedDB yang di-skip di Node.
- **Verifikasi browser (preview localhost:58519)**: tulis+baca entri cache nyata di IndexedDB halaman dengan skema app (key/value/size/cachedAt/TTL) → OK; lalu dibersihkan.

Gates: format/lint/typecheck 0 · test **248/248 +1 skip** (+7) · build 0 (db:typecheck & live-denial tak tersentuh — tanpa migration).

**Temuan (dilaporkan, bukan diubah di slice ini)**: saat benar-benar offline, `requireActiveMembership` di layout murid memanggil `getClaims` + query profiles/memberships → keduanya 504 terhadap hosted yang down → redirect `/login`/`/account-inactive` SEBELUM halaman activity sempat render. Artinya AC-2 end-to-end masih terblokir sampai slice auth-offline (D4) membuat guard toleran terhadap error DB saat session valid (deny-role-unknown tetap aman; cache hanya berisi data RLS-passing). Terverifikasi: `GET /activities/…` → 307 setelah ±63s.

## Catatan sesi — Write path study_sessions + target mingguan menit (tutup ADR-010)
Menutup penundaan ADR-010: `study_sessions` kini punya write path dan target
mingguan bisa diukur dalam menit belajar aktif yang jujur.

- **Migration 000016** (`20260906000016_study_sessions_write_path.sql`):
  1) RLS `study_sessions` diubah read-only utk murid (drop `sessions_student_rw`
     → `sessions_student_select`; policy guru cohort tetap) — murid TIDAK bisa
     menulis sesi langsung (anti pemalsuan menit);
  2) fungsi definer `private.append_study_session(enrollment_id, active_ms,
     occurred_at)` — delta per panggilan di-clamp (≤120 s, milidetik →
     detik), sesi lanjutan bila gap ≤ 10 mnt (`for update` atomik), sesi baru
     bila gap lewat, `active_seconds` per sesi di-cap 6 jam, occurred_at
     di-clamp ke jendela ±24 jam; wrapper publik di-revoke dari anon/
     authenticated (server-only);
  3) `weekly_plans.goal_value` kini unit-aware: completions 1..50, minutes
     1..2000 (CHECK lama 1..50 memblokir target menit — butuh migration
     tambahan di luar konsekuensi asli ADR-010).
- **Server action** `recordLearningEvent`: heartbeat yang DIVALIDASI server
  (clamp ulang + tolak raksasa) kini memanggil `append_study_session` via
  service client (privileged; best-effort — event tetap jadi ledger). Action
  baru `setWeeklyGoal` (zod; clamp per unit; upsert lazy per
  `(enrollment_id, week_start)`; RLS student membatasi enrollment miliknya).
- **lib**: `weeklyActiveMinutes` (Σ active_seconds di-clamp per sesi untuk
  sesi yang mulai di minggu ISO tz org, floor → menit), `clampGoalForUnit`
  (minutes 1..2000 — goal 180 TIDAK ter-clamp ke 50), `weeklyRollupForUnit`,
  `formatActiveMinutes` ("2 j 5 m"); konstanta gap sesi (10 mnt) + cap sesi
  (6 jam) di `lib/active-time.ts`.
- **UI `/learn`**: blok target mingguan unit-aware — default BARU `minutes`
  (goal 120 mnt) bila belum ada baris weekly_plans (flip ADR-010); label
  menit ("X dari Y menit aktif") vs completions; form kecil `WeeklyGoalForm`
  untuk set target sendiri (satuan + nilai).
- **Tests**: unit +10 (sesi/gap/clamp, weeklyActiveMinutes boundary tz WIB,
  clampGoal, rollup kedua unit, format); integration `study-sessions.test.ts`
  (8, statis: RLS read-only, RPC definer+clamp, revoke wrapper, CHECK
  unit-aware, wiring action+append, setWeeklyGoal); **live-denial t16 (+12 →
  91/91)** membuktikan di Postgres nyata: lanjutan sesi 60→90 s, sesi baru
  saat gap > 10 mnt, delta 999999 ms → 120 s (bug unit ms/detik yang
  terungkap harness: semula menambah 30000 "detik" → cap 21600), cap sesi
  21500+120 → 21600, goal menit 180 diterima / completions 2000 ditolak
  CHECK, murid baca sesi sendiri / sesi murid lain tersembunyi, insert
  langsung 42501, RPC publik 42501, set-goal sendiri OK / enrollment murid
  lain 42501.

Gates: format 0 · lint 0 · typecheck 0 · test **271/271 +1 skip** (34 files;
+23) · db:typecheck 0 (38 tabel — tanpa tabel baru) · live-denial **91/91**
(+12) · build 0. Migration 000016 belum di-push ke hosted (outage).
