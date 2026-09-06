/**
 * Helper reorder: ubah daftar id terurut menjadi pasangan (id, position 0..n).
 * Dipakai Server Action agar posisi selalu rapat tanpa lompat/duplikat.
 */
export function normalizeOrder(orderedIds: string[]): { id: string; position: number }[] {
  const seen = new Set<string>();
  const out: { id: string; position: number }[] = [];
  for (const id of orderedIds) {
    if (seen.has(id)) throw new Error("DUPLICATE_ID");
    seen.add(id);
    out.push({ id, position: out.length });
  }
  return out;
}
