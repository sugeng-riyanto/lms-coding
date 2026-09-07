/**
 * Template prompt AI + format untuk BANK SOAL (question pack).
 *
 * Guru menyalin prompt ini ke AI bersama materi/teks sumber, dan AI
 * mengembalikan teks pack SATU SOAL PER BARIS yang PERSIS diterima
 * parseQuestionPack (lib/question-pack): kolom dipisah `|`. Hasilnya
 * ditempel langsung ke kotak "Import bank soal (pack)" — tanpa JSON.
 *
 * Aturan ditulis agar keluaran AI selalu jatuh ke grammar parser. Kunci
 * jawaban TIDAK boleh dikarang: bila sumber tidak memuat kunci yang
 * tepercaya, AI harus memilih tipe essay dan menaruh pedoman di Catatan.
 */

export interface QuestionPackAiPromptOptions {
  /** Topik/materi bank soal (opsional). */
  topic?: string;
  /** Jumlah soal yang diminta (opsional). */
  count?: number;
  /** Instruksi tambahan guru (opsional). */
  extra?: string;
}

/** Spesifikasi format pack — dipakai prompt dan bisa ditampilkan di UI. */
export const QUESTION_PACK_FORMAT_GUIDE = `FORMAT PACK YANG DIDUKUNG LMS (SATU SOAL PER BARIS)
Kolom dipisah tanda | tepat 9 kolom:
TIPE | Prompt | OpsiA | OpsiB | OpsiC | OpsiD | Kunci | Poin | Catatan

1. TIPE (alias): sc=single_choice, mc=multiple_choice, tf=true_false, essay=essay_manual.
2. Prompt: pertanyaan jelas (min. 3 karakter); tanpa HTML; simbol kode boleh memakai backtick.
3. Opsi A–D: hanya untuk sc/mc (min. 2 opsi, maks. 4). Untuk tf/essay KOSONGKAN semua opsi.
4. Kunci: sc → huruf opsi (A–D, contoh B); mc → huruf dipisah ; atau , (contoh A;C);
   tf → benar atau salah; essay → KOSONG (dinilai manual; Catatan = pedoman/model jawaban guru).
5. Poin: angka ≥ 0; default 10 bila dikosongkan.
6. Catatan: opsional; untuk essay WAJIB berisi pedoman penilaian singkat.

ATURAN MUTU SOAL
- Jawaban benar TIDAK boleh mencolok dari panjang/redaksi opsi; distractor masuk akal.
- Kunci hanya ditulis bila sumber tepercaya memuatnya.
- TANPA tabel/HTML/baris kosong di antara soal (baris kosong diabaikan, komentar diawali #).`;

/** Prompt siap-salin untuk membuat bank soal via AI (Bahasa Indonesia). */
export function buildQuestionPackAiPrompt(opts: QuestionPackAiPromptOptions = {}): string {
  const topic = opts.topic?.trim();
  const count =
    Number.isFinite(Number(opts.count)) && Number(opts.count) > 0 ? Math.floor(Number(opts.count)) : 10;
  const extra = opts.extra?.trim();
  const topicLine = topic ? `Topik materi: ${topic}` : "Topik materi: <topik/materi>";
  const lines = [
    "Kamu adalah penyusun soal (item writer) untuk LMS coding sekolah. Buat bank soal dari teks sumber di bawah dalam FORMAT PACK yang didukung platform.",
    "",
    "ATURAN FORMAT:",
    QUESTION_PACK_FORMAT_GUIDE,
    "",
    `TUGAS: susun ${count} soal yang bervariasi (campuran sc/mc/tf dan essay bila topik cocok), bertingkat dari mudah ke sulit, mencakup pemahaman konsep dan aplikasi kecil.`,
    "",
    "KONTRAK KELUARAN:",
    "- Hanya keluarkan baris-baris pack (boleh diawali baris komentar #). Tanpa kata pengantar, tanpa penomoran, tanpa tabel, tanpa blok kode yang membungkus seluruh jawaban.",
    "- Prompt soal dalam Bahasa Indonesia (kecuali istilah/kode).",
    "- Jangan menebak kunci: jika sumber tidak memuat kunci tepercaya, jadikan soal essay dan tulis pedoman penilaian di kolom Catatan.",
    "- Essay wajib mengisi kolom Catatan dengan pedoman/model jawaban singkat untuk guru.",
    ...(extra ? ["", `INSTRUKSI TAMBAHAN DARI GURU: ${extra}`] : []),
    "",
    `${topicLine}`,
    "Teks sumber:",
    "<salin materi/teks sumber di sini — atau tempel tautan yang bisa dibaca>",
  ];
  return lines.join("\n");
}
