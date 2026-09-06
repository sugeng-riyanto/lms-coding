# Product Requirements

## Personas

### Murid

- Melihat target harian dan jalur belajar.
- Melanjutkan lesson terakhir dari semua perangkat.
- Membaca/menonton materi dan melakukan aktivitas interaktif.
- Mengerjakan kuis dengan feedback yang dikonfigurasi guru.
- Melihat mastery per kompetensi, bukan hanya nilai rata-rata.
- Mendapat rekomendasi review dan remedial.
- Mengunduh sertifikat setelah level selesai.

### Guru/Owner

- Mengelola course, cohort, level, lesson, activity, question bank, rubric, dan jadwal.
- Melihat ringkasan kelas dan drill-down per murid.
- Menilai jawaban esai/proyek dan memberi feedback.
- Mengatur bobot, passing score, attempt limit, prerequisite, dan mastery rule.
- Mengekspor nilai CSV.
- Mencabut atau menerbitkan ulang sertifikat dengan alasan.

### Orang tua/wali (fase berikutnya)

- Hanya melihat ringkasan anak yang secara eksplisit ditautkan.
- Tidak melihat jawaban detail atau data murid lain.

## Hierarki konten

`Course → Level → Module → Lesson → Activity → Assessment`

Activity types MVP: article, video link, downloadable resource, reflection, quiz, assignment upload, Roblox challenge link.

Question types MVP: single choice, multiple choice, true/false, numeric tolerance, short text exact/normalized, essay manual, file/project manual.

## Aturan penyelesaian

- Lesson selesai jika semua activity wajib diselesaikan.
- Level selesai jika seluruh lesson wajib selesai dan mastery threshold tercapai.
- Course selesai jika semua level wajib selesai.
- Aturan harus configurable per level, versioned, dan dihitung server-side.
- Perubahan konten yang sudah memiliki attempt membuat versi baru; histori lama tetap dapat diaudit.

## Non-functional requirements

- Mobile-first dan nyaman pada layar sekolah/laptop.
- P95 halaman dashboard yang sudah cache ditargetkan <2,5 detik pada jaringan layak.
- Autosave jawaban draft dan pemulihan setelah koneksi terputus.
- Keyboard accessible, focus visible, label form jelas, kontras WCAG AA.
- Timezone default `Asia/Jakarta`, simpan timestamp dalam UTC.
- Bahasa Indonesia utama; struktur siap i18n.

## Out of scope MVP

- Marketplace course publik.
- Pembayaran.
- Proctoring kamera.
- AI memberi nilai final esai tanpa persetujuan guru.
- Menyimpan PII di public blockchain.

