import type { TextDict } from "@/lib/i18n";

/** CodeRunner (components/code-runner) — dipakai activity-view & page quiz. */
export const CODE = {
  title: { id: "Praktek coding — jalankan & lihat output", en: "Coding practice — run & see the output" },
  copyCode: { id: "Salin kode", en: "Copy code" },
  copied: { id: "Tersalin ✓", en: "Copied ✓" },
  language: { id: "Bahasa", en: "Language" },
  inBrowserWasm: { id: "⚡ in-browser (WASM)", en: "⚡ in-browser (WASM)" },
  loadExample: { id: "Muat contoh {language}", en: "Load {language} example" },
  stdinLabel: { id: "Input (stdin, opsional)", en: "Input (stdin, optional)" },
  stdinPlaceholder: { id: "mis. 5", en: "e.g. 5" },
  codeLabel: { id: "Kode ({language})", en: "Code ({language})" },
  running: { id: "Menjalankan…", en: "Running…" },
  run: { id: "▶ Jalankan", en: "▶ Run" },
  browserEngineNote: {
    id: "Dieksekusi di browser Anda (WebAssembly Pyodide). Kode & output tidak meninggalkan perangkat.",
    en: "Executed in your browser (WebAssembly Pyodide). Code & output never leave your device.",
  },
  externalEngineNote: {
    id: "Dieksekusi di sandbox eksternal (bukan server LMS). Output & kode tidak disimpan.",
    en: "Executed in an external sandbox (not the LMS server). Output & code are not stored.",
  },
  badResponse: { id: "Respons server tidak terbaca.", en: "Server response could not be read." },
  unauthorized: { id: "Silakan masuk dulu.", en: "Please sign in first." },
  networkError: {
    id: "Gagal menghubungi server. Cek koneksi lalu coba lagi.",
    en: "Failed to reach the server. Check your connection and try again.",
  },
  output: { id: "Output", en: "Output" },
  stdoutEmpty: { id: "(stdout kosong)", en: "(empty stdout)" },
  aiPromptTitle: {
    id: "🤖 Prompt AI — pahami/perbaiki kode ini",
    en: "🤖 AI prompt — understand/fix this code",
  },
  aiPromptBody: {
    id: "Salin prompt lalu kirim ke AI bersama (opsional) output di atas. Prompt hanya memuat kode + output — tanpa data murid.",
    en: "Copy the prompt and send it to an AI together with (optional) the output above. The prompt contains only code + output — no student data.",
  },
  copyAiPrompt: { id: "Salin prompt AI", en: "Copy AI prompt" },
} as const satisfies TextDict;
