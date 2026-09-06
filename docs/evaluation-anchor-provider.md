# Evaluasi provider/network blockchain anchoring (ADR-018)

> Melengkapi ADR-018: **matriks skor konkret + rekomendasi default untuk keputusan
> manusia.** Keputusan final tetap di manusia (owner/ops sekolah). Angka biaya/finality
> adalah titik data September 2026 — verifikasi ulang saat keputusan diambil (tautan di
> bagian Sumber). Dokumen ini tidak mengubah implementasi: flag tetap OFF dan provider
> nyata tetap ditolak runtime sampai manusia memilih.

## 1. Kriteria & bobot (konteks: LMS sekolah, data anak, verifikasi sertifikat)

| # | Kriteria | Bobot | Alasan |
|---|---|---|---|
| K1 | Biaya per anchor batch (Merkle) | 0,15 | Satu batch = banyak sertifikat; budget sekolah kecil |
| K2 | Kejelasan finality ("final" punya definisi tegas, tanpa reorg/ambigu) | 0,20 | UI verifier berjanji "final = terverifikasi"; ketidakjelasan = risiko klaim salah |
| K3 | Uptime & keberlanjutan ekosistem (bisa diverifikasi bertahun-tahun) | 0,20 | Sertifikat harus bisa dicek ulang jangka panjang |
| K4 | Lock-in & kesederhanaan operasional (ops bisa jalankan: key, RPC, pemantauan) | 0,15 | Tim sekolah kecil, tanpa engineer blockchain |
| K5 | Regulasi & privacy data anak (hash-only; tanpa KYC/token untuk sekolah; UU PDP) | 0,20 | Data anak = non-nego; payload HANYA hash/root |
| K6 | Tooling & preseden notarisasi hash | 0,10 | SDK/docs/explorer memudahkan + mengurangi risiko implementasi |

Skor 1–5 (5 = terbaik). Bobot disusun agar "kejujuran klaim final" dan "privacy anak"
berbobot tinggi — sesuai kebutuhan verifier publik.

## 2. Data kandidat (titik data 2026)

| Kandidat | Biaya/tx (anchor batch) | Finality | Catatan keberlanjutan |
|---|---|---|---|
| Algorand | ≈ **$0,00015** (Chainspect) | **Deterministik ~3,3 dtk/round, irreversibel** (foundation: "instant finality", tanpa reorg) | ALGO all-time-low Maret 2026 (~$0,077) → risiko kontinuitas ekosistem; data on-chain tetap ada walau ekosistem menyusut |
| Solana | ≈ **$0,0005** (base fee 0,000005 SOL; sub-sen) | **Optimistik <400 ms – sub-detik**; probabilistik — praktik umum pakai kedalaman konfirmasi (~32 slot ≈ 20 dtk) | Ekosistem besar, uptime membaik pasca-2023 |
| Stellar | base fee 0,00001 XLM (sangat kecil) | Ledger close ~5 dtk; konsensus SCP federated, finality praktis cepat | Stabil, tapi mindshare dev kecil |
| Base (L2 optimistic) | sering **<$0,01** (umumnya jauh di bawah $0,10) | Konfirmasi L2 cepat, **finality L1 butuh jendela fraud-proof sampai ~7 hari** | Ekosistem terbesar (TVL stablecoin ~$3,9 M Apr 2026); sequencer Coinbase (AS) |
| Permissioned (Besu/Fabric/private L2) | biaya internal (infra) | Instan di jaringan sendiri | SLA sendiri; butuh HA + ops spesialis |

## 3. Matriks skor (bobot × skor)

| Kandidat | K1 0,15 | K2 0,20 | K3 0,20 | K4 0,15 | K5 0,20 | K6 0,10 | **Total** |
|---|---|---|---|---|---|---|---|
| **No-chain (baseline DB+SHA-256+QR)** | 5 | 3 | 4 | 5 | 5 | 3 | **4,20** |
| **Algorand** | 5 | 5 | 2 | 4 | 5 | 3 | **4,05** |
| **Solana** | 5 | 3 | 4 | 3 | 5 | 4 | **4,00** |
| **Stellar** | 5 | 3 | 3 | 4 | 5 | 3 | **3,85** |
| **Base (L2 optimistic)** | 5 | 2 | 4 | 3 | 4 | 5 | **3,70** |
| **Permissioned (Besu/Fabric)** | 3 | 4 | 3 | 2 | 5 | 3 | **3,45** |

Pembacaan jujur: **no-chain menang** untuk LMS sekolah — konsisten dengan ADR-001.
Klaster publik (Algorand 4,05 vs Solana 4,00) sangat rapat; beda 0,05 di bawah toleransi
skor → pemilihan antara keduanya harus diputus dari bobot non-kuantitatif (lihat §5).

**Analisis sensitivitas** — bila bobot digeser (mis. K3 keberlanjutan lebih tinggi daripada
K2 kejelasan finality), urutan berubah: Solana/Base bisa melampaui Algorand. Bila pembuat
keputusan lebih mementingkan brand/ekosistem daripada definisi final yang tegas, pilihan
bergeser ke Solana (klaim final perlu aturan kedalaman konfirmasi) atau Base (terima
caveat "finality L2", finality L1 ~7 hari). Bila memilih karena preseden notarisasi,
Base unggul (K6=5).

## 4. Skor per dimensi ADR-018 (ringkas)

