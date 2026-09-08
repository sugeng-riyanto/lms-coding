import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** AC-53: competency mastery traceable to evidence — teacher-facing view. */
describe("student detail page — competency mastery & evidence (AC-53)", () => {
  const page = readFileSync("app/(teacher)/teacher/students/[studentId]/page.tsx", "utf8");
  const lib = readFileSync("lib/mastery-evidence.ts", "utf8");

  it("page builds mastery from the pure evidence builder", () => {
    expect(page).toMatch(/import \{ buildMasteryEvidence[^\n]*\} from "@\/lib\/mastery-evidence"/);
    expect(page).toMatch(/masteryEvidence: evidenceInput \? buildMasteryEvidence\(evidenceInput\) : \[\]/);
  });

  it("fetch is bounded by this student's attempts (not an org-wide scan)", () => {
    // attempts → assessments → activities → activity_competencies → competencies
    expect(page).toMatch(
      /from\("attempts"\)\s*\n\s*\.select\("id,assessment_id,attempt_no,status,final_score,submitted_at"\)\s*\n\s*\.in\("enrollment_id", enrollmentIds\)/,
    );
    expect(page).toMatch(/from\("assessments"\)[\s\S]*\.in\("id", assessmentIds\)/);
    expect(page).toMatch(/from\("activity_competencies"\)[\s\S]*\.in\("activity_id", activityIds\)/);
  });

  it("evidence chain includes revisions and rubric criteria (draft=false only in lib)", () => {
    expect(page).toMatch(/from\("grade_revisions"\)[\s\S]*\.in\("attempt_id", attemptIds\)/);
    expect(page).toMatch(/from\("criterion_scores"\)/);
    expect(page).toMatch(/from\("rubric_criteria"\)/);
    // drafts are filtered in the pure layer, never surfaced as evidence
    expect(lib).toMatch(/if \(s\.draft\) continue/);
  });

  it("renders a per-competency card with mastery % and expandable attempts", () => {
    expect(page).toMatch(/<details/);
    expect(page).toMatch(/t\("masteryEvidence"\)/);
    expect(page).toMatch(/\(c\.mastery \* 100\)\.toFixed\(1\)/);
    expect(page).toMatch(/att\.revisions\.length > 0/);
    expect(page).toMatch(/att\.rubric &&/);
  });
});
