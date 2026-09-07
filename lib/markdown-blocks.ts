/**
 * Markdown → blok materi (article). Guru menulis materi biasa (Markdown ringan:
 * heading ATX, ``` fenced code, gambar `![alt](url)` baris sendiri, paragraf),
 * parser mengubahnya menjadi `content.blocks` yang VALIDASI + normalisasi lewat
 * lib/content-blocks (allowlist, URL aman, image wajib alt). Tidak pernah ada
 * HTML arbitrer — seluruh keluaran adalah blok canonical yang sama dengan
 * authoring JSON.
 */
import { sanitizeContentBlocks, type ContentBlock } from "@/lib/content-blocks";

export type MarkdownResult =
  { ok: true; blocks: ContentBlock[] } | { ok: false; error: "MARKDOWN_INVALID"; message: string };

const FENCE_RE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const IMG_RE = /^\s*!\[([^\]]*)\]\(\s*(https?:\/\/[^)\s]+)\s*\)\s*$/;
const H_RE = /^\s*(#{1,4})\s+(.+?)\s*#*\s*$/;

/** Parsing baris-demi-baris, tanpa dependensi MD (cukup untuk materi LMS). */
export function parseMarkdownToBlocks(md: string): MarkdownResult {
  const text = typeof md === "string" ? md : "";
  if (text.trim().length === 0) {
    return { ok: false, error: "MARKDOWN_INVALID", message: "Markdown kosong." };
  }

  const candidates: unknown[] = [];
  const lines = text.split(/\r?\n/);
  let fence: string | null = null; // "```" | "~~~" saat di dalam blok code
  let fenceLang = "";
  let codeBuf = "";

  const appendText = (line: string) => {
    const last = candidates[candidates.length - 1];
    if (
      last &&
      typeof last === "object" &&
      last !== null &&
      (last as { kind?: string }).kind === "paragraph"
    ) {
      (last as { text: string }).text += `\n${line.trimEnd()}`;
    } else {
      candidates.push({ kind: "paragraph", text: line.trimEnd() });
    }
  };

  for (const raw of lines) {
    const line = raw;

    // Di dalam blok code: kumpulkan sampai fence penutup.
    if (fence) {
      const close = FENCE_RE.exec(line);
      if (close && close[1] === fence) {
        candidates.push({ kind: "code", language: fenceLang || "text", code: codeBuf.replace(/\n$/, "") });
        fence = null;
        codeBuf = "";
        fenceLang = "";
      } else {
        codeBuf += `${line}\n`;
      }
      continue;
    }

    const open = FENCE_RE.exec(line);
    if (open) {
      fence = open[1] ?? null;
      fenceLang = open[2]?.trim() || "text";
      codeBuf = "";
      continue;
    }

    const img = IMG_RE.exec(line);
    const imgUrl = img?.[2];
    if (img && imgUrl) {
      candidates.push({ kind: "image", url: imgUrl, alt: img[1]?.trim() || "Ilustrasi materi" });
      continue;
    }

    const heading = H_RE.exec(line);
    if (heading) {
      candidates.push({ kind: "heading", text: heading[2] ?? "" });
      continue;
    }

    if (line.trim().length === 0) continue; // pemisah paragraf
    appendText(line);
  }

  // Fence terbuka sampai EOF: simpan sebagai blok code apa adanya.
  if (fence) {
    candidates.push({ kind: "code", language: fenceLang || "text", code: codeBuf.replace(/\n$/, "") });
  }

  const res = sanitizeContentBlocks(candidates);
  if (!res.ok) return { ok: false, error: "MARKDOWN_INVALID", message: res.message };
  return { ok: true, blocks: res.blocks };
}

/** Helper: konversi markdown menjadi blocks, atau null bila bukan/rusak. */
export function markdownToBlocksOrNull(md: unknown): ContentBlock[] | null {
  if (typeof md !== "string" || md.trim().length === 0) return null;
  const parsed = parseMarkdownToBlocks(md);
  return parsed.ok ? parsed.blocks : null;
}
