# Architecture Decision Log

Agent menambahkan keputusan menggunakan format berikut; jangan menghapus keputusan lama.

## ADR-001 — Hybrid certificate verification

- Status: accepted
- Decision: gunakan database record + deterministic SHA-256 + public QR verifier sebagai baseline. Blockchain hanya optional anchor adapter.
- Reason: memberi verifikasi nyata, revocation, biaya rendah, dan tidak mengekspos data anak.
- Consequence: istilah “blockchain verified” hanya boleh muncul setelah anchor final.

## ADR-002 — Server-authoritative grading and progress

- Status: accepted
- Decision: browser mengirim jawaban/events; trusted server menghitung score, mastery, completion, dan certificate eligibility.
- Reason: mencegah manipulasi nilai dan inkonsistensi antarperangkat.

## ADR-003 — Versioned published content

- Status: accepted
- Decision: konten yang sudah dipakai attempt tidak diedit in-place; terbitkan versi baru.
- Reason: menjaga keadilan dan auditability.

## ADR-004 — Manual migration timestamps (CLI unavailable)

- Status: accepted
- Context: Supabase CLI dan Docker tidak tersedia di environment build; migration tidak bisa dibuat via `supabase migration new` maupun di-apply ke live Postgres.
- Decision: tulis migration manual format `YYYYMMDDHHMMSS_description.sql`; RLS diuji via static tests + `scripts/db-advisor.mjs`. Regenerasi via CLI dan diff sebelum apply ke preview/production.
- Consequences: denial tests live-DB wajib dijalankan ulang setelah apply; RLS belum terbukti sampai live test lulus.

## ADR-005 — Pinned toolchain 2026-09-06

- Status: accepted
- Context: registry latest saat scaffold: next 16.3.4, react 19.2.8, @supabase/ssr 0.12.6, @supabase/supabase-js 2.115.0, zod 4.5.4, typescript 5.9.2 (dipilih atas 7.0.2 demi stabilitas), vitest 3.2.4, @playwright/test 1.63.0 (1.57.1 tidak ada di registry).
- Decision: pin exact di `package.json` + commit `package-lock.json`; pola SSR mengikuti docs resmi terbaru (per-request server client, Proxy + `getClaims()`, tidak pernah trust `getSession()` di server).
- Consequences: upgrade dependency = PR terpisah + full gate ulang.

## ADR-006 — Certificate print-to-PDF + QR via qrcode

- Status: accepted
- Context: PDFKit/React-PDF menambah beban bundle; acceptance menuntut "PDF A4 rapi pada print preview" + QR HTTPS verifier.
- Decision: halaman `/certificates/[publicId]` A4-landscape print-CSS (browser print → PDF) + QR PNG server route (`qrcode@1.5.4`). Render PDF server-side ke private bucket + signed download tetap backlog Phase 6.
- Consequences: sertifikat "resmi" (signed download) belum tersedia; UI tidak boleh menyebut file cetak browser sebagai dokumen resmi sistem.

## ADR-007 — Prettier mengabaikan Markdown spesifikasi

- Status: accepted
- Context: `prettier --write` atas 55 file akan memformat ulang dokumen spec beku di root sehingga diff tidak bermakna dan berisiko menimpa pekerjaan lain.
- Decision: `.prettierignore` mengecualikan `*.md`; formatter gate (CI `format:check`) hanya mencakup kode. Dokumen spec tidak diformat ulang.
- Consequences: konsistensi format Markdown dijaga manual saat menulis.

## ADR-008 — Owner/Guru satu kapabilitas, tanpa role terpisah

- Status: accepted
- Context: Prompt 02 menyebut "role Owner/Guru", tetapi RBAC.md (prioritas lebih tinggi) memetakan Owner/Guru sebagai satu kolom kapabilitas; DATA_MODEL tidak mendefinisikan nilai role owner.
- Decision: tidak ada role `owner` di `memberships.role` (CHECK tetap teacher/student/guardian). Kepemilikan diekspresikan via `courses.owner_id`; seluruh policy content-tree join ke owner tersebut.
- Consequences: bila dibutuhkan org-admin kelak, buat ADR baru + migration CHECK + policy org-wide; jangan menafsirkan ulang teacher sebagai admin.

## ADR-009 — PDF sertifikat on-demand + permission check

- Status: accepted
- Context: Prompt 08 meminta PDF A4 + private Storage + short-lived download. Tanpa backend live, persistensi bucket tak terverifikasi.
- Decision: PDF dirender on-demand (pdfkit, A4 landscape) dengan permission check RLS (murid pemilik / guru cohort); revoked → 410. Persist ke private bucket + signed URL menjadi backlog terverifikasi-belakangan.
- Consequences: tidak ada file PDF tersimpan; setiap unduhan melewati otorisasi — setara atau lebih ketat dari signed URL.

## ADR-010 — Unit target mingguan: completions dulu, minutes tertunda

- Status: accepted
- Context: rencana `docs/plan-weekly-target-spaced-review.md` (D1) — LEARNING_ENGINE.md
  menuntut target mingguan personal, tetapi `study_sessions` belum punya write
  path (heartbeat + active-time clamping Prompt 04 belum diimplementasi;
  `features/actions.ts` hanya menulis `learning_events`). Target berbasis menit
  tidak bisa diukur jujur hari ini; completions (transisi `progress_snapshots` →
  `completed`) sudah tersedia dan idempotent via `recomputeProgress`.
