"use client";

/**
 * Toggle tema terang/gelap. Kelas `dark` dipasang di <html>; inisialisasi tanpa
 * FOUC dilakukan inline script di root layout (localStorage → prefers-color-scheme).
 * Ikon di-switch lewat CSS (`.dark` variant) sehingga aman hydration — tanpa
 * state yang disinkronkan dari DOM di dalam effect.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("lms-theme", next ? "dark" : "light");
    } catch {
      // penyimpanan tidak tersedia (mode privat) → tema tetap berlaku sesi ini
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {/* Mode gelap aktif → ikon matahari (klik = ke terang). */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="hidden size-5 dark:block"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
      {/* Mode terang aktif → ikon bulan (klik = ke gelap). */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-5 dark:hidden"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        />
      </svg>
    </button>
  );
}
