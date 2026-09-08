/**
 * Rule lokal: lindungi kebijakan bahasa UI (docs/language-policy.md).
 * Dua gol:
 *  1. Shell publik (auth, verifier, health, error/not-found/unauthorized/
 *     inactive, landing, layout, theme-toggle) WAJIB English — dashboard peran
 *     sengaja Bahasa Indonesia.
 *  2. Permukaan yang sudah diterjemahkan penuh lewat t()/mkT (teacher dash /
 *     certificates / analytics, student learn, komponen berbagi) TIDAK BOLEH
 *     punya teks Indonesia hardcoded sebagai literal: string UI baru harus
 *     masuk dictionary lib/ui-text, bukan ditulis inline (CI: --max-warnings=0).
 * Rule hanya aktif pada path yang dipilih di eslint.config.mjs dan menandai
 * kata Indonesia yang tidak ambigu sebagai warning (CI: --max-warnings=0).
 */
export const INDONESIAN_UI_WORDS = [
  "masuk",
  "kata sandi",
  "simpan",
  "batal",
  "hapus",
  "tambah",
  "beranda",
  "pengaturan",
  "lanjutkan",
  "belajar",
  "murid",
  "guru",
  "wali",
  "kelas",
  "nilai",
  "soal",
  "ujian",
  "sertifikat",
  "verifikasi",
  "analitik",
  "antrian",
  "penilaian",
  "matriks",
  "sinyal",
  "risiko",
  "muat ulang",
  "memuat",
  "perbarui",
  "tidak ditemukan",
  "terjadi kesalahan",
  "kembali",
  "unduh",
  "penerima",
  "terbit",
  "cocok",
  "menunggu",
  "berhasil",
  "gagal",
  "daftar",
  "lihat",
  "buka",
  "tutup",
  "diperbarui",
  "selesai",
  "terkunci",
  "dikerjakan",
  "ringkasan",
  "tugas",
  "jawaban",
  "kunci jawaban",
  "bobot",
  "pencapaian",
  "kompetensi",
  "penguasaan",
];

// Escape kata untuk dipakai sebagai frasa utuh (word boundary).
export const INDO_WORD_RE = new RegExp(
  `\\b(?:${INDONESIAN_UI_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);

export function uiTextOf(value) {
  if (!value) return null;
  if (value.type === "Literal" || value.type === "StringLiteral") {
    return typeof value.value === "string" ? value.value : null;
  }
  if (value.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis.map((q) => q.value.cooked ?? "").join("");
  }
  return null;
}

export const noIndonesianShellText = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flags Indonesian UI words hardcoded in English-only shells and t()-routed pages",
      recommended: false,
    },
    messages: {
      indoText:
        'Teks Indonesia "{{text}}" hardcoded. Kebijakan bahasa (docs/language-policy.md): shell publik WAJIB English; halaman yang sudah bilingual lewat t()/mkT hanya boleh memuat Indonesia lewat dictionary (lib/ui-text), bukan literal inline.',
    },
    schema: [],
  },
  create(context) {
    const checkText = (node, text) => {
      if (!text) return;
      const m = INDO_WORD_RE.exec(text);
      if (m?.[0]) {
        context.report({ node, messageId: "indoText", data: { text: m[0] } });
      }
    };
    return {
      JSXText(node) {
        checkText(node, node.value);
      },
      Literal(node) {
        checkText(node, typeof node.value === "string" ? node.value : null);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) checkText(node, uiTextOf(node));
      },
    };
  },
};
