/**
 * Embed media responsif untuk LMS coding. Semua URL dibatasi http(s); YouTube
 * hanya host youtube.com/youtu.be dan src di-REBUILD dari id (bukan URL mentah)
 * sehingga iframe tidak pernah memuat host arbitrer. Field yang dibaca hanya
 * url/title/transcript — bukan HTML arbitrer.
 */

/** https/http saja; selain itu null. */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Ubah URL YouTube menjadi src embed youtube-nocookie (atau null bila tidak valid). */
export function youtubeEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
    let id: string | null = null;
    if (u.hostname === "youtu.be") {
      id = u.pathname.split("/")[1] ?? null;
    } else if (YT_HOSTS.has(u.hostname)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? null;
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] ?? null;
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function EmbedYoutube({ url, title }: { url: string; title?: string }) {
  const src = youtubeEmbedSrc(url);
  if (!src) return <p className="text-sm text-slate-500">URL YouTube tidak valid. Periksa kembali materi.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-600">
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
    <div className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-600">
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
    <div className="space-y-2 rounded-xl border border-slate-300 p-3 dark:border-slate-600">
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 p-4 dark:border-slate-600">
      <div className="min-w-0">
        <p className="font-semibold">{title && title.trim() ? title : "Berkas pendukung"}</p>
        <p className="truncate text-sm text-slate-500">{url}</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
      >
        Unduh berkas
      </a>
    </div>
  );
}
