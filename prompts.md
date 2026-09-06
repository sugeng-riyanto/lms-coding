# Standard Prompt Playbook — Autonomous Learning LMS

Dokumen ini berisi prompt siap salin untuk OpenCode, Freebuff, atau coding agent lain. Jalankan prompt secara berurutan. Jangan menjalankan beberapa fase besar sekaligus sebelum fase sebelumnya terverifikasi.

## Cara menggunakan

1. Buka terminal pada root repository.
2. Jalankan agent.
3. Kirim **Prompt 00** satu kali pada awal proyek.
4. Jalankan Prompt 01–12 secara berurutan.
5. Setelah setiap fase, jalankan **Prompt Verifikasi Fase**.
6. Gunakan prompt pemulihan jika agent berhenti, kehilangan konteks, atau menghasilkan error.

Variabel yang dapat diganti:

```text
{{APP_NAME}}       = Autonomous Learning LMS
{{SCHOOL_NAME}}    = nama sekolah/lembaga
{{TIMEZONE}}       = Asia/Jakarta
{{DEFAULT_PASS}}   = 70
{{DEPLOY_TARGET}}  = Vercel/Cloudflare/target lain
```

---

## Prompt 00 — Bootstrap dan kontrak kerja

```text
Anda adalah lead full-stack engineer untuk {{APP_NAME}}.

Baca AGENTS.md, README.md, MASTER_PROMPT.md, dan seluruh file Markdown di root repository sebelum menulis kode. Perlakukan dokumen tersebut sebagai source of truth dengan urutan prioritas yang dijelaskan di README.md.

Tugas awal:
1. Audit isi repository, branch, status Git, runtime, package manager, dan tool yang tersedia.
2. Jangan menghapus atau menimpa pekerjaan yang sudah ada.
3. Buat ringkasan requirements, dependency antarfase, risiko, dan keputusan yang masih terbuka.
4. Perbarui PROGRESS.md berdasarkan kondisi aktual; jangan menandai fitur selesai tanpa bukti.
5. Pastikan stack mengikuti arsitektur yang telah dikunci.
6. Verifikasi API dan paket terhadap dokumentasi resmi terbaru sebelum digunakan.
7. Gunakan local Supabase bila credential production belum tersedia.
8. Jangan meminta, mencetak, atau menyimpan secret dalam repository.
9. Jangan berhenti pada mockup. Setiap fase harus menjadi vertical slice yang benar-benar berfungsi.

Tampilkan audit dan rencana Phase 0. Jangan mengimplementasikan fase lain sebelum Phase 0 terverifikasi.
```

## Prompt 01 — Foundation dan developer experience

```text
Kerjakan Phase 0 dari IMPLEMENTATION_PLAN.md.

Bangun foundation production-oriented:
- Next.js App Router dan TypeScript strict;
- Tailwind CSS dan komponen UI yang aksesibel;
- struktur feature-based sesuai ARCHITECTURE.md;
- lint, formatter, typecheck, unit test, component test, dan Playwright;
- Supabase local configuration;
- environment validation dan .env.example tanpa secret;
- CI untuk clean install, lint, typecheck, tests, dan production build;
- responsive application shell untuk public, student, dan teacher;
- timezone default {{TIMEZONE}} dan penyimpanan timestamp UTC.

Gunakan package versions yang kompatibel dan lockfile. Jangan menambahkan library yang belum dibutuhkan.

Tambahkan halaman health/readiness lokal dan error boundary dasar. Buat seed placeholder anonim, tetapi jangan membangun schema fitur sebelum Phase 1.

Setelah implementasi:
1. Jalankan lint, typecheck, tests, dan production build.
2. Perbaiki root cause semua kegagalan dalam scope.
3. Perbarui PROGRESS.md dengan command dan hasil aktual.
4. Laporkan file berubah, keputusan, risiko tersisa, dan bukti exit criteria Phase 0.
```

## Prompt 02 — Auth, organisasi, cohort, dan RBAC

