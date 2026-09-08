import type { TextDict } from "@/lib/i18n";

/** Teacher question bank: `/teacher/questions` page + QuestionBank + RubricEditor. */
export const QUESTION = {
  // Page shell
  title: { id: "Bank soal", en: "Question bank" },
  subtitle: {
    id: "Soal berversi; kunci jawaban tidak pernah ke browser murid. Soal esai/proyek dapat diberi rubrik penilaian berversi.",
    en: "Versioned questions; answer keys never reach the student's browser. Essay/project questions can carry versioned grading rubrics.",
  },

  // Notice prefix
  failPrefix: { id: "Gagal: {error}", en: "Failed: {error}" },

  // Pack import
  packTitle: {
    id: "Import bank soal (pack) — MCQ/esai/kombinasi",
    en: "Import question pack — MCQ/essay/combined",
  },
  packDesc: {
    id: "Satu baris = satu soal. Kolom dipisah | : TIPE | Prompt | OpsiA–D | Kunci | Poin | Catatan. Tipe: sc/mc/tf/essay. Kunci = huruf opsi (mis. B atau A;C), benar/salah untuk tf; esai dinilai manual (Catatan jadi pedoman guru).",
    en: "One line = one question. Columns separated by |: TYPE | Prompt | Options A–D | Key | Points | Note. Types: sc/mc/tf/essay. Key = option letter (e.g. B or A;C), true/false for tf; essays are graded manually (the Note becomes the teacher's guide).",
  },
  packSample: { id: "Lihat contoh template (salin lalu tempel)", en: "See sample template (copy & paste)" },
  aiPromptSummary: {
    id: "🤖 Template prompt AI + format bank soal",
    en: "🤖 AI prompt template + question-pack format",
  },
  aiPromptDesc: {
    id: "Salin prompt di bawah, kirim ke AI bersama materi/teks sumber. AI mengembalikan baris pack (1 baris = 1 soal) yang langsung diterima kolom import di atas — termasuk kunci untuk soal yang kuncinya ada di sumber.",
    en: "Copy the prompt below and send it to an AI along with your source material/text. The AI returns pack lines (1 line = 1 question) accepted directly by the import box above — including keys for questions whose key is present in the source.",
  },
  aiTopicLabel: {
    id: "Topik materi (opsional — prompt otomatis dipersonalisasi)",
    en: "Lesson topic (optional — prompt is auto-personalized)",
  },
  aiTopicPlaceholder: { id: "Mis. Perulangan Python", en: "e.g. Python loops" },
  aiCountLabel: { id: "Jumlah soal", en: "Question count" },
  aiFormatSummary: { id: "Lihat ringkasan format (aturan cepat)", en: "See format summary (quick rules)" },
  aiCopied: { id: "Tersalin ✓", en: "Copied ✓" },
  copyAiPrompt: { id: "Salin prompt AI", en: "Copy AI prompt" },
  packPlaceholder: {
    id: "Tempel dulu isi template (baris per soal).",
    en: "Paste the template content first (one line per question).",
  },
  importFailed: { id: "Import gagal: {error}", en: "Import failed: {error}" },
  packCreated: { id: "{created} soal dibuat.", en: "{created} questions created." },
  noValidRows: { id: "Tidak ada soal valid.", en: "No valid questions." },
  packImported: { id: "{created} soal diimpor ke bank.", en: "{created} questions imported to the bank." },
  importPack: { id: "Import pack", en: "Import pack" },
  importPackAria: { id: "Import bank soal (pack)", en: "Import question pack" },

  // New question form
  newQuestionTitle: { id: "+ Soal baru", en: "+ New question" },
  newQuestionAria: { id: "Tambah soal", en: "Add question" },
  typeLabel: { id: "Tipe", en: "Type" },
  promptLabel: { id: "Prompt", en: "Prompt" },
  mediaLabel: { id: "Lampirkan media (opsional)", en: "Attach media (optional)" },
  mediaNone: { id: "Tanpa media", en: "No media" },
  mediaUrlLabel: { id: "URL media", en: "Media URL" },
  optionsLabel: {
    id: "Opsi jawaban (wajib ≥2, satu per baris — kunci versi harus sama persis dengan salah satunya)",
    en: "Answer options (required ≥2, one per line — the version key must exactly match one of them)",
  },
  add: { id: "Tambah", en: "Add" },
  errOptions: {
    id: "Gagal: soal pilihan butuh ≥2 opsi (satu per baris).",
    en: "Failed: choice questions need ≥2 options (one per line).",
  },
  created: {
    id: "Soal dibuat. Tambahkan versi + kunci di bawah.",
    en: "Question created. Add a version + key below.",
  },

  // Version publish form
  versionTitle: { id: "Terbit versi + kunci jawaban", en: "Publish version + answer key" },
  versionAria: { id: "Terbit versi soal", en: "Publish question version" },
  questionLabel: { id: "Soal", en: "Question" },
  pointsLabel: { id: "Poin", en: "Points" },
  keyLabel: {
    id: "Kunci (baris key=value; mis. correct=b · corrects=a,c · expected=3.14, tolAbs=0.01 · accepted=Soekarno). Untuk soal pilihan, nilai correct/corrects harus sama persis dengan teks opsi di atas, atau versi ditolak (INVALID_KEY).",
    en: "Key (key=value lines; e.g. correct=b · corrects=a,c · expected=3.14, tolAbs=0.01 · accepted=Soekarno). For choice questions, correct/corrects must exactly match one of the options above, or the version is rejected (INVALID_KEY).",
  },
  publish: { id: "Terbit versi", en: "Publish version" },
  versionFail: { id: "Gagal versi: {error}", en: "Version failed: {error}" },
  versionPublished: { id: "Versi {n} terbit.", en: "Version {n} published." },
  errGradingFormat: { id: "Format grading tidak valid.", en: "Invalid grading format." },

  // List
  listAria: { id: "Daftar soal", en: "Question list" },
  noVersions: { id: "belum ada versi", en: "no version yet" },
  bankEmpty: { id: "Bank masih kosong.", en: "The bank is still empty." },
  selectPrompt: { id: "— pilih —", en: "— select —" },
} as const satisfies TextDict;

