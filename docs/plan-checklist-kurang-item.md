# Checklist rencana item KURANG (reusable)

Checklist ini memadatkan pelajaran bersama dari dua rencana pertama yang sudah
dievaluasi — `docs/plan-weekly-target-spaced-review.md` (KURANG Phase 3) dan
`docs/plan-item-analysis-misconception-map.md` (KURANG Phase 5) — beserta
bukti dari slice yang sudah diimplementasi. Tempel bagian yang relevan ke
rencana baru (Phase 4/6/7 dst.) dan centang saat menulis, bukan saat
implementasi: tiap butir mencegah kesalahan yang sudah pernah terjadi.

Aturan pakai: (1) tiap rencana baru wajib bagian `Temuan konteks`, `Acceptance
criteria` (tabel AC + bukti), `Keputusan terbuka` (calon ADR), dan `Risiko`;
(2) centang butir di bawah yang berlaku; (3) jangan hapus butir historis —
tandai `N/A` bila tak berlaku.

---

## A. Fakta konteks — verifikasi SEBELUM mendesain

- [ ] Baca spec sumber yang relevan (`*_ENGINE.md`, `*_DASHBOARD.md`,
  `ACCEPTANCE_CRITERIA.md`, `prompts.md`) — kutip baris/nomor item aslinya.
- [ ] Pastikan KURANG/backlog asli di `PROGRESS.md` (frasa persisnya) agar
      definisi "selesai" tidak bergeser.
- [ ] Cek fakta data yang jadi fondasi desain, bukan asumsi:
  - write path benar-benar ada? (Lesson: `study_sessions` punya RLS tapi
    TIDAK punya write path → target menit tidak jujur; pakai proxy terukur
    `completions` dulu.)
  - read path (policy RLS) untuk role yang membaca sudah ada? (Lesson: item
    analysis bisa tanpa migration karena `responses_owner_select`/`attempts_*`
    sudah mencakup guru cohort.)
  - format kolom/JSON (mis. `answer_json`) dan tipe entity — bentuk bebas?
- [ ] Tentukan butuh migration/tabel/policy baru atau tidak; kalau ya, cek
      `scripts/db-advisor.mjs` (RLS wajib per tabel) dan grant wildcard
      harness live-denial menjangkau tabel baru (05_grants `all tables`).
- [ ] Tulis temuan sebagai fakta bernomor di rencana (pola kedua plan) —
      keputusan desain harus menelusuri ke fakta itu.

## B. Desain aman

### B1. RLS & database
- [ ] Policy baru: lookup satu arah (subquery ke tabel yang TIDAK menunjuk
      balik) ATAU helper `private.*` security-definer + grant EXECUTE
      authenticated; hindari subquery yang saling menunjuk (bug recursion
      000008). TANPA policy delete = tidak ada hard delete.
- [ ] Setiap tabel baru wajib `alter table ... enable row level security`.
- [ ] Setiap perubahan policy/tabel wajib langsung dicakup **live-denial**
      (`scripts/live-denial/`), bukan hanya test statis — dan jalankan ulang
      suite penuh setelah migration (harness mengaplikasikan migration
      verbatim).
- [ ] Bahkan read path TANPA policy baru: buktikan batas lintas-org lewat
      check live (opsional `tNN_*`) agar "RLS membatasi" bukan klaim kosong.

### B2. Idempotensi & efek samping
- [ ] Side-effect aplikasi yang menyertai event berulang (recompute/hook)
      harus idempotent; jaminan anti-duplikat di DB (partial unique index)
      + unit test eksekusi ganda.
- [ ] Hook/trigger: pilih hook aplikasi bila migration harus tetap sederhana
      dan auditable; trigger hanya via migration baru + test + live-denial
      (ADR-011).

### B3. Logika murni & definisi metrik
- [ ] Inti logika = fungsi murni di `lib/*` (tanpa I/O), deterministik (urutan
      tie eksplisit: id/studentId/date), tidak memodifikasi input.
- [ ] Definisi metrik/konstanta berversi (`*_VERSION`) + reconciliation test
      (agregasi == hitung manual dari baris raw) — jangan ubah makna
      diam-diam (aturan ANALYTICS.md).
- [ ] Pemfilteran populasi (mis. attempt draft) DI DALAM fungsi agar penyebut
      metrik yang saling terkait tidak pernah berbeda (pelajaran slice item
      analysis).
- [ ] Kontrak input dibatasi di perakit baris: parse defensif untuk bentuk
      bebas (`answer_json`), nyatakan eksplisit tipe/entity yang di luar
      scope.

### B4. Angka jujur (cohort kecil, metrik belum terukur)
- [ ] Tampilkan `n`/sample size; suppress/null metrik di bawah ambang
      (`minGroupN`); hindari klaim absolut; tanpa ranking publik.