- **Biaya**: semua kandidat publik sub-sen per tx → non-faktor setelah batching Merkle
  (setahun batch mingguan < $1 untuk Algorand/Solana).
- **Finality**: Algorand satu-satunya kandidat dengan "final" deterministik-irreversibel;
  Solana/Stellar butuh aturan kedalaman; Base butuh caveat jendela ~7 hari — paling sulit
  dipetakan ke janji UI "final".
- **Uptime**: ekosistem besar (Solana/Base) vs protokol deterministik tapi ekosistem
  menyusut (Algorand). Data hash bertahan di chain apa pun; yang berisiko adalah RPC/explorer
  untuk verifikasi jangka panjang.
- **Vendor lock-in**: protokol terbuka semua; lock-in nyata = RPC pilihan + funding wallet.
  Permissioned = lock-in tertinggi (stack spesifik).
- **Regulasi/privacy**: hash-only aman di semua; Base menambah yurisdiksi AS (sequencer
  Coinbase) — pertimbangan kecil untuk data hash, tapi tetap dicatat untuk sekolah di
  Indonesia.
- **Operasional**: Algorand/Stellar paling sederhana (akun + memo, tanpa kontrak, tanpa
  rent/account model); Solana butuh tooling signing/account sedikit lebih kompleks;
  Base butuh paham L2/bridge; permissioned butuh infra penuh.

## 5. Rekomendasi default untuk keputusan manusia

**Rekomendasi berjenjang (keputusan tetap di manusia):**

1. **Default hari ini: TETAP no-chain untuk production.** Skor tertinggi (4,20), biaya 0,
   tanpa risiko regulasi/ops, dan memenuhi kebutuhan verifikasi sekolah (ADR-001).
   `BLOCKCHAIN_ANCHOR_ENABLED=false` tetap; anchoring publik hanya mock/dev.
2. **Bila manusia memutuskan non-repudiation PHAK KETIGA benar dibutuhkan →
   Algorand sebagai default.** Alasannya: (a) finality deterministik-irreversibel = definisi
   "final" tegas, persis janji UI (tanpa perdebatan kedalaman konfirmasi/jendela proof);
   (b) biaya ≈ $0,00015/batch → < $1/tahun; (c) root SHA-256 32 byte muat persis di memo
   transaksi — tanpa kontrak pintar; (d) hash-only = bersih untuk data anak.
3. **Alternatif default bila keputusan menekankan keberlanjutan ekosistem: Solana**
   (kalah 0,05 karena finality probabilistik — wajib aturan finality eksplisit) atau
   **Base** (tooling terbaik, tapi terima caveat finality L2). 
4. **TIDAK direkomendasikan sekarang: permissioned ledger** (over-engineering: infra,
   ops spesialis, lock-in tinggi untuk kebutuhan verifikasi publik sederhana).

**Risiko utama rekomendasi Algorand + mitigasi** — kontinuitas ekosistem (ALGO ATH-low 2026):
hash on-chain tidak pernah hilang; verifikasi via explorer publik/indexer; adapter abstrak
(mock→http di `lib/chain.ts`) membuat provider swappable tanpa mengubah domain; no-chain
tetap berjalan sebagai fallback verifikasi. Rekomendasi ini layak di-revisit bila ekosistem
Algorand melemah lebih lanjut atau harga/aktivasi validator turun drastis.

## 6. Checklist keputusan manusia (untuk owner/ops sekolah)

Jawab YA/TIDAK; semua YA ke #1–#3 → lanjut #4; bila #2 TIDAK → tetap no-chain:

1. Apakah verifikasi pihak ketiga (di luar penerbit) adalah kebutuhan nyata? ___
2. Disetujui payload publik permanen HANYA hash/root SHA-256 (tanpa nama/email/nilai/
   student ID/jawaban/PDF)? ___
3. Ada pemegang funding wallet (Algorand: isi ~beberapa ALGO) dan komitmen memantau
   status anchor (pending→final) + retry? ___
4. Bila YA semua → pilih network: **[ ] Algorand (default)** · [ ] Solana · [ ] Base ·
   [ ] Stellar · [ ] permissioned · [ ] tetap no-chain.
5. Setelah pilih: implementasi `HttpChainAdapter` (slot `createAiProvider`-style di
   `lib/chain.ts`), set `BLOCKCHAIN_ANCHOR_ENABLED=true` + `BLOCKCHAIN_PROVIDER`/
   `_NETWORK`, jalankan e2e chain tests, baru aktifkan di production.

## 7. Sumber (periksa ulang saat keputusan)

- Algorand: fee/finality — Chainspect (chainspect.app/chain/algorand, 2026) & Algorand
  Foundation (algorand.co); risiko harga — data pasar Maret–Agustus 2026 (all-time-low
  ~$0,0775).
- Solana: fee — solana.com/docs/core/fees/fee-structure; finality/perbandingan —
  solana.com/learn, cobo.com/post/solana-vs-ethereum-comparison, rebelfi (Apr 2026).
- Stellar: developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering.
- L2/Base: arxiv.org/html/2606.22206v1 (studi L2 2024–2026); eco.com (TVL Apr 2026);
  ethereum.org + optimism.io (jendela fraud-proof ~7 hari, Jun 2026).
- Pembanding harga gas L1/L2: wavect.io/blog/web3-mandates-gas-cost-l1-l2-hindsight (2026).
