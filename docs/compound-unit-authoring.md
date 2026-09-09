# Compound-Unit Authoring Guide

Panduan untuk guru Fisika/Kimia yang menulis soal numerik dengan konversi satuan
menggunakan `unitFactors` pada question pack atau `grading_json` langsung.

## Ringkasan Cepat

Soal numerik di LMS ini mendukung **satu kalimat** atau **satuan majemuk** seperti
`72 km/jam`, `9.8 m/s²`, `10 kg·m/s²`, atau `5 kW·jam`. Guru mendefinisikan
**basis** (`expectedUnit`) dan **faktor konversi** (`unitFactors`) untuk tiap unit
yang diizinkan. Murid menulis jawaban dalam satuan apa pun yang terdaftar — server
mengonversi otomatis ke basis sebelum membandingkan dengan `expected` + toleransi.

---

## 1. Menulis unitFactors di grading_json

Setiap soal `numeric_tolerance` wajib menyertakan field `unit`:

```jsonc
{
  "type": "numeric_tolerance",
  "points": 10,
  "expected": 20,          // jawaban dalam basis (m/s)
  "toleranceAbsolute": 0.5,
  "toleranceRelative": 0,
  "unit": {
    "expectedUnit": "m/s",   // basis konversi
    "unitFactors": {
      "m": 1,     // 1 m   = 1 m (basis)
      "km": 1000, // 1 km  = 1000 m
      "s": 1,     // 1 s   = 1 s (basis)
      "jam": 3600 // 1 jam = 3600 s (diturunkan otomatis ke m/s)
    }
  }
}
```

**Kunci `unitFactors`:** nama token (boleh mixed-case, lookup case-insensitive).
**Nilai:** faktor konversi relatif terhadap `expectedUnit`.

### Cara menghitung faktor

1. Tulis `expectedUnit` sebagai basis yang diinginkan (mis. `m/s`).
2. Untuk tiap unit alternatif, hitung berapa kali ia lebih besar/kecil dari basis:
   - `km` → 1 km = 1000 m → `km: 1000`
   - `jam` → 1 jam = 3600 s → `jam: 3600` (karena `s` sudah ada sebagai basis untuk penyebut)
3. **Faktor berlaku untuk posisi mana pun** — `km` = 1000 di pembilang ATAU penyebut.
   Saat di penyebut, parser otomatis membalik: `km/jam` → (1000 m) / (3600 s).

### Contoh soal berbagai mata pelajaran

| Mata Pelajaran | expectedUnit | unitFactors | Soal |
|---|---|---|---|
| **Fisika — Kecepatan** | `m/s` | `{ m: 1, km: 1000, s: 1, jam: 3600 }` | "Sebuah mobil bergerak 72 km/jam. Berapa kecepatan dalam m/s?" |
| **Fisika — Percepatan** | `m/s²` | `{ m: 1, s: 1 }` | "Gravitasi Bumi = 9.8 m/s². Tulis dalam notasi ini." |
| **Fisika — Gaya** | `N` | `{ N: 1, kg: 1, m: 1, s: 1 }` | "Hitung gaya: massa 10 kg × percepatan 1 m/s²." |
| **Fisika — Densitas** | `kg/m³` | `{ kg: 1, g: 0.001, m: 1, L: 0.001 }` | "Densitas air = 1000 kg/m³. Tulis dalam g/L." |
| **Fisika — Energi** | `J` | `{ J: 1, kW: 1000, jam: 3600 }` | "Konsumsi 1 kW·jam = berapa Joule?" |
| **Kimia — Massa** | `kg` | `{ kg: 1, g: 0.001, mg: 0.000001 }` | "Timbangan menunjuk 5000 g. Tulis dalam kg." |
| **Kimia — Molaritas** | `mol/L` | `{ mol: 1, mmol: 0.001, µmol: 0.000001, L: 1, dL: 0.1, cL: 0.01, mL: 0.001 }` | "Larutan 0.5 mol/L. Tulis dalam mmol/mL." |
| **Kimia — Massa Molar** | `g/mol` | `{ g: 1, kg: 1000, mg: 0.001, mol: 1 }` | "Massa molar H₂O = 18 g/mol. Tulis dalam kg/mol." |
| **Kimia — Konsentrasi** | `mg/L` | `{ mg: 1, g: 1000, µg: 0.001, L: 1 }` | "Konsentrasi 500 mg/L. Tulis dalam g/L." |
| **Kimia — ppb** | `µg/L` | `{ µg: 1, mg: 1000, g: 1e6, L: 1 }` | "Konsentrasi 1000 µg/L = berapa mg/L?" |
| **Matematika — Persen** | `unit` | `{ "%": 0.01 }` | "Tentukan 75% dari 200." |

---

## 2. Sintaksis Satuan Majemuk

