/**
 * Spaced Repetition System using SM-2 Algorithm
 * 
 * Based on SuperMemo 2 algorithm by P.A. Wozniak:
 * - Quality rating (0-5) determines next interval
 * - Easiness Factor (EF) adjusts based on performance
 * - Failed recalls reset to shorter intervals
 * 
 * Quality ratings:
 * 0 - Complete blackout (no memory)
 * 1 - Wrong answer (incorrect recall)
 * 2 - Hard (correct with significant difficulty)
 * 3 - Good (correct with some hesitation)
 * 4 - Easy (correct with minor hesitation)
 * 5 - Perfect (instant, effortless recall)
 */

export interface SpacedRepetitionRecord {
  id: string;
  student_id: string;
  question_version_id: string;
  enrollment_id: string;
  easiness_factor: number;
  interval_days: number;
  repetition_count: number;
  next_review_at: string;
  last_review_at: string | null;
  last_quality: number | null;
  total_reviews: number;
  correct_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewResult {
  isDue: boolean;
  record: SpacedRepetitionRecord | null;
}

/**
 * SM-2 Algorithm: Calculate new easiness factor
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * where q is quality (0-5)
 */
export function calculateNewEF(currentEF: number, quality: number): number {
  const newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, newEF); // EF minimum is 1.3
}

/**
 * SM-2 Algorithm: Calculate next interval
 * Returns interval in days
 */
export function calculateNextInterval(
  currentInterval: number,
  repetitionCount: number,
  easinessFactor: number,
  quality: number
): number {
  if (quality < 3) {
    // Failed recall: reset
    return 0;
  }

  // Successful recall
  switch (repetitionCount + 1) {
    case 1:
      return 1; // First successful review: 1 day
    case 2:
      return 6; // Second successful review: 6 days
    default:
      // Subsequent: multiply by EF
      return Math.round(currentInterval * easinessFactor);
  }
}

/**
 * Check if a question is due for review
 */
export function isDueForReview(record: SpacedRepetitionRecord): boolean {
  return new Date(record.next_review_at) <= new Date();
}

/**
 * Get review status text
 */
export function getReviewStatus(record: SpacedRepetitionRecord): {
  status: "new" | "due" | "overdue" | "learning" | "mastered";
  label: string;
  daysUntilDue: number;
} {
  const now = new Date();
  const nextReview = new Date(record.next_review_at);
  const daysUntilDue = Math.ceil((nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (record.total_reviews === 0) {
    return { status: "new", label: "New", daysUntilDue: 0 };
  }

  if (daysUntilDue <= 0) {
    return { 
      status: record.interval_days > 21 ? "overdue" : "due", 
      label: daysUntilDue < -7 ? "Overdue" : "Due for review",
      daysUntilDue 
    };
  }

  if (record.interval_days < 7) {
    return { status: "learning", label: "Learning", daysUntilDue };
  }

  if (record.interval_days >= 21) {
    return { status: "mastered", label: "Mastered", daysUntilDue };
  }

  return { status: "due", label: `Review in ${daysUntilDue} days`, daysUntilDue };
}

/**
 * Get mastery percentage (0-100)
 */
export function getMasteryPercent(record: SpacedRepetitionRecord): number {
  if (record.total_reviews === 0) return 0;
  
  // Combine accuracy and interval for mastery score
  const accuracy = record.correct_count / record.total_reviews;
  const intervalScore = Math.min(record.interval_days / 30, 1); // Max out at 30 days
  
  return Math.round((accuracy * 0.6 + intervalScore * 0.4) * 100);
}

/**
 * Sort questions by priority (due first, then by difficulty)
 */
export function sortByReviewPriority(
  questions: Array<{ record: SpacedRepetitionRecord; questionId: string }>
): Array<{ record: SpacedRepetitionRecord; questionId: string }> {
  return [...questions].sort((a, b) => {
    const aDue = isDueForReview(a.record);
    const bDue = isDueForReview(b.record);

    // Due items first
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;

    // Among due items, prioritize overdue
    if (aDue && bDue) {
      const aOverdue = new Date(a.record.next_review_at).getTime();
      const bOverdue = new Date(b.record.next_review_at).getTime();
      return aOverdue - bOverdue;
    }

    // Among non-due items, prioritize by next review date
    return new Date(a.record.next_review_at).getTime() - new Date(b.record.next_review_at).getTime();
  });
}
