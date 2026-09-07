import { describe, expect, it } from "vitest";
import {
  BLOCK_KINDS,
  isSafeHttpUrl,
  MAX_BLOCKS,
  sanitizeContentBlocks,
  youtubeEmbedSrc,
} from "@/lib/content-blocks";

const sample = [
  { kind: "heading", text: "Apa itu Python?" },
  { kind: "paragraph", text: "Python adalah bahasa…" },
  { kind: "image", url: "https://files.example.com/py.png", caption: "Logo Python", alt: "" },
  { kind: "code", code: "print('halo')", language: "python", extraField: "x" },
  { kind: "embed_youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Intro" },
];

describe("isSafeHttpUrl / youtubeEmbedSrc (single source dari content-blocks)", () => {
  it("hanya http/https", () => {
    expect(isSafeHttpUrl("https://a.example/x.pdf")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("ftp://a.example/x")).toBe(false);
  });
  it("youtube direkonstruksi ke youtube-nocookie", () => {
    expect(youtubeEmbedSrc("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(youtubeEmbedSrc("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("sanitizeContentBlocks", () => {
  it("menerima campuran blok valid dan menormalisasi canonical", () => {
    const res = sanitizeContentBlocks(sample);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.blocks).toHaveLength(5);
    const [b0, b1, , b3] = res.blocks;
    expect(b0).toBeDefined();
    expect(b1).toBeDefined();
    expect(b3).toBeDefined();
    if (!b0 || !b1 || !b3) return;
    expect(b3).toEqual({ kind: "code", code: "print('halo')", language: "python" });
    expect(b0).toEqual({ kind: "heading", text: "Apa itu Python?" });
    expect(b1.kind).toBe("paragraph");
  });

  it("membuang field ekstra (hanya field allowlist)", () => {
    const res = sanitizeContentBlocks([
      { kind: "embed_youtube", url: "https://youtu.be/abcDEF123", onerror: "alert(1)" },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const first = res.blocks[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(Object.keys(first).sort()).toEqual(["kind", "url"]);
  });

  it("menolak kind di luar allowlist", () => {
    const res = sanitizeContentBlocks([{ kind: "iframe", src: "https://x" }]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("BLOCK_INVALID");
  });

  it("menolak non-array / kosong / melebihi kapasitas", () => {
    expect(sanitizeContentBlocks({ kind: "heading", text: "x" }).ok).toBe(false);
    expect(sanitizeContentBlocks([]).ok).toBe(false);
    const many = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => ({
      kind: "paragraph",
      text: `p${i}`,
    }));
    expect(sanitizeContentBlocks(many).ok).toBe(false);
  });

  it("menolak blok non-objek dan kind non-string", () => {
    expect(sanitizeContentBlocks([null]).ok).toBe(false);
    expect(sanitizeContentBlocks(["text"]).ok).toBe(false);
    expect(sanitizeContentBlocks([42]).ok).toBe(false);
    expect(sanitizeContentBlocks([{ kind: 7 }]).ok).toBe(false);
  });

  it("image wajib URL http(s) DAN alt/caption (aksesibilitas)", () => {
    expect(sanitizeContentBlocks([{ kind: "image", url: "javascript:alert(1)", alt: "x" }]).ok).toBe(false);
    expect(sanitizeContentBlocks([{ kind: "image", url: "https://x/y.png" }]).ok).toBe(false);
    expect(sanitizeContentBlocks([{ kind: "image", url: "https://x/y.png", caption: "Gbr 1" }]).ok).toBe(
      true,
    );
  });

  it("embed wajib URL aman; youtube wajib host youtube", () => {
    expect(sanitizeContentBlocks([{ kind: "embed_pdf", url: "javascript:alert(1)" }]).ok).toBe(false);
    expect(sanitizeContentBlocks([{ kind: "embed_youtube", url: "https://evil.example.com/v?x=y" }]).ok).toBe(
      false,
    );
    expect(sanitizeContentBlocks([{ kind: "embed_audio", url: "https://x/a.mp3" }]).ok).toBe(true);
    expect(sanitizeContentBlocks([{ kind: "embed_file", url: "https://x/b.zip", title: "B" }]).ok).toBe(true);
  });

  it("heading wajib teks; teks di-truncate ke batas", () => {
    expect(sanitizeContentBlocks([{ kind: "heading", text: "   " }]).ok).toBe(false);
    const long = sanitizeContentBlocks([{ kind: "paragraph", text: "x".repeat(30_000) }]);
    expect(long.ok).toBe(true);
    if (long.ok) {
      const longBlock = long.blocks[0];
      expect(longBlock?.text).toHaveLength(20_000);
    }
  });

  it("language default text saat kosong", () => {
    const res = sanitizeContentBlocks([{ kind: "code", code: "x = 1", language: "" }]);
    expect(res.ok).toBe(true);
    if (res.ok && res.blocks[0])
      expect(res.blocks[0]).toEqual({ kind: "code", code: "x = 1", language: "text" });
  });

  it("deterministik dan tidak pernah menyisipkan HTML mentah", () => {
    const a = sanitizeContentBlocks(sample);
    const b = sanitizeContentBlocks(JSON.parse(JSON.stringify(sample)));
    expect(a).toEqual(b);
    const withHtml = sanitizeContentBlocks([{ kind: "paragraph", text: "<script>alert(1)</script>" }]);
    expect(withHtml.ok).toBe(true);
    if (withHtml.ok) expect(withHtml.blocks[0]?.text).toContain("<script>"); // disimpan sbg teks, dirender ter-escape
  });

  it("BLOCK_KINDS berisi 8 kind dokumen", () => {
    expect(BLOCK_KINDS).toEqual([
      "heading",
      "paragraph",
      "image",
      "code",
      "embed_youtube",
      "embed_pdf",
      "embed_audio",
      "embed_file",
    ]);
  });
});
