// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LessonBlocks } from "@/components/lesson-blocks";
import type { ContentBlock } from "@/lib/content-blocks";

describe("LessonBlocks — renderer terkontrol (hanya kind allowlist)", () => {
  it("merender heading, paragraf, kode, gambar, dan embed", () => {
    const blocks: ContentBlock[] = [
      { kind: "heading", text: "Pengenalan" },
      { kind: "paragraph", text: "Baris satu\nBaris dua" },
      { kind: "code", code: "print('halo')", language: "python" },
      { kind: "image", url: "https://files.example.com/a.png", alt: "Diagram alur", caption: "Gbr 1" },
      { kind: "embed_youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Intro" },
      { kind: "embed_audio", url: "https://files.example.com/a.mp3", transcript: "Transkrip lisan" },
    ];
    const { container } = render(<LessonBlocks blocks={blocks} />);
    expect(container.querySelector("h2")?.textContent).toBe("Pengenalan");
    expect(container.textContent).toContain("Baris satu");
    expect(container.querySelector("code")?.textContent).toBe("print('halo')");
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("Diagram alur");
    expect(img?.getAttribute("loading")).toBe("lazy");
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(container.querySelector("audio")).not.toBeNull();
    expect(container.textContent).toContain("Transkrip lisan");
  });

  it("gambar tanpa alt memakai caption sebagai alt (aksesibilitas)", () => {
    const { container } = render(
      <LessonBlocks
        blocks={[{ kind: "image", url: "https://files.example.com/b.png", alt: "", caption: "Kurva" }]}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Kurva");
  });

  it("embed_pdf dan embed_file ter-render", () => {
    const { container } = render(
      <LessonBlocks
        blocks={[
          { kind: "embed_pdf", url: "https://files.example.com/m.pdf", title: "Materi" },
          { kind: "embed_file", url: "https://files.example.com/latihan.zip", title: "Latihan" },
        ]}
      />,
    );
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    const link = container.querySelector('a[href="https://files.example.com/latihan.zip"]');
    expect(link?.textContent).toContain("Unduh berkas");
  });

  it("HTML mentah dalam teks TIDAK menjadi elemen (React meng-escape)", () => {
    const { container } = render(
      <LessonBlocks
        blocks={[
          {
            kind: "paragraph",
            text: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
          },
        ]}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("kind tak dikenal tidak dirender (lapis kedua setelah sanitizer)", () => {
    const { container } = render(
      <LessonBlocks
        blocks={[{ kind: "iframe" as ContentBlock["kind"], src: "https://x" } as unknown as ContentBlock]}
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent?.trim()).toBe("");
  });
});
