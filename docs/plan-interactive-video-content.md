# Plan — Konten interaktif gaya Edpuzzle/H5P (video dengan soal tertanam)

Status: **PROPOSED** (belum diimplementasikan — dokumen rencana + kriteria
penerimaan, mengikuti konvensi plan KURANG-item).

## Tujuan

Membuat LMS lebih komprehensif ala Edpuzzle/H5P: materi **bukan hanya dibaca**,
tapi berhenti di titik-titik yang disisipkan guru dengan pertanyaan/kegiatan
singkat, lalu lanjut. Target MVP: **video (YouTube ter-embed) + pertanyaan yang
disisipkan pada waktu tertentu**, disimpan server-side, hasil dicatat ke
learning_events/attempt yang sudah ada.

## Konteks: yang SUDAH ada (jangan dibangun ulang)

- Blok materi ter-allowlist `embed_youtube/embed_pdf/embed_audio/embed_file`
  (`lib/content-blocks.ts`, `components/lesson-blocks.tsx`) + `article` ber-blok.
- Kuis/assessment server-side: attempt idempotent, timer, cooldown, release,
  grading tak bocor ke browser (`lib/attempt.ts`, `features/actions.ts`).
- `learning_events` append-only + `client_event_id` idempotent; heartbeat aktif
  dengan clamp (`lib/active-time.ts`) — dasar untuk sinyal "menonton jujur".
- Question bank + versioned questions; rubrik versi.

## Scope MVP (Tahap A) — video + pertanyaan pada timestamp

1. **Model data (migration 000024)**: blok baru `embed_video_quiz` pada
   `content.blocks`? — TIDAK: blok disimpan per aktivitas; lebih tepat aktivitas
   baru `interactive_video`:
   - `activities.content_json`: `{ url, transcript?, questions: [{id,
     t_ms, kind: sc|mc|tf, prompt, options[], key }] }`.
   - Atau tabel baru `video_quiz_nodes` (immutable per versi aktivitas, PK
     `(activity_version_id, node_no)`), jawaban murid di tabel `video_quiz_responses`
     append-only (attempt-style) — Pilih **tabel terpisah** agar bukti jawaban
     immutable + grading mudah di-query (lihat DECISIONS di bawah).
2. **Sanitasi (lib/content-blocks atau lib/video-quiz.ts)**: URL YouTube
   direkonstruksi dari id (pola existing `youtubeEmbedSrc`), `t_ms` dalam
   rentang durasi + urut, soal pakai skema sama seperti question-pack (sc/mc/tf),
   kunci + explanation tidak pernah dikirim sebelum node dilewati (analog
   sanitizeQuestionForAttempt).
3. **Player murid**: iframe youtube-nocookie + `postMessage`/timeupdate polling
   (tanpa iframe cross-origin control — pakai interval `currentTime` jika
   `allow="encrypted-media"` memungkinkan, fallback tombol "Tandai sudah sampai
   menit X"); saat `currentTime >= t_ms` tampilkan overlay soal (pause); jawaban
   dikirim idempoten (`client_event_id`), salah → tayang ulang 30 detik sebelum
   node (opsi config); benar → lanjut. Progress node = event terpisah.
4. **Grading & laporan**: skor node bukan skor kuis besar; dicatat ke
   `learning_events` (`video_quiz_answer`), dirangkum di progress lesson seperti
   activity_completed setelah semua node dijawab benar.
5. **Authoring guru**: di activity `interactive_video`, isi JSON terstruktur
   (pakai pola question-pack) + preview daftar node; atau blok di `article`
   disisipkan via editor blok (nanti).

## Kriteria penerimaan MVP

- [ ] Guru membuat aktivitas `interactive_video` (YouTube valid + ≥1 node) dan
      murid hanya bisa menonton; node muncul pada timestamp yang sama di semua
      browser ±500ms (uji 3 viewport).
- [ ] Key/explanation TIDAK pernah sampai ke DOM sebelum node dilewati (uji
      denial static + E2E dengan pemantau network).
- [ ] Jawaban duplikat (refresh, retry queue offline) tidak menggandakan skor/
      event (uji idempotensi dengan client_event_id sama).
- [ ] Jawaban salah memutar ulang 30 detik sebelum node (config) dan skor node
      hanya bertambah saat jawaban benar dari server.
- [ ] Murid yang melompat cepat / menyembunyikan tab tidak lolos: heartbeat
      aktif + batas lompatan waktu maksimal per detik clock (uji aktif-time).
- [ ] Seluruh node benar → muncul di progres lesson sebagai selesai (recompute
      konsisten); salah satu node belum → tidak selesai.
- [ ] RLS: hanya enrollment aktif yang membaca aktivitas+node; jawaban milik
      sendiri; guru org yang sama melihat agregat (bukan per murid sembarang).
- [ ] Render PDF/A4? N/A. Aksesibilitas: transkrip tersedia, kontrol keyboard,
      reduced-motion, kontras overlay.

## Tahap B (di luar MVP, syarat H5P-like)

- Interaktif lain: hotspot gambar, drag-and-drop, timeline, audio-with-questions,
  embed H5P pihak ketiga **tidak** diterima (bocor data + tak terkontrol) —
  bangun primitif internal.
- Pembelajaran adaptif: node gagal → sisipkan ulasan singkat otomatis.
- Papan skor guru per node (item analysis video).

## Keputusan terbuka (perlu ADR sebelum coding)

- **D1 Lokasi jawaban**: tabel `video_quiz_responses` terpisah (immutable,
  mudah denial-test) vs jalur `attempts` existing yang dipaksa ulang. 
  Rekomendasi: tabel terpisah + ringkasan ke learning_events.
- **D2 Kontrol waktu**: polling `currentTime` vs `postMessage` vs library
  youtube-player (perlu lisensi/dependensi baru; repo menghindari dependensi
  tak perlu).
- **D3 Pause paksa**: jika `allow` browser menolak kontrol, fallback UX "klik
  Tandai" (jangan klaim pause penuh).

## Risiko & batas

- iframe YouTube lintas origin: tidak bisa memaksa pause/seek 100% andal → desain
  fallback (D2/D3).
- Durasi video tidak selalu dapat diverifikasi server → `t_ms` divalidasi urut
  & dalam batas yang diklaim guru; abuse ditekan heartbeat + cap.
- Konten pihak ketiga H5P di-iframe menimbulkan risiko XSS/data — tidak dipakai
  (lihat batas di atas).

## Test yang direncanakan

Unit: sanitasi node, map key, idempotensi event; denial RLS (murid lain,
cross-org); static: kunci tak ada di payload murid. E2E: alur penuh node →
jawab → salah-putar-ulang → benar → selesai; duplicate submit; tab-hidden
(timeout) tidak menambah durasi jujur.
