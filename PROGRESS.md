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

## Catatan sesi — UI Analitik guru (Phase 5): item analysis, misconception map, bottleneck, digest

Menutup gap KURANG "Item analysis & misconception map UI" dan "learning-path bottleneck & teacher weekly action digest" (ANALYTICS.md insight guru).

**`/teacher/analytics` (baru, server component force-dynamic di grup teacher yang di-guard):**
- **Item analysis** dari `lib/analytics-item.ts` (itemStatistics + distractorMap): tabel n / p (kesulitan) / dilewati / diskriminasi; misconception map per distractor (opsi, berapa kali dipilih, share dari yang salah, nama murid — tanpa ranking publik).
- **Hambatan jalur belajar** dari `bottleneckAnalysis` (lib/analytics-teacher.ts baru): dropoff = 1 − selesai/mulai per lesson, severity high/watch/insufficient/ok dengan teks (warna bukan satu-satunya pembeda), sort deterministik.
- **Prioritas minggu ini** dari `buildTeacherDigest`: pending grading, alerts terbuka, murid tidak aktif (≥7 hari) → 3 kartu prioritas + alasan + tautan.
- Footer definisi: versi metrik (ITEM/TEACHER_ANALYTICS_DEFINITIONS_VERSION), "diperbarui {waktu}", "ukuran sampel (n)".
- Semua query **batch (.in)**, RLS via createClient (read-only, tanpa aksi tulis), filter cohort+assessment sebagai client component (AnalyticsFilters → router.push). Link "Analitik kelas" di dashboard guru.

**Perbaikan dari lint/typecheck:** `Date.now()` di render → wrapper modul-scope `currentEpochMs()` (pola sama dengan getDashboard di learn/page.tsx, memenuhi react-hooks/purity); `openAlerts` dipetakan ke `DigestAlert.createdAt`; narrowing `selectedAssessment` via guard `params.assessmentId && …`.

**Tests (+18):** unit `analytics-teacher.test.ts` (9: bottleneck dropoff/urut deterministik/distinct/minN, digest prioritas/≥5 alerts/resolved/bersih/deterministik) + integrasi statis (9: guard layout, versi metrik, read-only, batch, tabel ber-policy, UI metadata, filter, link dashboard).

## Bukti gates (analytics UI)
format 0 · lint 0 · typecheck 0 · test **289/289 +1 skip** (+18) · build 0. db:typecheck & live-denial tidak tersentuh (tanpa migration/DDL). 3 commit lokal di depan origin/main (a75cc94, 814fac5, dan commit ini).

## Catatan sesi — Slice AI draft feedback (Phase 4 KURANG, ADR-014/015/017)

Menutup sisa "KURANG: AI draft feedback (butuh consent config)" — migration 000011 + t11 sudah ada; slice app-layer kini lengkap.

**`lib/ai-feedback.ts` (baru, server-only):**
- `buildPrompt` + `extractAnswerText` (murni; AC-5 data minimization: tanpa identitas murid/nilai/data siswa lain; jawaban dipotong 4000 char, prompt 12.000).
- `AiDraftProvider` + `createAiProvider()`: `mock` (deterministik ber-label, TANPA jaringan — default pengujian) / `http` (POST JSON ke `{base}/draft-feedback` dengan Bearer key, timeout 10s AbortController, error terswallow + log redact) / `null` saat unconfigured (ADR-017).

**Env (semua server-only, masuk `.env.example` → daftar sah check-env otomatis):** `AI_FEEDBACK_ENABLED=false`, `AI_PROVIDER=`, `AI_PROVIDER_BASE_URL=`, `AI_PROVIDER_API_KEY=` — tanpa `NEXT_PUBLIC_AI_`; `lib/env.ts` +4 key opsional (file valid tanpa provider; fitur menolak runtime).

**Aksi server (`features/actions.ts`, strict client, provider TIDAK pernah dipanggil dari browser):**
- `requestAiDraft` — gerbang fail-closed berurutan: env → provider → consent org (rantai response→attempt→enrollment→cohort→course→org) → prompt → `upsert_ai_draft` (satu draft per response). Tanpa salah satu gerbang: `AI_DISABLED` / `AI_PROVIDER_UNCONFIGURED` / `AI_NO_CONSENT`, tanpa efek & tanpa jaringan (AC-1).
- `approveAiDraft` — `apply_ai_feedback` RPC (persetujuan eksplisit guru: `feedback_json.ai_approved` merge + `grade_revisions` reason `ai_draft:approved` + draft approved; idempoten untuk status approved).
- `rejectAiDraft` — status rejected (jejak keputusan, no hard delete; tolak draft yang sudah approved diblokir).

**UI (grade queue `/teacher/grading`):** halaman server mengambil draft per response (batch `.in`, tabel teacher-only RLS) + `aiConfig` (env + consent org). Panel per item non-rubrik: tombol "Saran draf AI" (nonaktif+alasan bila env/consent belum — `role`/title aksesibel), panel **"DRAFT AI — perlu persetujuan guru"** (body + model + **Setujui & pakai** / **Tolak**), status approved/rejected ditampilkan dengan teks (bukan warna saja).

**Tests (+20):** unit `ai-feedback.test.ts` (14: ekstraksi jawaban, prompt PII-strip/batas/orgName/kosong, mock deterministik + label, pilih provider mock/http/null, http POST+header+label, error non-OK dilempar) + integrasi statis +6 (env keys tanpa NEXT_PUBLIC_AI, ekspor lib + AbortController, urutan gerbang aksi env→provider→consent→draft, apply via RPC, UI label+tombol, tanpa import lib AI di client).

## Bukti gates (slice AI)
format 0 · lint 0 · typecheck 0 · test **309/309 +1 skip** (+20) · build 0 (check-env OK dengan 4 key AI baru). Tanpa migration baru → db:typecheck & live-denial tidak berubah (t11/000011 sudah membuktikan RLS+RPC). Catatan: commit ini lokal; 4 commit di depan origin/main (a75cc94, 814fac5, 53a93b4, dan ini). Verifikasi end-to-end state (c) — backend hidup + consent + mock — masih menunggu hosted pulih.

## Catatan sesi — Blockchain anchoring opsional (Prompt 09; ADR-018)

Baseline sertifikat sudah lulus seluruh test; anchoring kini jadi ADAPTER opsional dengan
keputusan provider/network DITUNDA ke manusia.

**ADR-018 (proposed)** — perbandingan no-chain / public low-cost chain (Solana, Algorand,
Stellar, Base, Polygon) / permissioned ledger (Fabric, Besu private) + evaluasi biaya,
finality, uptime, vendor lock-in, regulasi, privacy, operasional. Keputusan: TIDAK memilih;
provider nyata DITOLAK runtime (noop) — tidak ada kredensial/transaksi karangan. Flag
`BLOCKCHAIN_ANCHOR_ENABLED=false` default tetap.

**`lib/chain.ts` (upgrade)** — interface `anchor(rootHash)` / `getStatus(reference)` /
`verify(rootHash, reference)`; status `pending → final` (bukan boolean), `failed`,
`not_configured`. `MockChainAdapter` deterministik: confirmations → finality, duplicate
root → reference sama (idempoten), `failAnchor`/`failAnchorOnce` (transient), `timeoutMs`
(provider timeout), `unavailable` (provider down). `anchorWithRetry` (backoff sederhana);
`verifyAnchor` fallback → `verified | not_final | invalid | unavailable` (provider down
tidak pernah jadi "invalid"/"verified" palsu). `getChainAdapter()`: off → noop;
enabled+mock → mock; enabled+provider nyata → noop (ADR-018 pending).

**Migration `…000017`** — CHECK `chain_anchors.status in ('pending','final','failed')`;
policy `chain_anchors_public_read` (anon+authenticated) — baris HANYA hash/root +
transaction reference (tanpa PII/nilai, by design); view `certificates_public` kini
`LEFT JOIN chain_anchors` → `chain_anchor_status`.

**UI verifier** — `/api/public/certificates/[publicId]` mengembalikan
`chainAnchor.status ∈ none|pending|final|failed`; halaman `/verify/{publicId}` membedakan
Record valid / Payload hash cocok / Blockchain (final = "terverifikasi di blockchain",
pending = "belum final; tidak diklaim terverifikasi", failed = "anchor gagal", none =
"tidak di-anchor"); TIDAK ada klaim verified sebelum final (ACCEPTANCE_CRITERIA ✓).

**Tests (+15)** — `tests/unit/chain.test.ts` (12: lifecycle pending→final, duplicate,
pending selamanya, fail permanen, timeout, retry transient/habis, unavailable,
verifyAnchor verified/invalid/not_final/unavailable, seleksi flag+mock+provider nyata
ditolak, noop) + `contracts.test.ts` +3 statis (000017: CHECK, policy anon non-PII, view
LEFT JOIN).

## Bukti gates (anchor adapter)
format 0 · lint 0 · typecheck 0 · test **324/324 +1 skip** (+15) · `db:typecheck` 0
(38 tables, 2 views — view baru lolos advisor) · **live-denial 91/91** (000017 apply
bersih di harness) · build 0. Belum ter-push ke hosted (outage masih berlanjut;
migration pending 000012–000017 tercatat di .freebuff/run.md).

## Catatan sesi — Batch anchoring job slice (Prompt 09 lanjutan; ADR-018)

**`lib/anchor-job.ts` (baru)** — job batch anchoring per-org:
- `isAnchorEligible` (active + belum ter-anchor + punya payload_hash), `collectAnchorCandidates`
  (urut deterministik + `ANCHOR_BATCH_LIMIT=200`), `runAnchorBatch(deps)` orkestrator murni
  terhadap I/O: kandidat → **satu Merkle root** (lib/merkle.ts) → `adapter.anchor(root)` →
  `insertAnchor` baris `chain_anchors` (provider/network/transaction_ref/merkle_root/status
  pending|final) → `linkCertificates`. **Dedup crash-window**: root yang sama sudah ada →
  link ke baris lama, TANPA anchor ulang. Hanya hash/root + tx reference (tanpa PII).
  Anchor gagal/failed → tanpa insert/link (run berikutnya retry).

**Migration `…000018`** — `chain_anchors.organization_id` (nullable, FK org) + index:
anchor di-scope per-org sehingga guru org tidak bisa menyentuh/melihat sertifikat org lain.

