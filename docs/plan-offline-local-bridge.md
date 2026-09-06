# Rencana: Local-first bridge (offline / internet lambat) + sinkronisasi otomatis

Status: **PLAN** (belum diimplementasikan penuh). Prekondisi yang sudah ada:
retry queue offline untuk learning events (idempoten via `client_event_id`),
heartbeat/autosave dengan indikator offline/error, dan `sync-queue.ts`.
Belum ada: cache-baca lokal, auth lokal, dan sinkronisasi data umum.

## Masalah
- Murid/guru di sekolah dengan internet lambat atau mati tidak bisa membuka
  materi/kuis dan tidak bisa menyimpan progres.
- Hanya event belajar yang punya antrian offline; data lain (profil, konten,
  nilai) langsung bergantung pada ketersediaan hosted.

## Keputusan inti (draf — jadi ADR saat slice pertama)
- **D1 — Sumber kebenaran tetap hosted**; lokal hanyalah *cache + antrian
  tulis*. Tidak ada merge dua arah penuh (conflict resolution = last-write-wins
  dengan `updated_at`, konsisten dengan filosofi recompute idempoten).
- **D2 — Bentuk lokal**: Supabase lokal (Postgres + GoTrue + PostgREST via
  Docker, `supabase start`) ATAU IndexedDB cache ringan di browser. Keputusan
  per slice: read-cache (IndexedDB) dulu — tanpa infra baru; write antrian
  sudah ada dan diperluas.
- **D3 — Watchdog koneksi**: probe `/auth/v1/health` (apikey) setiap 30 s;
  saat pulih → flush antrian (dedupe via `client_event_id`), lalu refresh cache.
- **D4 — Auth offline**: session JWT tersimpan (sudah di cookie); akses read
  cache tetap diizinkan saat token tak bisa di-refresh, ditandai "offline".

## Slice
1. **Read-cache IndexedDB** (`lib/offline-cache.ts`): cache konten yang sudah
   dibuka (activity/lesson/level), TTL 24 jam, terbatas ukuran; render fallback
   dari cache saat fetch gagal (banner "Konten offline").
2. **Watchdog + flush** (`lib/connectivity.ts` + perbaiki `use-sync.ts`):
   status online/offline/lambat; auto-flush antrian saat pulih; indikator
   seragam di header murid.
3. **Perluas antrian tulis** ke action utama (saveResponse, submitReview,
   recordLearningEvent sudah; tambah submitAttempt idempoten).
4. **Supabase lokal penuh** (opsional, saat Docker tersedia): `supabase start`
   + copy schema/migrasi; mode `NEXT_PUBLIC_SUPABASE_URL` lokal saat hosted
   unreachable (env switch otomatis lewat watchdog).

## Acceptance criteria
- AC-1: Buka activity saat online → isi tersimpan di IndexedDB.
- AC-2: Matikan internet → activity yang pernah dibuka tetap render (banner
  offline), yang belum pernah dibuka menampilkan pesan jelas.
- AC-3: Tulis offline (jawaban/refleksi) masuk antrian; tidak ada duplikat saat
  flush (client_event_id sama → sekali).
- AC-4: Internet pulih → flush otomatis ≤ 60 s; server validasi ulang menolak
  kiriman basi (clamp/format), hasil konsisten dengan DB hosted.
- AC-5: Tanda status (online/offline/lambat) tampil di header tanpa
  membingungkan warna (teks + ikon).
- AC-6: RBAC tidak berubah — cache hanya menyimpan data yang RLS izinkan
  (cache dibuat dari respons yang sudah lolos RLS).
- AC-7: Unit test watchdog (palsu) + integration test flush dedupe.

## Risiko
- IndexedDB di lingkungan sekolah yang membatasi storage (mode privat).
- Konflik tulis (last-write-wins bisa menimpa) → mitigasi: tombol simpan
  offline jelas + riwayat revisi di server.
- Ukuran cache tak terkendali → quota + eviction LRU.

## Urutan eksekusi
Slice 1 (cache-baca + banner) → Slice 2 (watchdog+flush) → Slice 3 (antrian
tulis luas) → Slice 4 (Supabase lokal, opsional). Setiap slice di-commit
terpisah + bukti gates di PROGRESS.md.