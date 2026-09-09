import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Quiz result/pending-release persistence (regression test).
 *
 * Before this fix, the result panel was client-only state — reloading the
 * page dropped it. The fix passes server-fetched getAttemptResult() as an
 * initialResult prop to QuizTaker so the panel renders immediately from
 * server data on reload.
 *
 * This test asserts the structural contract at the source level:
 * 1. The server page fetches getAttemptResult for submitted attempts.
 * 2. QuizTaker accepts an initialResult prop.
 * 3. QuizTaker initializes result state from initialResult.
 */
const pageSource = readFileSync("app/(student)/quiz/[attemptId]/page.tsx", "utf8");
const quizTakerSource = readFileSync("app/(student)/quiz/[attemptId]/quiz-taker.tsx", "utf8");

describe("quiz result persistence — server-rendered for submitted attempts", () => {
  describe("server page fetches result for submitted attempts", () => {
    it("imports getAttemptResult", () => {
      expect(pageSource).toMatch(/import.*getAttemptResult.*from.*features\/actions/);
    });

    it("calls getAttemptResult when status is not in_progress", () => {
      // The page should fetch the result server-side for submitted attempts
      expect(pageSource).toMatch(/getAttemptResult\(attemptId\)/);
    });

    it("passes initialResult prop to QuizTaker", () => {
      expect(pageSource).toMatch(/initialResult=\{initialResult\}/);
    });

    it("initialResult is fetched inside a try/catch for resilience", () => {
      // The fetch should be guarded so auth edge cases don't crash the page
      expect(pageSource).toMatch(/try\s*\{[\s\S]*getAttemptResult/);
      expect(pageSource).toMatch(/catch\s*\{[\s\S]*\}/);
    });
  });

  describe("QuizTaker initializes from server-provided result", () => {
    it("accepts initialResult prop in Props interface", () => {
      expect(quizTakerSource).toMatch(/initialResult\?.*Result/);
    });

    it("destructures initialResult from props", () => {
      expect(quizTakerSource).toMatch(/function QuizTaker\(\{.*initialResult/);
    });

    it("initializes result state from initialResult (not null)", () => {
      // The useState should use initialResult ?? null, not just null
      expect(quizTakerSource).toMatch(/useState.*initialResult\s*\?\?\s*null/);
    });

    it("does NOT change the submit-time flow — onSubmit still calls getAttemptResult", () => {
      // The client-side submit flow should still work for in-progress attempts
      expect(quizTakerSource).toMatch(/const r = await getAttemptResult\(attemptId\)/);
      expect(quizTakerSource).toMatch(/setResult\(r\)/);
    });
  });

  describe("result panel rendering (unchanged)", () => {
    it("visible result shows score and per-question items", () => {
      expect(quizTakerSource).toMatch(/result\?\.ok && result\.visible/);
      expect(quizTakerSource).toMatch(/result\.finalScore/);
      expect(quizTakerSource).toMatch(/result\.items\.map/);
    });

    it("pending-release shows awaiting message when not visible", () => {
      expect(quizTakerSource).toMatch(/result\?\.ok && !result\.visible/);
      expect(quizTakerSource).toMatch(/t\("pendingRelease"\)/);
    });
  });
});
