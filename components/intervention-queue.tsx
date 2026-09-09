"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface AtRiskStudent {
  studentId: string;
  studentName: string;
  riskLevel: "high" | "medium" | "low";
  riskReasons: string[];
  lastActive: string;
  avgScore: number;
  interventionStatus: "none" | "pending" | "in_progress" | "resolved";
  interventionNote: string;
}

interface InterventionQueueProps {
  teacherId: string;
  cohortId: string;
}

function formatLastActive(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function InterventionQueue({ teacherId, cohortId }: InterventionQueueProps) {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<AtRiskStudent["interventionStatus"]>("pending");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const loadAtRiskStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, student_id")
        .eq("cohort_id", cohortId)
        .eq("status", "active");

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = [...new Set(enrollments.map((e) => e.student_id))];
      const enrollmentIds = enrollments.map((e) => e.id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", studentIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) ?? []);

      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("student_id, started_at")
        .in("enrollment_id", enrollmentIds)
        .order("started_at", { ascending: false });

      const { data: attempts } = await supabase
        .from("attempts")
        .select("enrollment_id, final_score, created_at")
        .in("enrollment_id", enrollmentIds)
        .not("final_score", "is", null)
        .order("created_at", { ascending: false });

      const { data: interventions } = await supabase
        .from("interventions")
        .select("*")
        .in("student_id", studentIds)
        .eq("cohort_id", cohortId);

      const interventionMap = new Map(interventions?.map((i) => [i.student_id, i]) ?? []);

      const atRiskStudents: AtRiskStudent[] = [];
      const now = new Date();

      for (const studentId of studentIds) {
        const studentSessions = sessions?.filter((s) => s.student_id === studentId) ?? [];
        const studentAttempts = attempts?.filter((a) => {
          const enrollment = enrollments.find((e) => e.id === a.enrollment_id);
          return enrollment?.student_id === studentId;
        }) ?? [];

        const riskReasons: string[] = [];
        let riskLevel: AtRiskStudent["riskLevel"] = "low";

        const lastSession = studentSessions[0];
        const lastActive = lastSession?.started_at ?? new Date().toISOString();
        const daysSinceActive = Math.floor(
          (now.getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceActive > 7) {
          riskReasons.push(`Inactive for ${daysSinceActive} days`);
          riskLevel = "high";
        } else if (daysSinceActive > 3) {
          riskReasons.push(`Inactive for ${daysSinceActive} days`);
          riskLevel = "medium";
        }

        const scores = studentAttempts.map((a) => Number(a.final_score)).filter((s) => s > 0);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        if (avgScore < 50 && scores.length > 0) {
          riskReasons.push(`Low average score: ${Math.round(avgScore)}%`);
          riskLevel = "high";
        } else if (avgScore < 70 && scores.length > 0) {
          riskReasons.push(`Below target score: ${Math.round(avgScore)}%`);
          riskLevel = riskLevel === "high" ? "high" : "medium";
        }

        const recentScores = scores.slice(0, 5);
        const failures = recentScores.filter((s) => s < 70).length;
        if (failures >= 3) {
          riskReasons.push(`${failures} of last 5 attempts below 70%`);
          riskLevel = "high";
        }

        if (riskReasons.length > 0) {
          const intervention = interventionMap.get(studentId);
          atRiskStudents.push({
            studentId,
            studentName: profileMap.get(studentId) ?? "Unknown",
            riskLevel,
            riskReasons,
            lastActive,
            avgScore,
            interventionStatus: intervention?.status ?? "none",
            interventionNote: intervention?.note ?? "",
          });
        }
      }

      atRiskStudents.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.riskLevel] - order[b.riskLevel];
      });

      setStudents(atRiskStudents);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [cohortId, supabase]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadAtRiskStudents();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadAtRiskStudents]);

  const handleSaveIntervention = async () => {
    if (!selectedStudent) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("interventions").upsert({
        student_id: selectedStudent.studentId,
        cohort_id: cohortId,
        teacher_id: teacherId,
        status,
        note,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === selectedStudent.studentId
            ? { ...s, interventionStatus: status, interventionNote: note }
            : s
        )
      );

      setSelectedStudent(null);
      setNote("");
      setStatus("pending");
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const riskColors = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-green-100 text-green-700 border-green-200",
  };

  const statusColors = {
    none: "bg-slate-100 text-slate-600",
    pending: "bg-amber-100 text-amber-700",
    in_progress: "bg-blue-100 text-blue-700",
    resolved: "bg-green-100 text-green-700",
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
        Loading intervention queue...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Intervention Queue</h3>
        <span className="text-xs text-slate-500">
          {students.filter((s) => s.riskLevel === "high").length} high risk
        </span>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border p-4 text-center text-sm text-slate-500">
          No at-risk students identified
        </div>
      ) : (
        <ul className="space-y-2">
          {students.map((student) => (
            <li key={student.studentId}>
              <button
                type="button"
                onClick={() => {
                  setSelectedStudent(student);
                  setNote(student.interventionNote);
                  setStatus(student.interventionStatus);
                }}
                className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md ${riskColors[student.riskLevel]}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{student.studentName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[student.interventionStatus]}`}>
                        {student.interventionStatus}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {student.riskReasons.map((reason, i) => (
                        <li key={i} className="text-xs opacity-80">• {reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{Math.round(student.avgScore)}%</p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Intervention: {selectedStudent.studentName}</h3>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AtRiskStudent["interventionStatus"])}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="none">None</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Document intervention actions..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveIntervention}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
