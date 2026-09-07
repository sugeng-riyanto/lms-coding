import type { BulkTemplateKind } from "@/lib/bulk-template";

/**
 * Cangkang kartu bulk up/download: judul + deskripsi + tautan template
 * (+ tautan ekspor data bila ada) + isi form. Satu tampilan modern responsif
 * untuk keempat jalur bulk (murid, materi, guru, penugasan).
 */
export function BulkCard({
  title,
  desc,
  templateKind,
  templateLabel,
  exportHref,
  exportLabel,
  capacityText,
  children,
}: {
  title: string;
  desc: React.ReactNode;
  templateKind: BulkTemplateKind;
  templateLabel: string;
  exportHref?: string;
  exportLabel?: string;
  capacityText: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="card-lift overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900"
    >
      <div aria-hidden="true" className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />
      <div className="border-b bg-gradient-to-r from-slate-50 to-slate-100/70 px-5 py-4 dark:from-slate-800/70 dark:to-slate-900">
        <h2 className="font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{desc}</p>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a
            href={`/api/bulk/templates/${templateKind}`}
            download
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700"
          >
            ⬇ {templateLabel}
          </a>
          {exportHref && (
            <a
              href={exportHref}
              download
              className="rounded-lg border px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ⬇ {exportLabel ?? "Unduh data (XLSX)"}
            </a>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">{capacityText}</span>
        </div>
        {children}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Berkas hanya dibaca di memori server saat impor — tidak disimpan di mana pun dan langsung dibuang
          setelah selesai; formulir dikosongkan otomatis bila berhasil.
        </p>
      </div>
    </section>
  );
}
