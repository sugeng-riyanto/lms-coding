# Plan — Persist PDF sertifikat ke bucket + UI reissue khusus (KURANG Phase 6)

Status: **draf untuk review** — belum ada kode. Menutup sisa gap Phase 6 di
PROGRESS.md ("persist PDF ke bucket + UI reissue khusus") sehingga Phase 6
tuntas. Acuan: `CERTIFICATE_VERIFICATION.md` (issuance flow langkah 4–7:
render PDF → simpan di private bucket → tandai aktif; revocation menyimpan
file lama untuk audit, signed download tidak diberikan untuk sertifikat
non-aktif), `ACCEPTANCE_CRITERIA.md` ("Revocation dan reissue bekerja"),
`prompts.md` Prompt 08 (status active/revoked/reissued; reissue yang
mempertahankan sejarah), `SECURITY_PRIVACY.md` (bucket privat; download via
signed URL pendek setelah permission check), ADR-006 & ADR-009 (backlog:
persist + signed URL), checklist `docs/plan-checklist-kurang-item.md`.

---

## Temuan konteks (memengaruhi desain)

1. **Reissue saat ini IMPOSSIBLE, bukan sekadar tanpa UI.** `certificates`
   punya `unique (enrollment_id, level_id)` **lintas status** (init). Setelah
   revoke, baris lama tetap memegang kunci; `issue_certificate` (RPC) memakai
   `on conflict ... do nothing` → issue ulang diam-diam mengembalikan NULL.
   Migration wajib: ganti constraint jadi partial unique index
   `WHERE status = 'active'` (satu active per enrollment-level; riwayat
   revoked boleh banyak).
2. **`pdf_path`/`qr_path` sudah ada di tabel** (nullable, belum dipakai);
   status CHECK `('active','revoked')`; `no_delete_certs` rule → history
   append-only. Verifier view `certificates_public` filter
   `status in ('active','revoked')` — menambah status 'reissued' akan
   mengubah view/RLS/anon; **keputusan: status TETAP active/revoked**,
   "reissued" diekspresikan sebagai revoked(reason REISSUE) + baris active
   baru (riwayat = beberapa baris + audit) (D1).
3. **Storage**: bucket `certificates` privat; `storage.objects` untuk bucket
   ini **deny select authenticated + tanpa policy insert/update/delete** →
   tulis & signed URL HANYA lewat service client (secret server-only,
   konsisten ADR-005; dijamin `tests/integration/storage.test.ts`).
4. **PDF on-demand sudah ada** (`app/api/certificates/[publicId]/pdf/route.ts`,
   pdfkit A4 landscape, permission RLS owner/guru, revoked → 410). Persist =
   render SEKALI lalu simpan, bukan render tiap unduhan.
5. **Eligibility full evaluator ada di TS** (`lib/eligibility.ts` +
   `issueCertificate` di `features/actions.ts`); RPC DB hanya insert
   (evaluator DB disederhanakan — komentar init). Maka **reissue = evaluasi
   TS dulu → RPC atomik DB (revoke + issue + audit dalam satu transaksi)**,
   mengikuti pola `revoke_certificate` yang menulis audit sendiri (TS tidak
   punya policy insert `audit_logs`).
6. **Tanpa storage live** (sandbox/CI): tulis bucket tak bisa diverifikasi →
   route persist harus **degradasi anggun**: simpan best-effort; kalau
   gagal/tak ada storage → fallback render on-demand (perilaku hari ini),
   `pdf_path` tetap null. Verifikasi penuh menunggu Supabase lokal
   (`docs/e2e-setup.md`).

---

## 0. Hosted push coverage (migration 000016 & 000017 ikut stack sertifikat)

Satu `supabase db push --linked` ke hosted (prosedur `.freebuff/push-and-verify.sh`)
menerapkan seluruh migration yang belum ter-push sekaligus, sehingga stack sertifikat
di-push **bersama** dua migration tetangganya — jangan pisahkan sebagian:

| Migration | Peran | Stack |
|---|---|---|
| `20260906000010_certificate_reissue.sql` | reissue atomik + index active partial | sertifikat |
| `20260906000016_study_sessions_write_path.sql` | write path `study_sessions` (ADR-010) | study_sessions (Phase 3) |
| `20260906000017_chain_anchor_status.sql` | status anchor pending/final/failed + `certificates_public.chain_anchor_status` | sertifikat/verifikasi |
| `20260906000018_anchor_batch_org.sql` | `chain_anchors.organization_id` utk batch per-org | sertifikat/verifikasi |

Semua migration (000000–000018) adalah **linear dan kompatibel** — tidak ada
ketergantungan urutan implisit selain urutan numerik; `db push` menjalankan
sesuai urutan file. Karena itu mem-push stack sertifikat tanpa 000016/000017
hanya membuat basisdata tertinggal, bukan rusak — tetapi untuk satu putaran
push yang konsisten, **selalu masukkan 000016 (study_sessions) dan 000017
(anchor status) bersama stack sertifikat** (000010/000017/000018). Verifikasi
live pasca-push: `attempts.question_order_json`, `rubrics`+`rubric_criteria`+
`update_rubric_version`, tipe aktivitas `code_board`/`embed_*`, dan
`certificates_public.chain_anchor_status`.

