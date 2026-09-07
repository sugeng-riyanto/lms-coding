import { describe, expect, it } from "vitest";
import { mapChoiceKey, parseQuestionPack, questionPackTemplateSample } from "@/lib/question-pack";

describe("parseQuestionPack", () => {
  it("mem-parse campuran sc/mc/tf/essay (kombinasi) satu baris per soal", () => {
    const text = [
      "sc | Output 2**3? | 6 | 8 | 9 | 5 | B | 10 | Pangkat",
      "mc | Tipe data Python? | int | str | list | loop | A;B;C | 15",
      "tf | Markdown pakai ``` untuk kode? | | | | | benar | 5",
      "essay | Beda list dan tuple? | | | | | | 20 | Sebutkan mutability",
      "",
      "# komentar",
    ].join("\n");
    const res = parseQuestionPack(text);
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(4);
    expect(res.rows[0]).toMatchObject({
      type: "single_choice",
      key: "B",
      points: 10,
      options: ["6", "8", "9", "5"],
    });
    expect(res.rows[1]).toMatchObject({ type: "multiple_choice", key: "A;B;C", points: 15 });
    expect(res.rows[2]).toMatchObject({ type: "true_false", key: "benar", options: [] });
    expect(res.rows[3]).toMatchObject({
      type: "essay_manual",
      key: "",
      note: "Sebutkan mutability",
      points: 20,
    });
  });

  it("alias singkat + kapital tidak peka huruf", () => {
    const res = parseQuestionPack("SC | Pertanyaan? | Ya | Tidak | | | A");
    expect(res.errors).toEqual([]);
    expect(res.rows[0]?.type).toBe("single_choice");
  });

  it("baris rusak dilaporkan per baris tanpa menggagalkan baris lain", () => {
    const res = parseQuestionPack(
      [
        "sc | Sah? | A | B | | | A",
        "unknown | ???",
        "sc | pilihan tanpa opsi",
        "mc | kunci di luar | A | B | | | Z | 5",
      ].join("\n"),
    );
    expect(res.rows).toHaveLength(1);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
    expect(res.errors.join("\n")).toContain("Baris 2");
    expect(res.errors.join("\n")).toContain("opsi");
  });

  it("tf kunci harus benar/salah; poin non-angka default 10", () => {
    const bad = parseQuestionPack("tf | Pernyataan X benar? | | | | | yakin");
    expect(bad.rows).toHaveLength(0);
    expect(bad.errors.join("\n")).toContain("benar");
    const dflt = parseQuestionPack("sc | Pertanyaan berapa X? | A | B | | | A | abc");
    expect(dflt.rows[0]?.points).toBe(10);
  });

  it("sample template dapat diparse ulang tanpa error (kontrak)", () => {
    const res = parseQuestionPack(questionPackTemplateSample());
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(4);
  });
});

describe("mapChoiceKey", () => {
  it("single: huruf → nilai opsi; multi: daftar huruf → daftar nilai", () => {
    const opts = ["int", "str", "list"];
    expect(mapChoiceKey("B", "single_choice", opts).id).toBe("str");
    expect(mapChoiceKey("A;C", "multiple_choice", opts).ids).toEqual(["int", "list"]);
  });
  it("huruf di luar rentang tidak menghasilkan nilai", () => {
    expect(mapChoiceKey("D", "single_choice", ["a", "b"]).id).toBe("");
    expect(mapChoiceKey("D", "multiple_choice", ["a", "b"]).ids).toEqual([]);
  });
});
