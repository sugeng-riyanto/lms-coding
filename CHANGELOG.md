# Changelog

## 2026-09-06 — Verifikasi Phase 1 (live), slice Wali, preview & E2E hardening

Ringkasan rilis (commit `6293f2b`, `35139ec`, `6ec3b99`, `60c9295` — pengganti
`a0b4786`):

- **Live-DB RLS denial suite** (`scripts/live-denial/`): denial RBAC.md dijalankan
  sebagai SQL sungguhan di Postgres 18 tanpa Docker — 38/38 PASS. Migration
  `20260906000008_rls_recursion_fix.sql` memperbaiki dua bug yang hanya muncul
  saat eksekusi nyata: siklus infinite-recursion antar-policy dan helper
  `private.*` tanpa `EXECUTE` untuk `authenticated`.
- **Guardian (Wali)**: route `/guardian` (guard `requireActiveMembership(["guardian"])`)
  menampilkan ringkasan anak via guardian link aktif (RLS-bounded, tanpa
  attempts/jawaban); hub peran `/dashboard` menggantikan redirect login statis;
  seed `wali@demo.local` tertaut aktif ke Murid 01.
- **Demo-mode preview (DEV-ONLY)**: guarded routes render state kosong saat
  `next dev` tanpa Supabase env (dataset selalu kosong, banner amber,
  fail-closed di production; write/API tetap strict via `createStrictClient`).
- **E2E & docs**: probe konektivitas Supabase nyata (cegah false-ready),
  state-matrix verifier tanpa-PII, `docs/e2e-setup.md` seed/akun, bukti
  verifikasi Phase 1 di `PROGRESS.md`.

Gates saat rilis: `format:check`/`lint`/`typecheck` PASS, test 113/113,
`build` PASS, live-denial 38/38, e2e 3 passed / 1 skipped (backend absent).