import { describe, expect, it } from "vitest";
import {
  assessmentPercent,
  autoGrade,
  normalizeShortText,
  parseNumericAnswer,
  questionScore,
} from "@/lib/grading";

describe("autoGrade fixtures", () => {
  it("single_choice benar/salah", () => {
    expect(autoGrade({ type: "single_choice", points: 10, correctOptionId: "b" }, "b")).toBe(10);
    expect(autoGrade({ type: "single_choice", points: 10, correctOptionId: "b" }, "a")).toBe(0);
  });
  it("multiple_choice harus exact set", () => {
    const rule = { type: "multiple_choice" as const, points: 10, correctOptionIds: ["a", "c"] };
    expect(autoGrade(rule, ["a", "c"])).toBe(10);
    expect(autoGrade(rule, ["c", "a"])).toBe(10);
    expect(autoGrade(rule, ["a"])).toBe(0);
    expect(autoGrade(rule, ["a", "b", "c"])).toBe(0);
  });
  it("true/false", () => {
    expect(autoGrade({ type: "true_false", points: 5, correctOptionId: "true" }, "true")).toBe(5);
    expect(autoGrade({ type: "true_false", points: 5, correctOptionId: "true" }, "false")).toBe(0);
  });
  it("numeric tolerance absolut & relatif", () => {
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 100, toleranceAbsolute: 0.5 }, 100.4),
    ).toBe(10);
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 100, toleranceAbsolute: 0.5 }, 101),
    ).toBe(0);
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 200, toleranceRelative: 0.01 }, 201),
    ).toBe(10);
    expect(
      autoGrade({ type: "numeric_tolerance", points: 10, expected: 200, toleranceRelative: 0.01 }, 205),
    ).toBe(0);
  });
  it("short_text normalisasi eksplisit", () => {
    const rule = { type: "short_text" as const, points: 10, acceptedAnswers: ["Soekarno"] };
    expect(autoGrade(rule, "  soekarno ")).toBe(10);
    expect(autoGrade(rule, "Hatta")).toBe(0);
    expect(normalizeShortText("  A   B ")).toBe("a b");
  });
  it("tanpa acceptedAnswers → manual (0)", () => {
    expect(autoGrade({ type: "short_text", points: 10, acceptedAnswers: [] }, "apapun")).toBe(0);
  });
  it("essay/file selalu 0 (moderation queue)", () => {
    expect(autoGrade({ type: "essay_manual", points: 20 }, "esai panjang")).toBe(0);
    expect(autoGrade({ type: "file_manual", points: 20 }, {})).toBe(0);
  });
});

describe("score aggregation", () => {
  it("clamp question score", () => {
    expect(questionScore(8, 5, 10)).toBe(10);
    expect(questionScore(0, null, 10)).toBe(0);
  });
  it("assessment percent", () => {
    expect(assessmentPercent([8, 10], [10, 10])).toBe(90);
    expect(assessmentPercent([], [])).toBe(0);
  });
});

