import { describe, expect, it } from "vitest";
import { MARKDOWN_FORMAT_GUIDE, buildMarkdownAiPrompt } from "@/lib/markdown-ai-prompt";
import { parseMarkdownToBlocks } from "@/lib/markdown-blocks";

describe("MARKDOWN_FORMAT_GUIDE", () => {
  it("menyebut konstruksi yang didukung dan yang TIDAK didukung", () => {
    expect(MARKDOWN_FORMAT_GUIDE).toContain("![deskripsi alt singkat]");
    expect(MARKDOWN_FORMAT_GUIDE).toContain("fence");
    expect(MARKDOWN_FORMAT_GUIDE).toContain("60 blok");
    expect(MARKDOWN_FORMAT_GUIDE).toContain("TIDAK DIDUKUNG");
    expect(MARKDOWN_FORMAT_GUIDE).toContain("Tabel");
    expect(MARKDOWN_FORMAT_GUIDE).toContain("HTML");
  });
});

describe("buildMarkdownAiPrompt", () => {
  it("memuat format guide, struktur, dan kontrak keluaran", () => {
    const p = buildMarkdownAiPrompt();
    expect(p).toContain(MARKDOWN_FORMAT_GUIDE);
    expect(p).toContain("STRUKTUR HALAMAN");
    expect(p).toContain("KONTRAK KELUARAN");
    expect(p).toContain("Teks sumber:");
    expect(p).toContain("<salin teks/artikel sumber");
  });

  it("menyisipkan topik bila diberikan, placeholder bila tidak", () => {
    expect(buildMarkdownAiPrompt().split("\n")).toContain("Topik materi: <topik/lesson>");
    const withTopic = buildMarkdownAiPrompt({ topic: "Perulangan for di Python" });
    expect(withTopic).toContain("Topik materi: Perulangan for di Python");
  });

  it("menyisipkan instruksi tambahan guru bila diberikan", () => {
    const p = buildMarkdownAiPrompt({ extra: "Sasaran: kelas 7 SMP." });
    expect(p).toContain("INSTRUKSI TAMBAHAN DARI GURU: Sasaran: kelas 7 SMP.");
  });

  it("contoh keluaran AI sesuai contoh prompt bisa diparse ulang menjadi blok", () => {
    // Guru menyalin prompt, AI menjawab dengan format ini → parser harus menerimanya.
    const aiOutput = [
      "# Perulangan for di Python",
      "",
      "Perulangan `for` dipakai untuk mengulang sekumpulan perintah.",
      "",
      "## Sintaks dasar",
      "",
      "```python",
      "for i in range(3):",
      "    print('Halo')",
      "```",
      "",
      "## Ilustrasi",
      "",
      "![Diagram alur perulangan](https://files.example.com/loop.png)",
      "",
      "Rangkuman: for menjalankan blok sebanyak urutan yang diberikan.",
    ].join("\n");
    const parsed = parseMarkdownToBlocks(aiOutput);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "code",
      "heading",
      "image",
      "paragraph",
    ]);
  });
});