**Action `anchorCertificateBatch()`** (features/actions.ts) — jalur ops:
auth (claims) → membership guru teacher aktif org (`FORBIDDEN`) → gerbang ADR-018 fail-closed
(`BLOCKCHAIN_DISABLED` saat flag off; `BLOCKCHAIN_PROVIDER_PENDING` saat provider nyata/
belum dipilih → NoopChainAdapter → tolak, tanpa transaksi karangan) → service client
(jobs/chain_anchors memang service-only) → batch sertifikat org caller:
`status=active + chain_anchor_id is null + enrollments.courses.organization_id=org`
(nested filter, server-side, tanpa cross-org) → `runAnchorBatch` → hasil
`{ok, anchored, root, reference, status}`; `no_candidates` = ok dengan anchored 0.
Scheduler dapat memanggil action ini berkala.

**Tests (+13)** — `tests/unit/anchor-job.test.ts` (10: eligible filter, collect deterministik/
limit, happy path root+insert+link, no-candidates tanpa panggil adapter, anchor failed tanpa
insert, crash-window dedup anchor sekali, batas batch) + `tests/integration/anchor-batch.test.ts`
(3 statis: migration 000018 org+index, surface lib + tanpa PII, action authz
membership→service→batch + gerbang + scope nested).

## Bukti gates (batch anchor)
format 0 · lint 0 · typecheck 0 · test **337/337 +1 skip** (+13) · `db:typecheck` 0 (38 tables)
· **live-denial 91/91** (000018 apply bersih) · build 0. Migration 000018 belum ter-push
ke hosted (outage; stack pending 000012–000018 di .freebuff/run.md).

## Catatan sesi — Anchoring UI guru (ADR-018): status per sertifikat + trigger anchor batch

**`/teacher/certificates` (baru)** — daftar sertifikat org guru (aggregasi lintas cohort
yang dia ajar; RLS certs_teacher_all + filter nested `enrollments.cohort_id` defense-in-depth),
per baris: serial, nama murid (via enrollments→profiles), status, tanggal, dan **chip status
anchor**. Header section "Anchoring blockchain (opsional)": saat flag off tampil catatan jelas
(`BLOCKCHAIN_ANCHOR_ENABLED=false` + rujukan ADR-018); saat on → `AnchorBatchButton`.

**`components/anchor-status.tsx` (baru)** — chip aksesibel `tidak di-anchor / anchor pending /
✓ anchor final / anchor gagal` (teks selalu ada; warna hanya sekunder; title memuat tx
reference). Hanya state final yang menyiratkan verifikasi; pending tidak pernah diklaim.

**`AnchorBatchButton` (client)** — memanggil `anchorCertificateBatch()`; hasil sukses
(anchored count + Merkle root pendek + status + tx) atau pesan terpetakan
(`BLOCKCHAIN_DISABLED`/`_PROVIDER_PENDING`/`ANCHOR_FAILED`/`ANCHOR_EMPTY`); `role="status"`;
kembali null saat fitur nonaktif.

**Perluasan**: chip anchor di halaman murid (`/teacher/students/[id]` — select sertifikat kini
meng-embed `chain_anchors(status,transaction_ref,network)`) dan tautan "Sertifikat & anchoring"
di dashboard guru.

**Tests (+6)** — `tests/integration/teacher-certificates.test.ts` statis: route force-dynamic +
select embed + scope cohort; gerbang flag di halaman; button client memanggil action + tanpa
klaim "blockchain verified"; chip membedakan 4 state; halaman murid menampilkan chip; link
dashboard.

## Bukti gates (anchoring UI guru)
format 0 · lint 0 · typecheck 0 · test **343/343 +1 skip** (+6) · build 0. Tanpa migration
baru (status anchor dari 000017; batch org dari 000018) → db:typecheck/live-denial tidak
berubah (91/91). Verifikasi visual di preview menunggu backend hidup.

## Catatan sesi — Evaluasi provider/network ADR-018 (matriks skor + rekomendasi)

**`docs/evaluation-anchor-provider.md` (baru)** — matriks skor konkret berbobot untuk
keputusan manusia ADR-018, data titik 2026 (web-sourced):
- Kriteria+bobot: biaya (0,15), kejelasan finality (0,20), keberlanjutan ekosistem (0,20),
  lock-in/ops (0,15), regulasi/privacy data anak (0,20), tooling/preseden (0,10).
- Skor: **no-chain 4,20** > **Algorand 4,05** > Solana 4,00 > Stellar 3,85 > Base (L2)
  3,70 > permissioned 3,45. Algorand unggul karena finality deterministik-irreversibel
  (definisi "final" tegas untuk UI) + ≈$0,00015/batch + root 32 byte muat memo; risiko
  kontinuitas (ALGO all-time-low 2026) dimitigasi hash-only + adapter abstrak + fallback.
- **Rekomendasi default**: (1) tetap no-chain untuk production; (2) bila non-repudiation
  pihak ketiga diputuskan perlu → Algorand; (3) alternatif Solana/Base; permissioned TIDAK
  direkomendasikan. Checklist keputusan manusia (YA/TIDAK) + langkah aktivasi
  (HttpChainAdapter → env → e2e) + daftar sumber untuk verifikasi ulang.
- **DECISIONS.md ADR-018**: ditambah blok evaluasi & rekomendasi (status tetap proposed —
  keputusan final di manusia; implementasi tetap mock-only sampai itu).

Tidak ada perubahan kode; flag/implementasi tidak berubah (ADR-018 masih menunggu keputusan).

## Catatan sesi — Hosted pulih + push 000012–000018 & verifikasi live

Hosted pulih (auth health 200, PostgREST merespons) setelah beberapa sesi down. Menjalankan `.freebuff/push-and-verify.sh` end-to-end:

- **`supabase db push --linked`** → 000012–000018 semua ter-push (000000–000011 + seed sudah dari sesi awal). `migration list` menunjukkan local == remote untuk seluruh 000000–000018.
- **V1 (000012)** `attempts?select=question_order_json` → 200 (kolom ada).
- **V2 (000013/000015)** `rubrics` → 200, `rubric_criteria` → 200; `rpc/update_rubric_version` dengan 3 argumen → 400 (fungsi dieksekusi; 404 pada smoke-probe `{}` hanya arity-mismatch, bukan fungsi hilang).
- **V3 (000014)** tipe aktivitas coding live: `bogus_type` → 400 (CHECK aktif), `code_board` → 201 diterima. Probe pertama gagal hanya karena posisi 999998 sudah terisi oleh probe run pertama (23505) — dibersihkan, re-probe sukses.
- **V4 (000017)** `certificates_public?select=public_id,chain_anchor_status` → 200 (kolom terekspos di verifier publik); status `bogus` → 400 (CHECK), `pending` → 201, PATCH `final` → 204 (baris menjadi `final`), semua probe dihapus.
- **Tidak ada sisa probe**: activities ber-title `probe` = 0, `chain_anchors` network `test-local` = 0.
- Catatan: hosted PostgREST mengembalikan body kosong pada POST (tanpa representation), sehingga ekstraksi id berbasis response-grep gagal — probe final memakai filter deterministik (title/merkle_root/network) untuk cleanup yang andal.

## Catatan sesi — Smoke flow mock-anchor live (preview) + 3 defect ditemukan-diperbaiki

Menjalankan smoke flow anchor end-to-end di preview terhadap hosted yang sudah pulih
(flags lokal `BLOCKCHAIN_ANCHOR_ENABLED=true`, `BLOCKCHAIN_PROVIDER=mock`,
`BLOCKCHAIN_NETWORK=mock` — HANYA untuk uji; default produksi tetap false):

1. Login guru (`guru@demo.local` / seed) → `/teacher/certificates`: awalnya **0 sertifikat**.
2. Root cause #1 (fix): page meng-embed `enrollments(student_id,profiles(display_name))`
   padahal schema `enrollments.student_id references auth.users(id)` — TIDAK ada FK
   enrollments→profiles → PostgREST `PGRST200` (hubungan tak ditemukan), query error
   di-swallow → data null → tampil "0 sertifikat". Fix: query `profiles` terpisah
   (`.in("id", studentIds)`), RLS guru tetap cohort-scoped.
3. Klik "Anchor batch" → **"Tidak ada sertifikat baru"** (no_candidates).
4. Root cause #2 (fix): `anchorCertificateBatch` memfilter
   `enrollments.courses.organization_id` TANPA embed jalur itu di select →
   `PGRST108` (bukan embedded resource) → error di-swallow → tampak no_candidates.
   Fix: tambah `enrollments(courses(organization_id))` ke select.
5. Setelah fix: batch sukses → **1 sertifikat di-anchor, Merkle root
   0000…, status pending, tx mock-anchor-000000000000** → chip "anchor pending".
6. Majukan ke final (PATCH service key `chain_anchors.status='final'` — simulasi
   status-refresh poll yang belum ada sebagai job) → chip "✓ anchor final".
7. Verifier publik `/verify/demo-valid-certificate` masih "Verifikasi tidak tersedia".
8. Root cause #3 (fix): `certificates_public` adalah security_invoker dan TIDAK ada
   policy anon pada tabel sumber → anon membaca `[]` (t05 sengaja mengunci) →
   halaman publik tak pernah menampilkan data DB hidup (hanya fallback demo).
   **Fix migration `20260906000019_public_verifier_rpc.sql`**: RPC kurasi
   `public.get_public_certificate(text)` security definer + search_path + validasi
   format public_id + jsonb whitelist minimal (tanpa email/jawaban/nilai/path) +
   revoke PUBLIC + grant anon/authenticated. View mentah TETAP terkunci anon
   (t05 91/91 tetap hijau — defense in depth; anon `certificates_public` = 0 baris).
   Route `/api/public/certificates/{publicId}` kini memanggil RPC (bukan query view);
   rate limit & validasi tetap.
9. Verifier publik kini menampilkan data nyata: **Sertifikat valid ✓ · Murid 01 ·
   Matematika Dasar · Level 1 — Fondasi · DEMO-0001 · Payload hash cocok (000000000000)
   · Record valid · Blockchain: terverifikasi di blockchain (anchor final)**.