describe("numeric unit normalization", () => {
  const rule = {
    type: "numeric_tolerance" as const,
    points: 10,
    expected: 5, // basis kg
    toleranceAbsolute: 0.1,
    unit: { expectedUnit: "kg", unitFactors: { kg: 1, g: 0.001, mg: 0.000001 } },
  };
  it("jawaban polos dianggap basis", () => {
    expect(autoGrade(rule, 5)).toBe(10);
    expect(autoGrade(rule, 5.05)).toBe(10); // |diff| 0.05 <= 0.1
    expect(autoGrade(rule, 5.2)).toBe(0); // |diff| 0.2 > 0.1
  });
  it("unit berbeda dikonversi ke basis", () => {
    expect(autoGrade(rule, "5000 g")).toBe(10);
    expect(autoGrade(rule, "5000000 mg")).toBe(10);
    expect(autoGrade(rule, "5 kg")).toBe(10);
    expect(autoGrade(rule, "5.2 kg")).toBe(0);
  });
  it("unit tak dikenal / bukan angka → 0 (tidak menebak)", () => {
    expect(autoGrade(rule, "5 ons")).toBe(0);
    expect(autoGrade(rule, "lima kg")).toBe(0);
    expect(autoGrade(rule, null)).toBe(0);
  });
  it("tanpa rule unit, string ber-unit tidak lolos (back-compat)", () => {
    const plain = { type: "numeric_tolerance" as const, points: 10, expected: 5, toleranceAbsolute: 0.1 };
    expect(autoGrade(plain, "5000 g")).toBe(0);
    expect(autoGrade(plain, 5)).toBe(10);
  });
  it("parseNumericAnswer: kasus batas & spasi", () => {
    expect(parseNumericAnswer("5000 g", rule.unit)).toBe(5);
    expect(parseNumericAnswer("5000g", rule.unit)).toBe(5);
    expect(parseNumericAnswer("5", rule.unit)).toBe(5);
    expect(parseNumericAnswer("5 KG", rule.unit)).toBe(5);
    expect(parseNumericAnswer("abc", rule.unit)).toBeNull();
  });
  it("kunci unitFactors case-insensitive (mL/mL/ml semua cocok)", () => {
    const mixed = {
      type: "numeric_tolerance" as const,
      points: 10,
      expected: 1.5,
      toleranceAbsolute: 0.01,
      unit: { expectedUnit: "L", unitFactors: { L: 1, mL: 0.001 } },
    };
    // Jawaban dalam satuan kecil (mL) → dikonversi ke basis L.
    expect(autoGrade(mixed, "1500 mL")).toBe(10);
    expect(autoGrade(mixed, "1500 ml")).toBe(10);
    expect(autoGrade(mixed, "1500ML")).toBe(10);
    expect(parseNumericAnswer("1500 mL", mixed.unit)).toBe(1.5);
    expect(parseNumericAnswer("1.5 L", mixed.unit)).toBe(1.5);
    // Unit campuran lain: kM (kilo-meter) vs km.
    const dist = {
      type: "numeric_tolerance" as const,
      points: 10,
      expected: 3000,
      toleranceAbsolute: 0.01,
      unit: { expectedUnit: "m", unitFactors: { m: 1, kM: 1000 } },
    };
    expect(autoGrade(dist, "3 kM")).toBe(10);
    expect(autoGrade(dist, "3km")).toBe(10);
  });
});

describe("numeric tolerance boundary (inklusif)", () => {
  it("|diff| == toleransi → benar", () => {
    const rule = { type: "numeric_tolerance" as const, points: 10, expected: 100, toleranceAbsolute: 0.5 };
    expect(autoGrade(rule, 100.5)).toBe(10); // tepat di batas
    expect(autoGrade(rule, 99.5)).toBe(10);
    expect(autoGrade(rule, 100.5001)).toBe(0); // lewat 1e-4
  });
  it("relatif tepat di batas → benar", () => {
    const rule = { type: "numeric_tolerance" as const, points: 5, expected: 200, toleranceRelative: 0.01 };
    expect(autoGrade(rule, 202)).toBe(5); // 200 + 2 = 1%
    expect(autoGrade(rule, 198)).toBe(5);
    expect(autoGrade(rule, 202.01)).toBe(0);
  });
  it("toleransi = max(absolut, relatif)", () => {
    const relWins = {
      type: "numeric_tolerance" as const,
      points: 5,
      expected: 1000,
      toleranceAbsolute: 1,
      toleranceRelative: 0.02, // tol = max(1, 20) = 20
    };
    expect(autoGrade(relWins, 1020)).toBe(5);
    expect(autoGrade(relWins, 1001.5)).toBe(5); // dalam 20 (relatif menang)
    expect(autoGrade(relWins, 1021)).toBe(0);
    const absWins = {
      type: "numeric_tolerance" as const,
      points: 5,
      expected: 100,
      toleranceAbsolute: 5,
      toleranceRelative: 0.01, // tol = max(5, 1) = 5
    };
    expect(autoGrade(absWins, 104)).toBe(5);
    expect(autoGrade(absWins, 106)).toBe(0);
  });
});

