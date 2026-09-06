# Rencana — AI draft feedback (Phase 4 KURANG) dengan consent config

> Menutup sisa Phase 4 di PROGRESS.md: *"KURANG: AI draft feedback (butuh consent config)"*.
> Mengikuti struktur rencana KURANG lain (`docs/plan-weekly-target-spaced-review.md`,
> `docs/plan-item-analysis-misconception-map.md`, `docs/plan-certificate-persist-reissue.md`)
> dan checklist reusable `docs/plan-checklist-kurang-item.md`.

## 1. Fakta konteks (diverifikasi di kode, bukan asumsi)

1. **Kontrak produk** (SECURITY_PRIVACY.md): "AI hanya boleh memberi **draft** feedback atau rubric suggestion yang **ditandai jelas dan wajib disetujui guru**. Jangan mengirim data murid ke provider AI tanpa konfigurasi consent." Consent adalah kebijakan **sekolah/org** (baris 39), bukan per-user.
2. **Permukaan grading yang ada**: queue guru di `app/(teacher)/teacher/grading/` (`page.tsx` mengambil attempts + responses via RLS cohort guru; `grade-queue.tsx` client memanggil `gradeResponse({responseId, manualScore, feedback})`). `responses.feedback_json` sudah ada (DATA_MODEL baris 41) dan dibaca di `features/actions.ts` (1355+) pada jalur nilai; alur revisi append-only via `grade_revisions` + RPC `grade_response_manual`.
3. **Tidak ada tulisan AI hari ini**: tidak ada lib provider, tidak ada env AI, tidak ada kolom settings org (`organizations` hanya id/name/slug/timezone). Semua tambahan ini bersih untuk dirancang.
4. **RLS**: guru cohort sudah bisa baca jawaban (`responses_owner_select` dkk, bukti live-denial). Murid bisa baca response miliknya sendiri → **feedback draft AI TIDAK boleh ditaruh di kolom yang terbaca murid** sebelum disetujui (kolom-level RLS tidak dipakai di repo; solusi aman = tabel draft terpisah teacher-only).
5. **Aturan keamanan yang berlaku** (Prompt 01–02): secret tidak pernah di browser; evaluasi/grading di trusted server; fungsi privileged di schema `private` dengan caller check + `search_path`; audit append-only; redact PII dari log; env divalidasi di `lib/env.ts` (Zod) dan kini juga struktur file via `scripts/check-env.mjs` (daftar key sah = `.env.example`).

## 2. Desain aman (MVP, feature OFF secara default)

**Kebijakan**: fitur mati kecuali (a) env `AI_FEEDBACK_ENABLED=true`, (b) provider terkonfigurasi, DAN (c) **org sudah consent** (`organizations.ai_feedback_consent = true`, di-set server-side oleh guru owner via audit). Tanpa salah satu → aksi menolak `AI_DISABLED` / `AI_NO_CONSENT` / `AI_PROVIDER_UNCONFIGURED`, tanpa efek.

### 2.1 Migration `…000011_ai_feedback_consent.sql` (1 tabel + 2 kolom)
- `alter table organizations add column ai_feedback_consent boolean not null default false, add column ai_feedback_consent_at timestamptz;` — consent per-org (default tolak = fail closed).
- `ai_feedback_drafts(id uuid pk default gen_random_uuid(), response_id uuid not null references responses(id) on delete cascade unique, body text not null, model text not null, status text not null default 'draft' check (status in ('draft','approved','rejected')), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), approved_at timestamptz, approved_by uuid references auth.users(id));`
  - RLS: `select/insert` = guru yang mengajar cohort dari response (via attempts→enrollments→teacher_cohort_ids); `update` (draft→approved/rejected) USING+WITH CHECK sama; **tidak ada policy murid/anon**; no hard delete (rule `no_delete_ai_drafts`).
  - Unique `response_id` → satu draft per response (regenerate = update status draft lama → rejected + insert baru, atau upsert).
- RPC `private.set_org_ai_consent(p_org_id, p_consent)` definer + search_path + caller check (guru teacher aktif org tsb) → tulis consent + `audit_logs` action `org.ai_consent` (actor, before/after). Wrapper public + grant authenticated + revoke public (pola revoke/reissue).
- RPC `private.upsert_ai_draft(p_response_id, p_body, p_model)` definer + caller check (guru cohort; lihat status sebelumnya; log?) → insert draft (status draft). Body **tidak** pernah ditulis ke `responses.feedback_json`.
- RPC `private.apply_ai_feedback(p_response_id, p_feedback, p_approved_by)` → saat guru menyetujui: tulis feedback ke `responses.feedback_json` (merge, beri penanda `{"source":"ai_approved","at":…}`) + `grade_revisions` reason `ai_draft:approved` (nilai prev=new) + tandai draft `approved`. Satu transaksi; audit append-only terjaga.
- Catatan: angka tabel db-advisor naik 36 → **37** (`db:typecheck` AC).

