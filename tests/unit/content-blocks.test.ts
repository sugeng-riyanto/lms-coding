import { describe, expect, it } from "vitest";
import {
  BLOCK_KINDS,
  gdrivePreviewSrc,
  isAllowedIframeHost,
  isSafeHttpUrl,
  MAX_BLOCKS,
  sanitizeContentBlocks,
  sanitizeQuestionMedia,
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

  it("BLOCK_KINDS berisi 10 kind dokumen (termasuk embed_web/embed_video)", () => {
    expect(BLOCK_KINDS).toEqual([
      "heading",
      "paragraph",
      "image",
      "code",
      "embed_youtube",
      "embed_pdf",
      "embed_audio",
      "embed_file",
      "embed_web",
      "embed_video",
    ]);
  });
});

describe("isAllowedIframeHost / gdrivePreviewSrc", () => {
  it("embed_web hanya host allowlist (PhET/oPhysics/Drive)", () => {
    expect(
      isAllowedIframeHost(
        "https://phet.colorado.edu/sims/html/buoyancy-basics/latest/buoyancy-basics_all.html",
      ),
    ).toBe(true);
    expect(isAllowedIframeHost("https://ophysics.com/l12.html")).toBe(true);
    expect(isAllowedIframeHost("https://drive.google.com/file/d/abc/preview")).toBe(true);
    expect(isAllowedIframeHost("https://evil.example.com/embed")).toBe(false);
    expect(isAllowedIframeHost("javascript:alert(1)")).toBe(false);
  });

  it("gdrivePreviewSrc mengubah URL Drive menjadi preview iframe", () => {
    expect(gdrivePreviewSrc("https://drive.google.com/file/d/1ZL2I4CiAATDwh5vVxtU2cpDwxOoegBsl/view")).toBe(
      "https://drive.google.com/file/d/1ZL2I4CiAATDwh5vVxtU2cpDwxOoegBsl/preview",
    );
    expect(gdrivePreviewSrc("https://drive.google.com/file/d/abc123/edit?usp=sharing")).toBe(
      "https://drive.google.com/file/d/abc123/preview",
    );
    expect(gdrivePreviewSrc("https://drive.google.com/open?id=xyz789")).toBe(
      "https://drive.google.com/file/d/xyz789/preview",
    );
    expect(gdrivePreviewSrc("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(gdrivePreviewSrc("javascript:alert(1)")).toBeNull();
  });
});

describe("sanitizeQuestionMedia (media butir soal kuis)", () => {
  it("menerima youtube/pdf/web/video/image/audio dengan URL aman", () => {
    expect(
      sanitizeQuestionMedia({
        type: "youtube",
        url: "https://www.youtube.com/watch?v=Q7twwJbocDM",
        title: "Pengantar",
      }),
    ).toEqual({
      type: "youtube",
      url: "https://www.youtube.com/watch?v=Q7twwJbocDM",
      title: "Pengantar",
    });
    expect(
      sanitizeQuestionMedia({
        type: "pdf",
        url: "https://drive.google.com/file/d/1ZL2I4CiAATDwh5vVxtU2cpDwxOoegBsl/view",
      }),
    )?.toMatchObject({ type: "pdf" });
    expect(
      sanitizeQuestionMedia({
        type: "web",
        url: "https://phet.colorado.edu/sims/html/buoyancy-basics/latest/buoyancy-basics_all.html",
      }),
    )?.toMatchObject({ type: "web" });
    expect(
      sanitizeQuestionMedia({
        type: "image",
        url: "https://files.example.com/grafik.png",
        alt: "Grafik fungsi",
      }),
    )?.toMatchObject({ type: "image", alt: "Grafik fungsi" });
  });

  it("menolak jenis tak dikenal / URL tidak aman / host iframe di luar allowlist", () => {
    expect(sanitizeQuestionMedia({ type: "iframe", url: "https://x" })).toBeNull();
    expect(sanitizeQuestionMedia({ type: "pdf", url: "javascript:alert(1)" })).toBeNull();
    expect(sanitizeQuestionMedia({ type: "web", url: "https://evil.example.com/embed" })).toBeNull();
    expect(sanitizeQuestionMedia({ type: "youtube", url: "https://evil.example.com/v" })).toBeNull();
    expect(sanitizeQuestionMedia(null)).toBeNull();
    expect(sanitizeQuestionMedia("text")).toBeNull();
  });

  it("image wajib alt atau caption (aksesibilitas)", () => {
    expect(sanitizeQuestionMedia({ type: "image", url: "https://files.example.com/x.png" })).toBeNull();
    expect(
      sanitizeQuestionMedia({ type: "image", url: "https://files.example.com/x.png", caption: "Gbr 1" }),
    )?.toMatchObject({ type: "image", caption: "Gbr 1" });
  });

  it("blok embed_web/embed_video diterima di sanitizeContentBlocks", () => {
    const okWeb = sanitizeContentBlocks([
      {
        kind: "embed_web",
        url: "https://phet.colorado.edu/sims/html/buoyancy-basics/latest/buoyancy-basics_all.html",
        title: "Buoyancy",
      },
      { kind: "embed_video", url: "https://drive.google.com/file/d/abc123/view" },
    ]);
    expect(okWeb.ok).toBe(true);
    if (okWeb.ok) {
      expect(okWeb.blocks[0]).toMatchObject({ kind: "embed_web", title: "Buoyancy" });
      expect(okWeb.blocks[1]).toMatchObject({ kind: "embed_video" });
    }
    // Host di luar allowlist ditolak (iframe tidak pernah host arbitrer).
    expect(sanitizeContentBlocks([{ kind: "embed_web", url: "https://evil.example.com/x" }]).ok).toBe(false);
    // Video non-Drive tetap boleh (fallback <video> native).
    expect(sanitizeContentBlocks([{ kind: "embed_video", url: "https://files.example.com/v.mp4" }]).ok).toBe(
      true,
    );
  });
});
