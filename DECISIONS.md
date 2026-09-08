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

## ADR-010 — Unit target mingguan: completions dulu, minutes tertunda

- Status: accepted
- Context: rencana `docs/plan-weekly-target-spaced-review.md` (D1) — LEARNING_ENGINE.md
  menuntut target mingguan personal, tetapi `study_sessions` belum punya write
  path (heartbeat + active-time clamping Prompt 04 belum diimplementasi;
  `features/actions.ts` hanya menulis `learning_events`). Target berbasis menit
  tidak bisa diukur jujur hari ini; completions (transisi `progress_snapshots` →
  `completed`) sudah tersedia dan idempotent via `recomputeProgress`.
- Decision: `weekly_plans.goal_unit` menyimpan kedua nilai
  (`check (goal_unit in ('completions','minutes'))`) dengan **default
  `'completions'`**; MVP menghitung progress dari jumlah completions per minggu
  ISO. Nilai `'minutes'` tidak dipakai app sampai write path `study_sessions`
  (heartbeat terbatas + clamp) hadir dan teruji.
- Alternatives: (a) target menit lebih dulu — butuh write path sesi yang belum
  ada; (b) tanpa kolom unit (tetap completions) — memaksa migration lagi saat
  menit dibutuhkan; (c) mengekspos menit sekarang — angka tidak jujur.
- Consequences: kebutuhan menit kelak hanya butuh perubahan app (recording
  sesi + UI), bukan migration (CHECK sudah mengizinkan `'minutes'`); dokumen
  dan UI tidak boleh menyebut target menit sebagai terukur sebelum write path
  hadir.

## ADR-011 — Scheduling review via hook aplikasi, bukan trigger DB

- Status: accepted
- Context: rencana `docs/plan-weekly-target-spaced-review.md` (D4) — review
  pertama harus dibuat saat sebuah level selesai, dan `recomputeProgress`
  bersifat idempotent (bisa dijalankan ulang). Migration manual (tanpa CLI)
  diaplikasikan verbatim oleh runner live-denial, sehingga migration idealnya
  seminimal mungkin dan bebas efek samping tersembunyi.
- Decision: tidak ada trigger DB. Baris `weekly_plans` dibuat lazy
  (get-or-create di server code); baris `review_items` pertama dijadwalkan oleh
  **hook aplikasi** yang menyertai `recomputeProgress` (hanya bila belum ada
  baris scheduled untuk `(enrollment, entity)`). Partial unique index
  `review_items_one_active` tetap menjadi jaminan tingkat-DB terhadap duplikat.
- Alternatives: (a) trigger `after insert/update` pada `progress_snapshots` —
  menyembunyikan efek samping di migration dan menyulitkan audit/test;
  (b) job berkala (cron/edge function) menyapu due items — menambah moving
  part infra untuk antrian yang sebenarnya sinkron dengan event completion.
- Consequences: kebenaran scheduling bergantung pada call-site aplikasi
  (semua jalur yang menandai level completed harus lewat hook); trigger hanya
  boleh diperkenalkan kembali via migration baru + test + live-denial, dan
  index unik parsial tetap melindungi dari duplikat apa pun jalurnya.

## ADR-012 — Reissue sertifikat = revoke + issue baru (tanpa nilai status 'reissued')

- Status: accepted
- Context: rencana `docs/plan-certificate-persist-reissue.md` (D1).
  `prompts.md` Prompt 08 menyebut status `active/revoked/reissued`, tetapi
  menambah nilai status berarti mengubah CHECK `certificates.status`,
  filter verifier view `certificates_public` (`status in ('active','revoked')`),
  dan permukaan anon/RLS. Migration `20260906000010` sudah mengganti unique
  lintas status dengan partial unique index `certificates_one_active`.
- Decision: `'reissued'` TIDAK menjadi nilai status. Reissue = baris lama
  di-revoke (alasan dicatat) + baris baru `active` dalam satu transaksi
  (`private.reissue_certificate`, audit `certificate.reissued` berisi
  old/new/reason). Status tetap `('active','revoked')`; verifier view & RLS
  tidak berubah. Satu ACTIVE per `(enrollment_id, level_id)` dijamin partial
  unique index; riwayat revoked boleh banyak (append-only, `no_delete_certs`).
- Alternatives: (a) nilai status `'reissued'` — ubah CHECK + view verifier +
  logika anon; (b) satu baris mutable dengan kolom superseded — bertentangan
  dengan audit append-only.
- Consequences: UI/riwayat menyebut sertifikat lama sebagai revoked dengan
  alasan (mis. "diganti"); verifier tetap menampilkan revoked + tanggal tanpa
  perubahan; PDF lama tidak diunduh sebagai valid (perilaku existing 410).