> Status saat ini (catatan sesi terakhir): 000012–000018 **sudah ter-push** ke
> hosted (project `jspmxdzgxevtfwvldwxy`) dan keempat verifikasi live lulus;
> bagian ini menjaga dokumen tetap sinkron bila push diulang dari environment lain.

## 1. Migration baru `20260906000010_certificate_reissue_persist.sql`

1. `alter table public.certificates drop constraint
   certificates_enrollment_id_level_id_key;` lalu
   `create unique index certificates_one_active on public.certificates
   (enrollment_id, level_id) where status = 'active';`
   (RLS/verifier tidak berubah; anon tetap tak bisa baca tabel.)
2. Fungsi privat (pola `private.revoke_certificate`, definer + search_path +
   caller check, revoke PUBLIC + grant authenticated via wrapper public):
   `private.reissue_certificate(p_certificate_id uuid, p_reason text,
   p_idempotency_key text) returns uuid`:
   - validasi `auth.uid()`; cari cert; **FORBIDDEN** bila bukan guru cohort
     (query sama dengan revoke);
   - **NOT_FOUND/ALREADY_REVOKED** bila cert tak ada / tak lagi `active`;
   - update baris lama → `revoked`, `revoked_at=now()`; insert baris baru
     (serial + payload_hash dihitung dalam fungsi, pola `issue_certificate`);
   - audit SATU baris `certificate.reissued` (old_id, new_id, reason);
   - return new id. Partial index aktif memastikan tak ada konflik.
3. Wrapper public + `grant execute` + hardening test pola (revoke PUBLIC).
   Tanpa perubahan tabel lain; advisor count bertambah 0 tabel.

Catatan: `issue_certificate` yang ada tetap dipakai alur issue biasa
(evaluasi TS dulu). Reissue TIDAK boleh memanggil issue biasa karena
idempotency-nya `do nothing` menyembunyikan kegagalan.

## 2. Persist PDF + signed download (server-only)

- `lib/certificate-store.ts` (baru): `certificateObjectPath(publicId)`
  (`certificates/{publicId}.pdf`, validasi `^[a-z0-9-]+$` — public_id hasil
  server; fallback untuk row demo slug → sanitize), `persistPdf(publicId,
  pdfBuffer)` via `createServiceClient().storage.from("certificates")`, dan
  `createPdfSignedUrl(publicId, ttlSeconds=300)`. Murni/deterministik utk path;
  upload/signed-url = I/O terisolasi di file ini (service key tidak bocor).
- PDF route `.../pdf/route.ts` berubah: permission & 410 tetap (strict
  client untuk baris cert). Lalu: (a) bila `pdf_path` terisi → buat signed
  URL → `302` redirect; (b) bila null → render buffer (logika existing
  diekstrak ke `renderCertificatePdf(...)` agar bisa dipakai issuance juga),
  kirim `application/pdf` biasa DAN persist best-effort async
  (`persistPdf`; gagal → log, jangan gagalkan response). pdf_path di-update
  via service client (strict client tak punya policy update certificates —
  deny, storage.test; service = satu-satunya jalur sah).
- Rate limit tetap; revoked tetap 410 sebelum persist check.

## 3. UI reissue khusus (teacher)

- `features/actions.ts`: `reissueCertificate({ certificateId, reason })` —
  load cert via strict client (RLS guru), evaluasi ulang eligibility (logika
  yang sama dengan `issueCertificate`, D2: bila tak lagi eligible → tolak
  dengan alasan, SEBELUM revoke), lalu `rpc("reissue_certificate", ...)`;
  error mapping `REVOKE_STATE/REISSUE_FAILED`.
- Halaman `app/(teacher)/teacher/students/[studentId]/page.tsx` (sudah
  menampilkan riwayat cert + IssueCertificateButton): per cert `active`
  tambah aksi "Reissue" → dialog alasan (wajib) → konfirmasi → revalidate.
  Riwayat menampilkan rantai: cert revoked (badge "diganti") → cert active
  baru (serial baru). Aksesibel (label, focus), komponen kecil + server
  action + `useFormStatus`.
- `lib/validation.ts`: `reissueCertificateSchema` (uuid + reason non-empty,
  panjang maks, mirror revoke).

## 4. Seed/fixture/live-denial & tests

- Seed/fixture: TIDAK mengubah data anonim (tanpa storage live); tambah satu
  baris revoked Murid 01 utk fixture reissue (opsional).
- Live-denial `t10_*`: pasca migration — (a) revoke + issue ulang atas
  enrollment-level yang sama → **2 baris** (revoked + active) dan index
  `certificates_one_active` menolak insert active kedua; (b) guru org-1 tetap
  0 baris cert org-2; murid tetap tak bisa update cert. (Service-only storage
  di luar cakupan RLS — dicatat, tidak diuji live.)