- Decision: `weekly_plans.goal_unit` menyimpan kedua nilai
  (`check (goal_unit in ('completions','minutes'))`) dengan **default
  `'completions'`**; MVP menghitung progress dari jumlah completions per minggu
  ISO. Nilai `'minutes'` tidak dipakai app sampai write path `study_sessions`
  (heartbeat terbatas + clamp) hadir dan teruji.
- Alternatives: (a) target menit lebih dulu — butuh write path sesi yang belum
  ada; (b) tanpa kolom unit (tetap completions) — memaksa migration lagi saat
  menit dibutuhkan; (c) mengekspos menit sekarang — angka tidak jujur.
- Consequences: kebutuhan menit kelak hanya butuh perubahan app (recording
  sesi + UI), bukan migration (CHECK sudah mengizinkan `'minutes'`); dokumen
  dan UI tidak boleh menyebut target menit sebagai terukur sebelum write path
  hadir.

## ADR-011 — Scheduling review via hook aplikasi, bukan trigger DB

- Status: accepted
- Context: rencana `docs/plan-weekly-target-spaced-review.md` (D4) — review
  pertama harus dibuat saat sebuah level selesai, dan `recomputeProgress`
  bersifat idempotent (bisa dijalankan ulang). Migration manual (tanpa CLI)
  diaplikasikan verbatim oleh runner live-denial, sehingga migration idealnya
  seminimal mungkin dan bebas efek samping tersembunyi.
- Decision: tidak ada trigger DB. Baris `weekly_plans` dibuat lazy
  (get-or-create di server code); baris `review_items` pertama dijadwalkan oleh
  **hook aplikasi** yang menyertai `recomputeProgress` (hanya bila belum ada
  baris scheduled untuk `(enrollment, entity)`). Partial unique index
  `review_items_one_active` tetap menjadi jaminan tingkat-DB terhadap duplikat.
- Alternatives: (a) trigger `after insert/update` pada `progress_snapshots` —
  menyembunyikan efek samping di migration dan menyulitkan audit/test;
  (b) job berkala (cron/edge function) menyapu due items — menambah moving
  part infra untuk antrian yang sebenarnya sinkron dengan event completion.
- Consequences: kebenaran scheduling bergantung pada call-site aplikasi
  (semua jalur yang menandai level completed harus lewat hook); trigger hanya
  boleh diperkenalkan kembali via migration baru + test + live-denial, dan
  index unik parsial tetap melindungi dari duplikat apa pun jalurnya.

## ADR-012 — Reissue sertifikat = revoke + issue baru (tanpa nilai status 'reissued')

- Status: accepted
- Context: rencana `docs/plan-certificate-persist-reissue.md` (D1).
  `prompts.md` Prompt 08 menyebut status `active/revoked/reissued`, tetapi
  menambah nilai status berarti mengubah CHECK `certificates.status`,
  filter verifier view `certificates_public` (`status in ('active','revoked')`),
  dan permukaan anon/RLS. Migration `20260906000010` sudah mengganti unique
  lintas status dengan partial unique index `certificates_one_active`.
- Decision: `'reissued'` TIDAK menjadi nilai status. Reissue = baris lama
  di-revoke (alasan dicatat) + baris baru `active` dalam satu transaksi
  (`private.reissue_certificate`, audit `certificate.reissued` berisi
  old/new/reason). Status tetap `('active','revoked')`; verifier view & RLS
  tidak berubah. Satu ACTIVE per `(enrollment_id, level_id)` dijamin partial
  unique index; riwayat revoked boleh banyak (append-only, `no_delete_certs`).
- Alternatives: (a) nilai status `'reissued'` — ubah CHECK + view verifier +
  logika anon; (b) satu baris mutable dengan kolom superseded — bertentangan
  dengan audit append-only.
- Consequences: UI/riwayat menyebut sertifikat lama sebagai revoked dengan
  alasan (mis. "diganti"); verifier tetap menampilkan revoked + tanggal tanpa
  perubahan; PDF lama tidak diunduh sebagai valid (perilaku existing 410).

## ADR-013 — Reissue mengevaluasi ulang eligibility (TS) sebelum RPC DB

- Status: accepted
- Context: rencana `docs/plan-certificate-persist-reissue.md` (D2). Evaluator
  eligibility PENUH hidup di TS (`lib/eligibility.ts` + `issueCertificate`);
  RPC DB `issue_certificate` sengaja disederhanakan (komentar init: "full
  evaluator di lib/mastery + job"). TS tidak punya policy insert
  `audit_logs`, sehingga audit reissue ditulis di dalam fungsi definer.
- Decision: reissue memakai evaluator eligibility yang SAMA dengan issuance
  biasa (TS) dan dijalankan SEBELUM memanggil RPC `reissue_certificate`;
  bila tak lagi eligible → tolak dengan alasan, tanpa efek apa pun. RPC DB
  tidak mengecek ulang eligibility.
- Alternatives: (a) reissue bebas syarat eligibility (koreksi administratif
  guru) — dapat menerbitkan sertifikat walau murid tak lagi eligible;
  (b) menduplikasi evaluator di dalam DB — dua sumber kebenaran.
- Consequences: ada celah TOCTOU kecil antara evaluasi TS dan eksekusi RPC
  (eligibility berubah di antara dua langkah) — diterima untuk MVP dan
  dicatat di risiko rencana; koreksi data tanpa evaluasi ulang penuh tetap
  mungkin via issue biasa dengan alasan audit.

## Template

```text
## ADR-NNN — Judul
- Status: proposed|accepted|superseded
- Context:
- Decision:
- Alternatives:
- Consequences:
```

