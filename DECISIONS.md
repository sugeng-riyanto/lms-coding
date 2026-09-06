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

## Template

```text
## ADR-NNN — Judul
- Status: proposed|accepted|superseded
- Context:
- Decision:
- Alternatives:
- Consequences:
```