- Unit: `lib/certificate-store.ts` path sanitasi (traversal/karakter aneh);
  tak ada kalkulasi metrik baru.
- Integration statis (`tests/integration/certificate-reissue.test.ts`):
  migration berisi partial unique index + drop constraint; fungsi
  `private.reissue_certificate` definer + search_path + revoke PUBLIC +
  wrapper/grant; TIDAK ada policy authenticated baru pada storage bucket
  certificates (regresi storage.test tetap hijau); actions.ts memuat
  `reissue_certificate` RPC dan `issueCertificate` TIDAK dipakai untuk
  reissue; pdf route masih strict client + service store import.
- E2E: tanpa backend route pdf tak teruji penuh (404/demo) — state matrix.

## 5. Acceptance criteria (terukur)

| ID | Kriteria | Bukti |
|---|---|---|
| AC-1 | Revoke lalu issue ulang enrollment-level sama menghasilkan 2 baris (revoked + active); satu-satunya active dijamin index | migration + live t10 |
| AC-2 | Reissue menolak cert bukan milik cohort guru / cert non-active / murid | unit/integration + live t10 |
| AC-3 | Reissue mengevaluasi ulang eligibility SEBELUM revoke; tak eligible → tolak tanpa efek | integration (urutan rpc/schema) + code review |
| AC-4 | Reissue menulis audit `certificate.reissued` (reason, old/new) dalam transaksi yang sama | integration (fungsi berisi audit) + live |
| AC-5 | PDF persist: path aman dari publicId tersanitasi; upload & signed URL hanya via service client; tidak ada policy authenticated baru pada bucket certificates | unit + integration + storage.test regresi |
| AC-6 | Route pdf: aktif+tersimpan → 302 signed URL; aktif+belum tersimpan → stream PDF (perilaku lama) + persist best-effort; revoked → 410; rate-limit tetap | integration/route + review |
| AC-7 | UI reissue di student detail teacher: dialog alasan, aksi, riwayat revoked+active tampil; aksesibel | preview/snapshot |
| AC-8 | Tanpa hard delete; status tetap active/revoked; verifier view & RLS tidak berubah | static + live t05/t07 regresi |
| AC-9 | Gates: unit/integration +N; typecheck/lint/format; `db:typecheck` (advisor: tabel tetap 36 + fungsi baru terindeks pola); `build`; e2e 18+/1; live-denial 38+N | log gate aktual |
| AC-10 | PROGRESS.md Phase 6 tanpa KURANG; CHANGELOG draf diperbarui | diff |

State matrix (dari checklist): (a) tanpa env → halaman guarded state demo;
(b) env tanpa DB/storage → action/route error keras (strict client), route
pdf fallback on-demand tetap berjalan bila baris cert terbaca demo? —
route butuh auth; e2e hanya verifier; (c) backend hidup + seed → reissue UI
& persist terverifikasi manual (`docs/e2e-setup.md`) — batas jujur: tulis
storage tidak bisa diverifikasi di sandbox.

## 6. Keputusan terbuka (calon ADR)

- **D1 — Status 'reissued' vs revoked+baru**: dipilih revoked+baru (view/RLS
  tak berubah; riwayat via baris + audit). Alternatif menambah nilai status
  → ubah CHECK + view + verifier.
- **D2 — Syarat reissue**: eligibility evaluasi ulang penuh (default) vs
  reissue bebas alasan administratif (koreksi data guru); kalau bebas,
  catat bahwa sertifikat baru bisa terbit walau murid tak lagi eligible.
- **D3 — Persist sinkron vs antrian jobs**: best-effort sinkron di route
  dulu; jobs `type=certificate` (retry idempotent, runbook §3) sebagai
  hardening menyusul.
- **D4 — QR persist**: `qr_path` dibiarkan null (QR regenerable deterministik
  dari publicId) — tidak di-persist di MVP.

## 7. Risiko

1. **Tanpa storage live** → upload/signed URL hanya teruji statis + degradasi
   anggun; verifikasi penuh menunggu Supabase lokal (dokumentasikan, jangan
   klaim teruji).
2. **Perubahan constraint unik** berisiko ke data lama (duplikat active tak
   mungkin dari constraint lama; tapi revoke-massal sebelum migrasi tak
   perlu) — migration idempotent + live dari nol.
3. **Regresi route pdf** (print/download page): pertahankan respons
   PDF-stream saat persist gagal; hardening test cek import strict client.
4. **Service key** hanya di `lib/certificate-store.ts` + route (server-only);
   secret scan & hardening test harus tetap lulus.
5. **Reissue bukan transaksi penuh lintas TS↔DB**: evaluasi TS lalu RPC DB —
   celah TOCTOU kecil (eligibility berubah antara evaluasi & eksekusi);
   mitigasi: RPC tidak mengecek ulang eligibility (keputusan D2), dicatat.
