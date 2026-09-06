# Plan — Target mingguan berbasis menit (tutup KURANG Phase 3, ADR-010)

Status: **draf untuk review** — belum ada kode. Menutup penundaan **ADR-010**
("completions dulu, minutes tertunda") yang prekondisinya — write path
heartbeat + active-time clamping (`lib/active-time.ts`, `useEngagementHeartbeat`,
validasi server `recordLearningEvent`) — **sudah dikirim** dan diverifikasi
deterministik (`tests/component/use-engagement.test.tsx`). Satu-satunya item
Phase 3 yang tersisa di PROGRESS.md setelah sesi target mingguan/spaced review.

Referensi: `ADR-010`, `docs/plan-weekly-target-spaced-review.md` (D1),
`LEARNING_ENGINE.md` (target mingguan personal), `STUDENT_EXPERIENCE.md`,
`DATA_MODEL.md` (`study_sessions`, `weekly_plans`, `learning_events`),
`PROGRESS.md` line 67.

---

## Temuan konteks (memengaruhi desain)

1. **`study_sessions` tidak punya write path** (ADR-010). Kolom: id,
   enrollment_id, started_at, ended_at, `active_seconds int >= 0`, RLS sudah
   ada. Tidak ada action yang menulisnya.
2. **Sumber menit yang jujur sudah ada**: `learning_events` baris
   `event_type='heartbeat'` menyimpan `metadata.activeMs` — di-clamp server
   (≤120 s, nilai raksasa ditolak), idempotent per `(student_id,
   client_event_id)`, dan hanya direkam saat tab visible + aktivitas (idle
   berhenti). Ledger append-only yang bisa dijumlah ulang kapan saja →
   konsisten dengan filosofi `progress_snapshots` recompute.
3. **`weekly_plans.goal_value` CHECK `between 1 and 50`** — cukup untuk unit
   completions (default 3), **terlalu kecil untuk menit** (target wajar 120–300
   menit/minggu). Migration diperlukan untuk membuka rentang per-unit.
4. **`weeklyRollup` meng-clamp goal ke `WEEKLY_GOAL_MAX = 50`** — perlu
   varian/parameter unit-aware agar goal menit (mis. 180) tidak ikut ter-clamp.
5. `/learn` membaca `goal_value` (default 3) dan menghitung progress dari
   event `activity_completed` minggu ISO berjalan; **belum ada UI/action untuk
   menyetel target** sama sekali (baris `weekly_plans` dibuat lazy; RLS student
   insert/update sudah ada di migration 000009).

---

## 1. Pengukuran menit: derivasi dari heartbeat, bukan write path baru

Keputusan inti (buka D1): **menit aktif = Σ `activeMs` heartbeat dalam minggu
ISO (tz org) ÷ 60.000**, dihitung ulang dari `learning_events` — bukan menulis
`study_sessions` baru.

Alasan: (a) sumbernya sudah jujur + server-validated; (b) idempotent by
construction (unik `client_event_id`; SUM stabil terhadap replay/recompute);
(c) tanpa state agregat kedua → tanpa risiko duplikasi/desync; (d) semantik
batas minggu aman: sesi panjang yang menyeberang tengah malam tersalur per
heartbeat ke minggunya masing-masing (created_at per-event). `study_sessions`
tetap tersedia untuk fitur "sesi eksplisit mulai/selesai" di masa depan (di
luar scope).

## 2. Migration `20260906000012_weekly_minutes.sql`

Tidak ada tabel baru (db:typecheck tetap 37 tabel). Perubahan:

```sql
-- goal_value kini unit-aware: completions 1..50, minutes 1..2000 (~33 jam/minggu).
alter table public.weekly_plans
  drop constraint weekly_plans_goal_value_check,
  add constraint weekly_plans_goal_value_check check (
    (goal_unit = 'completions' and goal_value between 1 and 50)
    or (goal_unit = 'minutes' and goal_value between 1 and 2000)
  );
```

Catatan: nama constraint lama dari `000009` harus diverifikasi saat eksekusi
(`\d public.weekly_plans`) — bila default `weekly_plans_goal_value_check`,
pakai `drop constraint if exists` + nama eksplisit di ADD.

## 3. Logika murni (`lib/progress-planning.ts`, + unit tests)

```ts
/** Menit aktif (di-floor) dari heartbeat events pada minggu ISO weekStart. */
export function weeklyActiveMinutes(
  heartbeats: { createdAt: string; activeMs?: number }[],
  weekStart: string,            // "YYYY-MM-DD" (isoWeekStart, tz org)
  tz: string = DISPLAY_TIMEZONE,
  now: Date = new Date(),
): number;

/** Clamp goal sesuai unit: completions → 1..50, minutes → 1..2000. */
export function clampGoalForUnit(unit: WeeklyGoalUnit, goalValue: number): number;

/** Rollup unit-aware: 'completions' = hitungan; 'minutes' = menit aktif. */
export function weeklyRollupForUnit(
  unit: WeeklyGoalUnit,
  measured: number,   // completions ATAU activeMinutes
  goalValue: number,
): WeeklyRollup;      // reuse struktur { completed, goal, pct, achieved, status }
```

`weeklyActiveMinutes` memakai `clampActiveMs` defensif (server sudah clamp;
klien/library tak percaya), `isSameIsoWeek` untuk filter minggu, floor sebelum
dibagi 60.000.

## 4. UI `/learn` + aksi set target (student, enrollment sendiri)