/** RubricEditor (shared component used by the question bank). */
export const RUBRIC_EDITOR = {
  attached: { id: "Rubrik v{version}: {title}", en: "Rubric v{version}: {title}" },
  editTo: { id: "Edit → versi {version}", en: "Edit → version {version}" },
  criterionLine: { id: "{title} — {points} poin", en: "{title} — {points} points" },
  reversionNote: {
    id: "Mengedit rubrik menaikkan versi dan menyimpan salinan kriteria — versi lama tetap utuh untuk riwayat nilai yang sudah tercatat.",
    en: "Editing a rubric bumps the version and stores a copy of the criteria — older versions stay intact for the recorded grade history.",
  },
  publishFirst: {
    id: "Terbitkan versi soal terlebih dahulu untuk memakai rubrik.",
    en: "Publish a question version first to use a rubric.",
  },
  editHeading: {
    id: "Edit rubrik v{from} → v{to}",
    en: "Edit rubric v{from} → v{to}",
  },
  newHeading: { id: "Rubrik baru — soal v{version}", en: "New rubric — question v{version}" },
  cancel: { id: "Batal", en: "Cancel" },
  titleLabel: { id: "Judul rubrik", en: "Rubric title" },
  titlePlaceholder: { id: "Mis. Rubrik Esai Pemrograman", en: "e.g. Programming Essay Rubric" },
  criterionLabel: { id: "Kriteria {n}", en: "Criterion {n}" },
  criterionPlaceholder: { id: "Mis. Ketepatan algoritma", en: "e.g. Algorithm accuracy" },
  maxPointsLabel: { id: "Poin maks", en: "Max points" },
  removeAria: { id: "Hapus kriteria {n}", en: "Remove criterion {n}" },
  remove: { id: "Hapus", en: "Remove" },
  addCriterion: { id: "+ Kriteria", en: "+ Criterion" },
  saving: { id: "Menyimpan…", en: "Saving…" },
  saveNewVersion: { id: "Simpan sebagai versi baru", en: "Save as new version" },
  saveRubric: { id: "Simpan rubrik", en: "Save rubric" },
  errFill: {
    id: "Isi judul rubrik (min. 3 karakter) dan minimal satu kriteria dengan poin > 0.",
    en: "Fill in a rubric title (min. 3 characters) and at least one criterion with points > 0.",
  },
  errNoVersion: {
    id: "Gagal menyimpan rubrik: versi soal belum tersedia.",
    en: "Failed to save rubric: question version not available yet.",
  },
  errSave: { id: "Gagal menyimpan rubrik: {error}.", en: "Failed to save rubric: {error}." },
} as const satisfies TextDict;
