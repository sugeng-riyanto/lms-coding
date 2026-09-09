import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IssueCertificateButton } from "./issue-button";
import { ReissueCertificateButton } from "./reissue-button";
import { AnchorStatusChip } from "@/components/anchor-status";
import { fmt, getLang, mkT } from "@/lib/i18n";
import { STUDENT_DETAIL } from "@/lib/ui-text/student-detail";
import { buildMasteryEvidence, type MasteryEvidenceInput } from "@/lib/mastery-evidence";

export const dynamic = "force-dynamic";

/**
 * Bukti mastery (AC-53): fetch baris DB DI BAWAH RLS guru-cohort, lalu bangun
 * lintasan per kompetensi (murni di lib/mastery-evidence.ts). Terikat oleh
 * attempt milik murid ini — bukan scan seluruh org.
 */
async function fetchMasteryEvidenceInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentIds: string[],
): Promise<MasteryEvidenceInput | null> {
  const empty: MasteryEvidenceInput = {
    competencies: [],
    activityCompetencies: [],
    activities: [],
    assessments: [],
    attempts: [],
    responses: [],
    questionVersions: [],
    rubrics: [],
    rubricCriteria: [],
    criterionScores: [],
    revisions: [],
  };
  if (enrollmentIds.length === 0) return empty;

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("id,assessment_id,attempt_no,status,final_score,submitted_at")
    .in("enrollment_id", enrollmentIds);
  const attempts = (attemptRows as MasteryEvidenceInput["attempts"] | null) ?? [];
  if (attempts.length === 0) return empty;
  const attemptIds = attempts.map((a) => a.id);
  const assessmentIds = [...new Set(attempts.map((a) => a.assessment_id))];

  const { data: asmtRows } = await supabase
    .from("assessments")
    .select("id,activity_id")
    .in("id", assessmentIds);
  const assessments = (asmtRows as MasteryEvidenceInput["assessments"] | null) ?? [];
  const activityIds = [...new Set(assessments.map((a) => a.activity_id))];

  const { data: actRows } = await supabase.from("activities").select("id,title,type").in("id", activityIds);
  const activities = (actRows as MasteryEvidenceInput["activities"] | null) ?? [];

  const { data: acRows } = await supabase
    .from("activity_competencies")
    .select("activity_id,competency_id,weight")
    .in("activity_id", activityIds);
  const activityCompetencies = (acRows as MasteryEvidenceInput["activityCompetencies"] | null) ?? [];
  const competencyIds = [...new Set(activityCompetencies.map((ac) => ac.competency_id))];

  let competencies: MasteryEvidenceInput["competencies"] = [];
  if (competencyIds.length > 0) {
    const { data: compRows } = await supabase
      .from("competencies")
      .select("id,code,title")
      .in("id", competencyIds);
    competencies = (compRows as MasteryEvidenceInput["competencies"] | null) ?? [];
  }

  const { data: respRows } = await supabase
    .from("responses")
    .select("id,attempt_id,question_version_id,auto_score,manual_score")
    .in("attempt_id", attemptIds);
  const responses = (respRows as MasteryEvidenceInput["responses"] | null) ?? [];
  const qvIds = [
    ...new Set(responses.map((r) => r.question_version_id).filter((x): x is string => Boolean(x))),
  ];

  let questionVersions: MasteryEvidenceInput["questionVersions"] = [];
  let rubrics: MasteryEvidenceInput["rubrics"] = [];
  let rubricCriteria: MasteryEvidenceInput["rubricCriteria"] = [];
  if (qvIds.length > 0) {
    const { data: qvRows } = await supabase
      .from("question_versions")
      .select("id,version,rubric_id")
      .in("id", qvIds);
    questionVersions = (qvRows as MasteryEvidenceInput["questionVersions"] | null) ?? [];
    const rubricIds = [
      ...new Set(questionVersions.map((q) => q.rubric_id).filter((x): x is string => Boolean(x))),
    ];
    if (rubricIds.length > 0) {
      const { data: rubRows } = await supabase.from("rubrics").select("id,title,version").in("id", rubricIds);
      rubrics = (rubRows as MasteryEvidenceInput["rubrics"] | null) ?? [];
      const { data: crRows } = await supabase
        .from("rubric_criteria")
        .select("id,rubric_id,version,title,max_points")
        .in("rubric_id", rubricIds);
      rubricCriteria = (crRows as MasteryEvidenceInput["rubricCriteria"] | null) ?? [];
    }
  }

  const responseIds = responses.map((r) => r.id);
  let criterionScores: MasteryEvidenceInput["criterionScores"] = [];
  if (responseIds.length > 0) {
    const { data: scRows } = await supabase
      .from("criterion_scores")
      .select("criterion_id,response_id,score,draft")
      .in("response_id", responseIds);
    criterionScores = (scRows as MasteryEvidenceInput["criterionScores"] | null) ?? [];
  }

  const { data: revRows } = await supabase
    .from("grade_revisions")
    .select("attempt_id,previous_score,new_score,reason,changed_by,created_at")
    .in("attempt_id", attemptIds);
  const revisions = (revRows as MasteryEvidenceInput["revisions"] | null) ?? [];

  return {
    competencies,
    activityCompetencies,
    activities,
    assessments,
    attempts,
    responses,
    questionVersions,
    rubrics,
    rubricCriteria,
    criterionScores,
    revisions,
  };
}

