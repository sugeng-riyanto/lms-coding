/**
 * Template prompt AI + format untuk authoring materi (article).
 *
 * Tujuan: guru menyalin prompt ini ke AI (mis. ChatGPT/Claude/Gemini) bersama
 * teks sumber (artikel/tutorial seperti codewithharry), dan AI mengembalikan
 * Markdown yang PERSIS diterima parseMarkdownToBlocks (lib/markdown-blocks):
 * heading ATX, fence kode, gambar `![alt](url)` baris sendiri, paragraf polos.
 * Hasilnya ditempel langsung ke kolom konten article — tidak perlu JSON.
 *
 * Aturan ditulis agar keluaran AI selalu jatuh ke grammar yang didukung; semua
 * konstruksi Markdown lain (tabel, daftar -, tautan, bold) TIDAK dirender oleh
 * LMS dan akan tampil sebagai teks mentah.
 */

export interface MarkdownAiPromptOptions {
  /** Topik/judul materi yang sedang disusun (opsional, diisi di baris "Teks sumber"). */
  topic?: string;
  /** Instruksi tambahan guru (opsional), mis. jenjang/kelas atau gaya bahasa. */
  extra?: string;
}

/** Spesifikasi format yang didukung — dipakai prompt dan bisa ditampilkan di UI. */
export const MARKDOWN_FORMAT_GUIDE = `FORMAT MARKDOWN YANG DIDUKUNG LMS (HANYA INI)
1. Judul bagian — baris diawali tanda pagar: # judul bab, ## bagian, ### sub-bagian, #### detail.
2. Paragraf — teks polos; pisahkan paragraf dengan baris kosong.
3. Kode — blok fence dengan bahasa: \`\`\`python ... \`\`\` (selalu sertakan bahasa).
4. Gambar/ilustrasi — satu baris sendiri: ![deskripsi alt singkat](https://url-gambar).
   Setiap gambar wajib punya alt (aksesibilitas); URL harus http(s).
5. Batas: maksimal 60 blok per halaman; tanpa HTML/iframe/CSS.

TIDAK DIDUKUNG (jangan dipakai — akan tampil sebagai teks mentah):
- Tabel, daftar berpoin (- / *), tautan [teks](url), tebal **teks**, miring *teks*, kutipan >, garis pemisah ---.
- Teks kode di luar fence; HTML mentah; emoji dekoratif berlebihan.`;

/** Prompt siap-salin untuk mengubah teks sumber menjadi materi LMS (Bahasa Indonesia). */
export function buildMarkdownAiPrompt(opts: MarkdownAiPromptOptions = {}): string {
  const topic = opts.topic?.trim();
  const extra = opts.extra?.trim();
  const sourceHeader = topic ? `Topik materi: ${topic}` : "Topik materi: <topik/lesson>";
  const lines = [
    "Kamu adalah penulis materi pembelajaran coding untuk LMS sekolah. Ubah teks sumber di bawah menjadi halaman bacaan Markdown yang TEPAT sesuai format yang didukung platform.",
    "",
    "ATURAN FORMAT:",
    MARKDOWN_FORMAT_GUIDE,
    "",
    "STRUKTUR HALAMAN YANG DISARANKAN:",
    "- # satu judul bab (ringkas, informatif).",
    "- Paragraf pembuka: apa yang akan dipelajari dan mengapa penting (2-3 kalimat).",
    "- ## bagian-bagian materi: penjelasan bertahap, ilustrasi bila ada, dan contoh kode yang bisa dicoba murid.",
    "- Akhiri dengan paragraf rangkuman singkat.",
    "- Bila sesuai, tambahkan ## Latihan: 2-3 pertanyaan pemahaman singkat (tanpa kunci — kunci dikelola guru terpisah).",
    "",
    "KONTRAK KELUARAN:",
    "- Hanya keluarkan Markdown halaman bacaan; tanpa kata pengantar, tanpa penutup, tanpa blok kode yang membungkus seluruh jawaban.",
    "- Pertahankan struktur topik, jangan menyingkat materi inti, jangan menambahkan fakta yang tidak ada di teks sumber.",
    "- Semua kode dalam fence dengan bahasa yang benar; contoh kode harus bisa dijalankan.",
    "- Bahasa utama: Indonesia (kecuali kode dan istilah teknis).",
    ...(extra ? ["", `INSTRUKSI TAMBAHAN DARI GURU: ${extra}`] : []),
    "",
    `${sourceHeader}`,
    "Teks sumber:",
    "<salin teks/artikel sumber di sini — atau tempel tautan yang bisa dibaca>",
  ];
  return lines.join("\n");
}
