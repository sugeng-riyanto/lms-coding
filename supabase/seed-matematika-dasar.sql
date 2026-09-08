-- Seed konten demo ANONIM: Matematika Dasar (3 level penuh, 12 pelajaran, 22 artikel,
-- 3 asesmen sumatif). Deterministik (UUID tetap) + idempotent (on conflict do nothing).
-- Course "Matematika Dasar" (slug matematika-dasar, cv e0000000-0000-0000-0000-000000000001,
-- level f0000000-...-001/002/003, org 11111111-1111-1111-1111-111111111111).
-- Pola struktur mengikuti course Python (modul → pelajaran → aktivitas + quiz).

-- ============================================================
-- MODUL
-- ============================================================
insert into public.modules (id, level_id, position, title)
values
  ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 1, 'Modul 2 — Operasi Dasar'),
  ('f1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 0, 'Modul 1 — Aljabar Dasar'),
  ('f1000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 1, 'Modul 2 — Persamaan Linear'),
  ('f1000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003', 0, 'Modul 1 — Rasio, Proporsi, dan Persen'),
  ('f1000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000003', 1, 'Modul 2 — Statistika Dasar dan Proyek Akhir')
on conflict (id) do nothing;

-- ============================================================
-- PELAJARAN
-- ============================================================
insert into public.lessons (id, module_id, position, title, estimated_minutes, required, objective)
values
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 1, 'Pelajaran 2 — Bilangan Bulat dan Garis Bilangan', 10, true, 'Mengenal bilangan bulat positif, nol, dan negatif serta letaknya pada garis bilangan.'),
  ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000002', 0, 'Pelajaran 3 — Penjumlahan dan Pengurangan', 12, true, 'Menjumlah dan mengurangkan bilangan bulat dengan benar.'),
  ('f2000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000002', 1, 'Pelajaran 4 — Perkalian dan Pembagian', 12, true, 'Mengalikan dan membagi bilangan bulat serta menerapkan aturan tanda.'),
  ('f2000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000003', 0, 'Pelajaran 5 — Variabel dan Ekspresi Aljabar', 12, true, 'Mengenali variabel, konstanta, dan menulis ekspresi aljabar sederhana.'),
  ('f2000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000003', 1, 'Pelajaran 6 — Koefisien dan Suku Sejenis', 12, true, 'Mengidentifikasi koefisien dan menyederhanakan suku sejenis.'),
  ('f2000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000004', 0, 'Pelajaran 7 — Menyelesaikan Persamaan Linear', 15, true, 'Menyelesaikan persamaan linear satu variabel.'),
  ('f2000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000004', 1, 'Pelajaran 8 — Persamaan dalam Soal Cerita', 15, true, 'Menerjemahkan soal cerita menjadi persamaan dan menyelesaikannya.'),
  ('f2000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000005', 0, 'Pelajaran 9 — Rasio dan Proporsi', 12, true, 'Memahami rasio dan menyelesaikan soal proporsi.'),
  ('f2000000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000005', 1, 'Pelajaran 10 — Persen dalam Kehidupan Sehari-hari', 12, true, 'Menghitung persen dari suatu bilangan dan menerapkannya pada diskon dan bunga.'),
  ('f2000000-0000-0000-0000-000000000011', 'f1000000-0000-0000-0000-000000000006', 0, 'Pelajaran 11 — Mean, Median, dan Modus', 12, true, 'Menghitung mean, median, dan modus dari kumpulan data.'),
  ('f2000000-0000-0000-0000-000000000012', 'f1000000-0000-0000-0000-000000000006', 1, 'Pelajaran 12 — Proyek: Analisis Data Sederhana', 15, true, 'Menyusun dan menganalisis data sederhana lalu menyajikannya.')
on conflict (id) do nothing;

-- ============================================================
-- AKTIVITAS ARTIKEL (Level 1 — Fondasi)
-- ============================================================
insert into public.activities (id, lesson_id, position, type, title, content_json, required)
values
  -- Pelajaran 2 — Bilangan Bulat dan Garis Bilangan
  ('f3000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 0, 'article', 'Bilangan Bulat: Positif, Nol, dan Negatif', jsonb_build_object('body', $$Bilangan bulat adalah himpunan bilangan yang terdiri dari bilangan bulat positif (1, 2, 3, …), nol (0), dan bilangan bulat negatif (−1, −2, −3, …). Bilangan ini tidak memiliki bagian pecahan atau desimal.

## Contoh

- Positif: 1, 2, 3, 10, 100
- Nol: 0
- Negatif: −1, −5, −20

**Mengapa perlu bilangan negatif?** Suhu di bawah titik beku, kedalaman laut, atau saldo bank yang kurang dari nol memerlukan bilangan negatif. Misalnya suhu −3°C berarti tiga derajat di bawah nol.

> Ingat: semakin ke kiri pada garis bilangan, nilainya semakin kecil. −5 lebih kecil dari −2.

## Latihan cepat

1. Sebutkan tiga bilangan bulat negatif.
2. Apakah −8 lebih besar atau lebih kecil dari −3?$$), true),
  ('f3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 1, 'article', 'Garis Bilangan dan Perbandingan', jsonb_build_object('body', $$Garis bilangan adalah garis lurus yang memuat bilangan-bilangan secara berurutan. Titik nol berada di tengah; bilangan positif di sebelah kanan dan bilangan negatif di sebelah kiri.

## Membaca garis bilangan

```
−5  −4  −3  −2  −1   0   1   2   3   4   5
```

## Aturan perbandingan

- Bilangan di sebelah kanan selalu **lebih besar**.
- Bilangan di sebelah kiri selalu **lebih kecil**.
- Contoh: 2 > −1, karena 2 berada di kanan −1.
- Contoh: −3 < −1, karena −3 berada di kiri −1.

## Nilai mutlak (pengantar)

Nilai mutlak adalah jarak suatu bilangan dari nol, tanpa memperhatikan arah. Ditulis dengan tanda |…|.

- |5| = 5
- |−5| = 5

Jarak −5 ke 0 sama dengan jarak 5 ke 0, yaitu 5 satuan.

> Tips: jika bingung membandingkan dua bilangan negatif, gambarlah garis bilangan terlebih dahulu.$$), true),
  -- Pelajaran 3 — Penjumlahan dan Pengurangan
  ('f3000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000003', 0, 'article', 'Penjumlahan Bilangan Bulat', jsonb_build_object('body', $$Penjumlahan bilangan bulat mengikuti aturan tanda. Gunakan garis bilangan sebagai alat bantu.

## Aturan dasar

1. **Dua bilangan positif**: jumlahkan seperti biasa. 3 + 4 = 7
2. **Dua bilangan negatif**: jumlahkan, lalu beri tanda negatif. (−3) + (−4) = −7
3. **Positif + negatif (atau sebaliknya)**: kurangkan nilai mutlaknya, tanda mengikuti bilangan yang lebih besar.

## Contoh

- 7 + (−2) = 5 → karena 7 lebih besar dari 2, hasilnya positif.
- (−6) + 4 = −2 → karena 6 lebih besar dari 4, hasilnya negatif.
- (−8) + 8 = 0 → dua bilangan saling berlawanan selalu berjumlah nol.

## Garis bilangan

Mulai dari 0. Untuk +7, melangkah 7 ke kanan. Untuk −2, melangkah 2 ke kiri. Berhenti di 5.

> Kesalahan umum: (−3) + 5 dianggap −2. Sebenarnya 5 lebih besar dari 3, sehingga hasilnya 2.

## Latihan

1. 9 + (−4) = ?
2. (−5) + (−6) = ?
3. 12 + (−12) = ?$$), true),
  ('f3000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000003', 1, 'article', 'Pengurangan Bilangan Bulat', jsonb_build_object('body', $$Pengurangan dapat dipandang sebagai penjumlahan dengan kebalikannya.

## Aturan kunci

Mengurangi b sama dengan menambah (−b):

a − b = a + (−b)

## Contoh

- 8 − 3 = 8 + (−3) = 5
- 5 − (−2) = 5 + 2 = 7 → kurangi negatif berarti tambah
- (−4) − 6 = (−4) + (−6) = −10
- (−7) − (−3) = (−7) + 3 = −4

## Pola yang perlu dihafal

| Operasi | Hasil |
|---|---|
| positif − positif | bisa positif atau negatif, selisihnya |
| positif − negatif | selalu positif (bertambah) |
| negatif − positif | selalu negatif (berkurang) |
| negatif − negatif | bergantung pada nilainya |

## Penerapan suhu

Suhu pagi −2°C, siang naik menjadi 7°C. Kenaikan suhu = 7 − (−2) = 9°C.

> Trik: ubah setiap pengurangan menjadi penjumlahan kebalikan, lalu gunakan aturan penjumlahan.$$), true),
  -- Pelajaran 4 — Perkalian dan Pembagian
  ('f3000000-0000-0000-0000-000000000006', 'f2000000-0000-0000-0000-000000000004', 0, 'article', 'Perkalian Bilangan Bulat', jsonb_build_object('body', $$Perkalian adalah penjumlahan berulang. 4 × 3 berarti 3 + 3 + 3 + 3 = 12.

## Aturan tanda perkalian

| Tanda | Contoh | Hasil |
|---|---|---|
| + × + | 3 × 4 | 12 (positif) |
| + × − | 3 × (−4) | −12 (negatif) |
| − × + | (−3) × 4 | −12 (negatif) |
| − × − | (−3) × (−4) | 12 (positif) |

**Ringkasan**: hasil positif jika kedua tanda sama; negatif jika tanda berbeda.

## Contoh penerapan

- (−5) × 6 = −30
- (−7) × (−2) = 14
- 8 × 0 = 0 → berapa pun dikali nol hasilnya nol.

## Perkalian dengan nol dan satu

- a × 0 = 0
- a × 1 = a

> Kesalahan umum: mengira (−2) × (−3) = −6. Karena kedua tanda sama, hasilnya positif 6.$$), true),
  ('f3000000-0000-0000-0000-000000000007', 'f2000000-0000-0000-0000-000000000004', 1, 'article', 'Pembagian Bilangan Bulat', jsonb_build_object('body', $$Pembagian adalah kebalikan dari perkalian. 20 ÷ 4 = 5 karena 4 × 5 = 20.

## Aturan tanda pembagian

Sama seperti perkalian:

| Tanda | Hasil |
|---|---|
| + ÷ + | positif |
| + ÷ − | negatif |
| − ÷ + | negatif |
| − ÷ − | positif |

## Contoh

- 18 ÷ (−3) = −6
- (−24) ÷ 4 = −6
- (−15) ÷ (−5) = 3

## Pembagian dengan nol

- a ÷ 0 **tidak didefinisikan** (tak hingga, tidak boleh).
- 0 ÷ a = 0, selama a ≠ 0.

## Urutan operasi (pengingat)

Kerjakan dalam urutan: **K**urung, **P**angkat, **K**ali/**B**agi (kiri ke kanan), **T**ambah/**K**urang (kiri ke kanan).

Contoh: 2 + 3 × 4 = 2 + 12 = 14 (bukan 20!). Perkalian dikerjakan lebih dulu daripada penjumlahan.

## Latihan

1. (−36) ÷ 6 = ?
2. (−40) ÷ (−8) = ?
3. 5 + 2 × 3 = ?$$), true),
  -- Pelajaran 5 — Variabel dan Ekspresi Aljabar
  ('f3000000-0000-0000-0000-000000000009', 'f2000000-0000-0000-0000-000000000005', 0, 'article', 'Apa Itu Variabel dan Ekspresi Aljabar?', jsonb_build_object('body', $$Aljabar memungkinkan kita menuliskan pola umum dengan huruf yang mewakili bilangan yang belum diketahui. Huruf tersebut disebut **variabel**.

## Istilah penting

- **Variabel**: lambang bilangan yang nilainya bisa berubah, misalnya x, y, a.
- **Konstanta**: bilangan tetap, misalnya 5 pada ekspresi 3x + 5.
- **Ekspresi aljabar**: gabungan variabel, konstanta, dan operasi, misalnya 2x + 3.

## Membaca ekspresi

- 2x berarti 2 × x.
- x² berarti x × x.
- xy berarti x × y.

## Menuliskan kalimat menjadi ekspresi

| Kalimat | Ekspresi |
|---|---|
| lima lebihnya dari x | x + 5 |
| tiga kali y | 3y |
| dua kurangnya dari 4a | 4a − 2 |

## Menghitung nilai ekspresi

Hitung 2x + 3 untuk x = 4:

2(4) + 3 = 8 + 3 = 11

## Latihan

1. Tuliskan "tujuh lebihnya dari p" dalam ekspresi.
2. Hitung 5y − 2 untuk y = 3.$$), true),
  ('f3000000-0000-0000-0000-000000000010', 'f2000000-0000-0000-0000-000000000005', 1, 'article', 'Menyusun Ekspresi dari Soal Cerita', jsonb_build_object('body', $$Kemampuan menerjemahkan kalimat menjadi ekspresi adalah fondasi aljabar.

## Kata-kata kunci

- "lebih dari", "ditambah" → +
- "kurang dari", "dikurangi" → −
- "kali", "lipat", "produk" → ×
- "bagi", "per" → ÷

## Contoh langkah demi langkah

**Soal**: Harga sebuah buku adalah x rupiah. Budi membeli 3 buku dan membayar dengan uang 50.000 rupiah. Uang kembaliannya?

1. Harga 3 buku = 3x.
2. Kembalian = 50.000 − 3x.

**Soal**: Umur ayah dua kali umur anaknya. Jika umur anak y tahun, umur ayah = 2y.

## Menghitung untuk nilai tertentu

Jika buku berharga 12.000 rupiah (x = 12.000), kembalian Budi:

50.000 − 3(12.000) = 50.000 − 36.000 = 14.000

Jadi kembaliannya 14.000 rupiah.

> Strategi: baca kalimat per kalimat, tandai kata kunci, lalu tulis dalam urutan operasi yang benar.$$), true),
  -- Pelajaran 6 — Koefisien dan Suku Sejenis
  ('f3000000-0000-0000-0000-000000000011', 'f2000000-0000-0000-0000-000000000006', 0, 'article', 'Koefisien, Suku, dan Konstanta', jsonb_build_object('body', $$Setiap bagian ekspresi yang dipisahkan tanda + atau − disebut **suku**.

## Contoh

Pada ekspresi 4x + 7y − 3:

- Suku-sukunya: 4x, 7y, dan −3.
- **Koefisien** x adalah 4; koefisien y adalah 7.
- Konstanta adalah −3.

## Suku sejenis

Suku sejenis memiliki variabel yang sama (huruf dan pangkatnya sama).

- 3x dan 5x → sejenis.
- 3x dan 3y → **tidak** sejenis (variabel beda).
- 2x² dan 5x² → sejenis.
- 2x² dan 5x → **tidak** sejenis (pangkat beda).

## Mengapa penting?

Suku sejenis dapat dijumlahkan/dikurangkan; suku tidak sejenis tidak bisa.

- 3x + 5x = 8x
- 3x + 5y = 3x + 5y (tetap)

## Latihan

1. Sebutkan koefisien pada 9a − 4b + 2.
2. Manakah yang sejenis: 6m dan 6n, atau 6m dan 2m?$$), true),
  ('f3000000-0000-0000-0000-000000000012', 'f2000000-0000-0000-0000-000000000006', 1, 'article', 'Menyederhanakan Ekspresi', jsonb_build_object('body', $$Menyederhanakan berarti menggabungkan semua suku sejenis sehingga ekspresi menjadi ringkas.

## Langkah-langkah

1. Kelompokkan suku sejenis.
2. Jumlahkan/kurangkan koefisiennya.
3. Tulis konstanta di bagian akhir.

## Contoh 1

Sederhanakan 7x + 3 − 2x + 5:

- Suku x: 7x − 2x = 5x
- Konstanta: 3 + 5 = 8
- Hasil: 5x + 8

## Contoh 2

Sederhanakan 4a + 2b − a + 3b:

- Suku a: 4a − a = 3a
- Suku b: 2b + 3b = 5b
- Hasil: 3a + 5b

## Contoh 3 (dengan perkalian)

Sederhanakan 2(3x + 4) + x:

1. Jabarkan: 6x + 8 + x
2. Gabung: 7x + 8

> Periksa kembali: koefisien variabel yang berbeda tidak boleh dicampur. 3a + 5b tidak bisa menjadi 8ab.$$), true),
  -- Pelajaran 7 — Menyelesaikan Persamaan Linear
  ('f3000000-0000-0000-0000-000000000013', 'f2000000-0000-0000-0000-000000000007', 0, 'article', 'Persamaan Linear Satu Variabel', jsonb_build_object('body', $$Persamaan linear satu variabel berbentuk ax + b = c, misalnya 2x + 3 = 11.

## Tujuan

Mencari nilai x yang membuat kedua ruas sama.

## Aturan emas

Apa pun yang dilakukan ke satu ruas, lakukan juga ke ruas lain (pertahankan keseimbangan).

## Contoh 1

Selesaikan 2x + 3 = 11:

1. Kurangi 3 dari kedua ruas: 2x = 8
2. Bagi kedua ruas dengan 2: x = 4

**Periksa**: 2(4) + 3 = 8 + 3 = 11 ✓

## Contoh 2

Selesaikan 3x − 7 = 8:

1. Tambah 7: 3x = 15
2. Bagi 3: x = 5

**Periksa**: 3(5) − 7 = 15 − 7 = 8 ✓

## Urutan umum

1. Sederhanakan kedua ruas (gabungkan suku sejenis).
2. Pindahkan suku variabel ke satu ruas, konstanta ke ruas lain.
3. Bagi dengan koefisien variabel.
4. Selalu periksa jawaban.

## Latihan

1. x + 5 = 12
2. 4x = 20
3. 2x − 1 = 9$$), true),
  ('f3000000-0000-0000-0000-000000000014', 'f2000000-0000-0000-0000-000000000007', 1, 'article', 'Persamaan dengan Variabel di Kedua Ruas', jsonb_build_object('body', $$Terkadang variabel muncul di kedua ruas, seperti 5x − 2 = 2x + 10.

## Strategi

Bawa semua suku variabel ke satu ruas dan konstanta ke ruas lain.

## Contoh

Selesaikan 5x − 2 = 2x + 10:

1. Kurangi 2x dari kedua ruas: 3x − 2 = 10
2. Tambah 2: 3x = 12
3. Bagi 3: x = 4

**Periksa**: ruas kiri 5(4) − 2 = 18; ruas kanan 2(4) + 10 = 18 ✓

## Jika variabel menjadi negatif

Selesaikan x + 8 = 3x:

1. Kurangi x: 8 = 2x
2. Bagi 2: x = 4

**Periksa**: 4 + 8 = 12; 3(4) = 12 ✓

## Kesalahan umum

- Lupa mengubah tanda saat memindahkan suku.
- Tidak memeriksa jawaban.

> Selalu substitusi jawaban ke persamaan awal. Jika kedua ruas sama, jawaban benar.$$), true),
  -- Pelajaran 8 — Persamaan dalam Soal Cerita
  ('f3000000-0000-0000-0000-000000000015', 'f2000000-0000-0000-0000-000000000008', 0, 'article', 'Menyusun Persamaan dari Soal Cerita', jsonb_build_object('body', $$Soal cerita aljabar diselesaikan dengan empat langkah: baca, definisikan variabel, susun persamaan, selesaikan.

## Contoh

**Soal**: Tiga kali sebuah bilangan ditambah 5 sama dengan 26. Berapakah bilangan itu?

1. Misalkan bilangan = x.
2. Persamaan: 3x + 5 = 26.
3. Selesaikan: 3x = 21 → x = 7.

**Periksa**: 3(7) + 5 = 26 ✓

## Contoh 2

**Soal**: Umur kakak 4 tahun lebih tua dari adik. Jumlah umur mereka 30 tahun. Berapa umur adik?

1. Umur adik = x; umur kakak = x + 4.
2. x + (x + 4) = 30.
3. 2x + 4 = 30 → 2x = 26 → x = 13.

Jadi umur adik 13 tahun dan kakak 17 tahun. **Periksa**: 13 + 17 = 30 ✓

## Tips

- Tuliskan apa yang ditanyakan sebagai variabel.
- Terjemahkan kata kunci (jumlah, lebih dari, kali) menjadi operasi.
- Periksa kembali apakah jawaban masuk akal.

## Latihan

Dua kali sebuah bilangan dikurangi 3 sama dengan 11. Tentukan bilangan itu.$$), true),
  ('f3000000-0000-0000-0000-000000000016', 'f2000000-0000-0000-0000-000000000008', 1, 'article', 'Aplikasi: Keliling, Luas, dan Uang', jsonb_build_object('body', $$Persamaan linear sangat berguna untuk masalah geometri dan keuangan.

## Contoh keliling

**Soal**: Keliling persegi panjang 30 cm. Panjangnya dua kali lebarnya. Cari panjang dan lebar.

1. Lebar = x; panjang = 2x.
2. Keliling = 2(panjang + lebar) = 2(2x + x) = 6x.
3. 6x = 30 → x = 5.

Lebar 5 cm, panjang 10 cm. **Periksa**: 2(10 + 5) = 30 ✓

## Contoh uang

**Soal**: Ana dan Bima total punya 90.000 rupiah. Ana punya 10.000 lebih banyak dari Bima. Berapa punya masing-masing?

1. Bima = x; Ana = x + 10.000.
2. x + (x + 10.000) = 90.000.
3. 2x = 80.000 → x = 40.000.

Bima 40.000, Ana 50.000. **Periksa**: 40.000 + 50.000 = 90.000 ✓

## Pola yang umum

- "Keliling" → jumlah semua sisi.
- "Total" → penjumlahan.
- "lebih banyak/kurang" → selisih tetap.

> Selalu tulis satuan (cm, rupiah) pada jawaban akhir.$$), true),
  -- Pelajaran 9 — Rasio dan Proporsi
  ('f3000000-0000-0000-0000-000000000018', 'f2000000-0000-0000-0000-000000000009', 0, 'article', 'Rasio dan Cara Membacanya', jsonb_build_object('body', $$Rasio membandingkan dua besaran. Rasio a : b dibaca "a banding b" dan berarti untuk setiap a bagian pertama terdapat b bagian kedua.

## Contoh

Dalam sebuah kelas terdapat 12 laki-laki dan 8 perempuan.

- Rasio laki-laki : perempuan = 12 : 8 = 3 : 2 (disederhanakan).
- Artinya untuk setiap 3 laki-laki ada 2 perempuan.

## Menyederhanakan rasio

Bagi kedua ruas dengan faktor persekutuan terbesar (FPB).

- 12 : 8 → bagi 4 → 3 : 2.
- 15 : 20 → bagi 5 → 3 : 4.

## Rasio senilai (ekuivalen)

Mengalikan atau membagi kedua bagian rasio dengan bilangan yang sama menghasilkan rasio senilai.

- 3 : 2 = 6 : 10? Tidak. 3 : 2 = 6 : 4 = 9 : 6.
- 3 : 2 = 6 : 4 (kedua bagian dikali 2).

## Latihan

1. Sederhanakan 10 : 15.
2. Tulislah dua rasio yang senilai dengan 2 : 3.$$), true),
  ('f3000000-0000-0000-0000-000000000019', 'f2000000-0000-0000-0000-000000000009', 1, 'article', 'Proporsi dan Perbandingan Senilai', jsonb_build_object('body', $$Proporsi adalah pernyataan bahwa dua rasio sama, ditulis a : b = c : d.

## Sifat dasar

Pada proporsi a : b = c : d berlaku **perkalian silang**: a × d = b × c.

## Contoh 1

Jika 3 buku harganya 15.000 rupiah, berapa harga 5 buku?

1. Rasio buku : harga = 3 : 15.000 = 5 : x.
2. 3x = 5 × 15.000 = 75.000.
3. x = 25.000.

Jadi 5 buku harganya 25.000 rupiah.

## Contoh 2

Skala peta 1 : 100.000. Jarak di peta 4 cm. Jarak sebenarnya?

1. 1 : 100.000 = 4 : x.
2. x = 4 × 100.000 = 400.000 cm = 4 km.

## Perbandingan berbalik nilai (pengantar)

Jika satu besaran naik dan yang lain turun dengan hasil kali tetap, disebut berbalik nilai. Contoh: waktu tempuh makin pendek bila kecepatan naik.

> Identifikasi dulu: senilai (hasil bagi tetap) atau berbalik (hasil kali tetap), baru susun perhitungannya.$$), true),
  -- Pelajaran 10 — Persen
  ('f3000000-0000-0000-0000-000000000020', 'f2000000-0000-0000-0000-000000000010', 0, 'article', 'Persen: Konsep dan Perhitungan', jsonb_build_object('body', $$Persen berarti "per seratus". 25% sama dengan 25/100 = 0,25.

## Mengubah bentuk

- Persen → pecahan: 40% = 40/100 = 2/5.
- Persen → desimal: 40% = 0,40.
- Pecahan → persen: 3/4 = 75/100 = 75%.

## Menghitung persen dari bilangan

p% dari n = (p/100) × n

## Contoh

- 25% dari 80 = (25/100) × 80 = 20.
- 10% dari 250 = 25.
- 50% dari 64 = 32.

## Mencari persen

Berapa persen 12 dari 60? (12/60) × 100% = 20%.

## Latihan

1. 20% dari 150 = ?
2. 75% dari 40 = ?
3. Ubah 0,3 menjadi persen.$$), true),
  ('f3000000-0000-0000-0000-000000000021', 'f2000000-0000-0000-0000-000000000010', 1, 'article', 'Persen dalam Diskon, Pajak, dan Bunga', jsonb_build_object('body', $$Persen dipakai luas dalam kehidupan: diskon, pajak, dan bunga bank.

## Diskon

Harga baju 200.000 rupiah mendapat diskon 20%.

- Besar diskon = 20% × 200.000 = 40.000.
- Harga bayar = 200.000 − 40.000 = 160.000.

## Pajak

Barang 500.000 rupiah kena pajak 11%.

- Pajak = 11% × 500.000 = 55.000.
- Total bayar = 500.000 + 55.000 = 555.000.

## Bunga tunggal (pengantar)

Tabungan 1.000.000 rupiah berbunga 6% per tahun.

- Bunga setahun = 6% × 1.000.000 = 60.000.
- Tabungan setelah setahun = 1.060.000.

## Rumus praktis

- Harga setelah diskon = harga awal × (100% − diskon).
- Total setelah pajak = nilai × (100% + pajak).

> Perhatikan kata "dari": diskon 20% *dari* harga, bukan dikurangi langsung dari harga awal tanpa menghitung.$$), true),
  -- Pelajaran 11 — Mean, Median, dan Modus
  ('f3000000-0000-0000-0000-000000000022', 'f2000000-0000-0000-0000-000000000011', 0, 'article', 'Mean (Rata-rata)', jsonb_build_object('body', $$Mean atau rata-rata adalah jumlah seluruh data dibagi banyaknya data.

## Rumus

mean = (jumlah data) / (banyak data)

## Contoh

Nilai ulangan Siti: 7, 8, 9, 6, 8.

1. Jumlah = 7 + 8 + 9 + 6 + 8 = 38.
2. Banyak data = 5.
3. Mean = 38 / 5 = 7,6.

## Contoh 2

Data: 2, 3, 7.

- Jumlah = 12; banyak = 3; mean = 4.

## Kapan mean berguna?

Mean memberi gambaran nilai tengah keseluruhan, tetapi bisa terpengaruh oleh satu nilai ekstrem (misalnya nilai 100 di antara banyak 5-an).

## Latihan

1. Hitung mean dari 4, 6, 6, 8.
2. Hitung mean dari 10, 20, 30.$$), true),
  ('f3000000-0000-0000-0000-000000000023', 'f2000000-0000-0000-0000-000000000011', 1, 'article', 'Median dan Modus', jsonb_build_object('body', $$**Median** adalah nilai tengah setelah data diurutkan. **Modus** adalah nilai yang paling sering muncul.

## Mencari median

1. Urutkan data dari kecil ke besar.
2. Jika banyak data ganjil: ambil nilai di tengah.
3. Jika genap: rata-rata dua nilai tengah.

## Contoh ganjil

Data: 4, 6, 6, 8, 10 → diurutkan sudah. Nilai tengah (posisi ke-3) = 6.

## Contoh genap

Data: 4, 6, 6, 8 → dua nilai tengah 6 dan 6 → median = (6+6)/2 = 6.

Data: 2, 4, 6, 8 → median = (4+6)/2 = 5.

## Mencari modus

Data: 4, 6, 6, 8 → 6 muncul dua kali, paling sering → modus = 6.

- Data: 1, 2, 3, 4 → semua sama sering → tidak punya modus.
- Data: 1, 1, 2, 2 → dua modus (bimodal).

## Kapan memilih ukuran mana?

- Mean: data merata tanpa pencilan.
- Median: ada nilai ekstrem (lebih tahan).
- Modus: data kategori atau nilai paling umum.

## Latihan

Data: 3, 7, 3, 9, 3, 5. Tentukan median dan modus.$$), true),
  -- Pelajaran 12 — Proyek Analisis Data
  ('f3000000-0000-0000-0000-000000000024', 'f2000000-0000-0000-0000-000000000012', 0, 'article', 'Proyek: Mengumpulkan, Menyajikan, dan Menganalisis Data', jsonb_build_object('body', $$Proyek ini menggabungkan semua konsep: mengumpulkan data, menyajikan, lalu menganalisis dengan mean, median, dan modus.

## Langkah 1 — Kumpulkan data

Contoh: catat tinggi badan (cm) 7 teman sekelas:

```
152, 148, 155, 152, 150, 160, 152
```

## Langkah 2 — Urutkan

```
148, 150, 152, 152, 152, 155, 160
```

## Langkah 3 — Hitung ukuran pemusatan

- **Mean** = (148+150+152+152+152+155+160) / 7 = 1069 / 7 ≈ 152,7
- **Median** = nilai tengah (posisi ke-4) = 152
- **Modus** = 152 (muncul 3 kali)

## Langkah 4 — Sajikan

Sajikan dalam tabel frekuensi atau diagram batang sederhana:

| Tinggi (cm) | Frekuensi |
|---|---|
| 148 | 1 |
| 150 | 1 |
| 152 | 3 |
| 155 | 1 |
| 160 | 1 |

## Langkah 5 — Interpretasi

Rata-rata tinggi ≈ 152,7 cm; sebagian besar teman (modus) 152 cm. Data cukup seragam karena selisih mean–median kecil.

## Tugas proyek Anda

1. Kumpulkan 10 data (misalnya lama tidur, nilai ulangan, atau tinggi badan).
2. Urutkan, hitung mean, median, modus.
3. Buat tabel frekuensi.
4. Tulis satu paragraf interpretasi singkat.$$), true);

-- ============================================================
-- PERKAYA PELAJARAN 1 (artikel lama yang tadinya cuma 1 kalimat)
-- ============================================================
update public.activities
set content_json = jsonb_build_object('body', $$Bilangan adalah dasar dari semua matematika. Dalam pelajaran ini kita mengenal jenis-jenis bilangan dan simbol-simbol matematika dasar.

## Jenis bilangan

1. **Bilangan asli**: 1, 2, 3, 4, …
2. **Bilangan cacah**: 0, 1, 2, 3, …
3. **Bilangan bulat**: …, −3, −2, −1, 0, 1, 2, 3, …
4. **Bilangan pecahan**: seperti 1/2, 3/4.
5. **Bilangan desimal**: seperti 0,5; 2,75.

## Simbol matematika dasar

| Simbol | Arti | Contoh |
|---|---|---|
| + | tambah | 3 + 2 = 5 |
| − | kurang | 7 − 4 = 3 |
| × | kali | 4 × 3 = 12 |
| ÷ | bagi | 12 ÷ 4 = 3 |
| = | sama dengan | 2 + 3 = 5 |
| < | kurang dari | 3 < 5 |
| > | lebih dari | 5 > 3 |

## Membandingkan bilangan

Pada garis bilangan, bilangan di kanan lebih besar. 10 > 3, dan −1 > −5.

## Latihan

1. Sebutkan 3 bilangan bulat.
2. Benar atau salah: 8 < 3?$$),
        updated_at = now()
where id = 'f3000000-0000-0000-0000-000000000001';

-- ============================================================
-- AKTIVITAS KUIS + ASESMEN (Level 1, 2, 3)
-- ============================================================
insert into public.activities (id, lesson_id, position, type, title, content_json, required)
values
  ('f3000000-0000-0000-0000-000000000008', 'f2000000-0000-0000-0000-000000000004', 2, 'quiz', 'Asesmen Sumatif Level 1 — Bilangan & Operasi Dasar', '{}'::jsonb, true),
  ('f3000000-0000-0000-0000-000000000017', 'f2000000-0000-0000-0000-000000000008', 2, 'quiz', 'Asesmen Sumatif Level 2 — Aljabar & Persamaan', '{}'::jsonb, true),
  ('f3000000-0000-0000-0000-000000000025', 'f2000000-0000-0000-0000-000000000012', 1, 'quiz', 'Asesmen Sumatif Level 3 — Rasio, Statistik & Proyek', '{}'::jsonb, true)
on conflict (id) do nothing;

insert into public.assessments (id, activity_id, settings_json, total_points)
values
  ('f4000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000008', '{"release":"immediate","randomize":true,"maxAttempts":3,"cooldownSeconds":0,"durationSeconds":0}'::jsonb, 4),
  ('f4000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000017', '{"release":"immediate","randomize":true,"maxAttempts":3,"cooldownSeconds":0,"durationSeconds":0}'::jsonb, 4),
  ('f4000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000025', '{"release":"immediate","randomize":true,"maxAttempts":3,"cooldownSeconds":0,"durationSeconds":0}'::jsonb, 4)
on conflict (id) do nothing;

-- ============================================================
-- SOAL (12 × single_choice, 1 poin)
-- ============================================================
insert into public.questions (id, organization_id, type, prompt_json, explanation_json, difficulty)
values
  ('f5000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Berapakah hasil dari 5 + 3?","options":["8","15","53","7"]}', '{"text":"5 + 3 = 8."}', 'easy'),
  ('f5000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Berapakah hasil dari 12 − 7?","options":["5","19","4","6"]}', '{"text":"12 − 7 = 5."}', 'easy'),
  ('f5000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Berapakah hasil dari 6 × 4?","options":["24","10","64","46"]}', '{"text":"6 × 4 = 24."}', 'easy'),
  ('f5000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Berapakah hasil dari 20 ÷ 4?","options":["5","16","80","6"]}', '{"text":"20 ÷ 4 = 5."}', 'easy'),
  ('f5000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Jika x = 3, berapakah nilai dari 2x + 1?","options":["7","5","6","8"]}', '{"text":"2(3) + 1 = 6 + 1 = 7."}', 'medium'),
  ('f5000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Selesaikan x + 5 = 12. Berapakah x?","options":["7","17","5","6"]}', '{"text":"x = 12 − 5 = 7."}', 'medium'),
  ('f5000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Bentuk sederhana dari 3a + 2a adalah…","options":["5a","6a","32a","3a²"]}', '{"text":"3a + 2a = 5a (gabungkan koefisien)."}', 'medium'),
  ('f5000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Sebuah persegi panjang panjangnya 8 cm dan lebarnya 3 cm. Kelilingnya adalah…","options":["22 cm","24 cm","11 cm","16 cm"]}', '{"text":"Keliling = 2(8+3) = 22 cm."}', 'medium'),
  ('f5000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Rasio 3 : 5 setara dengan…","options":["6 : 10","5 : 3","8 : 10","2 : 4"]}', '{"text":"Kedua bagian dikali 2: 3:5 = 6:10."}', 'easy'),
  ('f5000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Berapakah 25% dari 80?","options":["20","25","55","100"]}', '{"text":"(25/100) × 80 = 20."}', 'easy'),
  ('f5000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Data: 4, 6, 6, 8. Berapakah mediannya?","options":["6","4","8","7"]}', '{"text":"Dua nilai tengah 6 dan 6 → median 6."}', 'medium'),
  ('f5000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'single_choice', '{"text":"Data: 2, 3, 7. Berapakah rata-rata (mean)nya?","options":["4","3","12","5"]}', '{"text":"(2+3+7)/3 = 12/3 = 4."}', 'medium')
on conflict (id) do nothing;

-- ============================================================
-- VERSI SOAL + KUNCI JAWABAN (assessment_questions)
-- ============================================================
insert into public.question_versions (id, question_id, version, grading_json, points)
values
  ('f6000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', 1, '{"type":"single_choice","points":1,"correctOptionId":"8"}', 1),
  ('f6000000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000002', 1, '{"type":"single_choice","points":1,"correctOptionId":"5"}', 1),
  ('f6000000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000003', 1, '{"type":"single_choice","points":1,"correctOptionId":"24"}', 1),
  ('f6000000-0000-0000-0000-000000000004', 'f5000000-0000-0000-0000-000000000004', 1, '{"type":"single_choice","points":1,"correctOptionId":"5"}', 1),
  ('f6000000-0000-0000-0000-000000000005', 'f5000000-0000-0000-0000-000000000005', 1, '{"type":"single_choice","points":1,"correctOptionId":"7"}', 1),
  ('f6000000-0000-0000-0000-000000000006', 'f5000000-0000-0000-0000-000000000006', 1, '{"type":"single_choice","points":1,"correctOptionId":"7"}', 1),
  ('f6000000-0000-0000-0000-000000000007', 'f5000000-0000-0000-0000-000000000007', 1, '{"type":"single_choice","points":1,"correctOptionId":"5a"}', 1),
  ('f6000000-0000-0000-0000-000000000008', 'f5000000-0000-0000-0000-000000000008', 1, '{"type":"single_choice","points":1,"correctOptionId":"22 cm"}', 1),
  ('f6000000-0000-0000-0000-000000000009', 'f5000000-0000-0000-0000-000000000009', 1, '{"type":"single_choice","points":1,"correctOptionId":"6 : 10"}', 1),
  ('f6000000-0000-0000-0000-000000000010', 'f5000000-0000-0000-0000-000000000010', 1, '{"type":"single_choice","points":1,"correctOptionId":"20"}', 1),
  ('f6000000-0000-0000-0000-000000000011', 'f5000000-0000-0000-0000-000000000011', 1, '{"type":"single_choice","points":1,"correctOptionId":"6"}', 1),
  ('f6000000-0000-0000-0000-000000000012', 'f5000000-0000-0000-0000-000000000012', 1, '{"type":"single_choice","points":1,"correctOptionId":"4"}', 1)
on conflict (id) do nothing;

insert into public.assessment_questions (assessment_id, question_version_id, position, points)
values
  ('f4000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 0, 1),
  ('f4000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000002', 1, 1),
  ('f4000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000003', 2, 1),
  ('f4000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000004', 3, 1),
  ('f4000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000005', 0, 1),
  ('f4000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000006', 1, 1),
  ('f4000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000007', 2, 1),
  ('f4000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000008', 3, 1),
  ('f4000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000009', 0, 1),
  ('f4000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000010', 1, 1),
  ('f4000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000011', 2, 1),
  ('f4000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000012', 3, 1)
on conflict (assessment_id, question_version_id) do nothing;