Parser mendukung satuan yang terdiri dari beberapa token yang dikalikan/dibagi.

### Pemisah (separator)

| Operator | Unicode | Contoh |
|---|---|---|
| `/` | U+002F | `m/s²` |
| `*` | U+002A | `kg*m/s^2` |
| `·` | U+00B7 | `kg·m/s²` |
| `×` | U+00D7 | `kg×m/s²` |
| `⋅` | U+22C5 | `kg⋅m/s²` |

**Aturan `/`:** tiap `/` membalik arah (pembilang ↔ penyebut).
`a/b/c` = `a / (b × c)` → `a × c⁻¹ × b⁻¹`.

### Eksponen

| Notasi | Contoh | Arti |
|---|---|---|
| `^N` (ASCII) | `m/s^2` | pangkat +2 |
| `^N` negatif | `m/s^-1` | pangkat −1 |
| Superskrip `²` | `m/s²` | pangkat +2 |
| Superskrip `³` | `kg/m³` | pangkat +3 |
| Superskrip `⁻¹` | `m·s⁻¹` | pangkat −1 |
| Superskrip `⁻²` | `m·s⁻²` | pangkat −2 |

> ⚠️ **Pangkat pecahan** (mis. `m^0.5` untuk akar kuadrat) **TIDAK didukung**.
> Eksponen harus bilangan bulat.

### Spasi

Spasi di sekitar pemisah dan eksponen opsional — semua bentuk ini identik:

```
72 km/jam
72km/jam
72 km / jam
72 km/jam
```

### Contoh ekuivalen

| Bentuk | Nilai |
|---|---|
| `9.8 m/s²` | 9.8 m·s⁻² |
| `9.8m/s^2` | 9.8 m·s⁻² |
| `9.8 m·s⁻²` | 9.8 m·s⁻² |
| `10 kg·m/s²` | 10 N |
| `10 kg×m/s²` | 10 N |
| `10 kg*m/s^-2` | 10 N |
| `5000 g` | 5 kg |
| `5 kW·jam` | 5 × 3.600.000 J = 18.000.000 J |
| `50 km` | 50.000 m |
| `1500 mL` | 1.5 L |
| `0.25 jam` | 900 s |

---

## 3. Aturan Validasi dan Penolakan

| Input | Hasil | Alasan |
|---|---|---|
| `72 km/jam` (unitFactors ada `km`, `jam`) | ✅ benar | Konversi ke basis: 72 × 1000 / 3600 = 20 m/s |
| `9.8 m/s²` (unitFactors ada `m`, `s`) | ✅ benar | Semua token dikenal |
| `5000 g` (unitFactors ada `g`) | ✅ benar | `g: 0.001` → 5 kg |
| `1500 ml` (unitFactors key `mL`) | ✅ benar | Lookup case-insensitive: `ml` === `mL` |
| `72 km/menit` (tanpa `menit`) | ❌ ditolak | Token `menit` tidak ada di `unitFactors` — tidak menebak |
| `9.8 km@jam` | ❌ ditolak | Karakter `@` ilegal (hanya spasi, `*`/`·`/`×`/`⋅`, `/`) |
| `9.8 km+jam` | ❌ ditolak | Karakter `+` ilegal |
| `m^0.5` | ❌ ditolak | Pangkat pecahan tidak didukung |
| `10 kg*m/s²` + jawaban `10` (tanpa unit) | ✅ benar | Angka tanpa unit dianggap sudah dalam basis |
| `10` (tanpa unitFactors) | ✅ benar | Tanpa unit → tanpa konversi |

> **Prinsip dasar: tidak menebak.** Jika satuan tidak terdaftar di `unitFactors`,
> jawaban ditolak (dinilai 0). Guru harus mendeklarasikan semua satuan yang diizinkan.

---

## 4. Menulis via Question Pack (Template Teks)

Untuk guru yang lebih suka format teks (CSV-like), gunakan format `question pack`:

```
# numeric | Prompt | | | | | Kunci | Poin | unit: expected;factors;toleransi

# Kecepatan: 72 km/jam = 20 m/s
numeric | Sebuah mobil bergerak 72 km/jam. Berapa m/s? | | | | | 20 | 10 | unit:m/s;m=1,km=1000,s=1,jam=3600;tol:0.5

# Percepatan: 9.8 m/s² (toleransi relatif 1%)
numeric | Gravitasi Bumi = 9.8 m/s². Tulis dengan satuan ini. | | | | | 9.8 | 10 | unit:m/s²;m=1,s=1;tolRel:0.01

# Gaya: 10 kg·m/s² = 10 N
numeric | Hitung gaya dari massa 10 kg × percepatan 1 m/s². | | | | | 10 | 10 | unit:N;N=1,kg=1,m=1,s=1;tol:0
```

