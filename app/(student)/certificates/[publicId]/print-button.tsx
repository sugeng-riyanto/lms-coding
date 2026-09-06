"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
    >
      Cetak / Simpan PDF
    </button>
  );
}
