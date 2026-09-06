# Plan — Item analysis & misconception map (tutup KURANG Phase 5)

Status: **draf untuk review** — belum ada kode. Menutup sisa gap Phase 5
("Item analysis & misconception map: belum" di PROGRESS.md) sehingga Phase 5
tuntas. Acuan: `ANALYTICS.md` bagian "Insight keren" — *assessment item
analysis: difficulty, discrimination sederhana, omit rate* dan *misconception
map berdasarkan distractor terpilih*; serta aturan: metrik berversi, tampilkan
sample size & last updated, jangan ranking publik, sinyal explainable.
Pola kerja sama dengan `docs/plan-weekly-target-spaced-review.md`: fungsi murni
yang dapat direkonsiliasi dengan fixture raw (konsisten Prompt 07), lalu
permukaan UI teacher-only yang memakai RLS existing.

---

## Temuan konteks (memengaruhi desain)

1. **Tidak butuh migration/tabel/policy baru.** Baca lintas sudah tersedia:
   - `responses_owner_select` (init): guru cohort membaca `responses` milik
     enrollment di cohort-nya; `attempts_teacher_select` serupa. → Halaman item
     analysis cukup memakai `createClient()` (bukan service) dan RLS existing
     otomatis membatasi ke cohort sendiri. Tidak ada permukaan RLS baru yang
     harus diuji live (beda dengan rencana weekly targets yang menambah tabel).
   - `attempts.status` siklus `not_started → in_progress → submitted →
     auto_graded → needs_review → finalized`; item analysis harus mengabaikan
     attempt `not_started`/`in_progress` (responses di-insert saat in_progress).
   - Tipe soal objektif (lib/grading.ts): `single_choice`, `true_false`,
     `multiple_choice`; kunci benar ada di `grading_json`
     (`correctOptionId(s)`). Essay/file_manual/short_text/numeric tidak masuk
     distractor map.
2. **Pola analytics existing**: `lib/analytics.ts` = fungsi murni
   (`summarizeCohort`) + konstanta versi metrik `METRIC_DEFINITIONS_VERSION`
   ("jangan ubah makna grafik diam-diam"), dengan `tests/unit/analytics.test.ts`
   reconciliation. Ekstensi item analysis mengikuti pola yang sama
   (`lib/analytics-item.ts`), bukan query tersebar di page.
3. **Anchor UI**: dashboard guru (`app/(teacher)/teacher/page.tsx`) memuat
   link inline `/teacher/grading`, `/teacher/questions`, `/teacher/cohorts` →
   tambah `/teacher/analytics` + link. Export CSV ada di
   `GET /api/teacher/export?cohortId=…` (strict client, rate-limit, cek
   kepemilikan cohort eksplisit, `lib/csv` anti formula-injection) → ekstensi
   item export via param `kind` (D2).
4. **Data soal**: `questions(prompt_json, explanation_json, difficulty)` +
   `question_versions(grading_json, points)`. Opsi soal & label distractor
   dibaca dari `prompt_json`/`grading_json` bila ada; label "miskonsepsi" per
   opsi hanya muncul bila author menyediakan metadata (D1) — MVP menampilkan
   distribusi pilihan + siapa memilihnya, bukan label AI.

---

## 1. Definisi metrik (deterministik, berversi)

Ruang lingkup tiap item = **responses soal objektif pilihan** (`single_choice`,
`true_false`, `multiple_choice`) pada attempt yang **bukan**
`not_started`/`in_progress`, dalam assessment terpilih (default: seluruh
attempt finalized dari cohort). Tiap metrik menyertakan `n` dan `null` saat
`n` terlalu kecil (guard anti-noise cohort kecil, ANALYTICS.md "sample size").

- **Difficulty** `p` = jawaban benar / total responses (0–1). Rendah = sulit.
- **Omit rate** = responses tanpa jawaban (`answer_json` kosong/null) / total.
- **Discrimination sederhana (upper–lower)** = `p` kelompok atas − `p` kelompok
  bawah, kelompok dibentuk dari skor total assessment attempt (top vs bottom
  tercile, min `n ≥ 3` per kelompok; di bawah itu → `null`). Positif = item
  membedakan; ≤ 0 = mencurigakan.
- **Distractor share** = untuk tiap opsi salah (selain kunci), proporsi
  pemilihnya **di antara yang salah** + daftar murid pemilih. Ini bahan
  misconception map: cluster distractor yang paling sering dipilih kelompok
  skor bawah (bukan sekadar hitungan global) — explainable, tanpa ranking
  publik.