```text
Kerjakan Phase 1 sesuai DATA_MODEL.md, RBAC.md, dan SECURITY_PRIVACY.md.

Implementasikan:
- Supabase Auth menggunakan pola SSR resmi terbaru;
- organizations, profiles, memberships, cohorts, cohort_members, dan guardian_links;
- role Owner/Guru, Murid, serta Wali opsional;
- route guards dan server-side permission helpers;
- RLS pada semua tabel exposed;
- authorization berdasarkan organization dan hubungan aktual;
- halaman login, logout, unauthorized, account inactive, dan profile minimal;
- seed anonim: satu guru, satu cohort, tiga murid;
- audit log untuk perubahan role dan membership.

Aturan keamanan wajib:
- role tidak berasal dari user_metadata;
- service/secret key tidak pernah masuk browser;
- TO authenticated tidak boleh menjadi satu-satunya authorization;
- UPDATE policy wajib USING dan WITH CHECK;
- fungsi privileged berada di schema private, memvalidasi caller, menetapkan search_path, dan tidak executable oleh PUBLIC;
- server Supabase client dibuat per request.

Buat denial tests untuk seluruh skenario RBAC.md. Buktikan Murid A tidak dapat mengakses Murid B dan Guru A tidak dapat mengakses organisasi lain.

Jalankan migration workflow, advisors/security checks yang tersedia, tests, dan build. Perbarui PROGRESS.md dan DECISIONS.md bila ada keputusan baru.
```

## Prompt 03 — Course authoring, versioning, dan enrollment

```text
Kerjakan Phase 2.

Implementasikan hierarchy:
Course → Level → Module → Lesson → Activity → Assessment.

Bangun teacher authoring untuk create, edit draft, reorder, preview-as-student, validate, publish, duplicate, dan archive. Published content yang telah dipakai attempt tidak boleh diedit in-place; perubahan membuat course/content version baru.

Activity MVP:
- article;
- video link;
- resource download;
- reflection;
- quiz;
- assignment upload;
- Roblox challenge link.

Gunakan structured content blocks yang di-allowlist dan disanitasi; jangan menerima HTML arbitrer. Implementasikan cohort enrollment, enrollment status, student catalog, serta level map.

Validation sebelum publish harus mendeteksi objective kosong, urutan rusak, point total tidak valid, answer key hilang, accessibility field hilang, dan prerequisite cycle.

Tambahkan RLS serta tests sehingga hanya pemilik/teacher authorized dapat mengelola course, dan hanya murid dengan enrollment aktif dapat membaca versi published.

Jalankan semua quality gates dan catat bukti di PROGRESS.md.
```

## Prompt 04 — Learning player, progress, dan offline recovery

```text
Kerjakan Phase 3 berdasarkan LEARNING_ENGINE.md dan STUDENT_EXPERIENCE.md.

Implementasikan:
- dashboard murid personal;
- Continue Learning dari posisi terakhir;
- level map locked/available/in-progress/completed;
- lesson player: objective, material, worked example, practice, reflection;
- learning_events append-only dengan client_event_id idempotent;
- progress_snapshots yang dapat dihitung ulang;
- autosave draft dengan indikator saving/saved/offline/error;
- retry queue untuk event offline tanpa duplikasi;
- prerequisite dan unlock server-authoritative;
- target mingguan, spaced review, confidence check, dan next-best-action dengan alasan;
- accessible navigation, transcript field, reduced motion, dan font scaling.

Jangan menghitung waktu belajar hanya dari halaman terbuka. Gunakan heartbeat terbatas, visibility/activity signals, active-time clamping, dan server validation.

Buat tests untuk refresh recovery, duplicate event, reconnect, prerequisite, recompute projection, dan akses enrollment.

Jalankan semua quality gates dan perbarui PROGRESS.md.
```

## Prompt 05 — Question bank, quiz, dan automatic scoring

```text
Kerjakan bagian objective assessment pada Phase 4 sesuai ASSESSMENT_AND_SCORING.md.

Implementasikan question bank dan versioned questions untuk:
- single choice;
- multiple choice;
- true/false;
- numeric dengan absolute/relative tolerance dan unit normalization;
- short text dengan explicit normalization rules.

Bangun assessment builder, point validation, randomized pool/order dengan server-generated reproducible seed, attempt limit, cooldown, timer server-side, draft answer autosave, submit idempotency, dan release policy.

Answer key dan explanation rahasia tidak boleh dikirim ke client sebelum release policy. Browser tidak boleh menentukan score. Grading, competency evidence, progress update, dan eligibility evaluation dijalankan pada trusted server secara transactional/idempotent.

Buat fixtures dengan expected score yang dihitung manual. Test boundary numeric tolerance, multiple-choice partial-credit policy, duplicate submit, deadline race, dan forged client score.

Jalankan tests, build, dan perbarui PROGRESS.md.
```

## Prompt 06 — Essay, project, rubric, dan grade revision