/** Detail murid: timeline, attempts, revisions, certificates (RLS cohort guru). */
async function getDetail(studentId: string, cohortId: string | undefined) {
  const supabase = await createClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name,status")
    .eq("id", studentId)
    .single();
  const profile = prof as { display_name: string; status: string } | null;
  if (!profile) return null;

  let q = supabase.from("enrollments").select("id,course_id,courses(title)").eq("student_id", studentId);
  if (cohortId) q = q.eq("cohort_id", cohortId);
  const { data: enrollments } = await q;
  const enrs =
    (enrollments as { id: string; course_id: string; courses: { title: string } | null }[] | null) ?? [];

  const attempts: { id: string; no: number; status: string; score: number | null; at: string }[] = [];
  const events: { type: string; at: string }[] = [];
  const revisions: { attempt: string; prev: number | null; next: number | null; reason: string }[] = [];
  for (const e of enrs) {
    const { data: atts } = await supabase
      .from("attempts")
      .select("id,attempt_no,status,final_score,submitted_at")
      .eq("enrollment_id", e.id)
      .order("submitted_at", { ascending: false })
      .limit(20);
    for (const a of (atts as
      | {
          id: string;
          attempt_no: number;
          status: string;
          final_score: number | null;
          submitted_at: string | null;
        }[]
      | null) ?? []) {
      attempts.push({
        id: a.id,
        no: a.attempt_no,
        status: a.status,
        score: a.final_score,
        at: a.submitted_at ?? "—",
      });
      const { data: revs } = await supabase
        .from("grade_revisions")
        .select("previous_score,new_score,reason")
        .eq("attempt_id", a.id);
      for (const r of (revs as
        { previous_score: number | null; new_score: number | null; reason: string }[] | null) ?? []) {
        revisions.push({
          attempt: a.id.slice(0, 8),
          prev: r.previous_score,
          next: r.new_score,
          reason: r.reason,
        });
      }
    }
    const { data: evs } = await supabase
      .from("learning_events")
      .select("event_type,occurred_at")
      .eq("enrollment_id", e.id)
      .order("occurred_at", { ascending: false })
      .limit(20);
    for (const ev of (evs as { event_type: string; occurred_at: string }[] | null) ?? []) {
      events.push({ type: ev.event_type, at: ev.occurred_at });
    }
  }
  const { data: certs } = await supabase
    .from("certificates")
    .select(
      "id,serial_no,status,issued_at,enrollment_id,level_id,chain_anchors(status,transaction_ref,network)",
    )
    .in(
      "enrollment_id",
      enrs.map((e) => e.id),
    );
  const certRows =
    (certs as
      | {
          id: string;
          serial_no: string;
          status: string;
          issued_at: string;
          enrollment_id: string;
          level_id: string;
          chain_anchors: {
            status: string | null;
            transaction_ref: string | null;
            network: string | null;
          } | null;
        }[]
      | null) ?? [];

  // Approval penerbitan: level per enrollment + status sertifikat + tombol issue.
  const issuable: {
    enrollmentId: string;
    courseTitle: string;
    levelId: string;
    levelTitle: string;
    certStatus: string | null;
  }[] = [];
  for (const e of enrs) {
    const { data: versions } = await supabase
      .from("course_versions")
      .select("id")
      .eq("course_id", e.course_id)
      .not("published_at", "is", null)
      .order("version", { ascending: false })
      .limit(1);
    const v = ((versions as { id: string }[] | null) ?? [])[0];
    if (!v) continue;
    const { data: levelRows } = await supabase
      .from("levels")
      .select("id,title")
      .eq("course_version_id", v.id)
      .order("position");
    for (const lv of (levelRows as { id: string; title: string }[] | null) ?? []) {
      // Setelah reissue (migration 000010) satu pair bisa punya banyak baris
      // (revoked + active). Status yang dipakai = baris TERBARU, agar tidak
      // menampilkan tombol "Terbitkan" di atas sertifikat yang sudah diganti.
      const pairRows = certRows
        .filter((c) => c.enrollment_id === e.id && c.level_id === lv.id)
        .sort((a, b) => (a.issued_at < b.issued_at ? 1 : a.issued_at > b.issued_at ? -1 : 0));
      const existing = pairRows[0];
      issuable.push({
        enrollmentId: e.id,
        courseTitle: e.courses?.title ?? e.course_id,
        levelId: lv.id,
        levelTitle: lv.title,
        certStatus: existing?.status ?? null,
      });
    }
  }
  const evidenceInput = await fetchMasteryEvidenceInput(
    supabase,
    enrs.map((e) => e.id),
  );

  // Fetch alert history for this student (all statuses, ordered by most recent)
  const { data: alertRows } = await supabase
    .from("alerts")
    .select("id,code,message,status,resolved_note,created_at,updated_at,assigned_to,due_at,escalation_level")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  const alertHistory =
    (alertRows as
      | {
          id: string;
          code: string;
          message: string;
          status: string;
          resolved_note: string | null;
          created_at: string;
          updated_at: string;
          assigned_to: string | null;
          due_at: string | null;
          escalation_level: number;
        }[]
      | null) ?? [];

  return {
    profile,
    courses: enrs.map((e) => e.courses?.title ?? e.course_id),
    attempts,
    events,
    revisions,
    certs: certRows,
    issuable,
    masteryEvidence: evidenceInput ? buildMasteryEvidence(evidenceInput) : [],
    alertHistory,
  };
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ cohort?: string }>;
}) {
  const lang = await getLang();
  const t = mkT(STUDENT_DETAIL, lang);
  const { studentId } = await params;
  const { cohort } = await searchParams;
  let data: Awaited<ReturnType<typeof getDetail>>;
  try {
    data = await getDetail(studentId, cohort);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <p role="alert">{t("loadFailed")}</p>
      </main>
    );
  }
  if (!data) notFound();

  // Rantai reissue: cert revoked yang pasangan (enrollment, level)-nya kini punya
  // cert active ditandai "diganti" — historinya tertaut ke baris active baru.
  const activePairKeys = new Set(
    data.certs.filter((c) => c.status === "active").map((c) => `${c.enrollment_id}:${c.level_id}`),
  );

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/teacher" className="text-sm text-blue-700 underline">
        {t("backToDashboard")}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{data.profile.display_name}</h1>
      <p className="text-sm text-slate-500">
        {fmt(t("statusLine"), { status: data.profile.status, courses: data.courses.join(", ") })}
      </p>

      <h2 className="mt-6 text-xl font-semibold">{t("masteryEvidence")}</h2>
      <p className="text-sm text-slate-500">{t("masteryEvidenceBody")}</p>
      {data.masteryEvidence.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("noCompetencyEvidence")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {data.masteryEvidence.map((c) => (
            <details key={c.competencyId} className="rounded-xl border bg-white p-3 dark:bg-slate-900">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {c.code} — {c.title}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {t("mastery")}: {(c.mastery * 100).toFixed(1)}%
                  {!c.hasEvidence && <span className="ml-2 text-amber-700">({t("noEvidence")})</span>}
                </span>
              </summary>
              {c.assessments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">{t("noAttempts")}</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {c.assessments.map((a) => (
                    <li
                      key={a.assessmentId}
                      className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                    >
                      <p className="font-semibold">
                        {a.activityTitle}
                        {a.bestScore !== null && (
                          <span className="ml-2 font-medium text-green-700 dark:text-green-400">
                            · {t("best")} {a.bestScore}
                          </span>
                        )}
                      </p>
                      {a.attempts.length === 0 ? (
                        <p className="mt-1 text-slate-500">{t("noAttempts")}</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {a.attempts.map((att) => (
                            <li key={att.attemptId} className="text-slate-700 dark:text-slate-200">
                              #{att.attemptNo} · {t("status")}: {att.status} · {t("score")}:{" "}
                              {att.finalScore ?? "—"} · {att.submittedAt ?? "—"}
                              {att.rubric && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {t("rubricUsed")}: {att.rubric.title} v{att.rubric.version}
                                  {att.rubric.criteria.length > 0 && (
                                    <span>
                                      {" "}
                                      —{" "}
                                      {att.rubric.criteria
                                        .map((cr) => `${cr.title} ${cr.score}/${cr.maxPoints}`)
                                        .join(" · ")}
                                    </span>
                                  )}
                                </p>
                              )}
                              {att.revisions.length > 0 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {t("revisions")}:{" "}
                                  {att.revisions
                                    .map(
                                      (r) =>
                                        `${r.prev ?? "—"}→${r.next ?? "—"} (${r.reason}, ${r.by}, ${r.at})`,
                                    )
                                    .join(" · ")}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ))}
        </div>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t("attemptHistory")}</h2>
      {data.attempts.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("noAttempts")}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.attempts.map((a) => (
            <li key={a.id} className="rounded border px-3 py-2">
              {fmt(t("attemptLine"), { no: a.no, status: a.status, score: a.score ?? "—", at: a.at })}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t("revisionsHeading")}</h2>
      {data.revisions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("noRevisions")}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.revisions.map((r, i) => (
            <li key={i} className="rounded border px-3 py-2">
              {fmt(t("revisionLine"), {
                attempt: r.attempt,
                prev: r.prev ?? "—",
                next: r.next ?? "—",
                reason: r.reason,
              })}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t("timelineHeading")}</h2>
      {data.events.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("noEvents")}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.events.map((e, i) => (
            <li key={i} className="rounded border px-3 py-2">
              {fmt(t("eventLine"), { type: e.type, at: e.at })}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t("alertHistoryHeading")}</h2>
      {data.alertHistory.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("noAlerts")}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {data.alertHistory.map((a) => (
            <li key={a.id} className="rounded border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold">{a.code}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    a.status === "resolved"
                      ? "bg-green-100 text-green-800"
                      : a.status === "reopened"
                        ? "bg-amber-100 text-amber-800"
                        : a.status === "snoozed"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-red-100 text-red-800"
                  }`}
                >
                  {a.status}
                </span>
                {a.escalation_level > 0 && (
                  <span className="text-xs text-red-600">L{a.escalation_level}</span>
                )}
                {a.due_at && (
                  <span className="text-xs text-slate-500">
                    {fmt(t("dueLabel"), { date: new Date(a.due_at).toLocaleDateString() })}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm">{a.message}</p>
              {a.resolved_note && (
                <p className="mt-1 text-xs text-slate-500">
                  {t("interventionNote")}: {a.resolved_note}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {fmt(t("alertTimestamp"), {
                  created: new Date(a.created_at).toLocaleString(),
                  updated: new Date(a.updated_at).toLocaleString(),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t("certificatesHeading")}</h2>
      {data.certs.length === 0 && data.issuable.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t("noCertificates")}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.certs.map((c) => {
            const replaced = c.status === "revoked" && activePairKeys.has(`${c.enrollment_id}:${c.level_id}`);
            return (
              <li
                key={c.serial_no}
                className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{c.serial_no}</span>
                  {c.status === "active" ? (
                    <span className="font-semibold text-green-800">{t("certActive")}</span>
                  ) : (
                    <span className="font-semibold text-red-700">{t("certRevoked")}</span>
                  )}
                  {replaced && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {t("replaced")}
                    </span>
                  )}{" "}
                  · {c.issued_at}
                  <AnchorStatusChip
                    status={c.chain_anchors?.status ?? null}
                    reference={c.chain_anchors?.transaction_ref}
                  />
                </span>
                {c.status === "active" && (
                  <ReissueCertificateButton certificateId={c.id} serialNo={c.serial_no} lang={lang} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-6 text-xl font-semibold">{t("issuanceHeading")}</h2>
      <p className="text-sm text-slate-500">{t("issuanceBody")}</p>
      <ul className="mt-2 space-y-2">
        {data.issuable.map((it) => (
          <li
            key={`${it.enrollmentId}-${it.levelId}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
          >
            <span>
              {it.courseTitle} · {it.levelTitle} ·{" "}
              {it.certStatus ? fmt(t("certStatusLabel"), { status: it.certStatus }) : t("notIssued")}
            </span>
            {it.certStatus !== "active" && (
              <IssueCertificateButton enrollmentId={it.enrollmentId} levelId={it.levelId} lang={lang} />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