Gates: format 0 · lint 0 · typecheck 0 · test **347/347 +1 skip** (+4: contracts 000019)
· db:typecheck 0 (38 tables, 2 views; 000019 hanya fungsi) · live-denial **91/91**
(000019 apply bersih; t05 verifier view anon tetap 0) · build 0. Migration 000019
sudah di-push ke hosted. State demo (chain_anchors final + link DEMO-0001) dibiarkan
di hosted sebagai bukti; flags mock tetap ON di .env lokal untuk re-drive.

## Catatan sesi — Shell HttpChainAdapter Algorand (ADR-018, inert)

Implementasi shell jalur integrasi opsi rekomendasi ADR-018 (Algorand default),
TETAP INERT sampai provider nyata dipilih manusia:

- **`lib/chain-http.ts` (baru)**:
  - `AlgorandHttpClient` — interface client SWAPPABLE (submitAnchor/fetchAnchor);
    satu-satunya titik integrasi jaringan; provider bisa diganti tanpa menyentuh
    logika anchor.
  - `InertAlgorandClient` — klien inert (lempar `ERR_PROVIDER_NOT_CHOSEN`), dipakai
    bila env `BLOCKCHAIN_ALGORAND_*` kosong → TIDAK ada transaksi yang dibuat.
  - `HttpAlgorandClient` — shell HTTP PROVISIONAL (POST /submit-anchor, /anchor/{ref},
    Bearer key, timeout 10s, status divalidasi) — bentuk endpoint belum final,
    hanya dipakai bila env RPC+key terisi.
  - `HttpChainAdapter` — adapter domain: anchor→pending+reference, getStatus memetakan
    status client, verify=true HANYA final+root cocok; client inert → not_configured.
  - `getAlgorandClient()` — seleksi dari env.
- **`lib/chain.ts`**: `getChainAdapter()` untuk `BLOCKCHAIN_PROVIDER=algorand` →
  klien inert = `NoopChainAdapter` (action tetap `BLOCKCHAIN_PROVIDER_PENDING`);
  hanya RPC+key terisi → `HttpChainAdapter(client, network)`.
- **env**: `BLOCKCHAIN_ALGORAND_RPC_URL` + `BLOCKCHAIN_ALGORAND_API_KEY` (opsional,
  KOSONG default) di `lib/env.ts` + `.env.example`.
- **Tests +11** (`tests/unit/chain-http.test.ts`): anchor/getStatus/verify via fake
  client (tanpa jaringan), inert→not_configured, gating getChainAdapter
  (no-env→Noop, RPC+key→HttpChainAdapter, flag off/bogus→Noop), swappable client
  (reference berbeda), HTTP client dengan fetch mock (Bearer, status valid/invalid).

Gates: format 0 · lint 0 · typecheck 0 · test **358/358 +1 skip** (+11) · build 0.
Tanpa perubahan migration → db:typecheck/live-denial tidak berubah (91/91). Perilaku
produksi TIDAK berubah: flag OFF default; provider nyata tetap ditolak runtime sampai
keputusan manusia + kredensial aman (ADR-018 status accepted).

## Catatan sesi — Mode mock-algorand (finality deterministik) + refresh status UI

Menutup gap "pending tidak pernah maju ke final di UI" dengan mode adapter mock
ber-semantik finality Algorand + aksi refresh status:

- **`MockAlgorandClient`** (`lib/chain-http.ts`, implementasi `AlgorandHttpClient` —
  jalur swappable yang sama dengan shell nyata): submit → pending (reference
  deterministik `algo-mock-{root:12}`, idempoten utk root sama) → poll
  `fetchAnchor` × confirmations (default 1) → **final IRREVERSIBEL** (meniru
  Algorand; final tidak pernah kembali ke pending). Store dibagikan antar-instance
  dalam satu proses (dev/preview) sehingga getStatus lintas request berfungsi;
  `__resetMockAlgorandStore()` utk isolasi test.
- **`getChainAdapter()`**: `BLOCKCHAIN_PROVIDER=algorand-mock` →
  `HttpChainAdapter(new MockAlgorandClient(), network)` — jalur HttpChainAdapter
  yang sama dengan provider nyata, hanya client-nya diganti (buktikan client
  swappable). Tanpa jaringan.
- **`refreshAnchorStatus()`** (server action, `features/actions.ts`): gate
  claims → membership teacher aktif → flag → Noop; untuk baris chain_anchors
  org yang pending, tanya `adapter.getStatus(transaction_ref)`; HANYA status
  `final` yang diterapkan (pending/failed dibiarkan utk retry — tidak menurunkan
  row). Ini langkah status-refresh yang sebelumnya dijalankan manual via PATCH
  service key — kini aksi nyata yang bisa dipicu UI.
- **UI**: tombol "Refresh status anchor" (`anchor-refresh-button.tsx`) di samping
  "Anchor batch" pada `/teacher/certificates`; hasil `N anchor pending kini final`
  atau pesan kosong. `.env.example` mencatat nilai `algorand-mock`.
- **Tests +8** (6 unit `chain-http.test.ts`: pending→final 1 poll, idempoten root,
  confirmations=2 + irreversibel, ref tak dikenal→failed, store ter-inject,
  getChainAdapter algorand-mock→HttpChainAdapter + alur verify; 2 statis
  `teacher-certificates.test.ts`: tombol refresh + gating aksi).
- **Bukti E2E di preview (hosted, tanpa jaringan)**: reset state demo →
  Anchor batch → "1 sertifikat di-anchor … status pending · tx algo-mock-…" →
  chip "anchor pending" → klik **Refresh status anchor** → "1 anchor pending kini
  final." → chip "✓ anchor final"; DB: provider `algorand-mock`, status `final`;
  verifier `/verify/demo-valid-certificate` → chainAnchor.status `final`.

Gates: format 0 · lint 0 · typecheck 0 · test **366/366 +1 skip** (+8) · build 0.
Tanpa perubahan migration → db:typecheck/live-denial tidak berubah (91/91).

## Catatan sesi — Lanjutan: admin mapping org + RLS perf 000020–000022 + chain shell + e2e fix

Melanjutkan working tree uncommitted (migrasi 000019–000022, `lib/org-admin.ts`,
`lib/chain-http.ts`, halaman admin, aksi bulk guru/penugasan) + menutup gap uji:

1. **Admin mapping org (`/teacher/admin/map`, facet Owner ADR-008)** — `lib/org-admin.ts`
   `getOrgAdminContext()` (claims → membership teacher aktif → memiliki ≥1 course di
   org; strict client, tanpa service key di helper). Halaman guard org-admin + data
   org-wide via service client (pengecualian admin yang disengaja; guru biasa tetap
   cohort-scoped). Aksi privileged `bulkImportTeachers` (XLSX + guard + cap 200 +
   provisioning profil/membership + kolom Kelas opsional), `bulkImportStudentAssignments`
   (kelas/subjek via upsert idempoten), `saveStudentMapping`/`assignTeacherToClass`
   (skema max 20 id). Parser `parseTeacherRows`/`parseStudentAssignmentRows` di
   `lib/bulk-import.ts` + skema di `lib/validation.ts`. Tautan admin hanya bila
   `adminCtx` di dashboard guru. Tests: `tests/integration/admin-mapping.test.ts`.
2. **RLS perf content-tree (000020–000022)** — defect smoke live: query authenticated
   `lessons`/`activities` timeout (join-chain 4 tabel tanpa index FK + evaluasi RLS
   berlapis). 000020: index FK idempoten (non-semantik). 000021: helper security
   definer (gagal INSERT — WITH CHECK sebelum baris ada). 000022 (koreksi): helper
   FK-keyed (`course_id`/`course_version_id`/`level_id`/`module_id`/`lesson_id`/
   `activity_id`/`assessment_id`) + rebuild policy USING+WITH CHECK; revoke PUBLIC +
   grant authenticated. Kontrak statis baru di `contracts.test.ts` (+5: index list +
   non-semantik, FK-keyed signature, policy FK, definer/search_path/revoke/grant).
3. **Chain shell Algorand inert + mock-algorand + refresh** — `lib/chain-http.ts`
   (`AlgorandHttpClient` swappable, `InertAlgorandClient`, `HttpAlgorandClient`
   provisional, `MockAlgorandClient` finality deterministik irreversibel),
   `getChainAdapter()` (`algorand-mock` → HttpAdapter+mock; `algorand` tanpa env →
   Noop → `BLOCKCHAIN_PROVIDER_PENDING`), aksi `refreshAnchorStatus()` (hanya `final`
   diterapkan), tombol refresh di `/teacher/certificates`, env
   `BLOCKCHAIN_ALGORAND_RPC_URL/API_KEY` opsional. ADR-018 accepted (no-chain
   produksi; Algorand default bila syarat manusia terpenuhi).
4. **E2E fix** — heading landing berubah ("Belajar coding secara mandiri…",
   sesi redaksional dark/light) → regex `critical.spec.ts` `/Belajar mandiri/`
   tak cocok; diperbarui ke `/Belajar coding secara mandiri/`.

Gates sesi ini: format 0 · lint 0 · typecheck 0 · test **384/384 +1 skip**
(43 files; +18 vs 366: +13 working-tree — `admin-mapping` 7, sisanya tambahan
bulk-import/chain-http/teacher-certificates — +5 kontrak 000020–022 sesi ini) · db:typecheck 0 (38 tables, 2 views) · live-denial
**91/91** (000019–000022 verbatim) · e2e **18 passed / 1 skipped** (login skip:
tanpa backend) · build 0 (route `/teacher/admin/map` ikut ter-build dynamic).

Belum: push 000020–000022 ke hosted (000019 sudah); verifikasi visual
`/teacher/admin/map` + refresh anchor menunggu backend hidup.

## Catatan sesi — Modernisasi dashboard (semua peran, ekspektasi "tampilan modern")

Keluhan "dashboard jauh dari harapan" → presentasi ulang ketiga dashboard peran
(DATA + query + RLS TIDAK berubah — murni presentasi + redaksional):

1. **Kit `components/dashboard.tsx` (baru, tanpa dep baru, SVG murni)**:
   `StatCard` (aksen tone + hint), `ProgressRing` (SVG + teks % + role progressbar),
   `MeterBar` (role progressbar + aria), `SectionHeader`, `StateBadge` (selalu
   berteks — bukan warna saja). Palet slate/blue/emerald/amber + varian `dark:`.
