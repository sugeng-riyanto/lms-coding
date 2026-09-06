# Changelog

## (draf) Rilis berikutnya — Penutupan gap Phase 3–7

Entri draf untuk rilis mendatang. Scope: seluruh area yang masih `KURANG` pada
checklist Phase 3–7 di `PROGRESS.md` (Phase 2 tidak menyisakan gap; gap Phase 5
dirumuskan sebagai "item analysis & misconception map: belum"). Item di bawah
baru dipindah ke entri "rilis" setelah gate penuh hijau dan bukti tercatat di
PROGRESS.md. Pekerjaan in-flight lain (mis. job CI live-denial, bukti gate
rerun) diakumulasi ke entri ini saat rilis aktual.

- **Phase 3 — Learning/progress**: target mingguan & spaced review eksplisit —
  jadwal ulasan terjadwal per user + progres terhadap target mingguan di
  dashboard murid, di atas `recomputeProgress` yang sudah idempotent.
- **Phase 4 — Assessment**: AI draft feedback untuk jawaban esai — dikunci di
  belakang consent config (default off; aktif hanya bila config consent ada).
- **Phase 5 — Analytics**: item analysis & misconception map per soal
  (distribusi jawaban, pola miskonsepsi dari attempts), melengkapi live
  overview/matrix/detail yang sudah ada.
- **Phase 6 — Certificates**: persist PDF ke storage bucket (bukan hanya
  on-demand, ADR-009) + UI reissue khusus (regenerate dengan alasan audit).
- **Phase 7 — Hardening/deployment**: live Supabase advisor (`db lint`/advisor;
  alternatif tanpa CLI: perluas `scripts/db-advisor.mjs`), restore rehearsal
  (latihan restore dari backup terverifikasi), dan wiring E2E ke CI. Sebagian
  sudah tereksekusi: uji responsif @360/768/1440 diformalkan menjadi
  `tests/e2e/responsive.spec.ts` (5 route publik × 3 viewport, 15 test).

Exit criteria: seluruh gate hijau (`format:check`/`lint`/`typecheck`/`test`/
`build`/`db:typecheck`/`e2e` + live-denial 38/38 di CI) dan tidak ada lagi
`KURANG` pada checklist Phase 3–7 di PROGRESS.md.

---

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