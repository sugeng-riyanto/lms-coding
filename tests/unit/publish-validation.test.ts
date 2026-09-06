import { describe, expect, it } from "vitest";
import { validateCourseDraft, type DraftLevel } from "@/lib/publish-validation";

const goodActivity = {
  id: "a1",
  position: 0,
  type: "quiz" as const,
  title: "Kuis 1",
  points: 100,
  hasAnswerKey: true,
};
const goodLesson = {
  id: "le1",
  position: 0,
  title: "Lesson 1",
  objective: "Siswa dapat menjumlahkan.",
  activities: [goodActivity],
};
const goodLevel: DraftLevel = {
  id: "lv1",
  position: 0,
  title: "Level 1",
  objective: "Menguasai dasar.",
  lessons: [goodLesson],
};

describe("publish validation", () => {
  it("draft valid lolos tanpa issues", () => {
    expect(validateCourseDraft([goodLevel], [])).toEqual([]);
  });
  it("course tanpa level ditolak", () => {
    const issues = validateCourseDraft([], []);
    expect(issues.some((i) => i.code === "EMPTY_OBJECTIVE")).toBe(true);
  });
  it("objective kosong terdeteksi (level & lesson)", () => {
    const issues = validateCourseDraft([{ ...goodLevel, objective: "  " }], []);
    expect(issues.some((i) => i.code === "EMPTY_OBJECTIVE" && i.path === "levels/lv1")).toBe(true);
  });
  it("urutan rusak terdeteksi", () => {
    const bad: DraftLevel = {
      ...goodLevel,
      lessons: [
        { ...goodLesson, id: "x", position: 0 },
        { ...goodLesson, id: "y", position: 2 },
      ],
    };
    expect(validateCourseDraft([bad], []).some((i) => i.code === "BROKEN_ORDER")).toBe(true);
  });
  it("point total invalid & answer key hilang", () => {
    const bad: DraftLevel = {
      ...goodLevel,
      lessons: [{ ...goodLesson, activities: [{ ...goodActivity, points: 0, hasAnswerKey: false }] }],
    };
    const codes = validateCourseDraft([bad], []).map((i) => i.code);
    expect(codes).toContain("INVALID_POINTS");
    expect(codes).toContain("MISSING_ANSWER_KEY");
  });
  it("video tanpa transcript = MISSING_A11Y", () => {
    const bad: DraftLevel = {
      ...goodLevel,
      lessons: [
        {
          ...goodLesson,
          activities: [{ id: "v", position: 0, type: "video_link", title: "V", transcriptAvailable: false }],
        },
      ],
    };
    expect(validateCourseDraft([bad], []).some((i) => i.code === "MISSING_A11Y")).toBe(true);
  });
  it("siklus prerequisite terdeteksi", () => {
    const l2: DraftLevel = { id: "lv2", position: 1, title: "L2", objective: "O", lessons: [] };
    const issues = validateCourseDraft(
      [goodLevel, l2],
      [
        { targetId: "lv1", requiredIds: ["lv2"] },
        { targetId: "lv2", requiredIds: ["lv1"] },
      ],
    );
    expect(issues.some((i) => i.code === "PREREQ_CYCLE" && /lv1.*lv2|lv2.*lv1/.test(i.message))).toBe(true);
  });
  it("prerequisite ke entity inexistence ditolak", () => {
    expect(
      validateCourseDraft([goodLevel], [{ targetId: "lv1", requiredIds: ["ghost"] }]).some(
        (i) => i.code === "BROKEN_ORDER",
      ),
    ).toBe(true);
  });
});
