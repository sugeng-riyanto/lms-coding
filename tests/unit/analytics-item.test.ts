import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DRAFT_STATUSES,
  distractorMap,
  isCorrectResponse,
  isEligibleForItemAnalysis,
  itemStatistics,
  type ItemResponseRow,
} from "@/lib/analytics-item";

/** Helper baris deterministik. */
function row(partial: Partial<ItemResponseRow> & { questionId: string }): ItemResponseRow {
  return {
    attemptId: `att-${partial.questionId}-${partial.studentId ?? "s"}`,
    studentId: "s-1",
    displayName: "Murid 1",
    questionType: "single_choice",
    promptText: `soal ${partial.questionId}`,
    correctOptionIds: ["A"],
    chosenOptionIds: [],
    attemptStatus: "finalized",
    assessmentTotalPct: 50,
    ...partial,
  };
}

/** Tes mengharapkan tepat satu grup/soal; throw bila tidak — bukan undefined. */
function single<T>(arr: T[]): T {
  if (arr.length !== 1) throw new Error(`diharapkan 1 hasil, dapat ${arr.length}`);
  return arr[0]!;
}

const mc = (q: string, s: string, chosen: string[], total: number) =>
  row({
    questionId: q,
    studentId: s,
    displayName: `Murid ${s}`,
    questionType: "multiple_choice",
    correctOptionIds: ["A", "C"],
    chosenOptionIds: chosen,
    attemptStatus: "auto_graded",
    assessmentTotalPct: total,
  });

describe("eligibility & kebenaran jawaban", () => {
  it("attempt draft (not_started/in_progress) tidak eligible", () => {
    expect(isEligibleForItemAnalysis(row({ questionId: "q", attemptStatus: "in_progress" }))).toBe(false);
    expect(isEligibleForItemAnalysis(row({ questionId: "q", attemptStatus: "not_started" }))).toBe(false);
    expect(isEligibleForItemAnalysis(row({ questionId: "q", attemptStatus: "finalized" }))).toBe(true);
    expect(ATTEMPT_DRAFT_STATUSES).toEqual(["not_started", "in_progress"]);
  });

  it("single_choice benar hanya bila pilihan == kunci; kosong tidak benar", () => {
    expect(isCorrectResponse(row({ questionId: "q", correctOptionIds: ["B"], chosenOptionIds: ["B"] }))).toBe(
      true,
    );
    expect(isCorrectResponse(row({ questionId: "q", correctOptionIds: ["B"], chosenOptionIds: ["A"] }))).toBe(
      false,
    );
    expect(isCorrectResponse(row({ questionId: "q", chosenOptionIds: [] }))).toBe(false);
  });

  it("multiple_choice subset-pun dianggap salah (konsisten autoGrade exact-match)", () => {
    expect(isCorrectResponse(mc("q", "s1", ["A", "C"], 80))).toBe(true);
    expect(isCorrectResponse(mc("q", "s1", ["A"], 80))).toBe(false);
    expect(isCorrectResponse(mc("q", "s1", ["A", "B"], 80))).toBe(false);
  });
});