```text
Lanjutkan Phase 4 untuk manual assessment.

Implementasikan:
- essay dan file/project submission;
- private Storage bucket dengan MIME, size, ownership, dan path validation;
- moderation/grading queue;
- versioned rubric dan criteria;
- per-criterion score dan feedback;
- draft grade, finalize, dan release;
- immutable attempt/submission evidence;
- grade_revisions dengan previous score, new score, reason, actor, timestamp;
- audit event untuk setiap perubahan final grade.

Storage upsert hanya boleh dilakukan jika INSERT, SELECT, dan UPDATE policy benar; lebih baik gunakan immutable file path per submission version. Signed URL harus short-lived dan dibuat setelah permission check.

AI hanya boleh memberi draft feedback atau rubric suggestion yang ditandai jelas dan wajib disetujui guru. Jangan mengirim data murid ke provider AI tanpa konfigurasi consent.

Buat allow/deny tests untuk upload, download, grading, revision, dan cross-student access. Jalankan quality gates dan perbarui PROGRESS.md.
```

## Prompt 07 — Teacher dashboard dan learning analytics

```text
Kerjakan Phase 5 sesuai TEACHER_DASHBOARD.md dan ANALYTICS.md.

Bangun:
- overview cards: enrolled, active, on-track, needs-attention, pending grading;
- progress distribution;
- competency mastery heatmap;
- cohort matrix dengan drill-down;
- student timeline, attempt history, evidence, feedback, dan certificate history;
- misconception map dari distractor;
- item analysis;
- learning-path bottleneck;
- transparent alerts yang dapat acknowledge, snooze, dan resolve;
- CSV export aman dari formula injection;
- teacher weekly action digest.

Setiap metrik harus memiliki definisi eksplisit, sample size, last-updated, dan dapat direkonsiliasi dengan fixture raw data. Jangan membuat public student ranking. Warna bukan satu-satunya pembeda status.

Gunakan database query/view yang aman. View exposed harus security_invoker atau ditempatkan di schema yang tidak terekspos. Hindari N+1 dan subscription Realtime berlebihan; sediakan polling fallback.

Buat reconciliation tests dan authorization tests untuk filter, drill-down, serta export. Jalankan quality gates dan perbarui PROGRESS.md.
```

## Prompt 08 — Sertifikat PDF A4, QR, dan revocation

```text
Kerjakan baseline Phase 6 berdasarkan CERTIFICATE_VERIFICATION.md. Jangan aktifkan blockchain dahulu.

Implementasikan:
- server-side eligibility evaluator;
- idempotent issuance;
- canonical deterministic payload;
- SHA-256 payload hash;
- A4 landscape PDF certificate yang rapi;
- QR menuju HTTPS /verify/{public_id};
- private Storage untuk PDF;
- authorized short-lived download;
- public verification page dengan minimum disclosure;
- certificate status active/revoked/reissued;
- revocation reason internal dan audit event;
- reissue yang mempertahankan sejarah.

PDF berisi issuer, recipient display name dengan consent, course, level, date, serial, signature area, QR, dan short fingerprint. Jangan menampilkan nilai detail kecuali ada requirement baru yang disetujui.

Test determinism, tampered payload, guessed public IDs, duplicate issuance, failed PDF job retry, revocation, reissue, dan public data minimization. Render PDF dan lakukan visual inspection pada ukuran A4 sebelum menyatakan selesai.

Jalankan quality gates dan perbarui PROGRESS.md.
```

## Prompt 09 — Blockchain anchoring opsional

```text
Implementasikan blockchain anchoring sebagai adapter opsional setelah baseline certificate lulus seluruh test.

Sebelum memilih provider/network:
1. Tulis ADR yang membandingkan no-chain, public low-cost chain, dan permissioned ledger.
2. Evaluasi biaya, finality, uptime, vendor lock-in, regulasi, privacy, dan operasional.
3. Minta keputusan manusia jika provider/network belum ditetapkan. Jangan mengarang credential atau transaksi.

Implementasikan interface anchor(rootHash), getStatus(reference), dan verify(rootHash, reference). Batch certificate hashes menjadi Merkle root agar biaya rendah. Simpan hanya hash/root dan transaction reference—tidak ada nama, email, nilai, student ID, jawaban, atau PDF.

Feature flag BLOCKCHAIN_ANCHOR_ENABLED default false. UI harus membedakan record valid, payload hash valid, anchor pending, anchor final, dan anchor failed. Jangan menampilkan blockchain verified sebelum finality terpenuhi.

Sediakan mock adapter untuk tests. Test Merkle proof, duplicate anchoring, provider timeout, retry, reorg/finality state jika relevan, dan fallback verification ketika provider unavailable.
```

