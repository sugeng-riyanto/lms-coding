# Plan — Target mingguan & spaced review (tutup KURANG Phase 3)

Status: **draf untuk review** — belum ada kode. Scope dipilih dari daftar KURANG
Phase 3–7 di PROGRESS.md karena: (1) menutup gap **terakhir** Phase 3 sehingga
phase tuntas, (2) murni self-contained (logika scheduling/rollup adalah fungsi
murni, teruji tanpa Supabase live), (3) tidak bergantung pada consent config
(Phase 4), bucket storage (Phase 6), atau Supabase CLI (Phase 7), dan (4)
memakai ulang mesin yang sudah ada: `recomputeProgress`, `computeUnlock`,
`nextBestAction`, `detectRisk`, RLS `progress_*` sebagai pola.

Referensi spesifikasi: `LEARNING_ENGINE.md` (target mingguan personal; retrieval
practice 1/3/7/14 hari, interval dapat dikonfigurasi; confidence check; grace
day untuk streak), `STUDENT_EXPERIENCE.md` (sapaan, target hari ini, tombol
"Lanjutkan"), `prompts.md` Prompt 04, `DATA_MODEL.md`, `RBAC.md`.

---

## Temuan konteks (memengaruhi desain)

1. `study_sessions` **belum punya write path** di `features/actions.ts` — hanya
   `learning_events` yang ditulis (upsert idempotent `client_event_id`).
   RLS-nya sudah ada (student RW enrollment sendiri, teacher select cohort).
   → Target mingguan berbasis *menit* belum bisa jujur diukur; MVP memakai
   **unit completions** (transisi `progress_snapshots` → `completed`), menit
   jadi ekstensi setelah write path sesi hadir (lihat D1).
2. Helper `private.*` security-definer + RLS-subquery langsung adalah sumber bug
   live (migration 000008: recursion cycle, EXECUTE grants). → Semua policy
   baru memakai helper `private.*` yang di-grant ke `authenticated`, dan
   langsung dicakup live-denial — bukan hanya test statis.
3. Konvensi: migration manual `YYYYMMDDHHMMSS_*.sql` (berikutnya
   `20260906000009_learning_planning.sql`); tiap tabel exposed wajib RLS;
   `db-advisor` memindai semua migration; UTC tersimpan, tampil timezone org
   (`lib/time.ts`, Asia/Jakarta).

---

## 1. Data model (2 tabel baru, no hard delete)

### `weekly_plans`
Target mingguan **per enrollment** (student-dalam-course), unik per
`(enrollment_id, week_start)`.

```sql
create table public.weekly_plans (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id),
  week_start    date not null,          -- Senin minggu ISO, timezone org
  goal_unit     text not null default 'completions'
                check (goal_unit in ('completions','minutes')),
  goal_value    int  not null default 3
                check (goal_value between 1 and 50),
  status        text not null default 'active'
                check (status in ('active','completed','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (enrollment_id, week_start)
);
```

- `week_start` dihitung dari timezone org (bukan server UTC) lalu disimpan
  sebagai `date`; rollup pakai `progress_snapshots.updated_at` dalam rentang
  minggu org.
- Baris default dibuat lazy (get-or-create di server code saat dashboard dibaca
  atau saat level pertama minggu itu selesai) — bukan trigger, agar migration
  tetap sederhana dan perilakunya dapat diuji (keputusan D4).

### `review_items`
Antrian retrieval practice per `(enrollment, entity)`; **satu baris scheduled
aktif** per entitas.

```sql
create table public.review_items (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id),
  entity_type   text not null check (entity_type in ('level')),
  entity_id     uuid not null,
  due_at        timestamptz not null,
  interval_idx  int  not null default 1 check (interval_idx >= 1),
  status        text not null default 'scheduled'
                check (status in ('scheduled','completed','dismissed')),
  confidence    int check (confidence between 1 and 5),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index review_items_one_active
  on public.review_items (enrollment_id, entity_type, entity_id)
  where status = 'scheduled';
```

- `entity_type` dibatasi `'level'` di MVP; ekstensi `lesson`/`assessment` = D2.
- Status hanya maju `scheduled → completed|dismissed`; tidak ada DELETE
  (konsisten kebijakan append-only yang sudah ada di DATA_MODEL.md).
- Update `DATA_MODEL.md` dengan kedua tabel + constraint.

