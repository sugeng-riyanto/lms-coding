# Autonomous Learning LMS

Blueprint siap-eksekusi untuk OpenCode atau agent coding lain. Produk ini adalah LMS personal bagi setiap murid, dengan dashboard guru, mastery learning, kuis dan asesmen, skor otomatis, progress real-time, serta sertifikat PDF A4 dengan QR verifikasi.

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