Konstanta versi baru `ITEM_METRIC_DEFINITIONS_VERSION = "2026-09-06/v2"` (atau
tanggal implementasi) di `lib/analytics-item.ts`; UI menampilkan versi + waktu
perhitungan (last updated).

## 2. Fungsi murni (`lib/analytics-item.ts`, baru)

Input baris *flattened* hasil query page (bukan query di dalam fungsi):

```ts
interface ItemResponseRow {
  questionId: string;        // id soal (bukan version) untuk agregasi antar-version
  questionVersionId: string;
  attemptId: string;
  studentId: string;
  displayName: string;
  questionType: "single_choice" | "true_false" | "multiple_choice";
  promptText: string;        // teks opsi tersedia
  correctOptionIds: string[]; // dari grading_json versi tsb
  chosenOptionIds: string[];  // hasil parse answer_json (defensif)
  autoScore: number;          // 0 bila salah/belum
  attemptStatus: string;
  assessmentTotalPct: number; // skor attempt utk bucket atas/bawah
}
```

- `itemStatistics(rows, opts: { minGroupN?: number })` → per `questionId`:
  `{ n, correct, pct, omit, discr | null, answerableQuestions… }`.
- `distractorMap(rows)` → per `questionId`: per opsi salah terpilih
  `{ optionId, label, pickedIncorrect, shareOfIncorrect, studentIds[] }`,
  diurut share turun; hanya opsi yang benar-benar dipilih.
- `bucketRows(rows)` internal: top/bottom tercile by `assessmentTotalPct`.
- Semua murni + deterministik (urutan stabil: opsi id, student id) agar bisa
  direkonsiliasi dari fixture raw, gaya `tests/unit/analytics.test.ts`.

## 3. Read path & permission (tanpa policy baru)

- Halaman server `app/(teacher)/teacher/analytics/page.tsx`
  (`force-dynamic`, di dalam route group `(teacher)` yang sudah di-guard
  `requireActiveMembership(["teacher"])`); query paralel:
  cohort milik guru (`cohorts.eq(teacher_id, userId)`, pola dashboard),
  lalu `attempts` (status non-draft) → `responses` → `question_versions` →
  `questions` dalam cohort terpilih; perakit baris flattened **hanya di luar
  loop** (hindari pola N+1 dashboard).
- RLS membatasi otomatis; tetap ada cek eksplisit kepemilikan cohort
  (defense-in-depth, pola export route) walau RLS sudah menjamin.
- Filter UI: pilih cohort + pilih assessment; default cohort pertama.
- Tidak memakai `createStrictClient`/service: read-only halaman memakai
  `createClient()` — RLS yang memutuskan; tak ada jawaban/kunci bocor ke murid
  (halaman di bawah guard guru).

## 4. UI (teacher-only, aksesibel)

Route `/teacher/analytics` (link baru di dashboard guru):
- Pilih cohort & assessment (dropdown/select ber-label).
- Tabel **item analysis**: per soal — prompt singkat (kolom), tipe, `n`,
  difficulty %, omit %, discrimination index (bila `n` cukup), dengan
  tooltip/teks definisi (bukan warna satu-satunya pembeda).
- Panel **misconception map** untuk soal pilihan: per distractor terpilih —
  label opsi, jumlah & % di antara yang salah, daftar murid; ditekan urutan
  share; catatan "berdasarkan pilihan jawaban, bukan diagnosis".
- Label sample size + last updated + versi definisi metrik di kaki panel;
  empty state saat tak ada attempt.
- Aksesibilitas & responsif mengikuti konvensi; tanpa backend → state kosong
  demo (halaman guarded) sama seperti halaman guru lain.

## 5. Export CSV (opsional, D2)

Ekstensi `app/api/teacher/export/route.ts` dengan param
`kind=item-analysis&cohortId=…&assessmentId=…` memakai `lib/analytics-item.ts`
+ `toCsv` (tetap anti formula-injection, rate-limit, cek cohort milik guru).
Di luar MVP bila ingin meminimalkan permukaan.

## 6. Tests

