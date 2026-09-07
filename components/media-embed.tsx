/**
 * Embed media responsif untuk LMS coding. Semua URL dibatasi http(s); YouTube
 * hanya host youtube.com/youtu.be dan src di-REBUILD dari id (bukan URL mentah)
 * sehingga iframe tidak pernah memuat host arbitrer. Field yang dibaca hanya
 * url/title/transcript — bukan HTML arbitrer.
 *
 * Validator URL (isSafeHttpUrl/youtubeEmbedSrc) hidup di lib/content-blocks.ts
 * (single source); re-export di sini demi kompatibilitas impor lama.
 */
import { isSafeHttpUrl, youtubeEmbedSrc } from "@/lib/content-blocks";

export { isSafeHttpUrl, youtubeEmbedSrc };

export function EmbedYoutube({ url, title }: { url: string; title?: string }) {
  const src = youtubeEmbedSrc(url);
  if (!src) return <p className="text-sm text-slate-500">URL YouTube tidak valid. Periksa kembali materi.</p>;
  return (
    <div className="card-lift overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[var(--shadow-soft)] dark:border-slate-600 dark:bg-slate-900">
      <iframe
        src={src}
        title={title ? `Video: ${title}` : "Video YouTube"}
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

export function EmbedPdf({ url, title }: { url: string; title?: string }) {
  if (!isSafeHttpUrl(url))
    return <p className="text-sm text-slate-500">URL dokumen tidak valid. Periksa kembali materi.</p>;
  return (
    <div className="card-lift overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[var(--shadow-soft)] dark:border-slate-600 dark:bg-slate-900">
      <iframe
        src={url}
        title={title ? `Dokumen: ${title}` : "Dokumen PDF"}
        className="h-[70vh] w-full"
        loading="lazy"
      />
    </div>
  );
}

export function EmbedAudio({ url, transcript }: { url: string; transcript?: string }) {
  if (!isSafeHttpUrl(url))
    return <p className="text-sm text-slate-500">URL audio tidak valid. Periksa kembali materi.</p>;
  return (
    <div className="card-lift space-y-2 rounded-xl border border-slate-300 bg-white p-3 shadow-[var(--shadow-soft)] dark:border-slate-600 dark:bg-slate-900">
      <audio controls preload="none" className="w-full" src={url}>
        Browser Anda tidak mendukung pemutar audio.
      </audio>
      {transcript && transcript.trim() ? (
        <details className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-600">
          <summary className="cursor-pointer font-semibold">Transkrip</summary>
          <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{transcript}</p>
        </details>
      ) : null}
    </div>
  );
}

export function EmbedFile({ url, title }: { url: string; title?: string }) {
  if (!isSafeHttpUrl(url))
    return <p className="text-sm text-slate-500">URL berkas tidak valid. Periksa kembali materi.</p>;
  return (
    <div className="card-lift flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-[var(--shadow-soft)] dark:border-slate-600 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="font-semibold">{title && title.trim() ? title : "Berkas pendukung"}</p>
        <p className="truncate text-sm text-slate-500">{url}</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700"
      >
        Unduh berkas
      </a>
    </div>
  );
}
