import { describe, expect, it } from "vitest";
import { BLOCK_KINDS } from "@/lib/content-blocks";
import { markdownToBlocksOrNull, parseMarkdownToBlocks } from "@/lib/markdown-blocks";

describe("parseMarkdownToBlocks", () => {
  it("mengubah heading, paragraf, gambar, dan kode menjadi blok canonical", () => {
    const md = [
      "# Judul besar",
      "",
      "Paragraf pertama.",
      "Lanjutan paragraf pertama.",
      "",
      "![Logo](https://files.example.com/logo.png)",
      "",
      "```python",
      "print('halo')",
      "x = 1",
      "```",
    ].join("\n");
    const res = parseMarkdownToBlocks(md);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "image", "code"]);
    expect(res.blocks[0]).toEqual({ kind: "heading", text: "Judul besar" });
    expect(res.blocks[1]).toEqual({
      kind: "paragraph",
      text: "Paragraf pertama.\nLanjutan paragraf pertama.",
    });
    expect(res.blocks[2]).toMatchObject({
      kind: "image",
      url: "https://files.example.com/logo.png",
      alt: "Logo",
    });
    expect(res.blocks[3]).toEqual({ kind: "code", language: "python", code: "print('halo')\nx = 1" });
  });

  it("fence tertutup → baris sesudahnya kembali jadi paragraf", () => {
    const res = parseMarkdownToBlocks("```\ncode\n```\nTeks sesudah fence.");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.blocks.map((b) => b.kind)).toEqual(["code", "paragraph"]);
  });

  it("gambar tanpa alt diberi alt default; URL non-http jadi paragraf biasa", () => {
    const res = parseMarkdownToBlocks("![](https://files.example.com/x.png)\n![a](javascript:alert(1))");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [imgBlock, paraBlock] = res.blocks;
    if (imgBlock) expect(imgBlock).toMatchObject({ kind: "image", alt: "Ilustrasi materi" });
    expect(paraBlock?.kind).toBe("paragraph");
  });

  it("fence terbuka sampai EOF tetap blok code; fence kosong sendirian invalid", () => {
    const open = parseMarkdownToBlocks("```js\nlet a = 1;");
    expect(open.ok).toBe(true);
    if (open.ok && open.blocks[0]) {
      expect(open.blocks).toEqual([{ kind: "code", language: "js", code: "let a = 1;" }]);
    }
    expect(parseMarkdownToBlocks("```\n```\n```").ok).toBe(false);
  });

  it("markdown kosong / non-string ditolak", () => {
    expect(parseMarkdownToBlocks("").ok).toBe(false);
    expect(parseMarkdownToBlocks("   ").ok).toBe(false);
    expect(markdownToBlocksOrNull(null)).toBeNull();
    expect(markdownToBlocksOrNull("x")).not.toBeNull();
  });

  it("HTML mentah tidak pernah jadi blok html (hanya teks paragraf)", () => {
    const res = parseMarkdownToBlocks("<script>alert(1)</script>");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Keluaran hanya kind allowlist — HTML arbitrer tak pernah jadi elemen.
    expect(res.blocks.every((b) => (BLOCK_KINDS as readonly string[]).includes(b.kind))).toBe(true);
    expect(res.blocks.some((b) => b.kind === "paragraph")).toBe(true);
  });
});
