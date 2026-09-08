import { describe, expect, it } from "vitest";
import {
  gdrivePreviewSrc,
  isAllowedIframeHost,
  isSafeHttpUrl,
  youtubeEmbedSrc,
} from "@/components/media-embed";

describe("isSafeHttpUrl", () => {
  it("hanya http/https", () => {
    expect(isSafeHttpUrl("https://files.example.com/materi.pdf")).toBe(true);
    expect(isSafeHttpUrl("http://files.example.com/a.mp3")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("ftp://x.example.com/a")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
  });
});

describe("youtubeEmbedSrc", () => {
  it("watch?v= → embed youtube-nocookie", () => {
    expect(youtubeEmbedSrc("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
  it("youtu.be → embed", () => {
    expect(youtubeEmbedSrc("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
  it("shorts/embed path → embed", () => {
    expect(youtubeEmbedSrc("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
  it("host selain youtube ditolak (iframe tidak pernah host arbitrer)", () => {
    expect(youtubeEmbedSrc("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeEmbedSrc("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
  it("non-http / bukan video → null", () => {
    expect(youtubeEmbedSrc("javascript:alert(1)")).toBeNull();
    expect(youtubeEmbedSrc("https://www.youtube.com/")).toBeNull();
    expect(youtubeEmbedSrc("https://www.youtube.com/watch?list=abc")).toBeNull();
  });
});

describe("isAllowedIframeHost (embed_web: PhET/oPhysics/Drive)", () => {
  it("host allowlist diterima; lainnya ditolak", () => {
    expect(isAllowedIframeHost("https://phet.colorado.edu/sims/…/x.html")).toBe(true);
    expect(isAllowedIframeHost("https://ophysics.com/l12.html")).toBe(true);
    expect(isAllowedIframeHost("https://drive.google.com/file/d/abc/view")).toBe(true);
    expect(isAllowedIframeHost("https://evil.example.com/x")).toBe(false);
    expect(isAllowedIframeHost("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isAllowedIframeHost("")).toBe(false);
  });
});

describe("gdrivePreviewSrc (video/PDF Google Drive → preview iframe)", () => {
  it("file/d/{id}/view|edit dan open?id= → /preview", () => {
    expect(
      gdrivePreviewSrc(
        "https://drive.google.com/file/d/1V-V5kBTL45urRCTuj8OrpdkZNCz9od6G/view?usp=drive_open",
      ),
    ).toBe("https://drive.google.com/file/d/1V-V5kBTL45urRCTuj8OrpdkZNCz9od6G/preview");
    expect(gdrivePreviewSrc("https://drive.google.com/open?id=abc123")).toBe(
      "https://drive.google.com/file/d/abc123/preview",
    );
    expect(gdrivePreviewSrc("https://docs.google.com/document/d/xyz/edit")).toBeNull();
    expect(gdrivePreviewSrc("https://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });
});