**Catatan** (kolom 9) menggunakan prefix `unit:` untuk mendefinisikan satuan:

```
unit:<expectedUnit>;<key>=<factor>,<key>=<factor>,...;tol:<absolute>[;tolRel:<relative>]
```

| Parameter | Keterangan | Contoh |
|---|---|---|
| `unit:` | Prefix yang memicu parser satuan | — |
| `<expectedUnit>` | Basis konversi | `m/s`, `N`, `kg/m³` |
| `<key>=<factor>` | Pasangan key-faktor (dipisah koma) | `km=1000,jam=3600` |
| `tol:<n>` | Toleransi absolut | `tol:0.5` |
| `tolRel:<n>` | Toleransi relatif (proporsi) | `tolRel:0.01` (1%) |

---

## 5. Sintaksis Yang Didukung Lengkap

```
<angka> [<satuan>]

angka   → digit, desimal, notasi ilmiah (6.022e23, 1e-9)
satuan  → <token>[^<eksponen>] [<op> <token>[^<eksponen>]]*
token   → [A-Za-zµ%]+          (huruf Latin, µ, %)
eksponen→ (-)?\d+               (bulat, bisa negatif)
op      → / | * | · | × | ⋅ | spasi
```

**Superskrip Unicode yang dienkripsi otomatis:**
`⁰¹²³⁴⁵⁶⁷⁸⁹` → `^0`..`^9`, `⁻` → `^-`, `µ` tetap sebagai token.

---

## 6. Checklist untuk Guru Menulis Soal

- [ ] `expectedUnit` = basis yang diinginkan untuk jawaban benar.
- [ ] Setiap satuan yang mungkin ditulis murid sudah ada di `unitFactors`.
- [ ] Nilai faktor = berapa kali unit tsb lebih besar dari basis (di posisi pembilang).
- [ ] Gunakan `/` untuk pemisah pembilang/penyebut; tiap `/` membalik faktor.
- [ ] Pangkat > 1 pakai `^2`, `^3`, atau superskrip `²`/`³`.
- [ ] Pangkat negatif: `^-1` atau `⁻¹`.
- [ ] Jangan gunakan `^0.5` (akar) — tidak didukung.
- [ ] Toleransi `tol` (absolut) atau `tolRel` (proporsional) sesuai kebutuhan.
- [ ] Test di tampilan soal dengan jawaban dalam berbagai satuan sebelum publish.

---

## 7. Quick Reference — Common Conversions

### Physics

| Quantity | expectedUnit | unitFactors (JSON) | Example answer |
|---|---|---|---|
| Velocity | `m/s` | `{"m":1,"km":1000,"s":1,"jam":3600}` | `20 m/s` or `72 km/jam` |
| Acceleration | `m/s²` | `{"m":1,"s":1}` | `9.8 m/s²` |
| Force | `N` | `{"N":1,"kg":1,"m":1,"s":1}` | `10 N` or `10 kg*m/s^2` |
| Energy | `J` | `{"J":1,"kJ":0.001,"kW":1000,"jam":3600}` | `3600000 J` or `1 kW*jam` |
| Density | `kg/m³` | `{"kg":1,"g":0.001,"m":1,"L":0.001}` | `1000 kg/m³` or `1 g/mL` |
| Pressure | `Pa` | `{"Pa":1,"kPa":1000,"atm":101325,"bar":100000}` | `101325 Pa` or `1 atm` |

### Chemistry

| Quantity | expectedUnit | unitFactors (JSON) | Example answer |
|---|---|---|---|
| Molar mass | `g/mol` | `{"g":1,"kg":1000,"mg":0.001,"mol":1}` | `18 g/mol` or `0.018 kg/mol` |
| Molarity | `mol/L` | `{"mol":1,"mmol":0.001,"L":1,"mL":0.001}` | `0.5 mol/L` or `500 mmol/L` |
| Concentration | `mg/L` | `{"mg":1,"g":1000,"µg":0.001,"L":1}` | `500 mg/L` or `0.5 g/L` |
| Mass | `kg` | `{"kg":1,"g":0.001,"mg":0.000001}` | `5 kg` or `5000 g` |

### Common Mistakes

| ❌ Wrong | ✅ Correct | Why |
|---|---|---|
| `km/menit` (tanpa `menit` di unitFactors) | Tambahkan `menit: 60` ke unitFactors | Token tak dikenal → ditolak |
| `m^0.5` | Tidak didukung | Pangkat pecahan tidak ada |
| `km@jam` | `km/jam` | `@` bukan operator valid |
| `10` tanpa unit (saat soal minta unit) | `10 m/s` | Angka polos = basis; oke jika soal tidak wajib unit |
| `5000` (expected=5, unitFactors `g: 0.001`) | `5000 g` | 5000 tanpa unit = 5000 basis, bukan 5 kg |
