import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createQuestionSchema } from "@/lib/validation";

describe("createQuestionSchema — opsi wajib untuk soal pilihan", () => {
  it("single_choice tanpa opsi (>=2) ditolak", () => {
    expect(createQuestionSchema.safeParse({ type: "single_choice", promptText: "2+2?" }).success).toBe(false);
    expect(
      createQuestionSchema.safeParse({ type: "single_choice", promptText: "2+2?", options: ["4"] }).success,
    ).toBe(false);
  });

  it("single/multiple_choice dengan >=2 opsi diterima", () => {
    expect(
      createQuestionSchema.safeParse({
        type: "single_choice",
        promptText: "2+2?",
        options: ["3", "4"],
      }).success,
    ).toBe(true);
    expect(
      createQuestionSchema.safeParse({
        type: "multiple_choice",
        promptText: "Pilih genap",
        options: ["1", "2", "4"],
      }).success,
    ).toBe(true);
  });

  it("tipe non-pilihan tetap bisa tanpa opsi", () => {
    for (const type of ["true_false", "numeric_tolerance", "short_text", "essay_manual"] as const) {
      expect(createQuestionSchema.safeParse({ type, promptText: "Contoh soal cukup?" }).success).toBe(true);
    }
  });

  it("opsi dibatasi: maks 10, tiap opsi 1..200 char", () => {
    expect(
      createQuestionSchema.safeParse({
        type: "single_choice",
        promptText: "2+2?",
        options: Array.from({ length: 11 }, (_, i) => `o${i}`),
      }).success,
    ).toBe(false);
    expect(
      createQuestionSchema.safeParse({ type: "single_choice", promptText: "2+2?", options: ["", "4"] })
        .success,
    ).toBe(false);
  });
});

describe("publishQuestionVersion — kunci harus merujuk opsi yang ada", () => {
  const actions = readFileSync("features/actions.ts", "utf8");
  const fn = actions.slice(
    actions.indexOf("export async function publishQuestionVersion"),
    actions.indexOf("export async function createAssessment"),
  );

  it("memuat soal dulu lalu menolak INVALID_KEY bila kunci tak ada di opsi", () => {
    expect(fn).toMatch(/from\("questions"\)/);
    expect(fn).toMatch(/INVALID_KEY/);
    expect(fn).toMatch(/correctOptionId/);
    expect(fn).toMatch(/correctOptionIds/);
  });

  it("true_false memakai opsi bawaan true/false", () => {
    expect(fn).toMatch(/\["true", "false"\]/);
  });
});

describe("bank UI — field opsi untuk soal pilihan", () => {
  const ui = readFileSync("app/(teacher)/teacher/questions/question-bank.tsx", "utf8");

  it("textarea opsi + validasi client >=2 + diteruskan ke createQuestion", () => {
    expect(ui).toMatch(/q-options/);
    expect(ui).toMatch(/needsOptions/);
    expect(ui).toMatch(/options\.length < 2/);
    expect(ui).toMatch(
      /createQuestion\(\{ type, promptText: prompt, difficulty: "medium", options, media \}\)/,
    );
  });

  it("form soal menyediakan lampiran media (embed butir soal)", () => {
    expect(ui).toMatch(/q-media-type/);
    expect(ui).toMatch(/q-media-url/);
    expect(ui).toMatch(/\["youtube", "pdf", "web", "video", "image", "audio"\]/);
  });
});
