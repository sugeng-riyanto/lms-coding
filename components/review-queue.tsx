"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { mkT, type Lang } from "@/lib/i18n";
import { REVIEW } from "@/lib/ui-text/review";
import {
  type SpacedRepetitionRecord,
  isDueForReview,
  getReviewStatus,
  getMasteryPercent,
} from "@/lib/spaced-repetition";

interface ReviewQueueProps {
  lang?: Lang;
  userId: string;
  enrollmentId: string;
}

export function ReviewQueue({ lang = "en", userId, enrollmentId }: ReviewQueueProps) {
  const t = mkT(REVIEW, lang);
  const [records, setRecords] = useState<SpacedRepetitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<SpacedRepetitionRecord | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const supabase = createClient();

  // Load spaced repetition records
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("spaced_repetition")
        .select("*")
        .eq("student_id", userId)
        .eq("enrollment_id", enrollmentId)
        .order("next_review_at", { ascending: true });

      if (error) throw error;
      setRecords(data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [userId, enrollmentId, supabase]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Submit quality rating
  const handleRate = async () => {
    if (!selectedRecord || selectedQuality === null) return;

    setSubmitting(true);
    setResult(null);

    try {
      const { error } = await supabase.rpc("update_spaced_repetition", {
        p_student_id: userId,
        p_question_version_id: selectedRecord.question_version_id,
        p_enrollment_id: enrollmentId,
        p_quality: selectedQuality,
      });

      if (error) throw error;

      setResult({ success: true, message: t("rateSuccess") });

      // Refresh records
      await loadRecords();
      setSelectedRecord(null);
      setSelectedQuality(null);
    } catch {
      setResult({ success: false, message: t("rateError") });
    } finally {
      setSubmitting(false);
    }
  };

  // Get quality labels
  const qualityLabels = [
    { value: 0, label: "0 - Blackout", color: "bg-red-100 text-red-700" },
    { value: 1, label: "1 - Wrong", color: "bg-red-50 text-red-600" },
    { value: 2, label: "2 - Hard", color: "bg-orange-100 text-orange-700" },
    { value: 3, label: "3 - Good", color: "bg-yellow-100 text-yellow-700" },
    { value: 4, label: "4 - Easy", color: "bg-green-100 text-green-700" },
    { value: 5, label: "5 - Perfect", color: "bg-emerald-100 text-emerald-700" },
  ];

  // Stats
  const dueCount = records.filter((r) => isDueForReview(r)).length;
  const masteredCount = records.filter((r) => r.interval_days >= 21).length;
  const avgMastery =
    records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + getMasteryPercent(r), 0) / records.length)
      : 0;

  if (loading) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-slate-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-center dark:from-blue-950 dark:to-indigo-950">
          <p className="text-2xl font-bold text-blue-600">{dueCount}</p>
          <p className="text-xs text-slate-600">{t("dueForReview")}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center dark:from-emerald-950 dark:to-teal-950">
          <p className="text-2xl font-bold text-emerald-600">{masteredCount}</p>
          <p className="text-xs text-slate-600">{t("mastered")}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-purple-50 p-4 text-center dark:from-violet-950 dark:to-purple-950">
          <p className="text-2xl font-bold text-violet-600">{avgMastery}%</p>
          <p className="text-xs text-slate-600">{t("avgMastery")}</p>
        </div>
      </div>

      {/* Active record review */}
      {selectedRecord && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/50">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{t("reviewQuestion")}</h3>
            <button
              type="button"
              onClick={() => {
                setSelectedRecord(null);
                setSelectedQuality(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Question info */}
          <div className="mb-4 rounded-lg bg-white p-4 dark:bg-slate-800">
            <p className="text-sm text-slate-600">
              Question ID: {selectedRecord.question_version_id.slice(0, 8)}...
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
              <span>{t("reviews")}: {selectedRecord.total_reviews}</span>
              <span>{t("accuracy")}: {Math.round((selectedRecord.correct_count / Math.max(1, selectedRecord.total_reviews)) * 100)}%</span>
              <span>{t("interval")}: {selectedRecord.interval_days}d</span>
            </div>
          </div>

          {/* Quality rating */}
          <p className="mb-2 text-sm font-medium">{t("howWellDidYouRecall")}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {qualityLabels.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => setSelectedQuality(q.value)}
                className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition ${
                  selectedQuality === q.value
                    ? "border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : q.color
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Submit */}
          {selectedQuality !== null && (
            <button
              type="button"
              onClick={handleRate}
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("submitRating")}
            </button>
          )}

          {result && (
            <p className={`mt-2 text-sm ${result.success ? "text-green-600" : "text-red-600"}`}>
              {result.message}
            </p>
          )}
        </div>
      )}

      {/* Record list */}
      {records.length === 0 ? (
        <div className="rounded-xl border p-6 text-center text-sm text-slate-500">
          {t("noQuestionsForReview")}
          <p className="mt-2 text-xs text-slate-400">
            Complete quizzes to start spaced repetition review
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => {
            const status = getReviewStatus(record);
            const mastery = getMasteryPercent(record);
            const isDue = isDueForReview(record);

            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecord(record);
                    setSelectedQuality(null);
                  }}
                  disabled={!isDue && !selectedRecord}
                  className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md ${
                    isDue
                      ? "border-blue-200 bg-blue-50/50 hover:border-blue-300 dark:border-blue-800 dark:bg-blue-950/30"
                      : "border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            status.status === "mastered"
                              ? "bg-emerald-100 text-emerald-700"
                              : status.status === "due"
                              ? "bg-blue-100 text-blue-700"
                              : status.status === "overdue"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Q: {record.question_version_id.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-500">
                        <span>{t("reviews")}: {record.total_reviews}</span>
                        <span>{t("accuracy")}: {Math.round((record.correct_count / Math.max(1, record.total_reviews)) * 100)}%</span>
                        <span>{t("interval")}: {record.interval_days}d</span>
                        <span>EF: {record.easiness_factor.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="ml-3 flex flex-col items-end">
                      <div className="h-10 w-10 rounded-full border-4 border-slate-200 dark:border-slate-700" style={{
                        borderTopColor: mastery >= 80 ? "#10b981" : mastery >= 50 ? "#f59e0b" : "#ef4444",
                        transform: `rotate(${90 - (mastery / 100) * 180}deg)`
                      }} />
                      <span className="mt-1 text-[10px] font-medium text-slate-600">{mastery}%</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