## 2. Algoritma (fungsi murni di `lib/progress-planning.ts`)

- `isoWeekStart(ts, tz)` — Senin minggu ISO dalam timezone org, kembali `date`.
- `weeklyRollup({ goal, completedIdsThisWeek }) → { count, goal, pct, status }`
  — completions = jumlah `progress_snapshots` yang bertransisi ke `completed`
  pada minggu berjalan; `pct` di-clamp 0–100.
- `nextReviewAfter(intervalIdx, confidence, intervals)` — ladder default
  `[1, 3, 7, 14]` (LEARNING_ENGINE.md):
  - confidence ≥ 4 → `intervalIdx+1` (cap di 14, lalu tetap 14);
  - confidence = 3 → interval sama (ulang);
  - confidence ≤ 2 → reset ke idx 1;
  - `due_at = now + intervals[idx] hari` (UTC), waktu tampil org.
- `orderedReviewQueue(items)` — overdue > due hari ini > upcoming terdekat,
  lalu `mastery` terendah (tie-break konsisten `nextBestAction`).
- Interval "dapat dikonfigurasi": konstanta `DEFAULT_REVIEW_INTERVALS_DAYS`
  diekspor; override per-org ditunda (D2) tanpa mengubah bentuk data.

## 3. Hook scheduling (server-side)

- Saat `recomputeProgress` menandai sebuah level `completed` (idempotent),
  sisipkan baris `review_items` pertama (`due = now + 1 hari`) **hanya bila
  belum ada** baris scheduled untuk `(enrollment, 'level', levelId)` — mencegah
  duplikat saat recompute dijalankan ulang (properti idempotent yang sama
  dengan mesin progress).
- Hook di sisi aplikasi (bukan trigger DB) agar dapat diuji dan tak menyembunyikan
  efek samping di migration (D4).

## 4. Server actions (`features/actions.ts`, client strict — bukan demo)

- `setWeeklyGoal({ enrollmentId, weekStart, goalValue })` — student (enrollment
  sendiri) / guru (cohort sendiri) via RLS; validasi zod `1..50`.
- `completeReview({ reviewItemId, confidence })` — student enrollment sendiri;
  transisi + tulis baris berikutnya sesuai ladder bila belum terminal.
- `dismissReview({ reviewItemId })` — student enrollment sendiri.
- Semua pakai `createStrictClient` (fail keras tanpa backend), pola sama dengan
  action existing; `get-or-create` weekly_plans di read path dashboard.

## 5. RLS (pola helper, hindari recursion — pelajaran migration 000008)

Policy baru (semua `for select`/`for all` + `using`/`with check`, grant
helper `private.*` EXECUTE ke `authenticated`):

- `weekly_plans` & `review_items`:
  - student select/insert/update baris yang enrollment-nya miliknya &
    `status='active'` — lewat helper `private.student_enrollment_ids()` (baru)
    atau perluasan helper yang ada, bukan subquery yang menembus RLS tabel lain.
  - teacher select (read-only MVP, D3): `enrollment.cohort_id in
    (select private.teacher_cohort_ids())`.
  - guardian select: join `guardian_links` aktif — **opsional di MVP** (lihat
    D3; guardian ringkasan hari ini tidak menampilkan review).
- `alter table ... enable row level security;` untuk keduanya.

## 6. UI (murid `/learn`, aksesibel)

- Kartu **"Target mingguan"**: `X/Y completions` + progress bar + setter goal
  (angka 1–50) milik student; empty state saat belum ada enrollment.
- Kartu **"Ulasan terjadwal (spaced review)"**: daftar due hari ini/overdue +
  upcoming; tiap item: tombol confidence 1–5 dan "tunda/lewati" (dismiss);
  empty state + alasan ("belum ada materi untuk diulas").
- Client components kecil memakai server actions + `useFormStatus`; label,
  focus, dan reduced-motion mengikuti konvensi komponen existing. Halaman
  guarded → state demo (tanpa env) tetap render kosong, tidak error.

## 7. Seed, fixture, dan live-denial

- `supabase/seed.sql`: Murid 01 dapat `weekly_plans` minggu berjalan
  (`date_trunc('week', now())::date`) + satu `review_items` scheduled; UUID
  tetap, idempotent.
- `scripts/live-denial/10_fixture.sql`: baris lintas-org (weekly_plan milik
  Murid B/org-2) untuk denial.
