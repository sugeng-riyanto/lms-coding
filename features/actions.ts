"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { assessmentPercent, autoGrade } from "@/lib/grading";
import {
  addQuestionToAssessmentSchema,
  archiveCourseSchema,
  createActivitySchema,
  createAssessmentSchema,
  createCourseSchema,
  createLessonSchema,
  createLevelSchema,
  createModuleSchema,
  createQuestionSchema,
  duplicateCourseSchema,
  enrollStudentSchema,
  gradeResponseSchema,
  issueCertificateSchema,
  publishQuestionVersionSchema,
  recordLearningEventSchema,
  recomputeProgressSchema,
  releaseGradesSchema,
  reorderSiblingsSchema,
  revokeCertificateSchema,
  saveResponseSchema,
  startAttemptSchema,
  submitAttemptSchema,
  publishVersionSchema,
  uuidSchema,
} from "@/lib/validation";
import { sanitizeQuestionForAttempt, canShowScore, type SanitizedQuestion } from "@/lib/attempt";
import { normalizeOrder } from "@/lib/reorder";
import { validateCourseDraft, type DraftLevel, type DraftPrereq } from "@/lib/publish-validation";
import { checkRateLimit } from "@/lib/ratelimit";

// ---------- Course authoring: create draft ----------
export async function createCourse(input: unknown) {
  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const ownerId = (claims.claims as { sub?: string }).sub;
  if (!ownerId) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: org } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", ownerId)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  if (!org) return { ok: false as const, error: "FORBIDDEN" };
  const { data, error } = await supabase
    .from("courses")
    .insert({
      organization_id: (org as { organization_id: string }).organization_id,
      owner_id: ownerId,
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  const { data: version, error: vErr } = await supabase
    .from("course_versions")
    .insert({ course_id: (data as { id: string }).id, version: 1 })
    .select("id")
    .single();
  if (vErr) return { ok: false as const, error: "CREATE_FAILED" };
  return {
    ok: true as const,
    courseId: (data as { id: string }).id,
    versionId: (version as { id: string }).id,
  };
}

// ---------- Course authoring: publish (validasi server-side, bukan in-place edit) ----------
export async function publishCourseVersion(input: unknown) {
  const parsed = publishVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Rakit draft tree dari DB (RLS: hanya owner yang bisa baca draft miliknya).
  const { data: course } = await supabase
    .from("courses")
    .select("id,owner_id")
    .eq("id", parsed.data.courseId)
    .single();
  if (!course) return { ok: false as const, error: "NOT_FOUND" };
  const { data: versions } = await supabase
    .from("course_versions")
    .select("id,version")
    .eq("course_id", parsed.data.courseId)
    .order("version", { ascending: false })
    .limit(1);
  const versionRow = (versions as { id: string; version: number }[] | null)?.[0];
  if (!versionRow) return { ok: false as const, error: "NOT_FOUND" };

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id,position,title,objective")
    .eq("course_version_id", versionRow.id)
    .order("position");
  const levels: DraftLevel[] = [];
  for (const lv of (levelRows as
    { id: string; position: number; title: string; objective: string }[] | null) ?? []) {
    const { data: moduleRows } = await supabase.from("modules").select("id").eq("level_id", lv.id);
    const lessons: DraftLevel["lessons"] = [];
    for (const md of (moduleRows as { id: string }[] | null) ?? []) {
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("id,position,title,objective")
        .eq("module_id", md.id)
        .order("position");
      for (const le of (lessonRows as
        { id: string; position: number; title: string; objective: string }[] | null) ?? []) {
        const { data: actRows } = await supabase
          .from("activities")
          .select("id,position,type,title,content_json")
          .eq("lesson_id", le.id)
          .order("position");
        const activities: DraftLevel["lessons"][number]["activities"] = [];
        for (const a of (actRows as
          | {
              id: string;
              position: number;
              type: string;
              title: string;
              content_json: Record<string, unknown>;
            }[]
          | null) ?? []) {
          if (a.type === "quiz") {
            const { data: asmt } = await supabase
              .from("assessments")
              .select("id,total_points")
              .eq("activity_id", a.id)
              .limit(1)
              .single();
            const { count } = await supabase
              .from("assessment_questions")
              .select("assessment_id", { count: "exact", head: true })
              .eq(
                "assessment_id",
                (asmt as { id: string } | null)?.id ?? "00000000-0000-0000-0000-000000000000",
              );
            activities.push({
              id: a.id,
              position: a.position,
              type: "quiz",
              title: a.title,
              points: Number((asmt as { total_points: number } | null)?.total_points ?? 0),
              hasAnswerKey: (count ?? 0) > 0,
            });
          } else if (a.type === "video_link") {
            activities.push({
              id: a.id,
              position: a.position,
              type: "video_link",
              title: a.title,
              transcriptAvailable:
                typeof a.content_json?.["transcript"] === "string" &&
                (a.content_json["transcript"] as string).length > 0,
            });
          } else if (
            a.type === "article" ||
            a.type === "resource" ||
            a.type === "reflection" ||
            a.type === "assignment_upload" ||
            a.type === "roblox_challenge"
          ) {
            activities.push({ id: a.id, position: a.position, type: a.type, title: a.title });
          }
        }
        lessons.push({
          id: le.id,
          position: le.position,
          title: le.title,
          objective: le.objective,
          activities,
        });
      }
    }
    levels.push({ id: lv.id, position: lv.position, title: lv.title, objective: lv.objective, lessons });
  }

  // Prereq dibaca dari tabel prerequisites (RLS: guru aktif / enrollment aktif).
  const { data: prereqRows } = await supabase.from("prerequisites").select("target_id,required_id");
  const prereqMap = new Map<string, string[]>();
  for (const p of (prereqRows as { target_id: string; required_id: string }[] | null) ?? []) {
    const arr = prereqMap.get(p.target_id) ?? [];
    arr.push(p.required_id);
    prereqMap.set(p.target_id, arr);
  }
  const prereqs: DraftPrereq[] = [...prereqMap.entries()].map(([targetId, requiredIds]) => ({
    targetId,
    requiredIds,
  }));

  const issues = validateCourseDraft(levels, prereqs);
  if (issues.length > 0) return { ok: false as const, error: "VALIDATION_FAILED", issues };

  const { error } = await supabase
    .from("course_versions")
    .update({ published_at: new Date().toISOString() })
    .eq("id", versionRow.id);
  if (error) return { ok: false as const, error: "PUBLISH_FAILED" };
  await supabase.from("courses").update({ status: "published" }).eq("id", parsed.data.courseId);
  return { ok: true as const, version: versionRow.version };
}

// ---------- Assessment: start attempt (idempotent + limit + cooldown) ----------
export async function startAttempt(input: unknown) {
  const parsed = startAttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  if (!checkRateLimit(`start:${parsed.data.enrollmentId}`, 10, 60_000))
    return { ok: false as const, error: "RATE_LIMITED" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Idempotency dulu: kunci sama → kembalikan attempt yang sama.
  const { data: existing } = await supabase
    .from("attempts")
    .select("id")
    .eq("idempotency_key", parsed.data.idempotencyKey)
    .limit(1)
    .single();
  if (existing) return { ok: true as const, attemptId: (existing as { id: string }).id };

  // Attempt limit + cooldown dari settings (server-side, bukan client).
  const { data: asmt } = await supabase
    .from("assessments")
    .select("id,settings_json")
    .eq("id", parsed.data.assessmentId)
    .single();
  const settings = ((asmt as { settings_json: Record<string, unknown> } | null)?.settings_json ?? {}) as {
    maxAttempts?: number;
    cooldownSeconds?: number;
  };
  const { count } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", parsed.data.assessmentId)
    .eq("enrollment_id", parsed.data.enrollmentId);
  if ((count ?? 0) >= (settings.maxAttempts ?? 3)) return { ok: false as const, error: "LIMIT_REACHED" };
  if ((settings.cooldownSeconds ?? 0) > 0) {
    const { data: last } = await supabase
      .from("attempts")
      .select("submitted_at")
      .eq("assessment_id", parsed.data.assessmentId)
      .eq("enrollment_id", parsed.data.enrollmentId)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(1);
    const lastSubmit = ((last as { submitted_at: string }[] | null) ?? [])[0]?.submitted_at;
    if (lastSubmit && Date.now() - Date.parse(lastSubmit) < (settings.cooldownSeconds ?? 0) * 1000) {
      return { ok: false as const, error: "COOLDOWN" };
    }
  }

  // RLS menegakkan: murid hanya enrollment miliknya; append-only attempts.
  const { data: existingNo, error: noErr } = await supabase
    .from("attempts")
    .select("attempt_no")
    .eq("assessment_id", parsed.data.assessmentId)
    .eq("enrollment_id", parsed.data.enrollmentId)
    .order("attempt_no", { ascending: false })
    .limit(1);
  if (noErr) return { ok: false as const, error: "START_FAILED" };
  const attemptNo = (((existingNo as { attempt_no: number }[] | null) ?? [])[0]?.attempt_no ?? 0) + 1;
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      assessment_id: parsed.data.assessmentId,
      enrollment_id: parsed.data.enrollmentId,
      attempt_no: attemptNo,
      status: "in_progress",
      idempotency_key: parsed.data.idempotencyKey,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "START_FAILED" };
  return { ok: true as const, attemptId: (data as { id: string }).id };
}

// ---------- Assessment: submit attempt (timer + auto-grade server, idempotent) ----------
// Skor objektif DIHITUNG ULANG server via service client; kiriman skor client diabaikan.
export async function submitAttempt(input: unknown) {
  const parsed = submitAttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  if (!checkRateLimit(`submit:${parsed.data.attemptId}`, 5, 60_000))
    return { ok: false as const, error: "RATE_LIMITED" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const studentId = (claims.claims as { sub?: string }).sub;
  if (!studentId) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id,assessment_id,enrollment_id,status,started_at")
    .eq("id", parsed.data.attemptId)
    .single();
  const att = attempt as {
    id: string;
    assessment_id: string;
    enrollment_id: string;
    status: string;
    started_at: string;
  } | null;
  if (!att) return { ok: false as const, error: "NOT_FOUND" };
  if (att.status !== "in_progress") return { ok: true as const }; // submit ganda = idempotent

  const { data: asmt } = await supabase
    .from("assessments")
    .select("id,settings_json")
    .eq("id", att.assessment_id)
    .single();
  const settings = ((asmt as { settings_json: Record<string, unknown> } | null)?.settings_json ?? {}) as {
    durationSeconds?: number;
  };
  if (
    (settings.durationSeconds ?? 0) > 0 &&
    Date.now() - Date.parse(att.started_at) > (settings.durationSeconds ?? 0) * 1000
  ) {
    return { ok: false as const, error: "TIME_EXPIRED" };
  }

  // Auto-grade objektif via trusted server (service bypass RLS tulis murid).
  const svc = createServiceClient();
  const { data: links } = await svc
    .from("assessment_questions")
    .select("question_version_id,points")
    .eq("assessment_id", att.assessment_id);
  const scores: number[] = [];
  const points: number[] = [];
  for (const link of (links as { question_version_id: string; points: number }[] | null) ?? []) {
    const { data: qv } = await svc
      .from("question_versions")
      .select("grading_json,points")
      .eq("id", link.question_version_id)
      .single();
    const q = qv as { grading_json: { type: string; [k: string]: unknown }; points: number } | null;
    if (!q) continue;
    const { data: resp } = await svc
      .from("responses")
      .select("id,answer_json")
      .eq("attempt_id", att.id)
      .eq("question_version_id", link.question_version_id)
      .limit(1)
      .single();
    const r = resp as { id: string; answer_json: unknown } | null;
    const rule = {
      ...(q.grading_json as Record<string, unknown>),
      points: Number(link.points),
    } as Parameters<typeof autoGrade>[0];
    const auto = autoGrade(rule, r?.answer_json);
    scores.push(auto);
    points.push(Number(link.points));
    if (r) await svc.from("responses").update({ auto_score: auto }).eq("id", r.id);
  }
  const percent = assessmentPercent(scores, points);
  await svc.from("attempts").update({ raw_score: percent, final_score: percent }).eq("id", att.id);

  const { error } = await supabase.rpc("finalize_attempt", {
    p_attempt_id: parsed.data.attemptId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { ok: false as const, error: "SUBMIT_FAILED" };
  return { ok: true as const };
}

// ---------- Learning event (idempotent via client_event_id) ----------
export async function recordLearningEvent(input: unknown) {
  const parsed = recordLearningEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const studentId = (claims.claims as { sub?: string }).sub;
  if (!studentId) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.from("learning_events").upsert(
    {
      enrollment_id: parsed.data.enrollmentId,
      student_id: studentId,
      event_type: parsed.data.eventType,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      client_event_id: parsed.data.clientEventId,
      metadata_json: parsed.data.metadata,
    },
    { onConflict: "student_id,client_event_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false as const, error: "EVENT_FAILED" };
  return { ok: true as const };
}

// ---------- Enrollment (guru, cohort sendiri — ditegakkan RLS) ----------
export async function enrollStudent(input: unknown) {
  const parsed = enrollStudentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.from("enrollments").insert({
    course_id: parsed.data.courseId,
    student_id: parsed.data.studentId,
    cohort_id: parsed.data.cohortId,
    status: "active",
  });
  if (error) return { ok: false as const, error: "ENROLL_FAILED" };
  return { ok: true as const };
}

// ---------- Manual grade → revision append-only ----------
export async function gradeResponse(input: unknown) {
  const parsed = gradeResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.rpc("grade_response_manual", {
    p_response_id: parsed.data.responseId,
    p_manual_score: parsed.data.manualScore,
    p_feedback: parsed.data.feedback,
  });
  if (error) return { ok: false as const, error: "GRADE_FAILED" };
  return { ok: true as const };
}

// ---------- Certificates ----------
export async function issueCertificate(input: unknown) {
  const parsed = issueCertificateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.rpc("issue_certificate", {
    p_enrollment_id: parsed.data.enrollmentId,
    p_level_id: parsed.data.levelId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { ok: false as const, error: "ISSUE_FAILED" };
  return { ok: true as const };
}

export async function revokeCertificate(input: unknown) {
  const parsed = revokeCertificateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.rpc("revoke_certificate", {
    p_certificate_id: parsed.data.certificateId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false as const, error: "REVOKE_FAILED" };
  return { ok: true as const };
}

// ---------- Auth: logout (refresh session berhenti, cookie dibersihkan) ----------
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true as const };
}

const REORDER_PAIRS = {
  levels: "course_version_id",
  modules: "level_id",
  lessons: "module_id",
  activities: "lesson_id",
} as const;

// ---------- Authoring: reorder siblings (posisi rapat 0..n) ----------
export async function reorderSiblings(input: unknown) {
  const parsed = reorderSiblingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const { table, parentColumn, parentId } = parsed.data;
  if (REORDER_PAIRS[table] !== parentColumn) return { ok: false as const, error: "INVALID_INPUT" };
  let order: { id: string; position: number }[];
  try {
    order = normalizeOrder(parsed.data.orderedIds);
  } catch {
    return { ok: false as const, error: "INVALID_INPUT" };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Pastikan himpunan id persis sama (tidak ada baris dibuang/disusupkan).
  const { data: current } = await supabase.from(table).select("id").eq(parentColumn, parentId);
  const currentIds = new Set(((current as { id: string }[] | null) ?? []).map((r) => r.id));
  if (currentIds.size !== order.length || order.some((o) => !currentIds.has(o.id))) {
    return { ok: false as const, error: "MISMATCH" };
  }
  // Dua fase (offset +10000) agar tidak melanggar unique (parent, position).
  // Otorisasi ownership ditegakkan policy UPDATE (USING + WITH CHECK).
  for (const o of order) {
    const { error } = await supabase
      .from(table)
      .update({ position: o.position + 10000 })
      .eq("id", o.id);
    if (error) return { ok: false as const, error: "REORDER_FAILED" };
  }
  for (const o of order) {
    const { error } = await supabase.from(table).update({ position: o.position }).eq("id", o.id);
    if (error) return { ok: false as const, error: "REORDER_FAILED" };
  }
  return { ok: true as const };
}

// ---------- Authoring: archive (bukan hard delete) ----------
export async function archiveCourse(input: unknown) {
  const parsed = archiveCourseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data, error } = await supabase
    .from("courses")
    .update({ status: "archived" })
    .eq("id", parsed.data.courseId)
    .select("id");
  if (error || ((data as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  }
  return { ok: true as const };
}

// ---------- Authoring: duplicate (deep copy versi terbaru → draft baru) ----------
// Published version yang sudah dipakai attempt TIDAK disalin attempt/enrollment-nya;
// hasil duplikat selalu status draft versi 1 (ADR-003).
export async function duplicateCourse(input: unknown) {
  const parsed = duplicateCourseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const ownerId = (claims.claims as { sub?: string }).sub;
  if (!ownerId) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: src } = await supabase
    .from("courses")
    .select("id,organization_id,title,description")
    .eq("id", parsed.data.courseId)
    .single();
  const srcCourse = src as { id: string; organization_id: string; title: string; description: string } | null;
  if (!srcCourse) return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };

  const { data: srcVersions } = await supabase
    .from("course_versions")
    .select("id")
    .eq("course_id", srcCourse.id)
    .order("version", { ascending: false })
    .limit(1);
  const srcVersion = ((srcVersions as { id: string }[] | null) ?? [])[0];
  if (!srcVersion) return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };

  const { data: dstCourse, error: cErr } = await supabase
    .from("courses")
    .insert({
      organization_id: srcCourse.organization_id,
      owner_id: ownerId,
      slug: parsed.data.slug,
      title: `${srcCourse.title} (salinan)`,
      description: srcCourse.description,
      status: "draft",
    })
    .select("id")
    .single();
  if (cErr) return { ok: false as const, error: "DUPLICATE_FAILED" };
  const dstCourseId = (dstCourse as { id: string }).id;

  const { data: dstVersion, error: vErr } = await supabase
    .from("course_versions")
    .insert({ course_id: dstCourseId, version: 1 })
    .select("id")
    .single();
  if (vErr) return { ok: false as const, error: "DUPLICATE_FAILED" };
  const dstVersionId = (dstVersion as { id: string }).id;

  // Salin tree level→…→activity + assessment (+assessment_questions menaut bank soal yang sama).
  const idMap = new Map<string, string>();
  const remap = (oldId: string): string => {
    let n = idMap.get(oldId);
    if (!n) {
      n = randomUUID();
      idMap.set(oldId, n);
    }
    return n;
  };

  const { data: levels } = await supabase
    .from("levels")
    .select("id,position,title,passing_score,mastery_threshold")
    .eq("course_version_id", srcVersion.id)
    .order("position");
  for (const lv of (levels as
    | { id: string; position: number; title: string; passing_score: number; mastery_threshold: number }[]
    | null) ?? []) {
    const newLevelId = remap(lv.id);
    const { error } = await supabase.from("levels").insert({
      id: newLevelId,
      course_version_id: dstVersionId,
      position: lv.position,
      title: lv.title,
      passing_score: lv.passing_score,
      mastery_threshold: lv.mastery_threshold,
    });
    if (error) return { ok: false as const, error: "DUPLICATE_FAILED" };

    const { data: modules } = await supabase
      .from("modules")
      .select("id,position,title")
      .eq("level_id", lv.id)
      .order("position");
    for (const md of (modules as { id: string; position: number; title: string }[] | null) ?? []) {
      const newModuleId = remap(md.id);
      const { error: mErr } = await supabase
        .from("modules")
        .insert({ id: newModuleId, level_id: newLevelId, position: md.position, title: md.title });
      if (mErr) return { ok: false as const, error: "DUPLICATE_FAILED" };

      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,position,title,estimated_minutes,required")
        .eq("module_id", md.id)
        .order("position");
      for (const le of (lessons as
        | { id: string; position: number; title: string; estimated_minutes: number; required: boolean }[]
        | null) ?? []) {
        const newLessonId = remap(le.id);
        const { error: lErr } = await supabase.from("lessons").insert({
          id: newLessonId,
          module_id: newModuleId,
          position: le.position,
          title: le.title,
          estimated_minutes: le.estimated_minutes,
          required: le.required,
        });
        if (lErr) return { ok: false as const, error: "DUPLICATE_FAILED" };

        const { data: acts } = await supabase
          .from("activities")
          .select("id,position,type,title,content_json,required")
          .eq("lesson_id", le.id)
          .order("position");
        for (const a of (acts as
          | {
              id: string;
              position: number;
              type: string;
              title: string;
              content_json: unknown;
              required: boolean;
            }[]
          | null) ?? []) {
          const newActId = remap(a.id);
          const { error: aErr } = await supabase.from("activities").insert({
            id: newActId,
            lesson_id: newLessonId,
            position: a.position,
            type: a.type,
            title: a.title,
            content_json: a.content_json,
            required: a.required,
          });
          if (aErr) return { ok: false as const, error: "DUPLICATE_FAILED" };

          const { data: asmt } = await supabase
            .from("assessments")
            .select("id,settings_json,total_points")
            .eq("activity_id", a.id)
            .limit(1)
            .single();
          const srcAsmt = asmt as { id: string; settings_json: unknown; total_points: number } | null;
          if (srcAsmt) {
            const newAsmtId = randomUUID();
            const { error: sErr } = await supabase.from("assessments").insert({
              id: newAsmtId,
              activity_id: newActId,
              settings_json: srcAsmt.settings_json,
              total_points: srcAsmt.total_points,
            });
            if (sErr) return { ok: false as const, error: "DUPLICATE_FAILED" };
            const { data: links } = await supabase
              .from("assessment_questions")
              .select("question_version_id,position,points")
              .eq("assessment_id", srcAsmt.id);
            for (const link of (links as
              { question_version_id: string; position: number; points: number }[] | null) ?? []) {
              const { error: qErr } = await supabase.from("assessment_questions").insert({
                assessment_id: newAsmtId,
                question_version_id: link.question_version_id,
                position: link.position,
                points: link.points,
              });
              if (qErr) return { ok: false as const, error: "DUPLICATE_FAILED" };
            }
          }
        }
      }
    }
  }

  // Salin prerequisite edges internal (kedua ujung ada di tree salinan).
  const { data: prereqs } = await supabase
    .from("prerequisites")
    .select("target_type,target_id,required_type,required_id,rule_json");
  for (const p of (prereqs as
    | {
        target_type: string;
        target_id: string;
        required_type: string;
        required_id: string;
        rule_json: unknown;
      }[]
    | null) ?? []) {
    const t = idMap.get(p.target_id);
    const r = idMap.get(p.required_id);
    if (t && r) {
      await supabase.from("prerequisites").insert({
        target_type: p.target_type,
        target_id: t,
        required_type: p.required_type,
        required_id: r,
        rule_json: p.rule_json,
      });
    }
  }

  return { ok: true as const, courseId: dstCourseId };
}

// ---------- Authoring: tambah level/module/lesson/activity ----------
// Otorisasi ownership ditegakkan RLS INSERT (WITH CHECK join ke courses.owner_id).
// Position = max+1 dalam parent (append; rapikan via reorderSiblings).
async function nextPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  parentColumn: string,
  parentId: string,
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq(parentColumn, parentId)
    .order("position", { ascending: false })
    .limit(1);
  const rows = (data as { position: number }[] | null) ?? [];
  return (rows[0]?.position ?? -1) + 1;
}

async function requireAuth(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  return Boolean((claims?.claims as { sub?: string } | undefined)?.sub);
}

export async function createLevel(input: unknown) {
  const parsed = createLevelSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const position = await nextPosition(supabase, "levels", "course_version_id", parsed.data.courseVersionId);
  const { data, error } = await supabase
    .from("levels")
    .insert({
      course_version_id: parsed.data.courseVersionId,
      position,
      title: parsed.data.title,
      objective: parsed.data.objective,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, levelId: (data as { id: string }).id };
}

export async function createModule(input: unknown) {
  const parsed = createModuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const position = await nextPosition(supabase, "modules", "level_id", parsed.data.levelId);
  const { data, error } = await supabase
    .from("modules")
    .insert({ level_id: parsed.data.levelId, position, title: parsed.data.title })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, moduleId: (data as { id: string }).id };
}

export async function createLesson(input: unknown) {
  const parsed = createLessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const position = await nextPosition(supabase, "lessons", "module_id", parsed.data.moduleId);
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      module_id: parsed.data.moduleId,
      position,
      title: parsed.data.title,
      objective: parsed.data.objective,
      estimated_minutes: parsed.data.estimatedMinutes,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, lessonId: (data as { id: string }).id };
}

export async function createActivity(input: unknown) {
  const parsed = createActivitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  // Sanitasi konten: hanya block ter-allowlist (CONTENT_AUTHORING.md); tolak HTML arbitrer.
  const content = parsed.data.content;
  if (typeof content["html"] === "string" && content["html"].length > 0) {
    return { ok: false as const, error: "HTML_NOT_ALLOWED" };
  }
  const position = await nextPosition(supabase, "activities", "lesson_id", parsed.data.lessonId);
  const { data, error } = await supabase
    .from("activities")
    .insert({
      lesson_id: parsed.data.lessonId,
      position,
      type: parsed.data.type,
      title: parsed.data.title,
      content_json: content,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, activityId: (data as { id: string }).id };
}

// ---------- Learning: recompute progress (derived, idempotent, aman diulang) ----------
// Lesson selesai bila seluruh activity WAJIB punya event activity_completed.
// Level selesai bila seluruh lesson WAJIB selesai. Menulis progress_snapshots via upsert.
export async function recomputeProgress(input: unknown) {
  const parsed = recomputeProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id,course_id")
    .eq("id", parsed.data.enrollmentId)
    .single();
  const enr = enrollment as { id: string; course_id: string } | null;
  if (!enr) return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };

  const { data: versions } = await supabase
    .from("course_versions")
    .select("id")
    .eq("course_id", enr.course_id)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((versions as { id: string }[] | null) ?? [])[0];
  if (!version) return { ok: false as const, error: "NOT_PUBLISHED" };

  const { data: events } = await supabase
    .from("learning_events")
    .select("entity_id,event_type")
    .eq("enrollment_id", enr.id);
  const completedActivities = new Set(
    ((events as { entity_id: string; event_type: string }[] | null) ?? [])
      .filter((e) => e.event_type === "activity_completed")
      .map((e) => e.entity_id),
  );

  let lessonsDone = 0;
  let lessonsTotal = 0;
  const levelResults: { id: string; done: boolean }[] = [];

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id")
    .eq("course_version_id", version.id)
    .order("position");
  for (const lv of (levelRows as { id: string }[] | null) ?? []) {
    const { data: moduleRows } = await supabase.from("modules").select("id").eq("level_id", lv.id);
    let levelDone = true;
    for (const md of (moduleRows as { id: string }[] | null) ?? []) {
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("id,required")
        .eq("module_id", md.id);
      for (const le of (lessonRows as { id: string; required: boolean }[] | null) ?? []) {
        if (!le.required) continue;
        lessonsTotal += 1;
        const { data: actRows } = await supabase
          .from("activities")
          .select("id,required")
          .eq("lesson_id", le.id);
        const required = ((actRows as { id: string; required: boolean }[] | null) ?? []).filter(
          (a) => a.required,
        );
        const done = required.length > 0 && required.every((a) => completedActivities.has(a.id));
        if (done) lessonsDone += 1;
        else levelDone = false;
        await supabase.from("progress_snapshots").upsert(
          {
            enrollment_id: enr.id,
            entity_type: "lesson",
            entity_id: le.id,
            status: done ? "completed" : "in_progress",
            percent: done ? 100 : 0,
            mastery: 0,
            last_activity_at: new Date().toISOString(),
          },
          { onConflict: "enrollment_id,entity_type,entity_id" },
        );
      }
    }
    levelResults.push({ id: lv.id, done: levelDone });
    await supabase.from("progress_snapshots").upsert(
      {
        enrollment_id: enr.id,
        entity_type: "level",
        entity_id: lv.id,
        status: levelDone ? "completed" : "in_progress",
        percent: levelDone ? 100 : 0,
        mastery: 0,
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,entity_type,entity_id" },
    );
  }

  return { ok: true as const, lessonsDone, lessonsTotal, levels: levelResults };
}

// ---------- Question bank (guru org; versioned; answer key tak pernah ke murid) ----------
export async function createQuestion(input: unknown) {
  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  const org = mem as { organization_id: string } | null;
  if (!org) return { ok: false as const, error: "FORBIDDEN" };
  const { data, error } = await supabase
    .from("questions")
    .insert({
      organization_id: org.organization_id,
      type: parsed.data.type,
      prompt_json: { text: parsed.data.promptText },
      difficulty: parsed.data.difficulty,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, questionId: (data as { id: string }).id };
}

export async function publishQuestionVersion(input: unknown) {
  const parsed = publishQuestionVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: vers } = await supabase
    .from("question_versions")
    .select("version")
    .eq("question_id", parsed.data.questionId)
    .order("version", { ascending: false })
    .limit(1);
  const version = (((vers as { version: number }[] | null) ?? [])[0]?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("question_versions")
    .insert({
      question_id: parsed.data.questionId,
      version,
      grading_json: parsed.data.grading,
      points: parsed.data.points,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, questionVersionId: (data as { id: string }).id };
}

export async function createAssessment(input: unknown) {
  const parsed = createAssessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      activity_id: parsed.data.activityId,
      settings_json: {
        maxAttempts: parsed.data.maxAttempts,
        cooldownSeconds: parsed.data.cooldownSeconds,
        durationSeconds: parsed.data.durationSeconds,
        release: parsed.data.release,
      },
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, assessmentId: (data as { id: string }).id };
}

export async function addQuestionToAssessment(input: unknown) {
  const parsed = addQuestionToAssessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: links } = await supabase
    .from("assessment_questions")
    .select("position")
    .eq("assessment_id", parsed.data.assessmentId)
    .order("position", { ascending: false })
    .limit(1);
  const position = (((links as { position: number }[] | null) ?? [])[0]?.position ?? -1) + 1;
  const { error } = await supabase.from("assessment_questions").insert({
    assessment_id: parsed.data.assessmentId,
    question_version_id: parsed.data.questionVersionId,
    position,
    points: parsed.data.points,
  });
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, position };
}

// ---------- Attempt: simpan jawaban draft (autosave; hanya in_progress miliknya) ----------
export async function saveResponse(input: unknown) {
  const parsed = saveResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase
    .from("responses")
    .upsert(
      {
        attempt_id: parsed.data.attemptId,
        question_version_id: parsed.data.questionVersionId,
        answer_json: parsed.data.answer,
      },
      { onConflict: "attempt_id,question_version_id" },
    );
  if (error) return { ok: false as const, error: "SAVE_FAILED" };
  return { ok: true as const };
}

// ---------- Attempt: soal tersanitasi untuk browser (tanpa grading/explanation) ----------
export async function getAttemptQuestions(attemptId: string) {
  if (!uuidSchema.safeParse(attemptId).success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id,assessment_id,status")
    .eq("id", attemptId)
    .single();
  const att = attempt as { id: string; assessment_id: string; status: string } | null;
  if (!att) return { ok: false as const, error: "NOT_FOUND" };
  // RLS responses/attempts menegakkan kepemilikan; grading_json TIDAK PERNAH di-select di sini.
  const { data: links } = await supabase
    .from("assessment_questions")
    .select("question_version_id,position,points")
    .eq("assessment_id", att.assessment_id)
    .order("position");
  const out: (SanitizedQuestion & { savedAnswer: unknown })[] = [];
  for (const link of (links as { question_version_id: string; position: number; points: number }[] | null) ??
    []) {
    const { data: qv } = await supabase
      .from("question_versions")
      .select("id,question_id")
      .eq("id", link.question_version_id)
      .single();
    const q = qv as { id: string; question_id: string } | null;
    if (!q) continue;
    const { data: base } = await supabase
      .from("questions")
      .select("type,prompt_json")
      .eq("id", q.question_id)
      .single();
    const b = base as { type: string; prompt_json: { text?: string; options?: string[] } } | null;
    if (!b) continue;
    const { data: resp } = await supabase
      .from("responses")
      .select("answer_json")
      .eq("attempt_id", att.id)
      .eq("question_version_id", link.question_version_id)
      .limit(1)
      .single();
    out.push({
      ...sanitizeQuestionForAttempt({
        questionVersionId: link.question_version_id,
        position: link.position,
        points: Number(link.points),
        type: b.type as SanitizedQuestion["type"],
        promptJson: b.prompt_json,
      }),
      savedAnswer: (resp as { answer_json: unknown } | null)?.answer_json ?? null,
    });
  }
  return { ok: true as const, status: att.status, questions: out };
}

// ---------- Teacher: release nilai (submitted → finalized) ----------
export async function releaseGrades(input: unknown) {
  const parsed = releaseGradesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  // RLS UPDATE attempts (guru cohort) menegakkan otorisasi per baris.
  const { error } = await supabase
    .from("attempts")
    .update({ status: "finalized" })
    .eq("assessment_id", parsed.data.assessmentId)
    .eq("status", "submitted");
  if (error) return { ok: false as const, error: "RELEASE_FAILED" };
  return { ok: true as const };
}

// ---------- Attempt: hasil untuk murid (gate release policy) ----------
export async function getAttemptResult(attemptId: string) {
  if (!uuidSchema.safeParse(attemptId).success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id,assessment_id,status,final_score")
    .eq("id", attemptId)
    .single();
  const att = attempt as {
    id: string;
    assessment_id: string;
    status: string;
    final_score: number | null;
  } | null;
  if (!att) return { ok: false as const, error: "NOT_FOUND" };
  const { data: asmt } = await supabase
    .from("assessments")
    .select("settings_json")
    .eq("id", att.assessment_id)
    .single();
  const release = String(
    ((asmt as { settings_json: Record<string, unknown> } | null)?.settings_json ?? {}).release ?? "immediate",
  );
  if (!canShowScore(release, att.status))
    return { ok: true as const, visible: false as const, status: att.status };
  const { data: responses } = await supabase
    .from("responses")
    .select("question_version_id,auto_score,manual_score,feedback_json")
    .eq("attempt_id", att.id);
  return {
    ok: true as const,
    visible: true as const,
    status: att.status,
    finalScore: att.final_score,
    items: (
      (responses as
        | {
            question_version_id: string;
            auto_score: number | null;
            manual_score: number | null;
            feedback_json: unknown;
          }[]
        | null) ?? []
    ).map((r) => ({ ...r })),
  };
}
