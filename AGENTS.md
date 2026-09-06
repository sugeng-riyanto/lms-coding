# Agent Operating Contract

## Mission

Bangun LMS production-oriented sesuai dokumen proyek. Kerjakan secara inkremental, aman, dapat diuji, dan dapat dipulihkan. Jangan berhenti pada mock UI atau data hard-coded.

## Wajib sebelum coding

1. Baca seluruh Markdown di root.
2. Periksa repository, toolchain, dan versi aktual.
3. Periksa dokumentasi resmi terbaru untuk Next.js, Supabase, dan library penting.
4. Tulis rencana singkat dan daftar acceptance criteria fase aktif.
5. Implementasikan satu vertical slice sampai berfungsi sebelum memperluas fitur.

## Aturan teknis

- TypeScript `strict: true`; hindari `any`.
- Gunakan Server Components secara default; Client Components hanya jika interaksi browser dibutuhkan.
- Validasi semua input di boundary menggunakan Zod.
- Jangan percaya role, score, completion, certificate eligibility, atau enrollment dari client.
- Jangan pernah mengekspos secret/service key ke browser.
- Inisialisasi server Supabase client per request.
- Semua tabel pada exposed schema wajib RLS.
- Role otorisasi disimpan di tabel server-controlled atau `app_metadata`, bukan `user_metadata`.
- Setiap UPDATE policy memiliki `USING` dan `WITH CHECK`.
- View yang terekspos harus `security_invoker = true`.
- Fungsi privileged harus berada di schema private, menetapkan `search_path`, memeriksa caller, dan mencabut EXECUTE dari PUBLIC.
- Attempt asesmen append-only. Koreksi nilai menghasilkan revision/audit event, bukan menghapus bukti lama.
- Waktu server adalah sumber kebenaran untuk deadline dan durasi.
- Jangan menyimpan PII, jawaban murid, atau nilai di blockchain.

## Perintah kerja

- Jangan mengubah scope tanpa alasan tertulis.
- Jangan memasang dependency sebelum memeriksa apakah kebutuhan dapat dipenuhi dependency yang sudah ada.
- Pin versi dependency dan commit lockfile.
- Buat migration menggunakan Supabase CLI; jangan mengarang nama timestamp migration.
- Seed hanya data demo anonim.
- Setelah setiap fase: lint, typecheck, unit test, integration test relevan, dan build.
- Setelah perubahan database: jalankan RLS/denial tests dan database advisors.
- Catat keputusan penting di `DECISIONS.md`.
- Catat status aktual di `PROGRESS.md`; jangan menyatakan selesai tanpa bukti perintah.

## Definition of done

Sebuah fitur selesai hanya jika UI, authorization, validasi, persistence, empty/loading/error states, accessibility dasar, auditability, dan automated tests relevan sudah tersedia.