## Prompt 10 — Integrasi Roblox yang aman

```text
Implementasikan integrasi Roblox bertahap sesuai STUDENT_EXPERIENCE.md dan API_CONTRACTS.md.

Tahap A:
- activity menyimpan Roblox place/share link, instruction, objective, expected evidence, dan reflection;
- tombol membuka Roblox dengan web fallback;
- completion manual atau teacher verified.

Tahap B hanya jika server integration tersedia:
- signed completion endpoint;
- event_id dan nonce unik;
- timestamp expiry window;
- replay protection;
- rate limit;
- mapping Roblox user ke enrollment berdasarkan explicit consent;
- append-only integration receipt;
- score dan completion tetap divalidasi server LMS.

Jangan percaya LocalScript/client report. Jangan memasukkan LMS secret ke Roblox client. Jangan menggunakan iframe untuk mengklaim menjalankan experience Roblox di website.

Test invalid signature, expired event, reused nonce, unknown user mapping, cross-course challenge, forged score, dan valid retry idempotent. Perbarui threat model serta PROGRESS.md.
```

## Prompt 11 — Accessibility, security, dan performance hardening

```text
Kerjakan Phase 7 hardening.

Audit dan perbaiki:
- keyboard-only flows, focus order, labels, error announcements, contrast, reduced motion;
- responsive layout 360px, tablet, dan 1440px;
- loading, empty, offline, forbidden, not-found, conflict, dan server-error states;
- CSP, secure headers, output encoding, CSRF/session pattern, rate limiting;
- secret scanning, dependency audit, logging redaction, upload protection;
- RLS and Storage policies;
- N+1 queries, oversized payloads, images, client bundles, Realtime subscriptions;
- job retry/dead-letter behavior;
- backup and restore procedure.

Gunakan profiler dan test data realistis. Jangan menyatakan cepat hanya berdasarkan localhost tanpa pengukuran. Catat metric sebelum/sesudah dan known limitations.

Jalankan lint, typecheck, seluruh tests, production build, database advisors, accessibility scan, dan manual smoke tests. Perbarui PROGRESS.md serta runbooks.
```

## Prompt 12 — Deployment dan release readiness

```text
Siapkan deployment mengikuti DEPLOYMENT.md untuk {{DEPLOY_TARGET}}.

Jangan melakukan production deployment atau mengubah external resource tanpa otorisasi eksplisit. Siapkan terlebih dahulu:
- environment matrix dan validated .env.example;
- migration order dan rollback/forward-fix plan;
- preview deployment procedure;
- CI/CD gates;
- seed policy tanpa real student data;
- domain/HTTPS requirements;
- Storage configuration;
- scheduled/background job configuration;
- monitoring, alerting, backup, restore, and incident runbooks;
- release checklist dan smoke-test script.

Audit seluruh ACCEPTANCE_CRITERIA.md. Untuk setiap checkbox, berikan bukti test, file, atau command. Jangan menandai item lulus hanya karena implementasi terlihat ada.

Kelompokkan hasil menjadi:
1. Ready;
2. Ready with documented limitation;
3. Blocked by external configuration;
4. Failed and must be fixed.

Perbaiki seluruh kegagalan internal yang masih dalam scope, jalankan full verification dari clean install, dan perbarui PROGRESS.md.
```

---

## Prompt Verifikasi Fase

Gunakan setelah setiap fase:

```text
Verifikasi fase yang baru dikerjakan secara independen terhadap dokumen requirements dan exit criteria.

1. Periksa diff dan daftar file berubah.
2. Petakan setiap requirement fase ke bukti implementasi dan test.
3. Jalankan lint, typecheck, tests relevan, dan production build.
4. Jika database berubah, jalankan migration checks, RLS denial tests, dan advisors.
5. Uji happy path, boundary, unauthorized path, failure/retry, dan data isolation.
6. Cari mock, TODO, hard-coded identity/score, disabled test, swallowed error, exposed secret, atau claim tanpa bukti.
7. Perbaiki masalah material dalam scope dan jalankan ulang verifikasi.
8. Perbarui PROGRESS.md hanya dengan hasil aktual.

Keluarkan tabel: Requirement | Evidence | Test | Status | Remaining Risk.
Jangan melanjutkan fase berikutnya bila exit criteria belum terpenuhi.
```

