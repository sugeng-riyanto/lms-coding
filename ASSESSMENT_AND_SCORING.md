# Assessment and Scoring

## Lifecycle

`draft → published → active → closed → archived`

Attempt: `not_started → in_progress → submitted → auto_graded → needs_review → finalized`.

## Auto-grading

- Dijalankan trusted server transaction.
- Client menerima soal tanpa answer key.
- Setelah submit, attempt dikunci.
- Idempotency key mencegah submit ganda.
- Finalization menghitung score, competency evidence, progress, dan certificate eligibility dalam transaction/job yang dapat diulang.

## Manual grading

- Queue dapat difilter berdasarkan cohort, assessment, dan status.
- Rubric per kriteria dengan komentar.
- Perubahan setelah finalisasi membuat `grade_revision` dan audit event.
- Murid melihat nilai sesuai release policy.

## Integrity yang manusiawi

- Randomized question order/pool.
- Attempt limit dan cooldown configurable.
- Log tab-hidden hanya sebagai sinyal, bukan bukti kecurangan.
- Jangan gunakan pengenalan wajah atau proctoring invasif pada MVP.
- Guru mengambil keputusan akhir dengan konteks.

## Import/export

- CSV question import dengan dry-run, validation report, dan rollback.
- CSV grade export mengikuti filter cohort/course/level.
- Formula spreadsheet tidak dieksekusi; escape sel yang dimulai `=`, `+`, `-`, atau `@`.

