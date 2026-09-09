"use client";

import { useState } from "react";

/**
 * Blok kode untuk LMS coding: render monospace dengan scroll horizontal pada
 * baris panjang dan tombol salin satu-klik (clipboard API + fallback). Kode
 * dirender sebagai teks (bukan HTML) — tidak ada eksekusi/injeksi.
 */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = typeof code === "string" ? code : "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-900 text-left shadow-[var(--shadow-soft)] dark:border-slate-600">
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 px-3 py-1.5">
        <span className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-700 px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
          {language && language.trim() ? language.trim() : "kode"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-600"
          aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-x-auto p-3 text-sm leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
