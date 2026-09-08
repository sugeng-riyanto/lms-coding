import type { TextDict } from "@/lib/i18n";

/** Level manager + content bulk import (app/(teacher)/teacher/courses/[id]/levels/**). */
export const LEVEL: TextDict = {
  // ---- level page shell ----
  loadFailed: { id: "Data level tidak dapat dimuat.", en: "Level data could not be loaded." },
  backToManageCourse: { id: "← Kelola course", en: "← Manage course" },
  objectivePrefix: { id: "Objective: ", en: "Objective: " },
  objectiveEmpty: { id: "kosong — wajib diisi sebelum publish", en: "empty — required before publishing" },

  // ---- level-manager forms ----
  addModuleTitle: { id: "+ Module", en: "+ Module" },
  addLessonTitle: { id: "+ Lesson", en: "+ Lesson" },
  addActivityTitle: { id: "+ Activity", en: "+ Activity" },
  titleLabel: { id: "Judul", en: "Title" },
  moduleLabel: { id: "Module", en: "Module" },
  lessonLabel: { id: "Lesson", en: "Lesson" },
  typeLabel: { id: "Tipe", en: "Type" },
  objectiveLabel: { id: "Objective (min 10 karakter)", en: "Objective (min 10 characters)" },
  selectPlaceholder: { id: "— pilih —", en: "— select —" },
  addButton: { id: "Tambah", en: "Add" },
  contentLabelJson: { id: "Konten JSON", en: "Content JSON" },
  contentLabelMarkdown: { id: "Konten Markdown (atau JSON)", en: "Content Markdown (or JSON)" },
  examplePrefix: { id: "Contoh: ", en: "Example: " },

  // ---- level-manager notices ----
  addModuleFailed: { id: "Gagal tambah module: {error}", en: "Failed to add module: {error}" },
  moduleAdded: { id: "Module ditambahkan.", en: "Module added." },
  pickModuleFirst: { id: "Pilih module dulu.", en: "Pick a module first." },
  addLessonFailed: { id: "Gagal tambah lesson: {error}", en: "Failed to add lesson: {error}" },
  lessonAdded: { id: "Lesson ditambahkan.", en: "Lesson added." },
  pickLessonFirst: { id: "Pilih lesson dulu.", en: "Pick a lesson first." },
  contentMustBeJson: { id: "Konten harus objek JSON.", en: "Content must be a JSON object." },
  contentNotValidJson: { id: "Konten bukan JSON valid.", en: "Content is not valid JSON." },
  addActivityFailed: { id: "Gagal tambah activity: {error}", en: "Failed to add activity: {error}" },
  activityAdded: { id: "Activity ditambahkan.", en: "Activity added." },
  reorderFailed: { id: "Gagal reorder: {error}", en: "Reorder failed: {error}" },
  orderUpdated: { id: "Urutan diperbarui.", en: "Order updated." },

  // ---- AI prompt panel ----
  aiPanelSummary: {
    id: "🤖 Template prompt AI + format materi",
    en: "🤖 AI prompt template + material format",
  },
  aiPanelBody: {
    id: "Salin prompt di bawah, kirim ke AI bersama teks sumber (mis. halaman tutorial yang diadopsi). AI mengembalikan Markdown yang langsung diterima platform — tempel hasilnya ke kolom konten di atas.",
    en: "Copy the prompt below, send it to the AI together with the source text (e.g. the tutorial page being adopted). The AI returns Markdown the platform accepts directly — paste the result into the content field above.",
  },
  aiTopicLabel: {
    id: "Topik materi (opsional — prompt otomatis dipersonalisasi)",
    en: "Material topic (optional — the prompt is auto-personalized)",
  },
  aiTopicPlaceholder: { id: "Mis. Perulangan for di Python", en: "E.g. for-loops in Python" },
  aiTopicHint: {
    id: "Terisi otomatis dari judul activity — boleh diganti manual.",
    en: "Auto-filled from the activity title — you can edit it manually.",
  },
  aiFormatSummary: { id: "Lihat ringkasan format (aturan cepat)", en: "View format summary (quick rules)" },
  copied: { id: "Tersalin ✓", en: "Copied ✓" },
  copyPrompt: { id: "Salin prompt AI", en: "Copy AI prompt" },

  // ---- structure ----
  structureSection: { id: "Struktur konten", en: "Content structure" },
  noModules: { id: "Belum ada module.", en: "No modules yet." },
  moduleHeading: { id: "Module: {title}", en: "Module: {title}" },
  noLessons: { id: "Belum ada lesson.", en: "No lessons yet." },
  assessmentLink: { id: "Assessment", en: "Assessment" },

  // ---- content hints (JSON examples per activity type) ----
  hintArticle: {
    id: 'Markdown mentah (tanpa kurung kurawal) — # judul, ``` kode, ![alt](url) gambar, teks → paragraf. \nJSON juga tetap diterima: {"blocks":[…] atau {"body":"teks polos"}',
    en: 'Raw Markdown (no curly braces) — # heading, ``` code, ![alt](url) image, text → paragraph. \nJSON is also accepted: {"blocks":[…] or {"body":"plain text"}',
  },
  hintVideoLink: {
    id: '{"url": "https://…", "transcript": "Transkrip aksesibel"}',
    en: '{"url": "https://…", "transcript": "Accessible transcript"}',
  },
  hintResource: { id: '{"url": "https://…"}', en: '{"url": "https://…"}' },
  hintReflection: { id: "{}", en: "{}" },
  hintQuiz: { id: "{}", en: "{}" },
  hintAssignmentUpload: { id: "{}", en: "{}" },
  hintRoblox: { id: '{"placeId": "…", "instruction": "…"}', en: '{"placeId": "…", "instruction": "…"}' },
  hintCodeBoard: {
    id: '{"code": "print(\'Halo dunia\')", "language": "python", "transcript": "Penjelasan alternatif"}',
    en: '{"code": "print(\'Hello world\')", "language": "python", "transcript": "Alternative explanation"}',
  },
  hintEmbedYoutube: {
    id: '{"url": "https://www.youtube.com/watch?v=ID"}',
    en: '{"url": "https://www.youtube.com/watch?v=ID"}',
  },
  hintEmbedPdf: {
    id: '{"url": "https://…/materi.pdf", "title": "Opsional"}',
    en: '{"url": "https://…/materi.pdf", "title": "Optional"}',
  },
  hintEmbedAudio: {
    id: '{"url": "https://…/audio.mp3", "transcript": "Transkrip"}',
    en: '{"url": "https://…/audio.mp3", "transcript": "Transcript"}',
  },
  hintEmbedFile: {
    id: '{"url": "https://…/berkas.zip", "title": "Nama berkas"}',
    en: '{"url": "https://…/file.zip", "title": "File name"}',
  },
  hintEmbedWeb: {
    id: '{"url": "https://phet.colorado.edu/sims/html/…/index.html", "title": "Opsional"} — host: PhET, oPhysics, Google Drive',
    en: '{"url": "https://phet.colorado.edu/sims/html/…/index.html", "title": "Optional"} — hosts: PhET, oPhysics, Google Drive',
  },
  hintEmbedVideo: {
    id: '{"url": "https://drive.google.com/file/d/…/view", "title": "Opsional"} — Drive atau URL video http(s)',
    en: '{"url": "https://drive.google.com/file/d/…/view", "title": "Optional"} — Drive or http(s) video URL',
  },

  // ---- content bulk import ----
  bulkTitle: { id: "Bulk impor materi (XLSX)", en: "Bulk material import (XLSX)" },
  bulkDesc: {
    id: "Kolom: Module, Lesson, Objective (opsional), Activity Type, Activity Title, Content JSON (opsional). Materi masuk ke level ini sebagai draf.",
    en: "Columns: Module, Lesson, Objective (optional), Activity Type, Activity Title, Content JSON (optional). Materials enter this level as a draft.",
  },
  templateLabel: { id: "Template materi", en: "Material template" },
  exportLabel: { id: "Unduh materi kursus (XLSX)", en: "Download course material (XLSX)" },
  capacityText: { id: "Maksimal {n} baris per file", en: "Up to {n} rows per file" },
  fileLabel: { id: "Berkas XLSX", en: "XLSX file" },
  processing: { id: "Memproses…", en: "Processing…" },
  importButton: { id: "Impor materi", en: "Import material" },
  fileMustBeXlsx: { id: "Berkas harus berformat .xlsx.", en: "The file must be in .xlsx format." },
  fileEmpty: { id: "Berkas kosong (0 byte).", en: "The file is empty (0 bytes)." },
  fileTooLarge: { id: "Berkas melebihi batas ukuran 5 MB.", en: "The file exceeds the 5 MB size limit." },
  fileMimeRejected: {
    id: "Jenis berkas tidak dikenali sebagai spreadsheet.",
    en: "The file type is not recognized as a spreadsheet.",
  },
  rowsOverCap: {
    id: "File melebihi batas {cap} baris valid. Pecah menjadi beberapa file.",
    en: "The file exceeds the {cap} valid-row limit. Split it into multiple files.",
  },
  importDone: {
    id: "Selesai: {modules} module, {lessons} lesson, {activities} aktivitas.",
    en: "Done: {modules} modules, {lessons} lessons, {activities} activities.",
  },
  importFailed: { id: "Gagal: {error}", en: "Failed: {error}" },
} as const;
