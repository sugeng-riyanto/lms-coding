# Learning and Mastery Engine

## Status

`locked → available → in_progress → submitted → completed`

Assessment dapat memiliki `needs_review`, `passed`, atau `remedial_required`.

## Skor

```text
question_score = clamp(auto_score + manual_score, 0, question_points)
assessment_percent = sum(question_score) / sum(question_points) × 100
competency_mastery = weighted earned points / weighted possible points
```

Nilai level menggunakan bobot configurable. Default:

- formative quiz 30%
- summative assessment 50%
- project/reflection 20%

Default hanya seed; guru wajib dapat mengubah dan total bobot harus 100%.

## Mastery rule default

- seluruh activity wajib selesai;
- nilai akhir level ≥ 70;
- setiap kompetensi kritis ≥ 0,70;
- asesmen summative berstatus passed.

## Attempt

- Simpan setiap attempt, jawaban, timestamp, dan versi soal.
- Feedback benar/salah dapat ditunda sampai submit atau deadline.
- Randomisasi soal harus reproducible menggunakan server-generated seed.
- Numeric answer mendukung absolute/relative tolerance dan unit normalization.
- Short text hanya auto-grade jika guru menyediakan normalization/rule yang eksplisit.
- Essay dan proyek masuk moderation queue.

## Kemandirian belajar

- Target mingguan personal.
- “Next best action” berdasarkan prerequisite, mastery terendah, dan deadline.
- Retrieval practice: jadwalkan review 1, 3, 7, dan 14 hari; interval dapat dikonfigurasi.
- Confidence check sebelum/selesai lesson.
- Reflection prompt: apa dipahami, bukti, kesulitan, langkah berikutnya.
- Hint bertahap; penggunaan hint dicatat tetapi tidak menghukum kecuali guru mengaktifkan penalty.
- Streak tidak boleh mendorong perilaku tidak sehat; sediakan grace day.

## Risk signal

Tandai untuk perhatian guru, bukan memberi label permanen:

- tidak aktif melewati ambang;
- attempt berulang tanpa peningkatan;
- waktu sangat cepat dengan akurasi rendah;
- prerequisite mastery rendah;
- deadline dekat tetapi progress tertinggal.

Selalu tampilkan alasan sinyal dan beri guru kontrol untuk dismiss/snooze.

