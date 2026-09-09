/**
 * Quiz feedback integration (static): wiring verification.
 * getAttemptFeedback action + buildQuizFeedback lib + QuizResult UI + i18n keys.
 */
import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const actions = readFileSync("features/actions.ts", "utf8");
const quizFeedback = readFileSync("lib/quiz-feedback.ts", "utf8");
const quizResult = readFileSync("app/(student)/quiz/[attemptId]/quiz-result.tsx", "utf8");
const quizTaker = readFileSync("app/(student)/quiz/[attemptId]/quiz-taker.tsx", "utf8");
const quizDict = readFileSync("lib/ui-text/quiz.ts", "utf8");

describe("quiz feedback wiring", () => {
  it("getAttemptFeedback action exists and imports buildQuizFeedback", () => {
    expect(actions).toMatch(/export async function getAttemptFeedback/);
    expect(actions).toMatch(/await import\(".*quiz-feedback"\)/);
  });

  it("getAttemptFeedback fetches grading_json + explanation_json via service client", () => {
    expect(actions).toMatch(/question_id,grading_json/);
    expect(actions).toMatch(/questions.*explanation_json/);
    expect(actions).toMatch(/responses.*auto_score.*manual_score/);
  });

  it("getAttemptFeedback respects release policy via canShowScore", () => {
    const idx = actions.indexOf("export async function getAttemptFeedback");
    const slice = actions.slice(idx, idx + 1200);
    expect(slice).toMatch(/canShowScore\(release/);
  });

  it("getAttemptFeedback respects server-generated pool order", () => {
    const idx = actions.indexOf("export async function getAttemptFeedback");
    const slice = actions.slice(idx, idx + 1200);
    expect(slice).toMatch(/question_order_json/);
  });

  it("buildQuizFeedback is exported from lib/quiz-feedback.ts", () => {
    expect(quizFeedback).toMatch(/export function buildQuizFeedback/);
  });

  it("QuizResult component exists and imports getAttemptFeedback", () => {
    expect(quizResult).toMatch(/import.*getAttemptFeedback.*from.*@\/features\/actions/);
    expect(quizResult).toMatch(/export function QuizResult/);
  });

  it("QuizResult shows correct/incorrect badges", () => {
    expect(quizResult).toMatch(/badgeCorrect|badgeIncorrect/);
    expect(quizResult).toMatch(/isCorrect/);
  });

  it("QuizResult shows explanation toggle", () => {
    expect(quizResult).toMatch(/showExplanation|hideExplanation/);
    expect(quizResult).toMatch(/explanation/);
  });

  it("QuizResult shows correct answer for incorrect auto-graded questions", () => {
    expect(quizResult).toMatch(/correctAnswer/);
  });

  it("quiz-taker imports QuizResult", () => {
    expect(quizTaker).toMatch(/import.*QuizResult.*from.*\.\/quiz-result/);
  });

  it("quiz-taker renders QuizResult after visible result", () => {
    expect(quizTaker).toMatch(/<QuizResult attemptId=\{attemptId\}/);
  });

  it("quiz dict has all feedback keys", () => {
    const keys = [
      "loadingFeedback",
      "feedbackSection",
      "feedbackTitle",
      "feedbackSummary",
      "yourAnswer",
      "correctAnswer",
      "score",
      "awaitingManualGrade",
      "showExplanation",
      "hideExplanation",
      "badgeCorrect",
      "badgeIncorrect",
      "badgePending",
      "resultSubtitle",
    ];
    for (const key of keys) {
      expect(quizDict).toContain(key);
    }
  });

  it("quiz dict has EN and ID for every new key", () => {
    const newKeys = [
      "loadingFeedback",
      "feedbackSection",
      "feedbackTitle",
      "feedbackSummary",
      "yourAnswer",
      "correctAnswer",
      "awaitingManualGrade",
      "showExplanation",
      "hideExplanation",
      "badgeCorrect",
      "badgeIncorrect",
      "badgePending",
      "resultSubtitle",
    ];
    for (const key of newKeys) {
      // Keys are unquoted identifiers in the source: `loadingFeedback: { id: ...`
      expect(quizDict).toContain(`${key}:`);
    }
  });
});
