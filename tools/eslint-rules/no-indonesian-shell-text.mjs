/**
 * Rule lokal: lindungi kebijakan bahasa UI (docs/language-policy.md).
 * Shell publik (auth, verifier, health, error/not-found/unauthorized/inactive,
 * landing, layout, theme-toggle) WAJIB English; dashboard peran (teacher /
 * student / guardian / profile / settings) sengaja tetap Bahasa Indonesia.
 * Rule ini hanya aktif di path shell (files di eslint.config.mjs) dan menandai
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
      description: "Flags Indonesian UI words in public/shell components (English required)",
      recommended: false,
    },
    messages: {
      indoText:
        'Teks Indonesia "{{text}}" di komponen shell publik. Shell WAJIB English (docs/language-policy.md): pakai padanan Inggris, atau pindahkan label ke dashboard peran bila memang untuk pengguna internal.',
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