- `scripts/live-denial/20_denial.sql`: blok `t09_*` baru —
  Murid A tak bisa baca/ubah weekly_plan & review Murid B; guru org-1 tak bisa
  lihat milik org-2; murid tak bisa set goal enrollment orang lain; insert
  review duplikat (2× scheduled) ditolak index.

## 8. Tests

- `tests/unit/progress-planning.test.ts` (baru, fungsi murni): ladder
  1→3→7→14→cap 14; confidence ≤2 reset & =3 repeat; rollup minggu + batas
  Senin 00:00 org tz; queue ordering; idempotensi hook (duplikat tidak dibuat).
- `tests/integration/learning-planning.test.ts` (baru, statis): migration berisi
  2 tabel + RLS enabled + CHECK; nama policy; wiring action (string
  `.from("weekly_plans"|"review_items")` + `createStrictClient`); seed rows;
  tanpa `.delete()`; db-advisor lint migration.
- Live: perluasan suite denial (butir 7) → target 38+N PASS / 0 FAIL.
- E2E responsive: tetap 18+ passed (regresi layout /learn dicek manual via
  preview; tanpa backend halaman dalam state kosong).

## 9. Acceptance criteria (terukur, jadi checklist saat implementasi)

| ID | Kriteria | Bukti |
|---|---|---|
| AC-1 | Enrollment aktif punya `weekly_plans` minggu berjalan (default 3, lazy get-or-create) | integration + seed |
| AC-2 | Rollup completions per ISO-week org tz benar (batas Senin 00:00 org) | unit test fixture tanggal |
| AC-3 | Student hanya bisa set goal enrollment sendiri; guru read-only cohort sendiri; selain itu denial | unit RLS + live t09 |
| AC-4 | Level selesai → review pertama due +1 hari; recompute ulang tidak menggandakan | unit idempotensi + integration |
| AC-5 | Ladder 1/3/7/14 benar: ≥4 maju (cap 14), =3 ulang, ≤2 reset | unit |
| AC-6 | Complete/dismiss hanya untuk review sendiri; lintas-enrollment/org denial | static + live t09 |
| AC-7 | `/learn` menampilkan target X/Y + antrian review terurut + empty state; a11y (label, focus) | preview/snapshot + responsive suite tetap hijau |
| AC-8 | Tidak ada hard delete; hanya transisi status; `updated_at` berjalan | static test + DATA_MODEL.md |
| AC-9 | Gates: unit/integration +N, `db:typecheck`, lint/typecheck/format, `build`, e2e (18+/1), live-denial (38+N)/0; migration 000009 apply bersih di atas 000000–000008 | log gate aktual |
| AC-10 | PROGRESS.md Phase 3 tanpa KURANG; CHANGELOG draf diperbarui | diff |

## 10. Keputusan terbuka (jadikan ADR saat implementasi)

- **D1 — Unit goal**: `completions` untuk MVP; `minutes` hanya setelah write
  path `study_sessions` (heartbeat + clamp aktif, spec Phase 3) ada.
- **D2 — Cakupan interval/entity**: konstanta `[1,3,7,14]` + `entity_type='level'`
  dulu; override per-org & entity lain menyusul tanpa ubah bentuk data.
- **D3 — Hak guru**: read-only di MVP; edit goal/review siswa ditunda.
- **D4 — Hook vs trigger**: hook aplikasi (dalam/pasca `recomputeProgress`),
  bukan trigger DB.

## 11. Risiko

1. **RLS recursion** bila policy baru menyalin pola subquery lama → wajib helper
   `private.*` + cakupan live-denial segera (pengulangan bug 000008 dicegah).
2. **Menit tidak jujur** tanpa write path `study_sessions` → goal menit
   diekspos berlabel "eksperimental" atau disembunyikan sampai D1 selesai.
3. **Timezone**: salah hitung `week_start` membuat target bergeser sehari →
   seluruh perhitungan minggu memakai org tz (lib/time.ts), disimpan UTC/date.
4. **Idempotensi**: hook yang tidak idempotent menggandakan review → partial
   unique index + unit test duplikat.
5. **Tanpa backend live**: UI hanya terverifikasi state kosong/demo; verifikasi
   data penuh menunggu Supabase lokal (keterbatasan yang sama seperti fase lain,
   terdokumentasi di PROGRESS.md).
