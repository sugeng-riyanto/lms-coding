import type { TextDict } from "@/lib/i18n";

/** UploadBox (components/upload-box) — dipakai quiz-taker & activity-view. */
export const UPLOAD = {
  label: { id: "Unggah berkas (PDF/PNG/JPEG ≤10MB)", en: "Upload file (PDF/PNG/JPEG ≤10MB)" },
  typeRejected: {
    id: "Tipe file ditolak. Hanya PDF/PNG/JPEG.",
    en: "File type rejected. PDF/PNG/JPEG only.",
  },
  tooLarge: { id: "File maksimal 10MB.", en: "File must be 10MB or smaller." },
  uploading: { id: "Mengunggah…", en: "Uploading…" },
  uploadFailed: { id: "Upload gagal.", en: "Upload failed." },
  notSignedIn: { id: "Belum masuk — silakan masuk kembali.", en: "Not signed in — please sign in again." },
} as const satisfies TextDict;
