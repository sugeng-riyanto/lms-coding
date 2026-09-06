"use client";

import { useEffect, useState } from "react";

/**
 * Banner offline di student player (slice 1 offline plan).
 * - Tampil saat navigator.onLine = false (perubahan realtime via event).
 * - Bisa menampilkan info "salinan tersimpan" saat konten dirender dari cache.
 * - Teks + ikon (bukan warna saja) agar tetap aksesibel.
 */
export function OfflineBanner({ fromCacheAt }: { fromCacheAt?: number | null }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const cachedAt = fromCacheAt ?? null;
  const cachedLabel =
    cachedAt !== null
      ? new Date(cachedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
      : null;
  if (!offline && cachedAt === null) return null;

  return (
    <div
      role="status"
      className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/60 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
    >
      <span aria-hidden="true" className="mt-0.5">
        {offline ? "📡" : "💾"}
      </span>
      <p>
        {offline ? (
          <>
            <strong>Offline</strong> —{" "}
            {cachedAt !== null ? "menampilkan salinan tersimpan" : "koneksi terputus"}. Perubahan akan
            disinkronkan otomatis saat koneksi pulih.
          </>
        ) : (
          <>
            <strong>Salinan tersimpan</strong> — konten dimuat dari cache lokal ({cachedLabel}). Buka kembali
            saat terhubung untuk memuat versi terbaru.
          </>
        )}
      </p>
    </div>
  );
}
