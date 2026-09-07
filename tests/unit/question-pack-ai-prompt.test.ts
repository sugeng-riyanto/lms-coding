import { describe, expect, it } from "vitest";
import { QUESTION_PACK_FORMAT_GUIDE, buildQuestionPackAiPrompt } from "@/lib/question-pack-ai-prompt";
import { parseQuestionPack } from "@/lib/question-pack";

describe("QUESTION_PACK_FORMAT_GUIDE", () => {
  it("memuat aturan kolom, tipe, kunci, dan mutu soal", () => {
    expect(QUESTION_PACK_FORMAT_GUIDE).toContain(
      "TIPE | Prompt | OpsiA | OpsiB | OpsiC | OpsiD | Kunci | Poin | Catatan",
    );
    expect(QUESTION_PACK_FORMAT_GUIDE).toContain("sc=single_choice");
    expect(QUESTION_PACK_FORMAT_GUIDE).toContain("A;C");
    expect(QUESTION_PACK_FORMAT_GUIDE).toContain("benar atau salah");
    expect(QUESTION_PACK_FORMAT_GUIDE).toContain("essay");
    expect(QUESTION_PACK_FORMAT_GUIDE).toContain("Kunci hanya ditulis bila sumber tepercaya memuatnya");
  });
});

describe("buildQuestionPackAiPrompt", () => {
  it("memuat format guide, tugas, dan kontrak keluaran", () => {
    const p = buildQuestionPackAiPrompt();
    expect(p).toContain(QUESTION_PACK_FORMAT_GUIDE);
    expect(p).toContain("TUGAS:");
    expect(p).toContain("KONTRAK KELUARAN:");
    expect(p).toContain("Teks sumber:");
    expect(p).toContain("<salin materi/teks sumber");
  });

  it("jumlah soal default 10 dan dapat diganti; topik disisipkan", () => {
    expect(buildQuestionPackAiPrompt()).toContain("susun 10 soal");
    const withTopic = buildQuestionPackAiPrompt({ topic: "Perulangan Python", count: 5 });
    expect(withTopic).toContain("susun 5 soal");
    expect(withTopic).toContain("Topik materi: Perulangan Python");
  });

  it("menyisipkan instruksi tambahan guru bila diberikan", () => {
    const p = buildQuestionPackAiPrompt({ extra: "Sasaran: kelas 8 SMP." });
    expect(p).toContain("INSTRUKSI TAMBAHAN DARI GURU: Sasaran: kelas 8 SMP.");
  });

  it("contoh keluaran AI sesuai format bisa diparse ulang tanpa error", () => {
    // Guru menyalin prompt, AI menjawab dengan baris pack seperti ini.
    const aiOutput = [
      "# Pack hasil AI",
      "sc | Apa output dari print(2 ** 3)? | 6 | 8 | 9 | 5 | B | 10 | Pangkat dua",
      "mc | Mana tipe data Python? | int | str | list | loop | A;B;C | 15 | loop bukan tipe",
      "tf | List dapat diubah setelah dibuat. | | | | | benar | 5 |",
      "essay | Jelaskan beda list dan tuple. | | | | | | 20 | Sebutkan mutability + contoh",
    ].join("\n");
    const parsed = parseQuestionPack(aiOutput);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows.map((r) => r.type)).toEqual([
      "single_choice",
      "multiple_choice",
      "true_false",
      "essay_manual",
    ]);
  });
});
