# Acceptance Criteria

> Status diisi 2026-09-07 dengan memetakan bukti dari `docs/release-checklist.md` +
> `PROGRESS.md` (gates terakhir: lint/tsc 0 · **520 passed / 1 skipped (60 files)** ·
> build 0 · live-denial 95/95 di Postgres 18 · e2e login live-hosted). Checkbox
> dicentang hanya bila ada bukti nyata; item parsial tetap terbuka dengan catatan.
> Ini adalah peta bukti (evidence map), bukan pengganti runbook/artefak gate.

## Auth and permissions

- [x] Guru dan murid dapat login/logout dan session refresh bekerja.
      Bukti: `app/(auth)/login`, `signOut`, `proxy.ts` (getClaims refresh); login live
      guru/murid/wali → `/teacher`, `/learn`, `/guardian` di hosted (seed).
- [x] Semua exposed tables RLS-enabled.
      Bukti: `npm run db:typecheck` PASS — DB advisor 38 tabel + 2 view,
      semua exposed table RLS; migration 000000–000023+.
- [x] Seluruh denial tests di `RBAC.md` lulus.
      Bukti: `rls.test.ts` + `phase1.test.ts` statis + **live-denial 95/95**
      (`scripts/live-denial/`, Postgres 18, migration verbatim).
- [x] Role tidak dapat diubah dari browser/user metadata.
      Bukti: tanpa policy UPDATE/INSERT `memberships` untuk user sendiri +
      trigger audit (`phase1.test.ts`, ADR-008; role disimpan di app_metadata server).

## Learning

- [x] Course hierarchy dapat dibuat, dipreview, dipublish, dan versioned.
      Bukti: manage/level-manager + preview + `publishCourseVersion` +
      `validateCourseDraft` + duplicate; diuji live (kursus Python 12 level).
- [x] Murid hanya melihat enrollment aktif.
      Bukti: catalog/`/learn` query + RLS published-read (`courses_student_browse_published`).
- [x] Resume dan autosave pulih setelah refresh.
      Bukti: lesson player localStorage + retry queue offline
      (`useOfflineFlush`/`sync-queue.test.ts`, `offline-cache.test.ts`).
- [x] Prerequisite dan unlock dihitung server-side.
      Bukti: `computeUnlock` di `/learn`/level map + tabel `prerequisites` + test.
- [x] Next-best-action menjelaskan alasan rekomendasi.
      Bukti: `nextBestAction` + alasan dirender di dashboard murid.

## Assessment

- [x] Attempt history append-only dan submit idempotent.
      Bukti: `attempt_no` + `idempotency_key`; submit ganda no-op
      (unit + live-denial `t12_duplicate_submit_noop`).
- [x] Answer key tidak muncul di client sebelum release policy.
      Bukti: `getAttemptQuestions` sanitasi (RPC 000023) + `attempt.test.ts` +
      `hardening.test.ts`; grading_json/explanation server-only.
- [x] Objective scoring cocok dengan fixtures.
      Bukti: `grading.test.ts` + `attempt.test.ts` fixtures hitung-manual; skor
      dihitung ulang server via service client (client tidak menentukan nilai).
- [x] Manual grade dan revision dapat diaudit.
      Bukti: grading queue + `grade_response_manual` + `grade_revisions`
      (prev/new/actor/reason) + `audit_logs`; rubric per-kriteria RPC (000013).
- [ ] Competency mastery dapat ditelusuri ke evidence.
      ⚠️ Parsial: `competencyMastery` + snapshots + evidence per-kompetensi
      otomatis parsial (mastery level = rata-rata snapshot). Perlu lintasan
      evidence per-kompetensi yang eksplisit sebelum dicentang penuh.

## Dashboard

- [x] Class totals cocok dengan raw fixture data.
      Bukti: `analytics.test.ts` reconciliation terhadap fixture raw.
- [x] Guru dapat drill down tanpa melihat organisasi lain.
      Bukti: student detail + RLS cohort + export memfilter teacher_id; denial
      cross-org live-denial.
- [x] Alerts explainable dan dapat diselesaikan.
      Bukti: `detectRisk` + alerts persist (acknowledge/snooze/resolve + note).
- [x] CSV export aman dari formula injection.
      Bukti: `lib/csv` escape `=+-@` + `security.test.ts`, dipakai export route.

## Certificate

- [x] PDF A4 rapi pada print preview.
      Bukti: PDFKit A4 **2 halaman** landscape (`841.89×595.28`, `/Count 2`),
      inspeksi visual + print-safe grayscale (luminance ladder).
- [x] QR menuju HTTPS verifier.
      Bukti: `/api/certificates/[publicId]/qr` + `/verify/{publicId}`; QR sama di
      kedua halaman PDF.
- [x] Hash deterministik dan perubahan payload terdeteksi.
      Bukti: `lib/crypto.ts` canonical payload SHA-256 + `crypto.test.ts`; verifier
      menampilkan fingerprint/hash; JSON record publik membawa `payloadHash` penuh.
- [x] Public verifier tidak membocorkan PII/score detail.
      Bukti: `certificates_public` view + RPC kurasi `get_public_certificate[_record]`
      (whitelist) + `rls.test.ts` + e2e PII check (tanpa email/DOB/nilai/path).
- [x] Revocation dan reissue bekerja.
      Bukti: revoke + audit + reissue UI + action re-evaluasi eligibility
      (ADR-012/013) + live-denial `t10_*` (riwayat revoked+active, retry-safe).
- [x] UI tidak mengklaim blockchain verified saat anchor belum final.
      Bukti: flag OFF + `NoopChainAdapter` + chip status pending/final/failed
      (ADR-018) + `contracts.test.ts`.

## Quality

- [x] Mobile 360px dan desktop 1440px berfungsi.
      Bukti: `responsive.spec.ts` (5 route publik × 3 viewport) +
      `responsive-authed.spec.ts` (8 route peran × 3 viewport) — 0 overflow.
- [x] Keyboard-only critical paths berfungsi.
      Bukti: skip-link, focus-visible, label; e2e tab-check chromium PASS.
- [x] Loading, empty, offline, forbidden, and error states tersedia.
      Bukti: empty/loading/offline per halaman + `error.tsx`/`not-found.tsx` +
      `/unauthorized` + `account-inactive` + demo-mode amber (dev-only).
- [x] Lint, typecheck, tests, production build, dan security checks lulus.
      Bukti: lokal hijau — format, lint 0, tsc 0, **520 passed / 1 skipped**,
      build 0, db advisor (38 tabel/2 view), live-denial 95/95, secret scan.
- [x] README deployment dan operational runbooks akurat.
      Bukti: `docs/runbooks.md` (7 runbook ops) + `docs/release-checklist.md`
      + README (akun demo + sumber kebenaran + tautan docs).

## Catatan status

- **GO untuk uji kelas percontohan (data demo)** dengan catatan dari
  `docs/release-checklist.md`: rotasi kredensial demo (`DemoPass-2026!`) sebelum
  data nyata, `BLOCKCHAIN_ANCHOR_ENABLED=false` di production, dan audit keamanan
  2-org sebelum go-live.
- **Belum masuk kriteria di atas** (bukan bagian acceptance, tapi wajib sebelum
  produksi data nyata): restore rehearsal belum dieksekusi, e2e belum di-wire ke
  CI, live DB-advisor pasca-perubahan DB belum formal, dan `DEPLOYMENT.md` masih
  kerangka (belum ada deployment produksi nyata).
