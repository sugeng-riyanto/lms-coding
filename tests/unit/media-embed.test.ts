import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, youtubeEmbedSrc } from "@/components/media-embed";

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