## Prompt Melanjutkan Sesi Baru

```text
Lanjutkan proyek ini tanpa mengulang pekerjaan yang telah selesai.

Baca AGENTS.md, seluruh dokumen root, PROGRESS.md, DECISIONS.md, git status, dan recent commits. Verifikasi bahwa klaim terakhir di PROGRESS.md masih cocok dengan repository dan test aktual.

Identifikasi fase aktif, pekerjaan selesai, pekerjaan parsial, blockers, dan langkah terkecil berikutnya. Jangan mengubah scope atau menghapus perubahan yang tidak Anda buat. Lanjutkan dari langkah belum selesai sampai exit criteria fase aktif terpenuhi, kemudian jalankan Prompt Verifikasi Fase.
```

## Prompt Pemulihan Error

```text
Diagnosis kegagalan ini berdasarkan bukti, bukan tebakan.

1. Reproduksi dengan command terkecil yang relevan.
2. Simpan pesan error lengkap tetapi redact token/PII.
3. Tentukan layer: environment, dependency, build, application, auth, RLS, database, storage, network, test, atau deployment.
4. Temukan root cause dari logs, diff, schema, dan dokumentasi resmi terbaru.
5. Usulkan fix paling kecil yang menjaga requirements dan keamanan.
6. Terapkan fix, tambah regression test, lalu jalankan verification terkait.
7. Jika 2–3 pendekatan serupa gagal, berhenti mengulang dan evaluasi asumsi/pendekatan lain.
8. Perbarui PROGRESS.md dengan root cause dan bukti hasil.

Jangan menonaktifkan security, RLS, type checking, lint, atau test untuk membuat error menghilang.
```

## Prompt Audit Keamanan Sebelum Data Murid

```text
Lakukan audit read-only sebelum sistem menerima data murid nyata.

Periksa auth, session verification, role source, RLS seluruh exposed tables, Storage policies, IDOR/BOLA, answer-key exposure, score manipulation, upload validation, CSV injection, public verifier disclosure, QR enumeration, logs, secrets, retention, audit trail, guardian access, and certificate revocation.

Jalankan denial tests dengan minimal dua organisasi, dua guru, dua cohort, dua murid berbeda, satu wali linked, satu wali unlinked, dan anonymous user.

Klasifikasikan findings Critical/High/Medium/Low dengan evidence, impact, reproduction, dan recommended remediation. Jangan mengubah production code dalam mode audit ini. Nyatakan NO-GO jika ada Critical/High yang belum diperbaiki.
```

## Prompt Membuat Konten Level Baru

```text
Buat draft konten untuk satu level pembelajaran melalui authoring model yang tersedia, bukan hard-code UI.

Input:
- Course: {{COURSE}}
- Level: {{LEVEL}}
- Usia/kelas: {{GRADE}}
- Durasi: {{DURATION}}
- Kompetensi: {{COMPETENCIES}}
- Passing score: {{DEFAULT_PASS}}

Hasil harus memiliki objective terukur, prerequisite, lesson sequence, worked examples, misconception, formative checks, summative assessment, rubric bila diperlukan, remedial, enrichment, reflection, dan estimated time.

Semua konten AI tetap draft dan membutuhkan teacher approval. Sertakan source/provenance field dan jangan mengarang fakta yang memerlukan sumber. Jalankan publish validation tetapi jangan publish tanpa persetujuan guru.
```

## Prompt Final Release Audit

```text
Lakukan final release audit dari clean checkout/install.

Verifikasi seluruh ACCEPTANCE_CRITERIA.md, RBAC denial matrix, learning calculations, score fixtures, certificate visual PDF, QR verifier, revocation, mobile responsiveness, accessibility, performance, privacy, backup/restore, and operational runbooks.

Jalankan full automated suite dan catat exact commands serta exit results. Audit client bundle dan logs untuk secret, answer key, email, nilai, atau PII. Pastikan BLOCKCHAIN_ANCHOR_ENABLED=false kecuali provider telah dipilih, credential aman tersedia, dan end-to-end chain tests lulus.

Buat release report dengan:
- version/commit;
- passed criteria;
- failed criteria;
- known limitations;
- external blockers;
- rollback plan;
- GO/NO-GO recommendation.

Jangan deploy sampai manusia memberi otorisasi eksplisit.
```