- `tests/unit/analytics-item.test.ts` (baru): p/discr/omit pada fixture
  sintetis (termasuk batas `minGroupN` → null, cohort kecil); distractor
  grouping (single_choice & true_false; multiple_choice memilih salah satu
  dari kunci; siswa kosong jawaban tidak masuk distractor); determinisme
  urutan; reconciliation: hasil agregasi == hitung manual dari baris raw.
- `tests/unit/analytics.test.ts` existing tidak berubah (metrik lama beku —
  ADR/aturan versi).
- `tests/integration/analytics-item.test.ts` (baru, statis): halaman
  `force-dynamic` + hanya `.from(...)` tabel yang punya policy guru
  (attempts/responses/question_versions/questions/cohorts); tidak ada
  `.from` tabel privat; tanpa service client; teks guard `["teacher"]`.
- Live-denial: tidak ada tabel/policy baru; **opsional** `t10_*` membuktikan
  pola agregasi read (join responses via attempts) mengembalikan 0 baris untuk
  cohort/org lain (fixture org-2). Bila di-skip, catat alasan di PROGRESS.md.
- E2E: `/teacher/analytics` render empty state demo + link dari dashboard
  (dengan backend: data live — terbatas sama seperti fase lain).

## 7. Acceptance criteria (terukur, jadi checklist saat implementasi)

| ID | Kriteria | Bukti |
|---|---|---|
| AC-1 | Difficulty `p` = benar/total pada attempt non-draft; omit dihitung dari jawaban kosong | unit + reconciliation |
| AC-2 | Discrimination upper–lower dari skor total attempt; `null` saat `minGroupN` tak terpenuhi | unit batas |
| AC-3 | Distractor map: distribusi opsi salah + murid pemilih, urut share, tanpa siswa tanpa jawaban | unit grouping |
| AC-4 | Fungsi murni deterministik & versi definisi metrik baru diekspor | unit + konstanta |
| AC-5 | Read path hanya tabel ber-policy guru; tanpa service client; guard `["teacher"]`; cek kepemilikan cohort eksplisit | integration + code |
| AC-6 | Halaman menampilkan n, sample size, last updated, versi; tidak ada ranking publik; warna bukan satu-satunya pembeda | preview/snapshot + review |
| AC-7 | Filter cohort+assessment berfungsi; empty state saat tanpa attempt | snapshot/preview |
| AC-8 | Export (bila dalam scope) mengikuti permission & filter UI + anti-injection | integration/unit csv |
| AC-9 | Gates: unit/integration +N, typecheck/lint/format, `db:typecheck` (tetap 36 tables — tanpa migration), `build`, e2e 18+/1; live-denial 38/38 (atau 38+N bila t10 masuk) | log gate aktual |
| AC-10 | PROGRESS.md Phase 5 tanpa "belum"; CHANGELOG draf diperbarui | diff |

## 8. Keputusan terbuka (jadikan ADR saat implementasi)

- **D1 — Label miskonsepsi**: MVP menampilkan distribusi distractor + murid
  (bukti perilaku), bukan klaim diagnosis; label "miskonsepsi X" per opsi hanya
  bila authoring menyediakan metadata opsi — tanpa itu, frasa UI
  "pilihan jawaban, bukan diagnosis".
- **D2 — Scope export**: `kind=item-analysis` di route export existing vs
  halaman saja di MVP.
- **D3 — Metode discrimination**: upper–lower tercile (transparan, "sederhana"
  sesuai spec) vs point-biserial; tercile default.
- **D4 — `multiple_choice`**: sebagian benar (subset kunci) dihitung salah
  untuk statistik item MVP (konsisten `autoGrade` exact-match), dicatat agar
  tidak berubah diam-diam.

## 9. Risiko

1. **Cohort kecil** → statistik berisik: tampilkan `n`, suppress
   discrimination < `minGroupN`, hindari klaim absolut.
2. **Drift definisi**: metrik baru wajib konstanta versi + reconciliation test
   (aturan ANALYTICS.md).
3. **`answer_json` bentuk bebas** (string vs array vs null): parse defensif di
   perakit baris, distractor hanya untuk pilihan diskret; numeric/teks/esai
   eksplisit di luar scope halaman.
4. **N+1 read**: dashboard guru existing ber-loop per murid; halaman baru wajib
   batch query agar tidak meniru pola itu.
5. **Tanpa backend live**: UI hanya terverifikasi state kosong; hasil data
   penuh menunggu Supabase lokal (keterbatasan sama seperti fase lain,
   terdokumentasi di PROGRESS.md).
