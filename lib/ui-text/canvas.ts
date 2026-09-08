/** Kanvas anotasi sains/math — label bilingual (student work + teacher feedback). */
export const CANVAS = {
  titleStudent: { id: "Kanvas jawaban (coretanmu)", en: "Answer canvas (your work)" },
  titleFeedback: { id: "Umpan balik guru (coretan)", en: "Teacher feedback (annotations)" },
  titleTeacherFeedback: { id: "Kanvas umpan balik", en: "Feedback canvas" },
  pen: { id: "Pena", en: "Pen" },
  highlighter: { id: "Stabilo", en: "Highlighter" },
  eraser: { id: "Penghapus", en: "Eraser" },
  undo: { id: "Undo", en: "Undo" },
  clear: { id: "Bersihkan", en: "Clear" },
  colors: { id: "Warna", en: "Colors" },
  width: { id: "Ketebalan", en: "Width" },
  saving: { id: "Menyimpan coretan…", en: "Saving drawing…" },
  saved: { id: "Tersimpan", en: "Saved" },
  saveFailed: { id: "Gagal menyimpan coretan. Coba lagi.", en: "Failed to save drawing. Try again." },
  loadFailed: { id: "Gagal memuat kanvas.", en: "Failed to load canvas." },
  emptyHint: {
    id: "Gambar di sini dengan pena/stabilo — jawabanmu tersimpan otomatis.",
    en: "Draw here with pen/highlighter — your work is saved automatically.",
  },
  readonlyHint: {
    id: "Mode baca: coretan tidak bisa diubah di sini.",
    en: "Read-only: drawing cannot be changed here.",
  },
} as const;
