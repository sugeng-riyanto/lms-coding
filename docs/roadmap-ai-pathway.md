# Roadmap — dari Coding ke Agentic AI, ML, dan AGI literacy

Dokumen ini menetapkan POSISI PRODUK: Coding School LMS adalah fondasi
(learning loop) untuk kurikulum era AI — bukan klaim bahwa platform mengajar
AGI. Siswa yang lulus jalur ini terbiasa dengan disiplin yang dibutuhkan
untuk masuk ke Agentic AI, ML, dan penalaran tentang AGI: belajar terstruktur,
praktik yang jujur, pembuktian yang terverifikasi, dan refleksi berjadwal.

## Prinsip

1. **LMS menjamin LOOP, bukan konten AI.** Loop: baca/objective → praktik →
   asesmen (server-graded) → umpan balik → spaced review → sertifikat.
2. **Guru menyusun anak tangga.** Setiap tahap adalah kursus biasa (Course →
   Level → Lesson → Activity → Assessment) yang dibuat/diterbitkan guru;
   platform tidak mengarang materi.
3. **Tidak ada klaim tanpa bukti.** Capaian selalu berupa evidence:
   attempt immutable, snapshot progress yang dapat dihitung ulang, dan
   sertifikat SHA-256 + QR. Tidak ada "ranking ajaib".
4. **Kejujuran alat.** AI copy-prompt menolong authoring, bukan menggantikan
   pemahaman murid; code runner mengeksekusi di sandbox eksternal
   (provider dikonfigurasi admin), bukan di server LMS.

## Anak tangga (masing-masing = kurikulum guru di atas mesin LMS)

| # | Tahap | Yang dikuasai siswa | Dukungan platform yang sudah ada |
|---|-------|--------------------|----------------------------------|
| 1 | Coding & computational thinking | Pola pikir dekomposisi/debug; 1+ bahasa (Python/JS/dst) | Artikel Markdown, `code_board`, **code runner multi-bahasa**, level map mastery |
| 2 | Data, logika & matematika untuk ML | Statistika dasar, aljabar linear, penalaran data | Kuis objektif/numerik (toleransi), aktivitas proyek+rubrik, bank soal berversi |
| 3 | Applied machine learning | Siklus eksperimen model: data → latih → evaluasi → laporan | Lesson/assignment upload, grading manual via rubrik, item analysis guru |
| 4 | Agentic AI & tool-using systems | Konsep agent, tools, memory, evals; keamanan prompt/tool | Materi lesson + assessment; transparansi (RLS, audit, minimisasi data) sebagai contoh pola aman |
| 5 | AGI literacy & responsible AI | Kemampuan vs batas model; safety; alignment literacy | Ulasan/refleksi, sertifikat akhir verifiable (QR), kebijakan data sekolah |

## Yang TIDAK diklaim

- LMS tidak "menjalankan" atau "berisi" AGI.
- Tidak ada janji kelulusan otomatis ke pekerjaan AI; yang dihasilkan adalah
  rekam belajar yang dapat diverifikasi (bukti nyata, tanpa data berlebih).
- Provider AI/code runner adalah integrasi opsional di belakang env
  (default off) dan membutuhkan keputusan admin sekolah.

## Kebijakan "next" bila roadmap kurikulum dimulai

1. Guru membuat kursus per tahap dengan objective eksplisit (publish
   validation mewajibkan objective non-kosong).
2. Memakai template prompt AI + question pack untuk mempercepat authoring,
   dengan KUNCI hanya dari sumber tepercaya.
3. Setiap tahap diakhiri assessment + sertifikat; kunci jawaban tidak pernah
   ke browser murid (release policy).
4. Ukur waktu belajar jujur (menit aktif) dan hasil asesmen per tahap untuk
   menilai kesiapan naik tahap — bukan dari klaim subjektif.