describe("itemStatistics: difficulty, omit, discrimination", () => {
  it("difficulty = benar/n dan omit = kosong/n pada attempt non-draft saja", () => {
    const rows = [
      row({ questionId: "q1", studentId: "s1", chosenOptionIds: ["A"], attemptStatus: "finalized" }),
      row({ questionId: "q1", studentId: "s2", chosenOptionIds: ["B"], attemptStatus: "finalized" }),
      row({ questionId: "q1", studentId: "s3", chosenOptionIds: [], attemptStatus: "finalized" }),
      row({ questionId: "q1", studentId: "s4", chosenOptionIds: ["A"], attemptStatus: "submitted" }),
      row({ questionId: "q1", studentId: "s5", chosenOptionIds: ["A"], attemptStatus: "in_progress" }), // draft → diabaikan
    ];
    const stat = single(itemStatistics(rows));
    expect(stat.n).toBe(4);
    expect(stat.correct).toBe(2);
    expect(stat.difficulty).toBeCloseTo(0.5);
    expect(stat.omit).toBeCloseTo(0.25); // 1 kosong dari 4 eligible
  });

  it("discrimination positif saat skor tinggi menjawab benar dan skor rendah salah", () => {
    // q1: 9 murid; 3 teratas benar, 3 terbawah salah → discr tinggi.
    const rows: ItemResponseRow[] = [];
    for (const s of ["s1", "s2", "s3"]) {
      rows.push(row({ questionId: "q1", studentId: s, chosenOptionIds: ["A"], assessmentTotalPct: 90 }));
    }
    for (const s of ["s4", "s5", "s6"]) {
      rows.push(row({ questionId: "q1", studentId: s, chosenOptionIds: ["B"], assessmentTotalPct: 50 }));
    }
    for (const s of ["s7", "s8", "s9"]) {
      rows.push(row({ questionId: "q1", studentId: s, chosenOptionIds: ["B"], assessmentTotalPct: 10 }));
    }
    const stat = single(itemStatistics(rows));
    expect(stat.n).toBe(9);
    expect(stat.discrimination).toBeCloseTo(1); // p_atas=1, p_bawah=0
  });

  it("discrimination null saat kelompok < minGroupN (cohort kecil)", () => {
    const rows = [
      row({ questionId: "q1", studentId: "s1", chosenOptionIds: ["A"], assessmentTotalPct: 90 }),
      row({ questionId: "q1", studentId: "s2", chosenOptionIds: ["B"], assessmentTotalPct: 10 }),
    ];
    const stat = single(itemStatistics(rows));
    expect(stat.n).toBe(2);
    expect(stat.discrimination).toBeNull();
  });

  it("difficulty rendah saat banyak salah; omit penuh saat semua kosong", () => {
    const allBlank = [1, 2, 3].map((i) => row({ questionId: "q2", studentId: `s${i}`, chosenOptionIds: [] }));
    const s = single(itemStatistics(allBlank));
    expect(s.difficulty).toBe(0);
    expect(s.omit).toBe(1);

    const allWrong = [1, 2, 3, 4].map((i) =>
      row({ questionId: "q3", studentId: `s${i}`, chosenOptionIds: ["C"] }),
    );
    const s3 = single(itemStatistics(allWrong));
    expect(s3.difficulty).toBe(0);
    expect(s3.omit).toBe(0);
  });

  it("output terurut questionId; group yang sama digabung lintas attempt", () => {
    const rows = [
      row({ questionId: "qB", studentId: "s1", chosenOptionIds: ["A"] }),
      row({ questionId: "qA", studentId: "s1", chosenOptionIds: ["A"] }),
      row({ questionId: "qA", studentId: "s2", chosenOptionIds: ["A"] }),
    ];
    const stats = itemStatistics(rows);
    expect(stats.map((x) => x.questionId)).toEqual(["qA", "qB"]);
    expect(stats[0]!.n).toBe(2);
  });
});