- [ ] Jangan mengekspos metrik yang sumber datanya belum jujur (target menit
      tanpa write path sesi) — proxy dulu, gate sisanya.

### B5. Waktu & timezone
- [ ] Instant disimpan UTC; batas hari/minggu dihitung dalam timezone org
      (`lib/time.ts`), bukan server UTC.
- [ ] Test lintas-tz untuk kasus batas (Minggu malam UTC yang sudah Senin di
      Asia/Jakarta; tengah malam lokal = awal hari berikutnya).

### B6. Read path yang efisien
- [ ] Hindari pola N+1 yang sudah ada (dashboard guru ber-loop per murid);
      halaman baru wajib batch query, rakit baris di luar loop.

### B7. Gotcha TypeScript strict (terbukti oleh kedua slice)
- [ ] `noUncheckedIndexedAccess`: destructuring array → `T | undefined`.
      Pola: tipe parameter tuple non-kosong `readonly [number, ...number[]]`,
      helper `single<T>(arr)` untuk test yang mengharap tepat 1, atau
      non-null assertion dengan komentar jaminan — jalankan `typecheck`
      sedini mungkin setelah file lib/test pertama ditulis.

## C. Acceptance criteria & state matrix

- [ ] Tabel AC bernomor (AC-1..AC-N), tiap baris punya kolom **Bukti**
      (file/test/gate mana yang membuktikan).
- [ ] Setiap butir KURANG asli terpetakan ke ≥1 AC; "selesai" = checklist
      PROGRESS.md tidak lagi memuat KURANG itu.
- [ ] Nyatakan state matrix UI eksplisit: (a) tanpa backend → state kosong/
      demo, (b) env terisi tanpa DB → perilaku tertentu (mis. 404/redirect),
      (c) backend hidup + seed → data penuh. Cantumkan mana yang bisa
      diverifikasi SEKARANG vs menunggu Supabase lokal.
- [ ] Nama berkas/route/aksi yang akan dibuat disebut di rencana (supaya
      reviewer tidak menebak).

## D. Gates wajib (catat angka aktual di PROGRESS.md)

- [ ] `format:check` (md di-ignore prettier — file kode saja) · `lint` ·
      `typecheck` (0 error).
- [ ] `npm run test` — catat jumlah: N files / N tests SEBELUM dan SESUDAH.
- [ ] `db:typecheck` — catat jumlah tabel (advisor): berubah bila ada
      migration.
- [ ] `npm run build` bila ada route/import app baru.
- [ ] E2E bila ada route baru (`npm run e2e`; spec responsif ikut).
- [ ] `bash scripts/live-denial/run.sh` — catat PASS/FAIL; bertambah bila ada
      check t0x baru; migration diaplikasikan verbatim.
- [ ] Migration baru diaplikasikan di atas migration terakhir secara berurut.

## E. Keputusan & dokumen (konvensi repo)

- [ ] `Keputusan terbuka` D1..Dn di rencana → di-record sebagai ADR di
      `DECISIONS.md` (beri nomor ADR berikutnya yang benar — template BUKAN
      ADR) begitu keputusan diambil.
- [ ] Bukti/angka gates dicatat di `PROGRESS.md`; `CHANGELOG.md` draf rilis
      diperbarui (frasa KURANG lama dihapus/ganti).
- [ ] Commit bertema per workstream (bukan satu commit raksasa) — pola commit
      sesi sebelumnya.

---

## Pelajaran yang SUDAH terbukti (trace 2026-09-06)

| Butir | Terbukti oleh | Bukti/gate |
|---|---|---|
| Write path harus ada sebelum metrik dibangun | Rencana weekly → slice 1 | `study_sessions` tanpa write path; goal `completions` dipilih (ADR-010) |
| RLS: one-way lookup bebas recursion | Rencana weekly → slice 1 | migration 000009 lulus live-denial 38/38 + test 130/130 |
| Definisi versi + reconciliation | Rencana item analysis → slice metrik | `ITEM_METRIC_DEFINITIONS_VERSION`; 13 unit incl. reconciliation; test 143/143 |
| Draft-attempt difilter dalam fungsi | Rencana item analysis | denominator difficulty == omit == distractor konsisten |
| TS strict: destructuring `undefined` | Slice weekly + item analysis | fix tuple-type & `single()`; typecheck 0 error setelah fix |
| State HTTP-aware untuk halaman multi-state | Rencana/audit → spec responsif | `/verify` non-200: hanya cek overflow + annotation (e2e 18/1) |
| No-live-backend boundary jujur | Kedua rencana | UI state kosong diverifikasi; data penuh menunggu Supabase lokal (tercatat PROGRESS.md) |