## ADR-013 — Reissue mengevaluasi ulang eligibility (TS) sebelum RPC DB

- Status: accepted
- Context: rencana `docs/plan-certificate-persist-reissue.md` (D2). Evaluator
  eligibility PENUH hidup di TS (`lib/eligibility.ts` + `issueCertificate`);
  RPC DB `issue_certificate` sengaja disederhanakan (komentar init: "full
  evaluator di lib/mastery + job"). TS tidak punya policy insert
  `audit_logs`, sehingga audit reissue ditulis di dalam fungsi definer.
- Decision: reissue memakai evaluator eligibility yang SAMA dengan issuance
  biasa (TS) dan dijalankan SEBELUM memanggil RPC `reissue_certificate`;
  bila tak lagi eligible → tolak dengan alasan, tanpa efek apa pun. RPC DB
  tidak mengecek ulang eligibility.
- Alternatives: (a) reissue bebas syarat eligibility (koreksi administratif
  guru) — dapat menerbitkan sertifikat walau murid tak lagi eligible;
  (b) menduplikasi evaluator di dalam DB — dua sumber kebenaran.
- Consequences: ada celah TOCTOU kecil antara evaluasi TS dan eksekusi RPC
  (eligibility berubah di antara dua langkah) — diterima untuk MVP dan
  dicatat di risiko rencana; koreksi data tanpa evaluasi ulang penuh tetap
  mungkin via issue biasa dengan alasan audit.

## ADR-014 — Consent AI feedback per-org di kolom organizations (default false)

- Status: accepted
- Context: rencana `docs/plan-ai-draft-feedback-consent.md` (D1). SECURITY_PRIVACY.md
  menempatkan consent sebagai kebijakan sekolah/org, bukan per-user; tabel
  `organizations` saat ini hanya id/name/slug/timezone (tanpa kolom settings).
- Decision: consent direpresentasikan sebagai dua kolom di `organizations`
  (`ai_feedback_consent boolean not null default false` +
  `ai_feedback_consent_at timestamptz`) dan hanya guru teacher aktif org yang
  bisa mengubah via RPC definer `private.set_org_ai_consent` (audit
  `org.ai_consent`). Env `AI_FEEDBACK_ENABLED` hanya gerbang global; consent
  per-org tetap wajib (default false = fail closed).
- Alternatives: (a) env global saja — bertentangan dengan kebijakan per-org;
  (b) tabel settings terpisah — lebih fleksibel tetapi menambah permukaan RLS
  tanpa kebutuhan MVP.
- Consequences: menambah kolom pada tabel inti; migrasi `…000011`;
  db-advisor tabel tetap 36 (kolom, bukan tabel baru).

## ADR-015 — Draf AI hanya mengisi draft editor guru; guru tetap menekan Simpan

- Status: accepted
- Context: rencana `docs/plan-ai-draft-feedback-consent.md` (D2). Alur grading
  final yang ada adalah `gradeResponse` (server action → RPC
  `grade_response_manual` → `grade_revisions` append-only). Draf AI tidak boleh
  menjadi feedback final tanpa tindakan guru eksplisit.
- Decision: tombol "Setujui & pakai" hanya memindahkan body draft ke editor
  feedback guru (masih bisa diedit); feedback baru final saat guru menekan
  "Simpan nilai" lewat alur `gradeResponse` yang sudah ada (revisi/audit tidak
  berubah). Tidak ada jalur yang menulis `responses.feedback_json` dari AI
  tanpa aksi guru.
- Alternatives: (a) approve langsung menulis feedback final — menghilangkan
  kontrol/edit guru; (b) tanpa jejak draft — kehilangan audit keputusan guru.
- Consequences: konsisten dengan aturan "AI wajib disetujui guru"; jejak draft
  + keputusan (approved/rejected) di `ai_feedback_drafts`.

## ADR-016 — Rubric suggestion DI LUAR MVP draft feedback

- Status: accepted
- Context: rencana `docs/plan-ai-draft-feedback-consent.md` (D3).
  ASSESSMENT_AND_SCORING.md menyebut rubric per kriteria, dan tabel
  `rubrics`/`rubric_criteria` sudah ada, tetapi belum ada alur grading rubric
  yang dipakai UI.
- Decision: MVP AI feedback hanya naratif (draft teks); saran skor per kriteria
  rubric ditunda sampai alur rubric benar-benar aktif (ADR tersendiri saat itu).
- Alternatives: menyertakan rubric suggestion sekarang — bergantung permukaan
  yang belum dipakai dan memperluas risiko kualitas skor AI.
- Consequences: cakupan rencana tetap fokus; dokumen mencatat ini sebagai
  keputusan eksplisit, bukan lupa.

## ADR-017 — Provider AI via adapter dengan mock default (tanpa jaringan)

- Status: accepted
- Context: rencana `docs/plan-ai-draft-feedback-consent.md` (D4). Tidak ada
  kredensial provider eksternal di repo; pengujian harus deterministik dan
  tanpa jaringan keluar.
- Decision: `lib/ai-feedback.ts` mengekspos interface `AiDraftProvider`;
  `createAiProvider()` memilih `mock` (deterministik, berlabel draft, TANPA
  jaringan — default pengujian) / `http` (POST JSON ke base URL dari env,
  timeout 10s, error terswallow + log redact) / `null` saat unconfigured.
  Panggilan provider hanya dari server action (strict client); tidak ada
  fetch/import provider di file client.
- Alternatives: integrasi provider spesifik langsung — mengunci vendor dan
  menaruh kredensial/format di repo; tanpa mock — test tidak deterministik.
- Consequences: env baru `AI_FEEDBACK_ENABLED`/`AI_PROVIDER`/
  `AI_PROVIDER_BASE_URL`/`AI_PROVIDER_API_KEY` (semua server-only, masuk
  `.env.example` → daftar sah check-env otomatis).

## ADR-018 — Blockchain anchor: baseline no-chain untuk produksi; provider publik ditangguhkan bersyarat (mock-only)

- Status: accepted
- Context: baseline sertifikat (ADR-001: DB + SHA-256 + QR verifier) sudah lulus seluruh
  test. Prompt 09 meminta anchoring opsional dengan evaluasi sebelum memilih provider;
  provider/network BELUM ditetapkan dan keputusan ada di manusia (owner/ops sekolah).
  Evaluasi tiga opsi per dimensi yang diminta:

  1. **No-chain (baseline)**: verifikasi DB deterministik + SHA-256 + QR. Biaya 0;
     finality instan (tapi bukan third-party non-repudiation); uptime = infrastruktur
     sendiri; tanpa vendor lock-in; regulasi nihil; privacy penuh (tidak ada data ke
     pihak ketiga); operasional minimal. Kekurangan: verifier publik hanya mempercayai
     penerbit (single source of truth) — cukup untuk skenario sekolah.
  2. **Public low-cost chain** (kandidat: Solana, Algorand, Stellar, Base, Polygon):
     biaya per-anchor sangat rendah dengan batching Merkle (satu transaksi = banyak
     sertifikat); finality detik–menit tapi probabilistik (butuh konfirmasi, risiko
     reorg kecil); uptime tinggi namun bergantung jaringan publik + RPC provider;
     vendor lock-in rendah (protokol terbuka) tapi ketergantungan RPC/funding wallet;
     regulasi: data menjadi publik PERMANEN — hanya aman karena payload = hash/root
     tanpa PII (tetap perlu kebijakan hash + pengawasan data anak); operasional: funding
     wallet + monitoring finality + retry.
  3. **Permissioned ledger** (Hyperledger Fabric / Besu private / L2 internal): biaya
     internal (infra); finality cepat/instan; uptime = vendor/internal; vendor lock-in
     TINGGI (stack spesifik, ops terlatih); regulasi terkontrol penuh; privacy penuh
     (hanya peserta jaringan); operasional: infra tambahan + perawatan berkelanjutan.

- Decision: TIDAK memilih provider/network sekarang. Keputusan manusia diperlukan
  dengan bobot: (a) apakah non-repudiation pihak ketiga benar dibutuhkan (no-chain
  mungkin cukup untuk verifikasi sekolah); (b) regulasi data anak — publik permanen
  hanya diterima jika hash-only disetujui; (c) operasional — siapa memegang funding
  wallet / infra. Sampai keputusan: `BLOCKCHAIN_ANCHOR_ENABLED=false` (default),
  provider NYATA ditolak runtime (fallback noop — tidak mengarang kredensial atau
  transaksi), dan hanya `MockChainAdapter` yang aktif untuk tests/verifikasi.
- Alternatives: (a) langsung pilih public chain — melanggar prinsip "minta keputusan
  manusia"; (b) langsung permissioned — over-engineering tanpa kebutuhan terkonfirmasi.
- Consequences: interface `anchor/getStatus/verify` + Merkle batch + UI status
  pending/final/failed tanpa klaim "blockchain verified" sebelum final; status anchor
  dibaca publik HANYA hash/root + transaction reference (tanpa PII); ADR ini
  di-revisit saat keputusan manusia tiba.
- Evaluasi & rekomendasi: `docs/evaluation-anchor-provider.md` (matriks skor
  berbobot, data 2026). **Rekomendasi default (menunggu konfirmasi manusia):**
  (1) tetap no-chain untuk production (skor tertinggi 4,20 — kebutuhan sekolah
  terpenuhi ADR-001); (2) bila non-repudiation pihak ketiga diputuskan perlu →
  **Algorand** (finality deterministik-irreversibel = definisi "final" tegas untuk
  UI, ≈ $0,00015/batch, root 32 byte muat di memo, hash-only bersih untuk data
  anak) — risiko kontinuitas ekosistem dimitigasi adapter abstrak + explorer +
  fallback no-chain; (3) alternatif: Solana (ekosistem, finality probabilistik)
  / Base (tooling, caveat finality L2 ~7 hari); permissioned ledger TIDAK
  direkomendasikan (over-engineering).
- Recorded decision (checklist §6 docs/evaluation-anchor-provider.md dijawab):
  1. Verifikasi pihak ketiga kebutuhan nyata? **TIDAK saat ini** — baseline ADR-001
     sudah memenuhi verifikasi sekolah; tidak ada requirement non-repudiation pihak
     ketiga. 2. Payload publik permanen hash-only disetujui? **YA** (desain sejak
     awal: `chain_anchors` hanya merkle_root + transaction_ref; verifier hanya
     fingerprint). 3. Funding wallet + komitmen monitoring/retry? **TIDAK saat ini**
     — tidak ada wallet yang diarang; hanya manusia pemegang dana yang bisa
     mengubah ini. 4. **Keputusan: tetap no-chain untuk production** —
     `BLOCKCHAIN_ANCHOR_ENABLED=false` (default), `MockChainAdapter` hanya utk
     dev/test. Provider publik TIDAK dipilih sekarang; bila #1+#3 berubah jadi YA,
     default matriks adalah **Algorand** (finality deterministik = janji "final"
     tegas utk UI; ≈ $0,00015/batch; root 32 byte muat di memo; hash-only bersih
     utk data anak), Solana/Base alternatif, permissioned TIDAK direkomendasikan.
     Eksekusi (HttpChainAdapter + env `BLOCKCHAIN_*` + e2e chain tests) baru saat
     syarat itu terpenuhi. Implementasi TETAP mock-only sampai saat itu.

## ADR-019 — Cakupan dashboard Wali: summary-only untuk pilot

- Status: accepted
- Context: audit `view_linked_child_summary` terhadap dashboard Wali. Kontrak
  kapabilitas (RBAC.md) memang "ringkasan anak tertaut" — bukan detail. RLS
  wali hari ini mencakup profiles/enrollments/progress_snapshots/certificates
  (via `guardian_links` aktif + `certs_guardian_select`); attempts/responses/
  grade_revisions/study_sessions TIDAK punya policy wali. Dashboard wali sudah
  menampilkan sertifikat + unduh PDF + verifikasi.
- Decision:
  1. **Sertifikat (unduh PDF + verifikasi): TETAP** — data publik/record,
     PII minimal, sudah berfungsi; konsisten dengan rilis otomatis ke wali
     (migration `20260907110000`).
  2. **Nilai quiz/ujian terperinci: TIDAK untuk pilot.** Ringkasan agregat
     (progress %, mastery %, level tuntas, terakhir aktif) sudah menjawab
     pertanyaan wali "anak saya on track?" tanpa membocorkan item/jawaban;
     detail nilai menciptakan tekanan nilai & risiko privasi.
  3. **Absensi: TIDAK untuk pilot.** LMS asinkron tanpa roll-call; proksi
     engagement = menit aktif (`study_sessions`). Wali cukup melihat
     "terakhir aktif".
- Alternatives: (a) menampilkan rata-rata skor quiz per kursus ke wali;
  (b) menit aktif mingguan via `guardian_child_engagement` RPC; keduanya
  ditangguhkan menunggu feedback pilot tertulis.
- Consequences: bila feedback pilot meminta engagement/nilai agregat, jalur
  implementasinya WAJIB: RPC security-definer di schema private + policy
  sempit + denial test live — bukan widening policy SELECT. Dashboard wali
  juga tercatat masih hardcoded Indonesian (belum bilingual) — masuk backlog
  terjemahan, bukan blocker cakupan ini.

## Template

```text
## ADR-NNN — Judul
- Status: proposed|accepted|superseded
- Context:
- Decision:
- Alternatives:
- Consequences:
```