- Baca `weekly_plans` untuk `(enrollment, weekStart)`: pakai `goal_unit`
  (default `'completions'`) + `goal_value`; tampil unit-aware:
  - completions: "X/Y aktivitas selesai" (status quo);
  - minutes: "X/Y menit aktif" + format `H j M m` bila ≥ 60 menit.
  - progressbar + label achieved sama seperti sekarang (`weeklyRollupForUnit`).
- Data mingguan: `activity_completed` (completions) ATAU `heartbeat`
  (`weeklyActiveMinutes`) dari `learning_events` — pilih sesuai unit baris
  target (dua query ringan, bukan union).
- Aksi server `setWeeklyGoal` (schema zod: enrollmentId, unit
  completions|minutes, value int) — RLS `weekly_plans_student_insert/update`
  (000009) membatasi ke enrollment aktif murid; `weekly_plans` dibuat lazy
  get-or-create per `(enrollment, weekStart)`. Form kecil di `/learn` atau
  halaman profil belajar; murid boleh set sendiri (target personal, RBAC).
- Guru: read-only (policy sudah ada) — di luar scope MVP.

## Acceptance criteria

| AC | Kriteria | Bukti |
|---|---|---|
| AC-1 | Menit dihitung dari heartbeat yang jujur (visible+aktivitas, clamp server) | `weeklyActiveMinutes` + test: 60 s aktif = 1 menit; 90 s = 1 menit (floor); nol/negatif diabaikan; event di luar minggu tidak terhitung |
| AC-2 | Boundary minggu ISO benar (tz Asia/Jakarta) | test `isSameIsoWeek` + event Minggu 23:30 UTC = Senin tz → minggu baru |
| AC-3 | Idempotent: replay heartbeat tidak menggandakan menit | basis unik `(student_id, client_event_id)` (sudah) + test SUM stabil untuk array ber-duplikat id |
| AC-4 | Clamp goal per-unit (minutes 1..2000; completions 1..50) | `clampGoalForUnit` unit test + migration CHECK baru |
| AC-5 | Rollup unit-aware benar untuk kedua unit | `weeklyRollupForUnit` test: achieved/pct/status untuk minutes & completions |
| AC-6 | UI `/learn` menampilkan unit yang benar (menit h:m, atau selesai) | e2e/manual preview + component test label |
| AC-7 | `setWeeklyGoal` hanya enrollment aktif milik murid (RLS) + lazy create | live-denial `t12_*`: student set own enrollment OK, enrollment orang lain FORBIDDEN, guardian/teacher set ditolak |
| AC-8 | Tanpa migration tabel baru | `db:typecheck` tetap 37 tabel + 1 view |
| AC-9 | Menit tidak dihitung saat tab hidden/idle | reuse bukti `use-engagement` 5/5 + server clamp (sudah live) |
| AC-10 | Semua gate hijau | format/lint/typecheck/test/live-denial/db:typecheck/e2e/build di PROGRESS.md |

## State matrix (weekly_plans)

| Kondisi | before | after |
|---|---|---|
| `goal_unit='completions'`, goal 3, 2 selesai | 2/3 (67%, active) | sama (regresi-guard) |
| `goal_unit='minutes'`, goal 180, 125 menit | tidak terukur (ADR-010) | 125/180 (69%, active) |
| goal minutes 180 | ter-clamp ke 50 (bug) | 180 valid |
| event heartbeat replay | — | SUM stabil (AC-3) |

## Open decisions (calon ADR)

- **D1 — sumber menit**: derivasi event (dipilih, lihat §1) vs write
  `study_sessions` (agregasi + ended_at; lebih cocok bila "sesi eksplisit"
  jadi produk). 
- **D2 — siapa menyetel target**: murid sendiri (MVP, personal) vs guru per
  cohort vs org default. RBAC menyebut target personal; guru setter bisa jadi
  ekstensi.
- **D3 — cap menit**: 2000/minggu cukup? (≈33 jam; batas keamanan anti-gaming
  sudah ada di clamp 120 s/heartbeat).

## Risiko

1. **Coverage heartbeat terbatas**: quiz/upload/reflection punya heartbeat
   (activity page); halaman non-activity (mis. katalog) tidak → menit = waktu
   di konten belajar, bukan seluruh app. Dokumentasikan definisi.
2. **Clamp goal default 50 salah terpakai untuk menit** → dicegah AC-4/AC-5.
3. **Nama constraint lama** tidak persis `weekly_plans_goal_value_check` →
   `drop constraint if exists` + verifikasi saat eksekusi (AC-8 + live-denial).
4. Overflow SUM? `int` SUM ≤ 2.000×60.000 ≈ 1,2×10⁸ — aman di bigint; hasil
   akhir `int` minutes kecil.

## Test plan

- Unit `progress-planning`: AC-1..5 (baru, murni).
- Component `learn`: label unit menit/completions (AC-6).
- Live-denial `t12_*`/`p12_*` pada migration 000012: constraint unit-aware,
  set-goal RLS lintas murid (AC-7), regresi completions.
- E2E/manual preview setelah hosted pulih: set target menit → heartbeat ~2 mnt
  → blok `/learn` menunjukkan menit bertambah; tab hidden → menit berhenti.

## Execution order

1. Migration `000012` + update fixture live-denial.
2. `lib/progress-planning.ts` (3 fungsi) + unit test.
3. `setWeeklyGoal` action + schema zod + UI `/learn` unit-aware.
4. Live-denial `t12_*`; gates penuh; PROGRESS.md.
