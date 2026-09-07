# Release Checklist — ACCEPTANCE_CRITERIA.md vs Bukti

Legenda: ✅ Ready · ⚠️ Ready with limitation · ⛔ Blocked eksternal · ❌ Must fix (tidak ada saat ini).

## Auth & permissions

| Kriteria | Status | Bukti |
|---|---|---|
| Login/logout + session refresh | ✅ | `app/(auth)/login`, `signOut`, `proxy.ts` (getClaims refresh) — terbukti live (murid/guru/wali login → /learn, /teacher, /guardian) |
| Semua exposed tables RLS-enabled | ✅ | `npm run db:typecheck` PASS (38 tabel, 2 view, migration 000000–000023) |
| Denial tests RBAC.md lulus | ✅ | `rls.test.ts` + `phase1.test.ts` statis + **live-denial 95/95** (`scripts/live-denial/`, Postgres 18, migration verbatim) |
| Role tak bisa diubah browser | ✅ | `phase1.test.ts` (tanpa UPDATE/INSERT memberships) + trigger audit |

## Learning

| Kriteria | Status | Bukti |
|---|---|---|
| Hierarchy create/preview/publish/versioned | ✅ | manage + level-manager + preview + validate + duplicate |
| Murid hanya enrollment aktif | ✅ | catalog/learn query + RLS published-read |
| Resume & autosave pulih | ✅ | lesson player localStorage + retry queue (`sync-queue.test.ts`) |
| Prereq/unlock server-side | ✅ | `computeUnlock` di learn/catalog + `progress.test.ts` |
| Next-best-action + alasan | ✅ | `nextBestAction` + alasan di UI |

## Assessment

| Kriteria | Status | Bukti |
|---|---|---|
| Append-only + idempotent | ✅ | attempt_no + idempotency_key + `submitAttempt` ganda aman |
| Answer key tidak ke client | ✅ | `getAttemptQuestions` sanitasi + `hardening.test.ts` + `attempt.test.ts` |
| Objective scoring = fixtures | ✅ | `grading.test.ts` (9) + `attempt.test.ts` fixtures |
| Manual grade + revision audit | ✅ | grading queue + `grade_response_manual` + revision list |
| Mastery tertelusur ke evidence | ⚠️ | `competencyMastery` + snapshots; evidence per-kompetensi otomatis parsial (mastery level dari snapshot avg) |

## Dashboard

| Kriteria | Status | Bukti |
|---|---|---|
| Total cocok fixture | ✅ | `analytics.test.ts` reconciliation |
| Drill-down tanpa org lain | ✅ | student detail + RLS cohort + export cek teacher_id |
| Alerts explainable + resolvable | ✅ | `detectRisk` + alerts persist (ack/snooze/resolve + note) |
| CSV aman injection | ✅ | `lib/csv` + `security.test.ts`, dipakai export route |

## Certificate

| Kriteria | Status | Bukti |
|---|---|---|
| PDF A4 rapi print preview | ✅ | `/certificates/[publicId]` print-CSS + `/api/.../pdf` (pdfkit A4 landscape) |
| QR → HTTPS verifier | ✅ | `/api/.../qr` + `/verify/[publicId]` |
| Hash deterministik, tamper terdeteksi | ✅ | `crypto.test.ts` |
| Verifier tanpa PII/score | ✅ | `certificates_public` view + `rls.test.ts` + e2e PII check |
| Revocation & reissue | ✅ | revoke + audit + reissue UI (`reissue-button`) + action eligibility-ulang + live t10 (riwayat revoked+active, retry-safe) |
| Tanpa klaim blockchain palsu | ✅ | flag OFF + `NoopChainAdapter` + UI "tidak di-anchor" + `contracts.test.ts` |

## Quality

| Kriteria | Status | Bukti |
|---|---|---|
| Mobile 360 & desktop 1440 | ✅ | `responsive.spec.ts` (5 route publik × 3 viewport) + `responsive-authed.spec.ts` (8 route peran × 3 viewport) — 0 overflow, live 28/28 |
| Keyboard-only critical path | ✅ | skip-link, focus-visible, label; e2e tab-check PASS (chromium) |
| Loading/empty/offline/forbidden/error | ✅ | empty/empty/offline states per halaman + `error.tsx` + `unauthorized` + `account-inactive` |
| Lint/typecheck/tests/build/security | ✅ | lokal hijau: format, lint, typecheck, 406 tests, build, advisor (38t/2v), live-denial 95/95, hardening tests |
| README/runbooks akurat | ✅ | `docs/runbooks.md` + `docs/release-checklist.md` (file ini) + kredensial demo RBAC di `README.md` |

## Rekomendasi: GO untuk uji kelas percontohan (data demo)

Study loop penuh terbukti live melawan hosted (murid jawab+submit = 100 via RPC
tersanitasi 000023; guru melihat submitted + skor; wali melihat ringkasan).
Sebelum data murid nyata: rotasi kredensial demo (`DemoPass-2026!`), set
`BLOCKCHAIN_ANCHOR_ENABLED=false` di production, dan jalankan audit keamanan
Prompt Audit (2 org, 2 guru, wali linked/unlinked, anonymous). Rollback:
`git revert` per commit atomik.