### 2.2 Env & lib (semua server-only)
- `.env.example` (+ daftar sah check-env otomatis): `AI_FEEDBACK_ENABLED=false`, `AI_PROVIDER=`, `AI_PROVIDER_BASE_URL=`, `AI_PROVIDER_API_KEY=` (kosong; **tidak boleh** `NEXT_PUBLIC_`).
- `lib/env.ts`: tambah 4 key opsional (Zod); bila `AI_FEEDBACK_ENABLED=true` tetapi provider/base/key kosong → `getServerEnv` tetap lolos (fitur menolak runtime `AI_PROVIDER_UNCONFIGURED`), agar env file valid tanpa provider.
- `lib/ai-feedback.ts` (murni + I/O terisolasi):
  - `buildPrompt({qtype, promptText, answerText, orgName?})` — **hanya** teks soal + jenis + jawaban; komposisi prompt tanpa nama/email murid, nilai lain, data siswa lain (data minimization). `answerText` hasil ekstraksi aman dari `answer_json` (string; objek → JSON stringify terpotong; batas 4000 char).
  - `AiDraftProvider` interface + `createAiProvider()` memilih: `"mock"` (dev, menghasilkan teks deterministik ber-label, TANPA jaringan) / `"http"` (POST JSON ke base URL dengan key dari env; timeout 10s; gagal → error terswallow + log redact) / `null` saat unconfigured.
  - Label/penanda wajib: hasil selalu dibungkus `DRAFT AI — perlu persetujuan guru` di UI; `source/status` di DB.
- Aksi server `requestAiDraft({responseId})` & `approveAiDraft({draftId})` / `rejectAiDraft({draftId})` di `features/actions.ts` (strict client; **tidak ada fetch dari browser** — provider hanya dipanggil di server action; aksi guru di queue UI).

### 2.3 UI (grade queue)
- Per item queue: tombol **"Saran draf AI"** (kecil, jelas "draft", ikon/label teks bukan warna saja). Saat draft tersedia → panel "DRAFT AI — perlu persetujuan guru" berisi body + tombol **Setujui & pakai** / **Tolak**. Setuju → isi otomatis kolom feedback guru (draft) namun tetap butuh "Simpan nilai" guru? Keputusan D2.
- Aksesibel: label, focus, `role="status"`, state kosong "Fitur nonaktif / org belum consent" saat ditolak (dengan alasan).

## 3. Acceptance criteria (terukur)

| ID | Kriteria | Bukti |
|---|---|---|
| AC-1 | Fitur OFF default: tanpa env enable/consent, `requestAiDraft` menolak tanpa efek & tanpa jaringan | unit + integration + code review |
| AC-2 | Consent per-org (default false); hanya guru teacher aktif org bisa set via RPC; tercatat audit `org.ai_consent` | migration + integration + live-denial |
| AC-3 | Draft disimpan di tabel terpisah teacher-only; murid/anon **0 baris** (`ai_feedback_drafts`); no delete policy | RLS + live-denial t11 (opsional) |
| AC-4 | Body draft tidak pernah ditulis ke `responses.feedback_json` sebelum approval | integration (pemisahan kolom/status) |
| AC-5 | Prompt tidak memuat identitas murid/nilai/data siswa lain (buildPrompt murni, PII-strip, potong 4000) | unit |
| AC-6 | Provider hanya server-side (action); tidak ada `fetch`/import provider di file `use client`; secret key tak ber-NEXT_PUBLIC_ | integration statis + grep keamanan |
| AC-7 | Provider error → action gagal halus (alasan), log ter-redact (tanpa jawaban/PII/token) | unit/aksi + review |
| AC-8 | Approve → `responses.feedback_json` ter-update + `grade_revisions` reason `ai_draft:approved` + draft `approved` dalam satu transaksi | integration + live |
| AC-9 | UI queue: tombol draft + panel label jelas + Setujui/Tolak, state nonaktif/consent jelas; aksesibel | preview/snapshot (state (c)); DOM scan |
| AC-10 | Gates: unit/integration +N; typecheck/lint/format; `db:typecheck` 37 tables; build; e2e regresi; PROGRESS Phase 4 tanpa KURANG | log gate aktual |

## 4. State matrix