2. **Murid `/learn`**: eyebrow "Ruang Belajar" + h1 judul kursus (sapaan kasual
   "Halo, Pelajar" dihapus); hero grid — kartu gradien "Langkah berikutnya"
   (alasan + CTA) + kartu ring target mingguan; journey level vertikal (node
   ✓/lock/nomor + konektor, badge state, MeterBar mastery, tautan "Buka level"
   per level terbuka); ringkasan 3 StatCard (selesai/dikerjakan/terkunci).
   E2E login diperbarui: heading judul kursus + teks "Langkah berikutnya".
3. **Guru `/teacher`**: eyebrow nama cohort + h1; 5 StatCard bertone + hint;
   matriks cohort dalam kartu (mobile cards + tabel desktop dipertahankan);
   "Sinyal risiko" + "Kelola kelas" sebagai kartu aksi (6 alat + admin gated).
4. **Wali `/guardian`**: kartu anak ber-header gradien (avatar, nama, badge);
   ProgressRing + 4 tile; footer jujur bila kosong ("Belum ada progres tercatat
   — data muncul setelah anak mulai belajar", ganti "Level tuntas 0 dari 0").
5. **Kecil**: pesan INACTIVE dibatasi "30+ hari" (`lib/progress.ts`; ambang logika
   tak berubah; fallback 999 = tanpa aktivitas tercatat tak tampil mentah).

Tests: `dashboard-kit.test.tsx` (5, jsdom: teks/aria/clamp) +
`dashboard-modern.test.ts` (5, statis: impor kit ×3 peran, hero/journey/tautan,
kartu aksi + gate admin, wording wali) + 1 unit cap 30+; 3 test statis lama
disesuaikan ke tautan data-driven (`href:` bukan `href=`, `adminCtx && [`).

Gates: format 0 · lint 0 · typecheck 0 · test **406/406 +1 skip** (46 files)
· db:typecheck 0 (38 tables, 2 views) · build 0 · e2e live-hosted **28/28**
(24 responsive-authed + 4 critical, termasuk login murid→/learn) · live-denial
tidak tersentuh (tanpa migration). Screenshot bukti:
`C:\Users\User\AppData\Local\Temp\opencode\{learn,teacher,guardian}.png`
(tool dir, tidak di-commit).

UPDATE status "Belum" sesi lalu: 000020–000022 sudah remote (migration list
local == remote 000000–000023); service key hosted diperbaiki (sb_secret mati
401 → legacy service_role JWT via management API, terverifikasi 200); study loop
penuh terbukti live (murid01 jawab+submit = 100, guru melihat submitted+skor);
kunci RPC 000023 ter-push dan tersaji tanpa bocor grading.

## Catatan sesi — App shell: sidebar + topbar + pengaturan + keluar semua RBAC

Misi (navigasi jelas per peran, responsif, pengaturan & keluar di semua peran;
RBAC.md TIDAK menambah kapabilitas — pengaturan = akun sendiri):

1. **`lib/role-nav.ts` (baru, sumber tunggal)**: `navForRole(role, isOrgAdmin)` —
   murid 5 tautan (Belajar/Katalog/Review/Sertifikat/Pengaturan), guru 6–7
   (+Admin bila org-admin, ADR-008), wali 2 (Ringkasan/Pengaturan).
2. **`components/app-shell.tsx` (Server) + `app-nav.tsx` (Client)**:
   sidebar sticky `md:h-screen` (Keluar selalu terlihat desktop), topbar sticky
   (hamburger mobile + eyebrow + font-scale murid + tema + ⚙), drawer mobile
   (dialog, Escape/overlay/tautan menutup, aria-expanded). Halaman tetap
   merender `<main>` sendiri (tanpa nested main).
3. **Route `/settings` (semua peran)**: guard 3 peran → nav sesuai peran +
   `SettingsPanel` (Akun: email/nama/peran-server + EditProfile; Preferensi:
   tema + font-scale murid; Sesi: Keluar). Toggle tema ganda dihapus dari
   halaman guru/wali (kini di shell).
4. **Defect ditemukan**: footer sidebar tenggelam di halaman panjang (aside ikut
   tinggi konten) → aside `md:sticky md:h-screen`.

Tests: `app-nav.test.tsx` (5, jsdom: tautan per peran, aria-current, drawer
buka/Escape/tautan, Keluar) + `app-shell.test.ts` (6: peta nav, layout×3 guard
+ AppShell, shell synchronize topbar/sidebar, settings guard+panel).
E2E `shell.spec.ts` (live-only, 3 peran: sidebar/drawer/pengaturan/keluar).

Gates: format 0 · lint 0 · typecheck 0 · test **417/417 +1 skip** (48 files)
· build 0 · e2e live **24/24 responsive-authed + 3/3 shell + 4/4 critical**
· live-denial/db tidak tersentuh (tanpa migration).

## Catatan sesi — Bulk XLSX: template + ekspor + kontrak DB/API + layout modern

Permintaan: template untuk semua bulk, match DB+API, berkas dibuang setelah
sukses, menu download berisi data DB, layout modern responsif nyaman.

1. **Template (`lib/bulk-template.ts`, single source of truth)**: 4 kind
   (students/content/teachers/assignments) — header + contoh + kapasitas mirror
   guard server. Route `GET /api/bulk/templates/[kind]` (guru utk
   students/content; org-admin utk teachers/assignments; 404 kind asing).
   Alias parser ditambah "subjek" agar header template terparse.
2. **Ekspor XLSX round-trip**: roster per cohort (`Email, Nama, Status`) +
   materi per course (6 header template + Content JSON), otorisasi pemilik,
   escape anti formula-injection (mirror lib/csv). Unduhan → edit → impor
   ulang terbukti live (roster 3 baris ber-email, materi 1 baris, 0 error parse).
3. **Defect #1 — email resolution mati total**: `svc.schema("auth")` selalu 406
   live (PostgREST tak mengekspos skema auth) → semua impor bulk berakhir
   notFound diam-diam. Fix: `fetchAuthDirectory`/`resolveEmailsToIds` via Auth
   Admin API di 3 aksi + ekspor roster.
4. **Defect #2 — UUID seed ditolak**: `z.string().uuid()` (Zod 4) menolak bit
   varian → SEMUA action ber-ID seed (c000…/b000…) balas INVALID_INPUT live.
   Fix: `uuidSchema` = regex format hex 8-4-4-4-12 (DB penegak tipe akhir).
5. **Hapus-setelah-sukses**: server tak pernah menulis disk (parse memori);
   keempat kartu mereset form saat sukses + catatan di BulkCard.
6. **Layout**: `components/bulk-card.tsx` (judul, template, ekspor, kapasitas,
   hasil) dipakai keempat kartu; grid responsif; dark mode.

Tests: `bulk-contract.test.ts` (15: template↔parser 0-error, kapasitas,
workbook round-trip, escape, ekspor↔template, template roles, allowlist =
CHECK 000014, tanpa fs/auth-schema, reset+templateLink ×4 kartu, uuid seed).
Bukti live: template 2 baris 0 error, roster ber-email, materi 1 baris,
403 cohort asing, impor UI murid existing → "sudah menjadi anggota".

Gates: format/lint/typecheck 0 · test **432/432 +1 skip** (49 files) ·
db 0 (38t/2v) · build 0. Tanpa migration → live-denial tetap 95/95.

## Catatan sesi — Mobile: tabel sertifikat guru + perluasan audit route

Audit 360px semua 20 route peran → 1 bocor: `/teacher/certificates` (tabel 5
kolom + tanggal ISO, 456px). Fix pola matriks: kartu tumpuk `md:hidden` +
tabel desktop + tanggal pendek YYYY-MM-DD. Spec responsif-authed diperluas
(+certificates, +cohorts = 10 paths × 3 viewport).

Gates: e2e live **30/30 responsive-authed** · test **432/432 +1 skip**.

## Catatan sesi — Tanda tangan digital sertifikat + recovery script deterministik

1. **Tanda tangan digital penerbit di PDF** (`app/api/certificates/[publicId]/pdf/route.ts`):
   area garis + nama **"Sugeng Riyanto, M.Sc."** + label "Penerbit sertifikat" di
   kiri-bawah A4 landscape (QR tetap kanan-bawah). Verifikasi LIVE: PDF DEMO-0001
   via sesi guru → 200 application/pdf 4.822 byte; stream di-inflate + token hex
   pdfkit didekode → `Sugeng Riyanto, M.Sc.`, `Penerbit sertifikat`, `DEMO-0001`,
   `Matematika Dasar` semua TERKANDUNG. Test statis baru di hardening (P11).
2. **`.freebuff/push-and-verify.sh` refactor ke cleanup deterministik**: hosted
   mengembalikan POST body kosong tanpa `Prefer: return=representation`, sehingga
   ekstraksi id lama bisa membiarkan baris probe tersisa. Kini id probe FIXED
   (`c0000000-…-c0de`, `a0000000-…-b00d`) + `trap EXIT cleanup` by-id DAN
   by content-marker (sweep title lama + merkle_root 1111…) — baris probe TIDAK
   PERNAH tersisa walau assert gagal/body kosong. Run LIVE: bogus CHECK 400 ×2,
   insert code_board 201, pending 201 → PATCH final 204, semua cleanup 204.
3. Migration list --linked = 000000–000023, "Remote database is up to date".

Gates: format/lint/typecheck 0 · test **433 passed +1 skip** (49 files, +1 hardening
P11 signature) · build 0. Tanpa migration → db:typecheck/live-denial tak tersentuh.

## Catatan sesi — Adopsi materi gaya codewithharry: halaman bacaan kaya (blok ter-allowlist)

Permintaan: siswa membaca info/teks/ilustrasi + embed pdf/youtube/image/audio dalam
SATU halaman, lalu assignment (bisa diulang) dan asesmen mengunci topik berikut.
Gap dari recon: `article` hanya `content.body` teks polos; tak ada campuran media
satu halaman; tak ada ilustrasi. Solusi tanpa migrasi (content_json sudah jsonb):

1. **`lib/content-blocks.ts` (baru, pure)**: 8 kind allowlist
   (heading/paragraph/image/code/embed_youtube/embed_pdf/embed_audio/embed_file) +
   `sanitizeContentBlocks` (kind tak dikenal => BLOCK_INVALID; hanya field
   allowlist; URL http(s); youtube direkonstruksi dari id; image WAJIB
   alt/caption = aksesibilitas; MAX_BLOCKS 60; truncate). `isSafeHttpUrl`/
   `youtubeEmbedSrc` DIPINDAH ke sini (single source) — media-embed re-export.
2. **`components/lesson-blocks.tsx` (baru, client)**: renderer terkontrol — tidak
   ada HTML arbitrer (React escape), gambar lazy+alt, iframe hanya youtube-nocookie,
   audio+transcript, unduhan, CodeBlock. kind asing => null (lapis kedua).
3. **Student**: cabang `article` merender `content.blocks` bila ada (fallback body).
4. **Guru authoring**: createActivity kini memvalidasi `blocks` via sanitizer
   (hanya tipe `article`; error `BLOCK_INVALID`), lalu menyimpan canonical; hint
   JSON di level-manager diperbarui dengan contoh blocks.
5. Teacher JSON authoring = pola existing (bulk import Content JSON); blok siap
   dimakan template/bulk.

Tests: `content-blocks.test.ts` (12: canonical, strip extras, kind asing, kapasitas,
image alt-wajib, embed url aman, truncate, deterministik, HTML mentah tetap teks) +
`lesson-blocks.test.tsx` (5, jsdom: semua kind, caption→alt, pdf/file, escape HTML,
kind asing tidak dirender) + media-embed lama tetap hijau via re-export.

Gates: format/lint/typecheck 0 · test **451 passed +1 skip** (51 files, +18) ·
build 0. Tanpa migration → db:typecheck/live-denial tak tersentuh.

Tersisa (luar slice ini): UI block-builder drag&drop guru, importer bulk khusus
codewithharry, dan kebijakan "kuis unlock lesson berikut" per requirement (sudah ada
prereq/unlock server-authoritative Phase 3 — perlu penyetelan per lesson).

## Catatan sesi — Bugfix: drawer mobile runtuh setinggi header (~54px)

Laporan: sidebar di HP/tablet rusak. Probe Playwright @360 (guru) menemukan akar
masalah: overlay drawer `position: fixed` adalah ANAK header yang memakai
`backdrop-blur` — backdrop-filter menjadikan header sebagai containing block
fixed, sehingga drawer ter-ukur 54px (setinggi header) dan nav terpotong,
bukan 700px penuh. Fix `components/app-nav.tsx`: drawer kini di-render lewat
`createPortal(…, document.body)` (fixed = viewport; tidak ter-clip header).
Bukti sebelum/sesudah @360: overlay 360×54 → 360×700; drawer h-full 700; nav
554 dengan 8 tautan terlihat; Escape menutup; @820 sidebar flex 256px tanpa
overflowX (tetap). Verifikasi: probe 3/3 → shell.spec live 3/3 → component
app-nav 5/5 + app-shell 6/6 → full suite 451 +1 skip → lint/typecheck 0.

## Catatan sesi — Design pass: depth halus + micro-interaction (modern, tetap profesional)

Permintaan: modern, terkesan 3D, hover beranimasi, tetap profesional/elegant.

1. **`app/globals.css` — token elevation**: `--ambient` (radial glow lembut di
   body light/dark), `--shadow-soft/-lift/--glow-btn` (bayangan berlapis 3D halus,
   inner-highlight tombol), kelas `.card-lift` (hover: translateY(-3px) + shadow
   lift, 160/200ms cubic-bezier), tekan tombol global (`active: translateY(1px)
   scale(.99)`), glow focus + selection. Semua gerak dibungkus
   `prefers-reduced-motion: no-preference` (aturan reduce global lama tetap).
2. **Shell**: sidebar gradient light/dark + brand monogram "CS" (chip gradient
   blue→indigo + glow), NavLinks aktif jadi pill gradient + shadow lembut dan
   inactive hover translate-x halus; drawer mobile memakai permukaan sama +
   monogram di header.
3. **Dashboard**: StatCard `.card-lift` + aksen atas kini gradien per tone
   (blue→indigo, emerald→teal, amber→orange, rose→pink).
4. **Login**: kartu terangkat `rounded-3xl + --shadow-lift`, header monogram,
   CTA gradien + glow + hover ke shade lebih tua.

Kontras/aksesibilitas dijaga (teks putih di atas gradien gelap; status tetap
berteks; reduced-motion). Verifikasi visual live: login light+dark, drawer guru
dark (pill aktif Dasbor gradien, item jelas, Keluar di footer). Gates: lint 0
(css di-ignore eslint, ekspektasi) · tsc 0 · test 451 +1 skip · build 0.

## Catatan sesi — Tokens elevation dirambat ke seluruh permukaan bersama

`--ambient/--shadow-soft/-lift/--glow-btn` + `.card-lift` + gradien kini dipakai
di: hero publik (CTA Masuk gradien+glow; tombol sekunder lift hover; kartu
Status MVP accent gradien), CodeBlock (shadow + chip bahasa gradien),
media-embed (embed youtube/pdf/audio/file = permukaan putih/gelap + lift +
tombol Unduh gradien), UploadBox (dropzone dashed rounded + hover blue + tombol
file gradien via `file:`), BulkCard (accent atas gradien + header gradien +
tombol template solid), level map murid (kartu level + kartu mingguan/setting +
CTA "Buka level" gradien). Verifikasi visual: hero dark, admin map (accent
gradien + tombol template). Gates: lint/tsc 0 · test 451 +1 skip · build 0.

## Catatan sesi — Authoring massal guru: materi Markdown + question pack (MCQ/esai)

1. **Materi Markdown** (`lib/markdown-blocks.ts`, pure): baris per baris →
   heading `#`, ``` fenced code, gambar `![alt](url)`, paragraf (fence state
   eksplisit) → `content.blocks` canonical via sanitizeContentBlocks (tanpa HTML
   arbitrer). Wiring: createActivity & bulkImportContent menerima
   `content.markdown` (hanya article) → MARKDOWN_INVALID bila rusak; kotak
   authoring level-manager menerima Markdown MENTAH (tanpa `{}`) untuk article.
2. **Question pack** (`lib/question-pack.ts`, pure): template baris
   `TIPE|Prompt|OpsiA–D|Kunci|Poin|Catatan` — tipe sc/mc/tf/essay (alias
   singkat), kunci huruf (A atau A;C) divalidasi terhadap opsi nyata, tf
   benar/salah, esai dinilai manual. UI "Import bank soal (pack)" di
   /teacher/questions (textarea + contoh template collapsible); action
   `bulkImportQuestionPack` (guru org aktif, cap 500, error per baris tak
   menggagalkan baris lain) membuat question + question_versions v1 + kunci +
   catatan guru (explanation_json).
3. **Kunci jawaban**: dibawa baris pack (Kunci+Poin), tersimpan grading_json
   server-only, tak pernah ke browser murid; versi berikutnya tetap lewat
   publishQuestionVersion (riwayat immutabel).

Bukti LIVE (hosted, guru): import 4 baris contoh → "4 soal dibuat" → daftar
bank: sc v1(10p), mc v1(15p) A;B;C, tf v1(5p) benar, essay v1(20p) dengan
Catatan. Tests: markdown-blocks 6 + question-pack 7 (parser, kunci mapping,
kontrak sample). Gates: lint/tsc 0 · test **464 passed +1 skip** (53 files)
· build 0. Rencana Edpuzzle/H5P (video+soal tertanam) → docs/
plan-interactive-video-content.md (PROPOSED, belum di-coding).

## Sesi — Template prompt AI + format untuk authoring materi (article)

- **Baru `lib/markdown-ai-prompt.ts`** (pure): `MARKDOWN_FORMAT_GUIDE` (grammar yang didukung parser: heading ATX, fence kode dengan bahasa, gambar `![alt](url)` baris sendiri wajib alt, paragraf; daftar apa yang TIDAK dirender) dan `buildMarkdownAiPrompt({topic?, extra?})` — prompt siap-salin berbahasa Indonesia: peran penulis materi LMS coding, format, struktur halaman, kontrak keluaran (hanya Markdown, tanpa pengantar, tanpa HTML/iframe).
- **UI authoring**: panel "🤖 Template prompt AI + format materi" (collapsible) pada form activity saat tipe `article` — menampilkan prompt + ringkasan format, tombol **Salin prompt AI** (clipboard + fallback, "Tersalin ✓"), label kolom konten jadi "Markdown (atau JSON)". Hasil AI ditempel langsung ke kolom konten → diubah jadi blok ter-allowlist oleh `parseMarkdownToBlocks` + `sanitizeContentBlocks` di server.
- **README**: seksi "Dokumentasi penting" menautkan `docs/design-system.md` (+ runbooks, release-checklist, PROGRESS.md).
- **Bukti gate**: eslint 0 · `tsc --noEmit` 0 · vitest **469 passed +1 skip** (54 files, +5 test baru untuk prompt builder) · prettier bersih. Contoh keluaran AI (heading→paragraf→kode→gambar→rangkuman) diverifikasi bisa diparse ulang menjadi blok canonical.
- **Belum dikerjakan** (luar scope sesi ini): aturan lint custom untuk hex shadow/gradient hardcoded; templating prompt yang sama untuk question pack AI.

## Sesi — Grafik nyata (bukan pajangan): guru & murid

- **Baru `components/charts.tsx`** (server-safe, tanpa dependensi/JS klien): `ColumnChart` (batang responsif, nilai TETAP teks di atas batang + <title>, daftar sr-only, skala dinamis atau tetap 0–100, token gradien light/dark) dan `ChartPanel` (judul + definisi + "Diperbarui" + catatan kaki + empty state jujur).
- **Murid `/learn`**: dua panel baru yang semuanya bersumber data asli —
  1. "Menit aktif minggu ini" (7 batang Sen–Min) dari `study_sessions` (detik aktif di-clamp per heartbeat — bukan buka-halaman), agregasi murni `weekActiveMinutesByDay` di `lib/progress-planning.ts` (terkonsiliasi dengan ring target: sumber sama);
  2. "Skor kuis terakhir" (maks 6 percobaan ber-`final_score`) dari `attempts` + judul asesmen, skala 0–100, "skor dihitung server".
- **Guru `/teacher/analytics`**: seksi baru "Distribusi kelas" — histogram kemajuan murid (lesson selesai vs total lesson di versi terbit kursusnya, dari `progress_snapshots`, per-kursus benar) + histogram skor asesmen (filter-aware, dari `attempts.final_score`). Murni `percentDistribution` (6 ember tetap, jumlah ember = n) di `lib/analytics-teacher.ts`; tidak ada query baru/N+1 (data batch yang sudah ada).
- **Kejujuran angka**: definisi berversi (`CLASS_DISTRIBUTION_DEFINITIONS_VERSION 2026-09-07/v1`), `n` sample size, rata-rata, "Diperbarui" per panel; empty state eksplisit saat belum ada data (bukan grafik palsu); tanpa ranking publik.
- **Bukti gate**: eslint 0 · tsc 0 · vitest **481 passed +1 skip** (55 files; +12: 5 weekActiveMinutesByDay, 4 percentDistribution, 5 static student-charts, 1 static analytics) · `npm run build` 0. Live preview (hosted, dark): seksi Distribusi kelas tampil dengan kontrak metrik & empty-state jujur (n=0 karena demo hosted belum punya attempt ber-skor / snapshot lesson — bukan cacat grafik).

## Sesi — Prompt AI untuk bank soal + aturan lint token elevasi

- **Baru `lib/question-pack-ai-prompt.ts`** (pure): `QUESTION_PACK_FORMAT_GUIDE` (grammar pack persis `parseQuestionPack`: 9 kolom `|`, tipe sc/mc/tf/essay, kunci A–D / `A;C` / benar|salah, poin default 10, aturan mutu soal) + `buildQuestionPackAiPrompt({topic?, count?, extra?})` — prompt siap-salin Bahasa Indonesia; kontrak keluaran melarang menebak kunci (bila sumber tak memuat kunci → jadikan essay dengan pedoman di Catatan).
- **UI bank soal**: panel "🤖 Template prompt AI + format bank soal" (collapsible) di kartu Import pack `/teacher/questions` — prompt + ringkasan format + tombol **Salin prompt AI** ("Tersalin ✓"), cermin dari panel article di level-manager. Hasil AI ditempel langsung ke kolom import pack.
- **Rule lint baru `lms/no-hardcoded-elevation-hex`** (warn) di `eslint.config.mjs`: memflag hex hardcoded (`#rrggbb`) pada nilai className (Literal/TemplateLiteral/expression) dan menyarankan token elevasi (`--shadow-soft`/`--shadow-lift`/`--glow-btn`, kelas gradien palet, `--surface-grad-*`). Divalidasi dengan probe stdin: `from-[#123456]` → 1 warning sesuai pesan.
- **Refactor demi kepatuhan**: dua gradien permukaan gelap yang memakai hex (drawer `app-nav`, sidebar `app-shell`) kini memakai token `--surface-grad-from/--surface-grad-to` di `globals.css` (blok `.dark`).
- **Bukti gate**: prettier · eslint repo **0 warning** (rule aktif) · tsc 0 · vitest **486 passed +1 skip** (56 files; +5: unit question-pack-ai-prompt) · build 0. Live preview `/teacher/questions` (dark): panel prompt AI tampil benar + tombol Salin.

## Sesi — Panel prompt AI dipersonalisasi per topik

- Panel AI article (level-manager) + bank soal (`/teacher/questions`) kini punya input **Topik materi** (opsional) yang langsung membangun ulang preview prompt (`buildMarkdownAiPrompt({topic})` / `buildQuestionPackAiPrompt({topic, count})`) dan dipakai tombol Salin. Bank soal juga dapat mengatur **jumlah soal** (default 10).
- Verifikasi live (preview, guru): isi "Perulangan Python" + jumlah 5 → preview prompt berubah jadi "Topik materi: Perulangan Python" dan "susun 5 soal". Gates: tsc 0 · eslint 0 · vitest **486 passed +1 skip**.

## Sesi — Landing page (/) bahasa Inggris profesional

- `app/page.tsx` ditulis ulang penuh dalam Bahasa Inggris: header brand + ThemeToggle, hero (pill "Self-paced learning · teacher oversight · verifiable outcomes", H1, sub-copy), CTA row (Sign in / Student demo / Teacher dashboard / Guardian view), 6 kartu fitur, 3 kartu peran (students/teachers/guardians), seksi "Trusted by design" (RLS, kunci server-side, append-only audit, verifier minimal-PII, aksesibilitas, blok konten tanpa HTML arbitrer), CTA bawah + footer. Token elevasi + `card-lift` + gradien dipertahankan; tetap server-safe.
- Klaim produk dijaga akurat (tanpa klaim blockchain "live"; anchoring opsional di belakang feature flag).
- `tests/e2e/critical.spec.ts` disesuaikan: landing sekarang meng-assert H1 Inggris + link "Sign in" (login page tetap "Masuk").
- Gates: prettier · eslint 0 · tsc 0 · vitest **486 passed +1 skip** · build 0. Live preview dark: hero, fitur, peran, dan CTA render benar.

## Sesi — Code runner multi-bahasa (sandbox eksternal) + copy prompt AI kode

- **Baru `lib/code-runner.ts`** (pure): allowlist 11 bahasa (Python, JS, TS, C, C++, Java, Go, Rust, Ruby, PHP, C#) + alias (py/js/ts/c++/golang/cs), batas kode/stdin, `buildPistonPayload`/`parsePistonResponse` (Piston-compatible), provider **mock** (deterministik tanpa jaringan) & **http** (POST `/execute`, timeout 15 s, apiKey Bearer opsional, fetch diinjeksi utk tests), factory **fail-closed** (`CODE_RUNNER_ENABLED` default false → CODE_RUNNER_DISABLED), dan `buildCodeAiPrompt` (copy prompt "pahami/perbaiki kode" — hanya kode+output, tanpa data murid).
- **Route `POST /api/code/run`**: wajib login; validasi body/ukuran/bahasa; memanggil provider; kode/output TIDAK disimpan/dilog.
- **UI `components/code-runner.tsx`** (client): pilih bahasa, starter code per bahasa, stdin, tombol ▶ Jalankan, pane output (stdout/stderr + exit code), "Salin kode", dan panel "🤖 Prompt AI — pahami/perbaiki kode ini" dengan tombol salin — ditempel di aktivitas `code_board` (ActivityView murid). Landing page diperbarui (feature "Coding-first content" menyebut playground multi-bahasa sandbox).
- **Env baru (semua opsional, default off)**: `CODE_RUNNER_ENABLED`, `CODE_RUNNER_PROVIDER` (mock|http), `CODE_RUNNER_BASE_URL`, `CODE_RUNNER_API_KEY` — ditambahkan ke schema lib/env.ts + `.env.example`.
- **Bukti gate**: eslint 0 · tsc 0 · vitest **502 passed +1 skip** (58 files; +16: 12 unit code-runner + 3 component CodeRunner) · build 0. Test komponen membuktikan jalur fail-closed (503 → pesan jelas) & jalur sukses (stdout/exit tampil, payload benar).
- **Catatan jujur**: eksekusi nyata butuh provider (Piston-compatible) yang dikonfigurasi admin; default server menolak dengan pesan ramah (tidak pernah "diam"). `provider=mock` untuk preview/tests.

## Sesi — Positioning AI-era: jalur Coding → Agentic AI / ML / AGI literacy

- Landing page (EN): tagline brand jadi "From first program to agentic AI"; hero menyebut LMS sebagai base layer kurikulum era-AI (loop belajar → praktik → bukti → kredensial); seksi baru "One honest loop, from first program to agentic AI & AGI literacy" = timeline 5 anak tangga (Coding & computational thinking → Data/logika/matematika ML → Applied ML → Agentic AI & tool-using systems → AGI literacy & responsible AI), masing-masing memetakan fitur platform yang SUDAH ada (versi kursus, code runner sandbox, kuis server-graded, rubrik, sertifikat QR). Copy sengaja anti-hype: "tidak menjanjikan mengajar AI magic".
- **Dokumen baru `docs/roadmap-ai-pathway.md`**: prinsip (LMS menjamin loop, guru menyusun anak tangga, bukti-bukti, kejujuran alat), tabel anak tangga × dukungan platform, yang TIDAK diklaim, dan kebijakan "next" kurikulum.
- Gates: prettier · eslint 0 · tsc 0 · vitest **502 passed +1 skip** · build 0. Live preview dark: tagline/hero + timeline 5 tahap + "Trusted by design" render benar.

## Sesi — UI/UX "latest version": kohesi global tanpa refactor massal

- Audit pola lama lintas app: 33 tombol solid `bg-blue-700` + 15 file kartu polos `rounded-xl border p-4` masih "pra-token". Solusi terpusat di `app/globals.css` (tanpa menyentuh tiap file, aman & mudah direvert): `.bg-blue-700` → CTA gradien blue→indigo + `--glow-btn` (+ varian `.dark` & hover brightness); `.rounded-xl.border.p-4` → permukaan terangkat (white / #111a2e + `--shadow-soft`).
- `docs/design-system.md` ditambah seksi "Legacy auto-upgrade" (aturan selector-level; komponen baru tetap menulis kelas eksplisit).
- Verifikasi: build 0; preview dark `/teacher/questions` — kartu Import pack/+ Soal baru terangkat konsisten dengan panel AI & tombol gradien; landing & login tidak terpengaruh (sudah token modern). Tidak ada perubahan markup/test.

## Sesi — Auto-fill topik AI dari judul activity (panel article, level-manager)

- `level-manager.tsx`: kolom topik pada "Template prompt AI + format materi" kini TERISI OTOMATIS dari judul activity yang sedang diketik (`actTitle`, max 120). Nilai di-*derive* saat render (`aiTopicValue = edited ? manual : actTitle…`) — bukan setState dalam effect (patuh react-hooks/set-state-in-effect). Begitu guru menyentuh kolom topik, nilainya terkunci manual dan tidak ditimpa oleh perubahan judul. Ada keterangan kecil "Terisi otomatis dari judul activity — boleh diganti manual."
- Panel bank soal tetap manual (tidak ada "judul lesson" di konteks bank soal).
- Gates: prettier · tsc 0 · eslint 0 · vitest **502 passed +1 skip**.

## Sesi — Pref AI tersimpan di perangkat (localStorage) per panel

- **Baru `lib/client-storage.ts`** (SSR-safe): `loadLocalPref`/`saveLocalPref` prefix `lms-ui:`, try/catch (private/quota), null → hapus.
- Panel AI article (level-manager): topik manual terakhir guru disimpan & dipulihkan (`ai:article-topic`); auto-fill dari judul tetap berjalan untuk sesi baru tanpa pref.
- Panel AI bank soal (`/teacher/questions`): topik (`ai:pack-topic`) & jumlah soal (`ai:pack-count`, clamp 1–100) disimpan/dipulihkan.
- Pemulihan lewat efek setTimeout 0 (setelah hidrasi) — patuh `react-hooks/set-state-in-effect`.
- Bukti: unit client-storage 3 (roundtrip, null-hapus, data rusak→null) · **live preview**: seed localStorage → reload+login ulang → panel terbuka dengan topik "Perulangan Python lanjutan", jumlah 7, dan prompt berisi keduanya. Gates: tsc 0 · eslint 0 · vitest **505 passed +1 skip** (59 files).

## Sesi — Kehandalan lintas mapel: notasi ilmiah + normalisasi unicode/IME

- Latar: audit primitif penilaian untuk matematika/fisika/kimia/biologi/geografi/English/Mandarin. Dua gap nyata yang ditutup:
- **`lib/grading.ts`** — `parseNumericAnswer` kini menerima notasi ilmiah: `6.022e23`, `1e-9`, `2.5E+3`, `.5e-2` (regex `-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?`), tetap memakai unit-factor (`1e3 g` = `1 kg`). Penting untuk fisika/kimia (konstanta, molaritas, pH) & matematika.
- **`lib/grading.ts`** — `normalizeShortText` menambah opsi `normalize.unicode`: NFKC (melipat full-width IME: `Ｈ２Ｏ` → `H2O`) + lipat apostrof/kutip melengkung (`it’s` → `it's`, `“x”` → `"x"`) untuk English & input IME Mandarin. Back-compat: tanpa `unicode` (default) perilaku lama tidak berubah.
- **`lib/attempt.ts`** — `buildGradingRule` mengekspos kolom `normalize` (`unicode` / `plain`) pada rule short_text dari grading_json.
- Fixture test baru di `tests/unit/grading.test.ts` (7): parse e-notation, autoGrade dalam/batas toleransi (fixture diperbaiki: |6.02e23−6.022e23|=2e20 → tolerance 1e21), konversi unit + e-notation, NFKC full-width, back-compat tanpa unicode, apostrof melengkung, teks Mandarin biasa.
- Gates: prettier · eslint 0 · tsc 0 · vitest **512 passed +1 skip** (59 files) · build 0.

## Sesi E2E live guru→murid→sertifikat (hosted) — 07 Sep 2026

Simulasi penuh per instruksi: guru membuat content Python dari `docs/xlsx/Python_Materi_Impor (1).xlsx` + `Python_Panduan_Guru (1).xlsx`, murid belajar + asesmen, guru menilai (server-graded), sertifikat terbit & terverifikasi.

- **Kursus**: "Python: From Fundamentals to a Science Project" — 12 level (1 per modul), 12 modul, 24 lesson, **120 aktivitas** (96 article + 24 code_board) ter-import dari XLSX via UI bulk-import (per-level, 0 error). Verifikasi DB: struktur utuh.
- **Bank soal**: 4 soal kunci asli dari sheet Question Bank workbook (PY-01-Q1…Q4) di-import via format pack; assessment 4 soal × 1 poin dengan randomisasi server-seeded terhubung ke aktivitas quiz lesson 01.1.
- **Defect #1 (fix, migration 000024 `recompute_assessment_total_points`)**: `assessments.total_points` tidak pernah dihitung ulang → quiz berisi soal tervalidasi 0 poin dan publish gagal `INVALID_POINTS`. Fix: trigger AFTER INSERT/UPDATE/DELETE pada `assessment_questions` + backfill; `total_points` kini 4 → publish sukses (Versi 1).
- **Murid 01**: enrollment active via UI cohort; menyelesaikan 11 aktivitas lesson 01.1 + 01.2; kuis **final_score 100** (server-graded, order soal ter-shuffle seed server, autosave 4 jawaban terverifikasi di DB); recompute → lesson + level 01 `completed 100%`.
- **Defect #2 (fix `features/actions.ts`)**: `evaluateLevelEligibility` merata-rata SEMUA lesson snapshot enrollment (termasuk level lain yang belum digarap) → level tuntas tampak 8.3/70. Koreksi: filter hanya lesson milik level yang dievaluasi (`requiredIds`).
- **Defect #3 (fix, migration 000025 `fix_certificate_digest_resolution`)**: RPC `issue_certificate`/`reissue_certificate` memanggil `digest()` yang di hosted ada di schema `extensions` (bukan `public`) → `function digest(text, unknown) does not exist` (42883) hanya di hosted; lokal lolos. Fix: helper `private.sha256_hex` dengan search_path `private, public, extensions` + kedua RPC memakainya.
- **Sertifikat terbit**: `CERT-20260907-53f80c`, public_id `b452443196874056bd527530b4cf3138`, status active, payload_hash sha256 64-hex (RPC dipanggil dengan JWT guru asli; idempotent).
- **Verifier publik** `/verify/b452443196874056bd527530b4cf3138`: "Sertifikat valid ✓" — Penerima Murid 01, course, level, tanggal, serial, payload hash cocok (`90ECE54DAA19`), record valid, blockchain tidak di-anchor, minimum disclosure (tanpa email/DOB/nilai/path).
- **PDF A4 landscape** (on-demand, auth: murid pemilik/guru cohort): status 200, `application/pdf`, **MediaBox `0 0 841.89 595.28`** (A4 landscape), 1 halaman — inspeksi visual: "Certificate of Completion", nama, course—level, tanggal+serial, fingerprint pendek, garis tanda tangan + **Sugeng Riyanto, M.Sc.** + label "Penerbit sertifikat", QR kanan-bawah, border ganda.
- Gates sesi: tsc 0 · vitest certificate suite **23 passed** (certificate 6, reissue 9, teacher-certificates 8). Migration remote kini **000000–000025**.

## Sesi perbaikan navigasi murid — Python tidak bisa lanjut ke test/ujian (07 Sep 2026)

Keluhan live: materi Python tidak bisa lanjut hingga akses test dan ujian. Dua defect navigasi ditemukan & diperbaiki:

- **Defect A — `/learn` mengabaikan `?enrollment=`**: `getDashboard` selalu memakai enrollment aktif PERTAMA (`.limit(1)` tanpa filter), sehingga murid dengan >1 kursus (mis. Matematika Dasar + Python) selalu mendarat di Matematika walau mengklik kursus Python di katalog. Perbaikan: `getDashboard(userId, requestedEnrollmentId?)` mem-filter `.eq("id", enrollment)` bila query menyediakannya; fallback tetap enrollment pertama.
- **Defect B — `/learn/[id]` hanyalah stub refleksi**: route level map sebelumnya hanya textarea draft/refleksi tanpa daftar lesson/aktivitas, jadi tidak ada jalur dari dashboard ke lesson player (`/activities/[activityId]`) maupun kuis. Ditulis ulang menjadi **peta level nyata** (Server Component): modul → lesson → aktivitas ber-urutan, badge tipe (Materi/Papan kode/Kuis-Ujian/dll), status ✓ selesai / 🔒 terkunci / tersedia (unlock server-side via `computeUnlock` + tabel prerequisites), tiap aktivitas menautkan ke `/activities/{id}?enrollment=`, banner "semua aktivitas selesai" per level, dan fallback enrollment pertama bila query kosong.

Verifikasi live di preview (hosted, murid01):
1. `/learn?enrollment=<python>` → dashboard **"Python: From Fundamentals to a Science Project"** (12 level, level 01 selesai, grafik menit aktif + skor kuis "05 Summative check 100%").
2. Level map level 02 & 01 → modul/lesson/aktivitas dengan badge; aktivitas kuis "05 Summative check — Lesson 01.1 (Kuis/Ujian)" terlihat.
3. Klik aktivitas kuis → player quiz → **"Mulai kuis"** → exam `/quiz/{attemptId}` dengan 4 soal, autosave, timer & batas attempt server-side.
4. Halaman `/certificates` murid menampilkan sertifikat `CERT-20260907-53f80c` dengan unduh PDF/verifikasi.

Gates: prettier · eslint 0 · tsc 0 · **build 0**. Catatan jujur: kursus Python hasil import XLSX hanya memuat **1 aktivitas quiz** dari 120 aktivitas (97 article + 24 code_board + 1 quiz) — bank 48 soal di workbook guru ter-import ke bank soal tetapi belum di-wire sebagai kuis per lesson; menambahkan kuis per lesson = langkah authoring berikutnya.

## Sesi sertifikat 2 halaman — halaman 2 informasi umum & kelengkapan konten (07 Sep 2026)

Permintaan: halaman kedua sertifikat menampilkan general information content completeness sebagai tabel & statistik, tidak terpisahkan dari halaman 1, dengan QR dan kode unik yang SAMA (dapat diverifikasi di halaman mana pun).

- **Route** `app/api/certificates/[publicId]/pdf/route.ts`: kini menghasilkan **2 halaman A4 landscape** yang tidak terpisahkan:
  - Halaman 1: muka sertifikat (tidak berubah) — recipient, course, level, tanggal, serial, fingerprint pendek, garis tanda tangan digital **Sugeng Riyanto, M.Sc.**, QR kanan-bawah.
  - Halaman 2: judul "Informasi Umum & Kelengkapan Konten" + catatan "Halaman 2 dari 2 — bagian tak terpisahkan dari halaman 1" + **tabel Informasi Umum** (penerima, penerbit, kursus, level, nomor serial, kode unik/public ID, tanggal terbit, fingerprint) + **tabel Kelengkapan konten per modul** (No, Modul, Pelajaran selesai/total, Aktivitas selesai/total, Kelengkapan %) + **tabel Statistik penyelesaian** (konten level selesai %, pelajaran selesai, aktivitas selesai, asesmen sumatif, nilai terbaik asesmen, waktu belajar aktif) + footer dengan **QR yang sama persis** dan kode unik + URL verifikasi yang sama.
- Data halaman 2 diambil live via RLS viewer: modules/lessons/activities level (required), `progress_snapshots` (lesson completed), `learning_events` `activity_completed` (aktivitas), `attempts` (nilai terbaik), `study_sessions` (waktu aktif server-clamped). Statistik "Asesmen sumatif" menampilkan `N asesmen (M attempt)` bila attempt > asesmen agar tidak terbaca "2/1".
- **Defect ditemukan via inspeksi visual**: pdfkit auto-menambah halaman kosong ke-3 saat baris footer "Halaman 2 dari 2" di `height-56` melewati batas bawah margin (`maxY = height-48`). Reproduksi minimal membuktikan: tanpa baris itu = 2 halaman, dengan = 3 halaman. Perbaikan: posisi `height-64` → output tepat **2 halaman**.
- Verifikasi live (hosted, guru cookie, `CERT-20260907-53f80c`): status 200 `application/pdf`; `MediaBox 0 0 841.89 595.28` ×2 (A4 landscape); `/Count 2` di tree Pages; ekstraksi teks halaman 2 memuat header info umum, kelengkapan per modul (2/2 pelajaran, 11/11 aktivitas, 100%), statistik, kode unik `b452443196874056bd527530b4cf3138`, serial, dan URL verifikasi; **inspeksi visual via PDF viewer**: viewer menampilkan "2 / 2", halaman 2 render utuh (tabel + QR + kode unik sama).
- Gates sesi: prettier · eslint 0 · tsc 0 · vitest certificate suite **23 passed** (unit certificate 6, reissue 9, teacher-certificates 8).

## Sesi penyempurnaan sertifikat — English + QR kanan atas + grafik + link verifier (07 Sep 2026)

Umpan balik: QR halaman 2 tumpang tindih dengan teks, minta QR kecil di kanan atas (tetap bisa discan), sertifikat memakai grafik, dan seluruh copy memakai English level IELTS 8.5+.

- **Route `app/api/certificates/[publicId]/pdf/route.ts` ditulis ulang** (2 halaman A4 landscape tetap):
  - Seluruh copy sertifikat kini **English profesional**: halaman 1 — "ACADEMY", "Certificate of Completion", "Presented to", "for the successful completion of", "Date of issue / Serial number / Fingerprint", "This certificate attests to demonstrated competence; detailed scores are not disclosed.", tanda tangan "Sugeng Riyanto, M.Sc." + label "Certificate Issuer". Halaman 2 — "General Information & Content Completeness", "Page 2 of 2 — an integral part of page 1", tabel Field/Value (Recipient/Issuer/Course/Level/Serial number/Unique code/Date of issue/Fingerprint), "Content Completeness by Module", "Completion Statistics", footer "Unique code / Serial number / Verify".
  - **QR halaman 2 dipindah ke kanan atas, ukuran kecil (90 px)** — buffer QR sama persis dengan halaman 1 (kode unik identik, pemindaian di halaman mana pun → verifier yang sama); tidak ada lagi tumpang tindih dengan judul/teks tengah. QR halaman 1 tetap kanan-bawah (tidak bertabrakan).
  - **Grafik nyata**: seksi "Completion Statistics" kini memakai horizontal bar charts (track slate + fill gradient biru, data live dari progress_snapshots/learning_events/attempts) untuk Level content completed, Lessons completed, Activities completed, Best assessment score; baris teks untuk Summative assessment & Active study time; assessment summary pakai "1 assessment (2 attempts)" agar tidak terbaca "2/1".
  - Guard margin ketat (`maxY = height − 48`): teks footer "Page 2 of 2" di `height−64`, chart di-skip bila sisa ruang < batas → **tidak ada halaman kosong ke-3** (regresi phantom-page yang pernah ditemukan tetap tertutup).
- **`app/(public)/verify/[publicId]/page.tsx`**: badge visual "✓ PDF 2 halaman (A4)" + penjelasan halaman 2 (info umum & kelengkapan konten, QR/kode unik sama) tampil saat valid; tombol "Buka PDF sertifikat (2 halaman)" hanya muncul bagi **penerima atau guru cohort** (auth check server-side via RLS, ADR-009) — pengunjung anonim mendapat catatan privasi, bukan tautan mati.
- Verifikasi live (hosted, `CERT-20260907-53f80c`): PDF `200 application/pdf` 12043 B; **/Count 2**, kedua MediaBox `841.89×595.28`; 13/13 pemeriksaan struktur+copy lulus (2 pages, A4, marker English ada, marker Indonesian `Diberikan kepada`/`Informasi Umum`/`Penerbit sertifikat` hilang). Inspeksi visual via PDF viewer: **2/2 halaman** — halaman 2 menampilkan tabel umum, kelengkapan per modul (2/2, 11/11, 100%), bar chart Completion Statistics, QR kanan-atas tanpa overlap. Verifier: anonim → badge + catatan privasi (tanpa link); session guru → link tampil dan endpoint mengembalikan PDF.
- Gates sesi: prettier · eslint 0 · tsc 0 · vitest certificate suite **23 passed** (unit 6, reissue 9, teacher 8) · **build 0**.

## Sesi penutupan gap Phase 6 — persist PDF ke private bucket + signed download (07 Sep 2026)

KURANG asli PROGRESS.md: "persist PDF ke bucket" (Phase 6). Bagian reissue (RPC
000010/000025 + UI `reissue-button.tsx`) sudah ada; bagian persist belum ada kode.

- **`lib/certificate-store.ts` (baru, server-only)**: `certificateObjectName`
  (murni — map public_id → `{id}.pdf`, tolak traversal/karakter aneh,
  deterministik agar satu sertifikat = satu objek), `persistPdf` (upload
  upsert ke bucket privat `certificates` + update `certificates.pdf_path`
  via service client — satu-satunya jalur sah; TANPA policy authenticated
  baru → regresi `storage.test` tetap hijau), `createPdfSignedUrl` (TTL 300 s,
  null saat storage tak tersedia).
- **`app/api/certificates/[publicId]/pdf/route.ts`**: select kini memuat
  `pdf_path`. Aktif + tersimpan → **302 ke signed URL** (permission RLS sudah
  dipaksa sebelum branch); signed URL gagal → fall through render on-demand.
  Setelah render → persist best-effort dalam try/catch (storage gagal →
  respons PDF-stream tetap, `pdf_path` tetap null) — degradasi anggun
  (AC-6 plan-certificate-persist-reissue).
- **`tests/unit/certificate-store.test.ts` (baru, 4 test)** sanitasi path
  (hex/demo-slug valid; `../`, `%2f`, spasi, `?`, `#`, kosong → INVALID);
  `tests/integration/hardening.test.ts` assertion lama `Penerbit sertifikat`
  diselaraskan ke label English `Certificate Issuer` (perubahan copy PDF
  sesi sebelumnya).
- **Verifikasi live (hosted, `CERT-20260907-53f80c`, JWT guru)**: request 1 →
  `200 application/pdf` (render + persist); request 2 → **302** ke
  `…/storage/v1/object/sign/certificates/b452443…pdf?token=…`; fetch URL →
  `200 application/pdf` 12043 B; DB `pdf_path` terisi; objek storage
  `b452443196874056bd527530b4cf3138.pdf` terdaftar di bucket `certificates`.
- Gates sesi: prettier · eslint 0 · tsc 0 · **npm test 516 passed / 1 skipped
  (60 files)** · build 0. Phase 6 kini TANPA KURANG tersisa.

## Sesi visual sertifikat — gradasi warna + QR page 2 75% (07 Sep 2026)

- **QR halaman 2 dikecilkan ke 75%** (90 → 67.5 px, `qrSize`) — tetap kanan-atas
  tanpa tumpang tindih, buffer QR sama dengan halaman 1.
- **Warna & gradasi (aman untuk print grayscale)**: halaman 1 — wash latar
  vertikal putih→`#e8effc`, frame ganda, ribbon gradien navy→blue→sky
  (`#1e3a8a→#2563eb→#38bdf8`) atas-bawah, judul navy + underline gradien, teks
  kursus navy; halaman 2 — header tabel memakai gradien indigo muda
  (`#eef2ff→#dbeafe`) dengan teks navy + accent line gradien di bawah judul.
- **Kepatutan grayscale (analisis luminance)**: wash 1.00→0.86, header
  0.89→0.81, ribbon 0.05→0.44; seluruh tinta teks (0.01–0.17) lebih gelap dari
  semua isian → tidak ada teks hilang saat dicetak hitam-putih.
- Verifikasi live: re-render 16,968 B ter-persist ulang (pdf_path + objek
  bucket); inspeksi visual page 1 (ribbon, underline, layout utuh tanpa
  tabrakan) & page 2 (header gradien, bar chart, QR 67.5) — tetap 2/2 halaman.
- Gates sesi: prettier · eslint 0 · tsc 0.

## Sesi round-2 visual sertifikat — QR page 2 50% + border rounded (07 Sep 2026)

- **QR halaman 2 diperkecil lagi ke 50%** (67.5 → **33.75 px**, `qrSize`).
  Buffer khusus `qrSmall` (width 72) dipakai untuk halaman 2 — payload URL sama
  persis (kode tetap identik dengan halaman 1), namun modul QR tetap tajam saat
  diskala ke 33.75 pt sehingga masih bisa discan.
- **Outer border rounded** di kedua halaman (radius 16 + inset 8): halaman 1
  dekorasi (wash latar + ribbon) di-clip ke path rounded (pdfkit
  save/roundedRect/clip/restore) agar tidak menyembul di sudut; halaman 2 frame
  rounded ganda yang sama → kedua halaman terbaca sebagai satu dokumen.
- Verifikasi live: re-render 15,413 B ter-persist (pdf_path + objek bucket
  terisi); inspeksi visual — sudut rounded tampil rapi di kedua halaman, QR
  page 2 kecil & tajam tanpa tumpang tindih, tabel/grafik/footer utuh, tetap
  2/2 halaman.
- Gates sesi: prettier · eslint 0 · tsc 0.
