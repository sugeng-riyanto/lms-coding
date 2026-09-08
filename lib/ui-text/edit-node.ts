import type { TextDict } from "@/lib/i18n";

/** EditNode (components/edit-node.tsx) — edit/delete content node shared by course authoring. */
export const EDIT_NODE: TextDict = {
  editLabel: { id: "Ubah {title}", en: "Edit {title}" },
  deleteLabel: { id: "Hapus {title}", en: "Delete {title}" },
  editButton: { id: "Ubah", en: "Edit" },
  deleteButton: { id: "Hapus", en: "Delete" },
  titleLabel: { id: "Judul", en: "Title" },
  objectiveLabel: { id: "Objective", en: "Objective" },
  saveButton: { id: "Simpan", en: "Save" },
  cancelButton: { id: "Batal", en: "Cancel" },
  deleteConfirm: { id: "Hapus item ini beserta isinya?", en: "Delete this item and its contents?" },
  updateImmutable: {
    id: "Versi published tidak bisa diubah — buat versi baru.",
    en: "Published versions cannot be edited — create a new version.",
  },
  deleteImmutable: { id: "Versi published tidak bisa dihapus.", en: "Published versions cannot be deleted." },
  hasAttempts: {
    id: "Sudah ada attempt — tidak bisa dihapus (auditability).",
    en: "Attempts exist — cannot be deleted (auditability).",
  },
  failed: { id: "Gagal: {error}", en: "Failed: {error}" },
} as const;
