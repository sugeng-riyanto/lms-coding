/** Escape CSV anti formula-injection (ASSESSMENT_AND_SCORING.md). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needsQuote = /[",\n\r]/.test(s);
  const dangerous = /^[=+\-@\t\r]/.test(s);
  const body = dangerous ? `'${s}` : s;
  if (needsQuote || dangerous) return `"${body.replace(/"/g, '""')}"`;
  return body;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map((h) => escapeCsvCell(h)).join(",")];
  for (const row of rows) lines.push(row.map((c) => escapeCsvCell(c)).join(","));
  return lines.join("\r\n") + "\r\n";
}
