# Autonomous Learning LMS

Blueprint siap-eksekusi untuk OpenCode atau agent coding lain. Produk ini adalah LMS personal bagi setiap murid, dengan dashboard guru, mastery learning, kuis dan asesmen, skor otomatis, progress real-time, serta sertifikat PDF A4 dengan QR verifikasi.

## Akun demo & peran (RBAC)

Akun seed anonim untuk local/preview (lihat `docs/e2e-setup.md` dan `RBAC.md`). Password sama untuk semua: `DemoPass-2026!`

| Peran (RBAC.md) | Email | Password | Akses utama |
|---|---|---|---|
| Guru (Owner/Guru) | `guru@demo.local` | `DemoPass-2026!` | `/teacher` — kelas, matriks cohort, grading, bank soal, analitik, sertifikat; `/teacher/admin/map` khusus guru pemilik course (facet Owner, ADR-008) |
| Murid | `murid01@demo.local` | `DemoPass-2026!` | `/learn` — target, peta level, kuis; `/catalog`, `/review`, sertifikat sendiri |
| Murid | `murid02@demo.local` | `DemoPass-2026!` | Sama seperti Murid 01 (data terisolasi per murid) |
| Murid | `murid03@demo.local` | `DemoPass-2026!` | Sama seperti Murid 01 (data terisolasi per murid) |
| Wali (Guardian) | `wali@demo.local` | `DemoPass-2026!` | `/guardian` — ringkasan Murid 01 yang tertaut aktif (tanpa jawaban/nilai rinci) |
| Publik | — (tanpa login) | — | `/verify/{public_id}` — verifikasi sertifikat minimal-PII |

> ⚠️ Akun demo HANYA untuk local/preview. Jangan pernah memakai password ini di production — rotasi/ganti sebelum data murid nyata masuk. Wali hanya melihat anak via guardian link aktif; publik tidak melihat data internal apa pun.

## Sasaran

- Murid memiliki jalur belajar personal dan dapat belajar mandiri.
- Guru memantau keterlibatan, penguasaan, risiko tertinggal, dan nilai.
- Materi, kuis, proyek, remedial, dan sertifikat dapat dikelola tanpa mengubah kode.
- Data anak aman: least privilege, RLS, audit log, minimisasi data, dan persetujuan sesuai kebijakan sekolah.

## Stack yang dikunci

- Next.js App Router + TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase Auth, Postgres, Storage, Realtime, Edge Functions
- Zod untuk validasi
- React Hook Form
- Vitest + Testing Library + Playwright
- PDFKit atau React-PDF untuk sertifikat
- QR code menuju `/verify/{public_id}`
- Hash SHA-256; blockchain anchoring opsional melalui adapter

## Cara memulai dengan OpenCode

1. Salin seluruh folder ini ke root repository kosong.
2. Buka terminal pada folder tersebut.
3. Jalankan `opencode`.
4. Kirim isi `MASTER_PROMPT.md` sebagai perintah pertama.
5. Agent wajib membaca `AGENTS.md` dan semua dokumen yang dirujuk sebelum menulis kode.

## Urutan sumber kebenaran

1. `AGENTS.md`
2. `PRODUCT_REQUIREMENTS.md`
3. `RBAC.md` dan `SECURITY_PRIVACY.md`
4. `DATA_MODEL.md`
5. `LEARNING_ENGINE.md`
6. Dokumen fitur lainnya
7. `IMPLEMENTATION_PLAN.md`
8. `ACCEPTANCE_CRITERIA.md`

Jika ada konflik, dokumen dengan urutan lebih tinggi menang. Jangan menebak aturan penilaian atau kebijakan data; buat konfigurasi dan tandai keputusan yang memerlukan guru.

## Dokumentasi penting

- `RBAC.md` / `SECURITY_PRIVACY.md` — peran, RLS, dan kebijakan data (wajib dibaca sebelum menulis kode akses).
- `docs/design-system.md` — token elevasi, `.card-lift`, aturan gradien, pemetaan dark mode, dan kebijakan reduced-motion. **Baca sebelum memberi style pada komponen baru** agar konsisten.
- `docs/runbooks.md` — prosedur operasional (migration, seed, live-denial, backup/restore).
- `docs/release-checklist.md` — daftar rilis dan smoke test.
- `docs/pilot-deployment.md` — playbook dry-run pilot: env set, urutan db push + smoke, prosedur restore (rehearsal 9/9).
- `docs/language-policy.md` — kebijakan bahasa UI: shell publik WAJIB English, dashboard peran Bahasa Indonesia. **Baca sebelum menambah teks pada halaman shell** (ditegakkan `lms/no-indonesian-shell-text`).
- `PROGRESS.md` — status fase, bukti gate, dan pekerjaan yang belum selesai.

## MVP selesai ketika

- Guru dapat membuat course → level → lesson → activity → assessment.
- Murid dapat belajar, melanjutkan posisi terakhir, mengerjakan kuis, dan menerima feedback.
- Skor objektif dihitung otomatis dan riwayat attempt tidak ditimpa.
- Dashboard guru menampilkan progress, mastery, waktu belajar, dan murid berisiko.
- Level terkunci/terbuka berdasarkan prerequisite dan mastery threshold.
- Sertifikat dibuat otomatis, dapat diverifikasi melalui QR, dan dapat dicabut.
- RLS serta denial tests lulus.
- Unit, integration, dan end-to-end tests utama lulus.
# lms-coding

