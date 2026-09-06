"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  archiveCourseSchema,
  createCourseSchema,
  duplicateCourseSchema,
  enrollStudentSchema,
  gradeResponseSchema,
  issueCertificateSchema,
  recordLearningEventSchema,
  reorderSiblingsSchema,
  revokeCertificateSchema,
  startAttemptSchema,
  submitAttemptSchema,
  publishVersionSchema,
} from "@/lib/validation";
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
    .select("id,position,title")
    .eq("course_version_id", versionRow.id)
    .order("position");
  const levels: DraftLevel[] = [];
  for (const lv of (levelRows as { id: string; position: number; title: string }[] | null) ?? []) {
    const { data: moduleRows } = await supabase.from("modules").select("id").eq("level_id", lv.id);
    const lessons: DraftLevel["lessons"] = [];
    for (const md of (moduleRows as { id: string }[] | null) ?? []) {
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("id,position,title")
        .eq("module_id", md.id)
        .order("position");
      for (const le of (lessonRows as { id: string; position: number; title: string }[] | null) ?? []) {
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
        lessons.push({ id: le.id, position: le.position, title: le.title, objective: "", activities });
      }
    }
    levels.push({ id: lv.id, position: lv.position, title: lv.title, objective: "", lessons });
  }

  // Objective & prereq diambil dari content_json level/lesson bila ada (fallback "" = ditolak validator).
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

// ---------- Assessment: start attempt (idempotent) ----------
export async function startAttempt(input: unknown) {
  const parsed = startAttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  if (!checkRateLimit(`start:${parsed.data.enrollmentId}`, 10, 60_000))
    return { ok: false as const, error: "RATE_LIMITED" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  // RLS menegakkan: murid hanya enrollment miliknya; append-only attempts; unique idempotency.
  const { data, error } = await supabase
    .from("attempts")
    .upsert(
      {
        assessment_id: parsed.data.assessmentId,
        enrollment_id: parsed.data.enrollmentId,
        status: "in_progress",
        idempotency_key: parsed.data.idempotencyKey,
        started_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "START_FAILED" };
  return { ok: true as const, attemptId: (data as { id: string }).id };
}

// ---------- Assessment: submit attempt (idempotent, server finalizes) ----------
export async function submitAttempt(input: unknown) {
  const parsed = submitAttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  if (!checkRateLimit(`submit:${parsed.data.attemptId}`, 5, 60_000))
    return { ok: false as const, error: "RATE_LIMITED" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  // Finalisasi SESUNGGUHNYA dikerjakan Edge/DB function finalize_attempt (migration).
  // Action ini hanya memanggil RPC agar scoring tidak pernah dari client.
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
