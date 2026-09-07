/**
 * Builder workbook XLSX — SERVER-ONLY (jangan impor dari Client Components;
 * dipakai route/actions server: template download + ekspor data).
 */
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import { escapeXlsxCell } from "@/lib/bulk-template";

/** Susun workbook satu sheet dari header + baris → Buffer .xlsx. */
export function buildXlsxBuffer(
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): Buffer {
  const safe = rows.map((r) => r.map((c) => (typeof c === "number" ? c : escapeXlsxCell(c))));
  const ws = xlsxUtils.aoa_to_sheet([headers, ...safe]);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.max(h.length + 2, ...safe.slice(0, 50).map((r) => String(r[i] ?? "").length + 2), 12),
  }));
  const wb = xlsxUtils.book_new();
  xlsxUtils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(xlsxWrite(wb, { type: "buffer", bookType: "xlsx" }));
}

/** Header respons download attachment .xlsx. */
export function xlsxDownloadHeaders(fileName: string): Record<string, string> {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  };
}