(a) **tanpa env AI** → fitur OFF; tombol di UI tampil nonaktif/alasan (server tetap menolak). (b) **env enable, tanpa provider/consent** → aksi menolak `AI_PROVIDER_UNCONFIGURED`/`AI_NO_CONSENT`, tidak ada jaringan keluar. (c) **backend hidup + consent + mock provider** → alur lengkap terverifikasi manual (`docs/e2e-setup.md`). (d) **provider HTTP nyata** → TIDAK diverifikasi di sandbox (butuh kredensial eksternal; dicatat, tidak diuji live). Mock = default pengujian.

## 5. Keputusan terbuka (calon ADR berikutnya — lanjut dari ADR-013)

- **D1 — Lokasi consent**: kolom `organizations.ai_feedback_consent` (paling sederhana, per-org, default false) vs tabel settings terpisah vs env global. Arah rencana: kolom org (kebijakan sekolah per SECURITY_PRIVACY.md) + env hanya gerbang global.
- **D2 — Alur approve**: (a) approve langsung menulis feedback final ke response (feedback guru otomatis = draft AI, transparan penanda) vs (b) approve hanya mengisi kolom draft editor guru yang masih bisa diedit sebelum simpan (guru kontrol penuh). Arah rencana: (b) — AI = saran, guru tetap menekan "Simpan" lewat alur `gradeResponse` yang sudah ada (revisi/audit tidak berubah).
- **D3 — Cakupan rubric suggestion**: masuk MVP (AI menyarankan skor per kriteria rubric) vs di luar (hanya feedback naratif). Arah rencana: **di luar MVP** (rubric UI belum dipakai; fokus draft feedback naratif; ADR tersendiri bila rubric aktif).
- **D4 — Provider**: interface adapter + `mock` default vs integrasi provider spesifik langsung. Arah: adapter (testability + tidak ada kredensial di repo).

## 6. Risiko

- **R1 Data minimization** — jawaban murid adalah data pribadi; prompt wajib tanpa identitas dan tanpa data siswa lain; batas panjang; konsentrasi pada teks jawaban (bukan metadata). Mitigasi: buildPrompt murni + unit PII-strip.
- **R2 Kebocoran draft sebelum approve** — mencegah murid membaca draft via `responses.feedback_json`. Mitigasi: tabel terpisah teacher-only + integration + live t11 (kalau ditambah).
- **R3 Provider tidak tersedia / error** — jangan menggagalkan grading manual. Mitigasi: catch + alasan + log redact; aksi tidak wajib.
- **R4 Drift definisi/penanda** — "draft AI" harus selalu jelas (AC-9). Mitigasi: penanda DB `source/status` + label UI konsisten + static test.
- **R5 Tanpa backend live di sandbox** — verifikasi UI penuh butuh backend (state (c)); mock menutup logika tanpa jaringan.

## 7. Test plan & gates

- **Unit** (`tests/unit/ai-feedback.test.ts`): buildPrompt PII-strip/batas; ekstraksi answerText berbagai `answer_json`; provider mock deterministik (tanpa jaringan); label draft.
- **Integration statis** (`tests/integration/ai-feedback.test.ts`): migration berisi kolom consent + tabel draft + RLS (tanpa policy murid) + rule no-delete + RPC definer/search_path/revoke-PUBLIC; `features/actions.ts` memuat urutan consent→provider→draft; tanpa `fetch`/provider di file client; `.env.example` memuat key AI (daftar sah check-env otomatis mengikuti).
- **Live-denial opsional `t11_*`**: murid 0 baris draft; guru org lain 0 baris; consent org-2 tak mengubah org-1 (ditambah setelah migration bila disetujui).
- **Gate**: unit+integration +N → test total 167+N; typecheck/lint/format; `db:typecheck` = 37 tables; `build`; e2e regresi 18/1; live-denial 48+N.

## 8. Urutan eksekusi

1. Migration `…000011` (kolom consent + tabel draft + RPC consent/upsert/apply + RLS + no-delete) → live-denial buktikan.
2. `lib/ai-feedback.ts` (murni) + unit.
3. Env + `.env.example` + `lib/env.ts` → check-env otomatis menangkap key baru (daftar sah dari contoh).
4. Aksi server request/approve/reject + integration statis.
5. UI queue (tombol draft + panel persetujuan) + state matrix (c) manual.
6. Gate penuh + PROGRESS.md Phase 4 tanpa KURANG (item analysis Phase 5 & persist PDF Phase 6 tetap track terpisah).

**Dokumen terkait**: DATA_MODEL.md, ASSESSMENT_AND_SCORING.md, SECURITY_PRIVACY.md, ADR-008 (role), ADR-012/013 (pola RPC + audit), checklist `docs/plan-checklist-kurang-item.md`.