describe("distractorMap: misconception dari distractor terpilih", () => {
  it("menyebar pemilih opsi salah; opsi benar & jawaban kosong tidak masuk cluster", () => {
    const rows = [
      // 5 menjawab salah memilih B, 1 salah memilih C, 1 benar A, 1 kosong.
      ...["s1", "s2", "s3", "s4", "s5"].map((s) =>
        row({ questionId: "q1", studentId: s, displayName: `Murid ${s}`, chosenOptionIds: ["B"] }),
      ),
      row({ questionId: "q1", studentId: "s6", displayName: "Murid s6", chosenOptionIds: ["C"] }),
      row({ questionId: "q1", studentId: "s7", displayName: "Murid s7", chosenOptionIds: ["A"] }),
      row({ questionId: "q1", studentId: "s8", displayName: "Murid s8", chosenOptionIds: [] }),
    ];
    const map = single(distractorMap(rows));
    expect(map.n).toBe(8);
    expect(map.correct).toBe(1);
    expect(map.incorrect).toBe(6); // 5(B) + 1(C); kosong bukan salah-terpilih
    expect(map.clusters.map((c) => c.optionId)).toEqual(["B", "C"]); // urut share
    expect(map.clusters[0]!.picked).toBe(5);
    expect(map.clusters[0]!.shareOfIncorrect).toBeCloseTo(5 / 6);
    expect(map.clusters[0]!.studentIds).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(map.clusters[0]!.studentNames[0]).toBe("Murid s1");
  });

  it("multiple_choice: opsi benar yang ikut terpilih tidak dihitung sebagai distractor", () => {
    // Kunci [A,C]; murid memilih [A,B] → salah, distractor hanya B.
    const rows = [
      mc("q1", "s1", ["A", "B"], 70),
      mc("q1", "s2", ["A", "D"], 70),
      mc("q1", "s3", ["A", "C"], 90),
    ];
    const map = single(distractorMap(rows));
    expect(map.correct).toBe(1);
    expect(map.incorrect).toBe(2);
    expect(map.clusters.map((c) => c.optionId)).toEqual(["B", "D"]);
    expect(map.clusters.find((c) => c.optionId === "B")?.picked).toBe(1);
  });

  it("tidak ada jawaban salah → cluster kosong; kosong penuh → incorrect 0", () => {
    const allCorrect = ["s1", "s2"].map((s) =>
      row({ questionId: "q1", studentId: s, chosenOptionIds: ["A"] }),
    );
    expect(distractorMap(allCorrect)[0]!.clusters).toEqual([]);

    const allBlank = ["s1", "s2"].map((s) => row({ questionId: "q1", studentId: s, chosenOptionIds: [] }));
    const m = single(distractorMap(allBlank));
    expect(m.incorrect).toBe(0);
    expect(m.clusters).toEqual([]);
  });

  it("deterministik: dua pemanggilan sama, output terurut questionId", () => {
    const rows = [
      row({ questionId: "qB", studentId: "s2", chosenOptionIds: ["C"] }),
      row({ questionId: "qA", studentId: "s1", chosenOptionIds: ["B"] }),
    ];
    expect(distractorMap(rows)).toEqual(distractorMap(rows));
    expect(distractorMap(rows).map((m) => m.questionId)).toEqual(["qA", "qB"]);
  });
});

describe("reconciliation: agregasi == hitung manual dari baris raw", () => {
  it("statistik per soal dapat dihitung ulang langsung dari baris", () => {
    // Fixture raw deterministik: 2 soal, 4 murid, status beragam.
    const rows: ItemResponseRow[] = [
      row({
        questionId: "q1",
        studentId: "s1",
        chosenOptionIds: ["A"],
        assessmentTotalPct: 90,
        attemptStatus: "finalized",
      }),
      row({
        questionId: "q1",
        studentId: "s2",
        chosenOptionIds: ["B"],
        assessmentTotalPct: 70,
        attemptStatus: "finalized",
      }),
      row({
        questionId: "q1",
        studentId: "s3",
        chosenOptionIds: [],
        assessmentTotalPct: 40,
        attemptStatus: "auto_graded",
      }),
      row({
        questionId: "q1",
        studentId: "s4",
        chosenOptionIds: ["A"],
        assessmentTotalPct: 30,
        attemptStatus: "in_progress",
      }),
      row({
        questionId: "q2",
        studentId: "s1",
        chosenOptionIds: ["A"],
        assessmentTotalPct: 90,
        attemptStatus: "finalized",
      }),
      row({
        questionId: "q2",
        studentId: "s2",
        chosenOptionIds: ["B"],
        assessmentTotalPct: 70,
        attemptStatus: "finalized",
      }),
    ];
    const stats = itemStatistics(rows);

    // Manual: q1 eligible = s1, s2, s3 (s4 draft); kunci A → benar hanya s1 (1/3);
    // omit = s3 kosong (1/3).
    const q1 = stats.find((x) => x.questionId === "q1")!;
    expect(q1.n).toBe(3);
    expect(q1.correct).toBe(1);
    expect(q1.difficulty).toBeCloseTo(1 / 3);
    expect(q1.omit).toBeCloseTo(1 / 3);
    expect(q1.discrimination).toBeNull(); // n=3 → kelompok 1 < minGroupN 3

    // Manual: q2 eligible = s1, s2; benar 1/2; omit 0; discrimination null.
    const q2 = stats.find((x) => x.questionId === "q2")!;
    expect(q2.n).toBe(2);
    expect(q2.difficulty).toBeCloseTo(0.5);
    expect(q2.discrimination).toBeNull();
  });
});