describe("multiple_choice partial-credit policy", () => {
  const rule = {
    type: "multiple_choice" as const,
    points: 10,
    correctOptionIds: ["a", "b", "c"],
  };
  it("exact (default): subset/superset/salah → 0", () => {
    expect(autoGrade(rule, ["a", "b", "c"])).toBe(10);
    expect(autoGrade(rule, ["a", "b"])).toBe(0); // subset
    expect(autoGrade(rule, ["a", "b", "c", "d"])).toBe(0); // superset
    expect(autoGrade(rule, ["a", "d"])).toBe(0);
    expect(autoGrade(rule, [])).toBe(0);
  });
  it("fractional: proporsi benar, tanpa penalti opsi salah", () => {
    const frac = { ...rule, partialCredit: "fractional" as const };
    expect(autoGrade(frac, ["a", "b", "c"])).toBe(10);
    expect(autoGrade(frac, ["a", "b"])).toBeCloseTo(10 * (2 / 3));
    expect(autoGrade(frac, ["a"])).toBeCloseTo(10 * (1 / 3));
    expect(autoGrade(frac, ["a", "b", "c", "d"])).toBe(10); // ekstra tidak mengurangi
    expect(autoGrade(frac, ["x", "y"])).toBe(0); // tak ada yang benar
    expect(autoGrade(frac, [])).toBe(0);
  });
});

describe("notasi ilmiah numerik (fisika/kimia/matematika)", () => {
  it("parseNumericAnswer menerima e-notation (6.022e23, 1e-9)", () => {
    expect(parseNumericAnswer("6.022e23")).toBeCloseTo(6.022e23, 5);
    expect(parseNumericAnswer("6.02E+23")).toBeCloseTo(6.02e23, 5);
    expect(parseNumericAnswer("1e-9")).toBe(1e-9);
  });

  it("autoGrade numeric: jawaban e-notation benar dalam toleransi", () => {
    const rule = {
      type: "numeric_tolerance" as const,
      points: 10,
      expected: 6.022e23,
      toleranceAbsolute: 1e21,
    };
    expect(autoGrade(rule, "6.02e23")).toBe(10); // |Δ|=2e20 < 1e21
    expect(autoGrade(rule, "6.4e23")).toBe(0); // |Δ|≈3.78e23 > 1e21
  });

  it("konversi unit tetap jalan bersama e-notation (1e3 g = 1 kg)", () => {
    const rule = {
      type: "numeric_tolerance" as const,
      points: 10,
      expected: 1,
      toleranceAbsolute: 0.0001,
      unit: { expectedUnit: "kg", unitFactors: { kg: 1, g: 0.001 } },
    };
    expect(autoGrade(rule, "1e3 g")).toBe(10);
    expect(autoGrade(rule, "1000 g")).toBe(10);
    expect(autoGrade(rule, "1 kg")).toBe(10);
  });
});

describe("normalizeShortText unicode (English apostrof & Mandarin/IME full-width)", () => {
  it("NFKC melipat karakter full-width IME (Ｈ２Ｏ → H2O)", () => {
    const rule = {
      type: "short_text" as const,
      points: 5,
      acceptedAnswers: ["H2O"],
      normalize: { unicode: true },
    };
    expect(autoGrade(rule, "Ｈ２Ｏ")).toBe(5);
    expect(autoGrade(rule, "h2o")).toBe(5); // lowercase default tetap
  });

  it("tanpa unicode: full-width TIDAK dianggap sama (back-compat)", () => {
    const rule = {
      type: "short_text" as const,
      points: 5,
      acceptedAnswers: ["H2O"],
      normalize: { unicode: false },
    };
    expect(autoGrade(rule, "Ｈ２Ｏ")).toBe(0);
  });

  it("apostrof melengkung English dilipat ke lurus saat unicode:true", () => {
    const rule = {
      type: "short_text" as const,
      points: 5,
      acceptedAnswers: ["it's"],
      normalize: { unicode: true },
    };
    expect(autoGrade(rule, "it’s")).toBe(5);
    expect(normalizeShortText("it’s", { unicode: true })).toBe("it's");
  });

  it("teks Mandarin biasa (tanpa karakter khusus) lolos normalisasi default", () => {
    const rule = {
      type: "short_text" as const,
      points: 5,
      acceptedAnswers: ["你好，世界"],
      normalize: { trim: true },
    };
    expect(autoGrade(rule, "你好，世界")).toBe(5);
  });
});
