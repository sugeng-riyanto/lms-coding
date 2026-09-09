"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n";

interface TrendData {
  period: "7d" | "30d";
  activeStudents: number;
  avgScore: number;
  completions: number;
  studyTimeMinutes: number;
}

interface AnalyticsTrendsProps {
  lang?: Lang;
  cohortId: string;
}

export function AnalyticsTrends({ cohortId }: AnalyticsTrendsProps) {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d">("7d");

  const supabase = createClient();

  const loadTrends = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const periods: Array<{ period: "7d" | "30d"; days: number }> = [
        { period: "7d", days: 7 },
        { period: "30d", days: 30 },
      ];

      const results: TrendData[] = [];

      for (const { period, days } of periods) {
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Get enrollments in cohort
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("id, student_id")
          .eq("cohort_id", cohortId)
          .eq("status", "active");

        const enrollmentIds = enrollments?.map((e) => e.id) ?? [];

        // Get active students (had activity in period)
        const { data: sessions } = await supabase
          .from("study_sessions")
          .select("student_id")
          .in("enrollment_id", enrollmentIds)
          .gte("started_at", startDate.toISOString());

        const activeStudents = new Set(sessions?.map((s) => s.student_id) ?? []).size;

        // Get attempts in period
        const { data: attempts } = await supabase
          .from("attempts")
          .select("final_score, enrollment_id")
          .in("enrollment_id", enrollmentIds)
          .gte("created_at", startDate.toISOString())
          .not("final_score", "is", null);

        const scores = attempts?.map((a) => Number(a.final_score)) ?? [];
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        // Get completions in period
        const { data: completions } = await supabase
          .from("progress_snapshots")
          .select("id")
          .in("enrollment_id", enrollmentIds)
          .eq("percent", 100)
          .gte("updated_at", startDate.toISOString());

        // Get study time
        const { data: studySessions } = await supabase
          .from("study_sessions")
          .select("duration_seconds")
          .in("enrollment_id", enrollmentIds)
          .gte("started_at", startDate.toISOString());

        const studyTimeMinutes = Math.round(
          (studySessions?.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) ?? 0) / 60
        );

        results.push({
          period,
          activeStudents,
          avgScore: Math.round(avgScore),
          completions: completions?.length ?? 0,
          studyTimeMinutes,
        });
      }

      setTrends(results);
    } catch {
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, [cohortId, supabase]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadTrends();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadTrends]);

  const current = trends.find((t) => t.period === selectedPeriod);
  const previous = trends.find((t) => t.period === (selectedPeriod === "7d" ? "30d" : "7d"));

  // Calculate changes
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${Math.round(change)}%` : `${Math.round(change)}%`;
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
        Loading trends...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Performance Trends</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedPeriod("7d")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
              selectedPeriod === "7d"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800"
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setSelectedPeriod("30d")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${
              selectedPeriod === "30d"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800"
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {current && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-950 dark:to-indigo-950">
            <p className="text-xs text-slate-600">Active Students</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{current.activeStudents}</p>
            {previous && (
              <p className={`text-xs ${current.activeStudents >= previous.activeStudents ? "text-green-600" : "text-red-600"}`}>
                {calcChange(current.activeStudents, previous.activeStudents)} vs {selectedPeriod === "7d" ? "30d" : "7d"}
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950 dark:to-teal-950">
            <p className="text-xs text-slate-600">Avg Score</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{current.avgScore}%</p>
            {previous && (
              <p className={`text-xs ${current.avgScore >= previous.avgScore ? "text-green-600" : "text-red-600"}`}>
                {calcChange(current.avgScore, previous.avgScore)} vs {selectedPeriod === "7d" ? "30d" : "7d"}
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-purple-50 p-4 dark:from-violet-950 dark:to-purple-950">
            <p className="text-xs text-slate-600">Completions</p>
            <p className="mt-1 text-2xl font-bold text-violet-600">{current.completions}</p>
            {previous && (
              <p className={`text-xs ${current.completions >= previous.completions ? "text-green-600" : "text-red-600"}`}>
                {calcChange(current.completions, previous.completions)} vs {selectedPeriod === "7d" ? "30d" : "7d"}
              </p>
            )}
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-950 dark:to-orange-950">
            <p className="text-xs text-slate-600">Study Time</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{current.studyTimeMinutes}m</p>
            {previous && (
              <p className={`text-xs ${current.studyTimeMinutes >= previous.studyTimeMinutes ? "text-green-600" : "text-red-600"}`}>
                {calcChange(current.studyTimeMinutes, previous.studyTimeMinutes)} vs {selectedPeriod === "7d" ? "30d" : "7d"}
              </p>
            )}
          </div>
        </div>
      )}

      {!current && (
        <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
          No data available for this period
        </div>
      )}
    </div>
  );
}
