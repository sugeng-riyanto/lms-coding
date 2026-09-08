"use server";

import { randomUUID } from "node:crypto";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";
// Jalur WRITE: strict — env hilang → throw (tidak pernah sukses diam-diam di demo mode).
import { createStrictClient as createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { createAiProvider, extractAnswerText, type AiDraftRequest } from "@/lib/ai-feedback";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgAdminContext } from "@/lib/org-admin";
import { assessmentPercent, autoGrade } from "@/lib/grading";
import {
  clampGoalForUnit,
  firstReviewInsertRows,
  isoWeekStart,
  nextReviewAfter,
  startOfNextDayInTz,
} from "@/lib/progress-planning";
import { validateDraftMetadata, validateHeartbeatMetadata } from "@/lib/active-time";
import {
  addQuestionToAssessmentSchema,
  alertIdSchema,
  archiveCourseSchema,
  createRubricSchema,
  finalizeResponseGradesSchema,
  saveCriterionGradeSchema,
  updateRubricSchema,
  createActivitySchema,
  createAssessmentSchema,
  bulkImportQuestionPackSchema,
  createCohortSchema,
  createCourseSchema,
  createLessonSchema,
  createLevelSchema,
  createModuleSchema,
  createQuestionSchema,
  deleteContentSchema,
  duplicateCourseSchema,
  enrollStudentSchema,
  gradeResponseSchema,
  requestAiDraftSchema,
  aiDraftIdSchema,
  issueCertificateSchema,
  publishQuestionVersionSchema,
  recordLearningEventSchema,
  recomputeProgressSchema,
  releaseGradesSchema,
  reissueCertificateSchema,
  reorderSiblingsSchema,
  submitReviewSchema,
  resolveAlertSchema,
  revokeCertificateSchema,
  saveResponseSchema,
  setWeeklyGoalSchema,
  suspendEnrollmentSchema,
  updateContentSchema,
  updateProfileSchema,
  startAttemptSchema,
  submitAttemptSchema,
  publishVersionSchema,
  uuidSchema,
  saveStudentMappingSchema,
  assignTeacherToClassSchema,
  setLanguageSchema,
} from "@/lib/validation";
import { sanitizeQuestionForAttempt, canShowScore, type SanitizedQuestion } from "@/lib/attempt";
import { sanitizeContentBlocks } from "@/lib/content-blocks";
import { parseMarkdownToBlocks } from "@/lib/markdown-blocks";
import { mapChoiceKey, parseQuestionPack } from "@/lib/question-pack";
import { pickPool, randomSeedHex } from "@/lib/shuffle";
import { checkEligibility } from "@/lib/eligibility";
import { normalizeOrder } from "@/lib/reorder";
import { validateCourseDraft, type DraftLevel, type DraftPrereq } from "@/lib/publish-validation";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  MAX_ASSIGNMENT_ROWS,
  MAX_CONTENT_ROWS,
  MAX_STUDENT_ROWS,
  MAX_TEACHER_ROWS,
  groupContentRows,
  parseContentRows,
  parseStudentAssignmentRows,
  parseStudentRows,
  parseTeacherRows,
  rowsOverCap,
  xlsxFileError,
  type BulkActivityType,
} from "@/lib/bulk-import";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { ANCHOR_BATCH_LIMIT, isAnchorEligible, runAnchorBatch, type AnchorCandidate } from "@/lib/anchor-job";
import { getChainAdapter, isChainEnabled, NoopChainAdapter } from "@/lib/chain";

// ---------- Preferences: UI language (per-user, all RBAC) ----------
export async function setLanguage(input: unknown) {
  const parsed = setLanguageSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const lang = parsed.data.lang;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.from("profiles").update({ language: lang }).eq("id", user.id);
  if (error) return { ok: false as const, error: "UPDATE_FAILED" };
  // Mirror the preference into a cookie so client-only shells (login, error
  // boundaries, drawers) render in the same language.
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  return { ok: true as const, lang: lang as Lang };
}

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
            a.type === "roblox_challenge" ||
            // LMS coding: konten kode & media ter-embed (tanpa gate tambahan).
            a.type === "code_board" ||
            a.type === "embed_youtube" ||
            a.type === "embed_pdf" ||
            a.type === "embed_audio" ||
            a.type === "embed_file"
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
    randomize?: boolean;
    poolSize?: number;
  };

  // Randomisasi server-authoritative: seed kriptografis dibuat SERVER, pool +
  // urutan dihitung deterministik (lib/shuffle), disimpan di attempt agar
  // grading memakai subset yang sama dan dapat direproduksi. Client tidak
  // pernah memilih seed/urutan (kunci jawaban juga tak ikut di sini).
  let questionOrderJson: { seed: string; order: string[] } | null = null;
  if (settings.randomize) {
    const { data: links } = await supabase
      .from("assessment_questions")
      .select("question_version_id")
      .eq("assessment_id", parsed.data.assessmentId)
      .order("position", { ascending: true });
    const ids = ((links as { question_version_id: string }[] | null) ?? []).map((l) => l.question_version_id);
    if (ids.length > 0) {
      const seed = randomSeedHex();
      questionOrderJson = { seed, order: pickPool(ids, settings.poolSize ?? ids.length, seed) };
    }
  }
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
      question_order_json: questionOrderJson,
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
    .select("id,assessment_id,enrollment_id,status,started_at,question_order_json")
    .eq("id", parsed.data.attemptId)
    .single();
  const att = attempt as {
    id: string;
    assessment_id: string;
    enrollment_id: string;
    status: string;
    started_at: string;
    question_order_json: { seed: string; order: string[] } | null;
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
  const { data: linksRaw } = await svc
    .from("assessment_questions")
    .select("question_version_id,points")
    .eq("assessment_id", att.assessment_id);
  let links = (linksRaw as { question_version_id: string; points: number }[] | null) ?? [];
  // Randomisasi: hanya subset/urutan yang di-roll SERVER saat startAttempt yang
  // dinilai — soal di luar pool attempt ini tidak ikut (dan tidak bisa
  // disisipkan client lewat response palsu).
  const ordered = att.question_order_json?.order;
  if (ordered && ordered.length > 0) {
    const byId = new Map(links.map((l) => [l.question_version_id, l]));
    links = ordered
      .map((id) => byId.get(id))
      .filter((l): l is { question_version_id: string; points: number } => !!l);
  }
  const scores: number[] = [];
  const points: number[] = [];
  for (const link of links) {
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

  // Kuis yang disubmit menandai activity assessmen-nya selesai → hook
  // recordLearningEvent memicu recomputeProgress (snapshots terisi).
  // client_event_id deterministik per attempt = idempoten (resubmit no-op di
  // atas tidak sampai sini; retry submit sukses mengabaikan duplikat event).
  // Best-effort: nilai sudah tersimpan + attempt submitted; progres menyusul.
  const { data: asmtRow } = await supabase
    .from("assessments")
    .select("activity_id")
    .eq("id", att.assessment_id)
    .single();
  const activityId = (asmtRow as { activity_id: string } | null)?.activity_id;
  if (activityId) {
    await recordLearningEvent({
      enrollmentId: att.enrollment_id,
      eventType: "activity_completed",
      entityType: "activity",
      entityId: activityId,
      clientEventId: `attempt-submitted:${parsed.data.attemptId}`,
      metadata: {},
    });
  } else {
    await recomputeProgress({ enrollmentId: att.enrollment_id });
  }
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

  // Validasi server: waktu aktif TIDAK dipercaya mentah dari client.
  // heartbeat → clamp ulang (nilai non-finite/negatif/raksasa ditolak);
  // draft_saved → hanya panjang teks yang disimpan (minimisasi data).
  let metadata = parsed.data.metadata;
  let heartbeatActiveMs: number | null = null;
  if (parsed.data.eventType === "heartbeat") {
    const v = validateHeartbeatMetadata(metadata);
    if (!v.ok) return { ok: false as const, error: "EVENT_REJECTED" };
    metadata = { ...metadata, activeMs: v.activeMs };
    heartbeatActiveMs = v.activeMs;
  } else if (parsed.data.eventType === "draft_saved") {
    const v = validateDraftMetadata(metadata);
    if (!v.ok) return { ok: false as const, error: "EVENT_REJECTED" };
    metadata = { ...metadata, chars: v.chars };
  }

  const { error } = await supabase.from("learning_events").upsert(
    {
      enrollment_id: parsed.data.enrollmentId,
      student_id: studentId,
      event_type: parsed.data.eventType,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      client_event_id: parsed.data.clientEventId,
      metadata_json: metadata,
    },
    { onConflict: "student_id,client_event_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false as const, error: "EVENT_FAILED" };

  // Write path study_sessions (ADR-010): heartbeat yang diterima (sudah
  // diverifikasi + di-clamp server) menambah active seconds ke sesi belajar
  // via jalur PRIVILEGED (service client → fungsi definer; murid TIDAK punya
  // policy tulis study_sessions). Best-effort: kegagalan agregasi tidak boleh
  // menggagalkan event (event tetap jadi ledger yang bisa dijumlah ulang).
  if (parsed.data.eventType === "heartbeat" && heartbeatActiveMs !== null) {
    const svc = createServiceClient();
    await svc.rpc("append_study_session", {
      p_enrollment_id: parsed.data.enrollmentId,
      p_active_ms: heartbeatActiveMs,
    });
  }

  // Progres turunan (idempoten, ADR-011): activity yang selesai memicu
  // recomputeProgress agar snapshots/level-map/teacher-matrix/wali terisi.
  // Best-effort seperti agregasi heartbeat: kegagalan recompute tidak boleh
  // menggagalkan event (event tetap jadi ledger yang bisa dijumlah ulang).
  if (parsed.data.eventType === "activity_completed") {
    await recomputeProgress({ enrollmentId: parsed.data.enrollmentId });
  }
  return { ok: true as const };
}

// ---------- Target mingguan: set goal (unit completions|minutes) ----------
export async function setWeeklyGoal(input: unknown) {
  const parsed = setWeeklyGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const studentId = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!studentId) return { ok: false as const, error: "UNAUTHENTICATED" };
  const goalValue = clampGoalForUnit(parsed.data.unit, parsed.data.value);
  // RLS weekly_plans_student_insert/update membatasi ke enrollment AKTIF milik
  // murid; upsert (enrollment_id, week_start) = get-or-create lazy per minggu.
  const { data: rows, error } = await supabase
    .from("weekly_plans")
    .upsert(
      {
        enrollment_id: parsed.data.enrollmentId,
        week_start: isoWeekStart(new Date()),
        goal_unit: parsed.data.unit,
        goal_value: goalValue,
      },
      { onConflict: "enrollment_id,week_start" },
    )
    .select("id,goal_unit,goal_value");
  if (error || ((rows as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  }
  return { ok: true as const, unit: parsed.data.unit, goal: goalValue };
}

// ---------- Spaced review: confidence → reschedule (ladder 1/3/7/14 hari) ----------
export async function submitReview(input: unknown) {
  const parsed = submitReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const studentId = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!studentId) return { ok: false as const, error: "UNAUTHENTICATED" };

  // RLS memastikan baris milik enrollment AKTIF murid ini; baris asing → kosong.
  const { data: itemRows } = await supabase
    .from("review_items")
    .select("id,enrollment_id,entity_type,entity_id,due_at,interval_idx,status")
    .eq("id", parsed.data.reviewItemId)
    .eq("status", "scheduled")
    .limit(1);
  const item = ((itemRows as
    | {
        id: string;
        enrollment_id: string;
        entity_type: string;
        entity_id: string;
        due_at: string;
        interval_idx: number;
        status: string;
      }[]
    | null) ?? [])[0];
  if (!item) return { ok: false as const, error: "NOT_SCHEDULED" };
  if (item.enrollment_id !== parsed.data.enrollmentId) {
    return { ok: false as const, error: "FORBIDDEN" };
  }

  // Jatuh tempo: sudah lewat ATAU masih hari ini (batas 00:00 besok, tz org).
  const now = new Date();
  const dueLimit = startOfNextDayInTz(now);
  if (Date.parse(item.due_at) >= dueLimit.getTime()) {
    return { ok: false as const, error: "NOT_DUE" };
  }

  // Ladder: confidence ≥4 maju satu anak tangga, 3 ulang, ≤2 reset (lib murni).
  const next = nextReviewAfter({
    completedAt: now,
    confidence: parsed.data.confidence,
    intervalIdx: item.interval_idx,
  });

  const { error: updErr } = await supabase
    .from("review_items")
    .update({
      status: "completed",
      confidence: parsed.data.confidence,
      completed_at: now.toISOString(),
    })
    .eq("id", item.id);
  if (updErr) return { ok: false as const, error: "REVIEW_FAILED" };

  const { error: insErr } = await supabase.from("review_items").insert({
    enrollment_id: item.enrollment_id,
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    due_at: next.dueAt.toISOString(),
    interval_idx: next.intervalIdx,
    status: "scheduled",
  });
  if (insErr) return { ok: false as const, error: "REVIEW_FAILED" };

  return { ok: true as const, nextDueAt: next.dueAt.toISOString() };
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

// ---------- AI draft feedback (ADR-014/015/017) ----------
// Gerbang fitur: env AI_FEEDBACK_ENABLED=true + provider terkonfigurasi + org
// consent. Tanpa salah satu → tolak tanpa efek & tanpa jaringan (AC-1).
// Provider hanya dipanggil di server action; tidak ada fetch dari browser.
export async function requestAiDraft(input: unknown) {
  const parsed = requestAiDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const env = getServerEnv();
  if (!env.AI_FEEDBACK_ENABLED) return { ok: false as const, error: "AI_DISABLED" };
  const provider = createAiProvider({
    enabled: env.AI_FEEDBACK_ENABLED,
    provider: env.AI_PROVIDER,
    baseUrl: env.AI_PROVIDER_BASE_URL,
    apiKey: env.AI_PROVIDER_API_KEY,
  });
  if (!provider) return { ok: false as const, error: "AI_PROVIDER_UNCONFIGURED" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Response + rantai org (RLS guru): response → attempt → enrollment → cohort → course → org.
  const { data: resp } = await supabase
    .from("responses")
    .select("id,answer_json,question_version_id,attempts(enrollments(cohorts(courses(organization_id))))")
    .eq("id", parsed.data.responseId)
    .single();
  const orgId = (
    resp as {
      id: string;
      answer_json: unknown;
      question_version_id: string;
      attempts: {
        enrollments: { cohorts: { courses: { organization_id: string } | null } | null } | null;
      } | null;
    } | null
  )?.attempts?.enrollments?.cohorts?.courses?.organization_id;
  if (!orgId) return { ok: false as const, error: "NOT_FOUND" };

  // Consent per-org (ADR-014; default false = fail closed).
  const { data: org } = await supabase
    .from("organizations")
    .select("name,ai_feedback_consent")
    .eq("id", orgId)
    .single();
  const orgRow = org as { name: string | null; ai_feedback_consent: boolean } | null;
  if (!orgRow?.ai_feedback_consent) return { ok: false as const, error: "AI_NO_CONSENT" };

  // Soal + jawaban → prompt (data minimization; identitas murid TIDAK ikut).
  const { data: qv } = await supabase
    .from("question_versions")
    .select("question_id,questions(type,prompt_json)")
    .eq("id", (resp as { question_version_id: string }).question_version_id)
    .single();
  const q = qv as {
    question_id: string;
    questions: { type: string; prompt_json: { text?: string } | null } | null;
  } | null;
  const answerText = extractAnswerText((resp as { answer_json: unknown }).answer_json);
  const request: AiDraftRequest = {
    qtype: q?.questions?.type ?? "unknown",
    promptText: q?.questions?.prompt_json?.text ?? "",
    answerText,
    orgName: orgRow.name ?? undefined,
  };

  let result;
  try {
    result = await provider.generate(request);
  } catch {
    return { ok: false as const, error: "AI_PROVIDER_ERROR" };
  }

  const { data: draftId, error } = await supabase.rpc("upsert_ai_draft", {
    p_response_id: parsed.data.responseId,
    p_body: result.body,
    p_model: result.model,
  });
  if (error) return { ok: false as const, error: "DRAFT_FAILED" };
  return { ok: true as const, draftId: draftId as string };
}

// Approval eksplisit guru (ADR-015): apply_ai_feedback menulis feedback final
// (penanda ai_approved, merge — tidak menimpa feedback manual) + grade_revisions
// reason 'ai_draft:approved' + draft approved, satu transaksi di DB.
export async function approveAiDraft(input: unknown) {
  const parsed = aiDraftIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: draft } = await supabase
    .from("ai_feedback_drafts")
    .select("id,response_id,body,status")
    .eq("id", parsed.data.draftId)
    .single();
  const d = draft as { id: string; response_id: string; body: string; status: string } | null;
  if (!d) return { ok: false as const, error: "NOT_FOUND" };
  if (d.status === "approved") return { ok: true as const }; // idempoten
  const { error } = await supabase.rpc("apply_ai_feedback", {
    p_response_id: d.response_id,
    p_feedback: d.body,
  });
  if (error) return { ok: false as const, error: "APPROVE_FAILED" };
  return { ok: true as const };
}

// Menolak draft: jejak keputusan tetap (status rejected; tanpa hard delete).
export async function rejectAiDraft(input: unknown) {
  const parsed = aiDraftIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: draft } = await supabase
    .from("ai_feedback_drafts")
    .select("id,status")
    .eq("id", parsed.data.draftId)
    .single();
  const d = draft as { id: string; status: string } | null;
  if (!d) return { ok: false as const, error: "NOT_FOUND" };
  if (d.status === "approved") return { ok: false as const, error: "ALREADY_APPROVED" };
  if (d.status === "rejected") return { ok: true as const }; // idempoten
  const { error } = await supabase
    .from("ai_feedback_drafts")
    .update({ status: "rejected" })
    .eq("id", parsed.data.draftId);
  if (error) return { ok: false as const, error: "REJECT_FAILED" };
  return { ok: true as const };
}

// ---------- Manual assessment: rubric versioning + per-criterion grading ----------
// Rubrik dibuat guru org soal (versi 1 + criteria + diikat ke question_versions).
// Skor per-kriteria disimpan DRAFT via RPC (validasi guru-cohort + RUBRIC_MISMATCH);
// finalize hanya setelah semua kriteria final → manual_score + grade_revisions + audit.
export async function createRubricVersion(input: unknown) {
  const parsed = createRubricSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Guru pemilik org soal (lewat question_versions → questions.organization_id).
  const { data: qv } = await supabase
    .from("question_versions")
    .select("question_id")
    .eq("id", parsed.data.questionVersionId)
    .single();
  const q = qv as { question_id: string } | null;
  if (!q) return { ok: false as const, error: "NOT_FOUND" };
  const { data: question } = await supabase
    .from("questions")
    .select("organization_id")
    .eq("id", q.question_id)
    .single();
  const orgId = (question as { organization_id: string } | null)?.organization_id;
  if (!orgId) return { ok: false as const, error: "NOT_FOUND" };
  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  if (!mem) return { ok: false as const, error: "FORBIDDEN" };

  const now = new Date().toISOString();
  const { data: rubric, error: rErr } = await supabase
    .from("rubrics")
    .insert({
      organization_id: orgId,
      title: parsed.data.title,
      version: 1,
      created_by: userId,
      updated_at: now,
    })
    .select("id")
    .single();
  if (rErr || !rubric) return { ok: false as const, error: "CREATE_FAILED" };
  const rubricId = (rubric as { id: string }).id;
  const criteria = parsed.data.criteria.map((c, i) => ({
    rubric_id: rubricId,
    title: c.title,
    max_points: c.maxPoints,
    position: i,
  }));
  const { error: cErr } = await supabase.from("rubric_criteria").insert(criteria);
  if (cErr) return { ok: false as const, error: "CREATE_FAILED" };
  const { error: linkErr } = await supabase
    .from("question_versions")
    .update({ rubric_id: rubricId })
    .eq("id", parsed.data.questionVersionId);
  if (linkErr) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, rubricId };
}

export async function updateRubricVersion(input: unknown) {
  const parsed = updateRubricSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data, error } = await supabase.rpc("update_rubric_version", {
    p_rubric_id: parsed.data.rubricId,
    p_title: parsed.data.title,
    p_criteria: parsed.data.criteria.map((c) => ({ title: c.title, maxPoints: c.maxPoints })),
  });
  if (error) return { ok: false as const, error: "UPDATE_FAILED" };
  return { ok: true as const, version: (data as number | null) ?? null };
}

export async function saveCriterionGrade(input: unknown) {
  const parsed = saveCriterionGradeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.rpc("save_criterion_grade", {
    p_response_id: parsed.data.responseId,
    p_criterion_id: parsed.data.criterionId,
    p_score: parsed.data.score,
    p_feedback: parsed.data.feedback,
    p_draft: parsed.data.draft,
  });
  if (error) return { ok: false as const, error: "SAVE_FAILED" };
  return { ok: true as const };
}

export async function finalizeResponseGrades(input: unknown) {
  const parsed = finalizeResponseGradesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase.rpc("finalize_response_grades", {
    p_response_id: parsed.data.responseId,
  });
  if (error) return { ok: false as const, error: "FINALIZE_FAILED" };
  return { ok: true as const };
}

// ---------- Certificates (eligibility dievaluasi server sebelum issuance) ----------
// Evaluator eligibility level dipakai issueCertificate DAN reissueCertificate
// (ADR-013: reissue mengevaluasi ulang dengan logika yang sama, sebelum revoke).
async function evaluateLevelEligibility(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentId: string,
  levelId: string,
): Promise<
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "NOT_FOUND" }
  | { status: "OK"; eligible: boolean; reasons: string[] }
> {
  // Kumpulkan bukti: snapshots lesson + attempts summative + rule level.
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id,course_id")
    .eq("id", enrollmentId)
    .single();
  const enr = enrollment as { id: string; course_id: string } | null;
  if (!enr) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  const { data: level } = await supabase
    .from("levels")
    .select("id,passing_score,mastery_threshold")
    .eq("id", levelId)
    .single();
  const lv = level as { id: string; passing_score: number; mastery_threshold: number } | null;
  if (!lv) return { status: "NOT_FOUND" };

  const { data: snaps } = await supabase
    .from("progress_snapshots")
    .select("entity_id,status,percent,mastery")
    .eq("enrollment_id", enr.id)
    .eq("entity_type", "lesson");
  const ss =
    (snaps as { entity_id: string; status: string; percent: number; mastery: number }[] | null) ?? [];
  // Required lessons pada level ini: telusuri modules → lessons (required).
  const { data: moduleRows } = await supabase.from("modules").select("id").eq("level_id", lv.id);
  const requiredIds: string[] = [];
  for (const md of (moduleRows as { id: string }[] | null) ?? []) {
    const { data: lessonRows } = await supabase.from("lessons").select("id,required").eq("module_id", md.id);
    for (const le of (lessonRows as { id: string; required: boolean }[] | null) ?? []) {
      if (le.required) requiredIds.push(le.id);
    }
  }
  // Defect live: levelPercent/avgMastery dirata-rata atas SEMUA lesson snapshot
  // enrollment (termasuk level lain yang belum digarap) → level dengan banyak
  // level saudara di bawah passing_score meski level ini tuntas (contoh: 24
  // lesson → level tuntas terlihat 8.3/70). Koreksi: hitung hanya lesson yang
  // merupakan bagian dari level yang dievaluasi (requiredIds).
  const levelSs = ss.filter((s) => requiredIds.includes(s.entity_id));
  const completedIds = levelSs.filter((s) => s.status === "completed").map((s) => s.entity_id);
  const levelPercent =
    levelSs.length > 0 ? levelSs.reduce((a, s) => a + Number(s.percent), 0) / levelSs.length : 0;
  const avgMastery =
    levelSs.length > 0 ? levelSs.reduce((a, s) => a + Number(s.mastery), 0) / levelSs.length : 0;
  const { data: atts } = await supabase
    .from("attempts")
    .select("final_score,status")
    .eq("enrollment_id", enr.id)
    .neq("status", "in_progress");
  const passed = ((atts as { final_score: number | null; status: string }[] | null) ?? []).some(
    (a) => (a.final_score ?? 0) >= Number(lv.passing_score),
  );
  const verdict = checkEligibility({
    requiredLessonIds: requiredIds,
    completedLessonIds: completedIds,
    levelPercent,
    summativePassed: passed,
    mastery: new Map([["__level_avg__", avgMastery]]),
    rule: {
      passingScore: Number(lv.passing_score),
      masteryThreshold: Number(lv.mastery_threshold),
      criticalCompetencies: [],
      weights: { formative: 30, summative: 50, project: 20 },
    },
  });
  return { status: "OK", eligible: verdict.eligible, reasons: verdict.reasons };
}

export async function issueCertificate(input: unknown) {
  const parsed = issueCertificateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };

  const ev = await evaluateLevelEligibility(supabase, parsed.data.enrollmentId, parsed.data.levelId);
  if (ev.status === "NOT_FOUND_OR_FORBIDDEN") return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  if (ev.status === "NOT_FOUND") return { ok: false as const, error: "NOT_FOUND" };
  if (!ev.eligible) return { ok: false as const, error: "NOT_ELIGIBLE", reasons: ev.reasons };

  const { error } = await supabase.rpc("issue_certificate", {
    p_enrollment_id: parsed.data.enrollmentId,
    p_level_id: parsed.data.levelId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { ok: false as const, error: "ISSUE_FAILED" };
  return { ok: true as const };
}

// Reissue = revoke + issue baru dalam SATU transaksi (RPC reissue_certificate,
// migration 000010). Eligibility dievaluasi ulang penuh SEBELUM revoke: bila
// murid tak lagi eligible, sertifikat lama TETAP active dan tidak ada efek
// (ADR-013); bila cert bukan milik cohort guru / bukan active → tolak.
export async function reissueCertificate(input: unknown) {
  const parsed = reissueCertificateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Muat sertifikat via strict client: RLS (certs_teacher_all) membatasi baca
  // ke guru dari cohort enrollment terkait.
  const { data: cert } = await supabase
    .from("certificates")
    .select("id,status,enrollment_id,level_id")
    .eq("id", parsed.data.certificateId)
    .single();
  const row = cert as { id: string; status: string; enrollment_id: string; level_id: string } | null;
  if (!row) return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  if (row.status !== "active") return { ok: false as const, error: "NOT_ACTIVE" };

  const ev = await evaluateLevelEligibility(supabase, row.enrollment_id, row.level_id);
  if (ev.status === "NOT_FOUND_OR_FORBIDDEN") return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  if (ev.status === "NOT_FOUND") return { ok: false as const, error: "NOT_FOUND" };
  if (!ev.eligible) return { ok: false as const, error: "NOT_ELIGIBLE", reasons: ev.reasons };

  const { error } = await supabase.rpc("reissue_certificate", {
    p_certificate_id: parsed.data.certificateId,
    p_reason: parsed.data.reason,
    p_idempotency_key: randomUUID(),
  });
  if (error) return { ok: false as const, error: "REISSUE_FAILED" };
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

// ---------- Batch anchoring (ADR-018; per-org, service client) ----------
// Ops job: kumpulkan payload_hash sertifikat ACTIVE org ini yang belum
// ter-anchor → satu Merkle root → anchor via adapter → simpan chain_anchors +
// tautkan. Tanpa env/provider terkonfigurasi → tolak (tidak mengarang
// transaksi). Scheduler dapat memanggil action ini secara berkala.
export async function anchorCertificateBatch() {
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
  const orgId = (mem as { organization_id: string } | null)?.organization_id;
  if (!orgId) return { ok: false as const, error: "FORBIDDEN" };

  // Gerbang ADR-018: flag OFF → disabled; provider nyata/belum dipilih → pending.
  if (!isChainEnabled()) return { ok: false as const, error: "BLOCKCHAIN_DISABLED" };
  const adapter = getChainAdapter();
  if (adapter instanceof NoopChainAdapter) {
    return { ok: false as const, error: "BLOCKCHAIN_PROVIDER_PENDING" };
  }
  const env = getServerEnv();
  const provider = (env.BLOCKCHAIN_PROVIDER ?? "").trim() || "mock";
  const network = (env.BLOCKCHAIN_NETWORK ?? "").trim() || "mock";

  // Jalur privileged (service): chain_anchors & link sertifikat TANPA policy
  // authenticated — hanya setelah validasi caller (guru teacher aktif org).
  const svc = createServiceClient();
  // Filter bersarang `enrollments.courses.organization_id` hanya sah bila jalur
  // embed-nya ikut di-select (PGRST108 bila tidak). Defect yang ditemukan saat
  // smoke flow: tanpa embed, query error → data null → terlihat "no candidates".
  const { data: certRows } = await svc
    .from("certificates")
    .select("id,status,chain_anchor_id,payload_hash,enrollments(courses(organization_id))")
    .eq("status", "active")
    .is("chain_anchor_id", null)
    .eq("enrollments.courses.organization_id", orgId)
    .limit(ANCHOR_BATCH_LIMIT);
  const certs =
    (certRows as
      { id: string; status: string; chain_anchor_id: string | null; payload_hash: string | null }[] | null) ??
    [];

  const outcome = await runAnchorBatch({
    findCandidates: async (): Promise<AnchorCandidate[]> =>
      certs
        .filter(isAnchorEligible)
        .map((c) => ({ certificateId: c.id, payloadHash: c.payload_hash as string })),
    findAnchorByRoot: async (root) => {
      const { data } = await svc
        .from("chain_anchors")
        .select("id,status,transaction_ref")
        .eq("merkle_root", root)
        .eq("organization_id", orgId)
        .maybeSingle();
      return (data as { id: string; status: string; transaction_ref: string | null } | null) ?? null;
    },
    insertAnchor: async (row) => {
      const { data } = await svc.from("chain_anchors").insert(row).select("id").single();
      if (!data) throw new Error("ANCHOR_INSERT_FAILED");
      return (data as { id: string }).id;
    },
    linkCertificates: async (anchorId, certificateIds) => {
      await svc.from("certificates").update({ chain_anchor_id: anchorId }).in("id", certificateIds);
    },
    adapter,
    provider,
    network,
    organizationId: orgId,
  });

  if (outcome.ok) {
    return {
      ok: true as const,
      anchored: outcome.anchored,
      root: outcome.root,
      reference: outcome.reference,
      status: outcome.status,
    };
  }
  if (outcome.reason === "no_candidates") {
    return { ok: true as const, anchored: 0, root: null, reference: null, status: "none" as const };
  }
  if (outcome.reason === "empty_hashes") return { ok: false as const, error: "ANCHOR_EMPTY" };
  return { ok: false as const, error: "ANCHOR_FAILED", root: outcome.root };
}

/**
 * Refresh status anchor: untuk baris chain_anchors org yg masih `pending`, tanya
 * adapter.getStatus(reference) dan naikkan ke `final` bila sudah final (idempoten;
 * status final tidak pernah kembali ke pending). Mode mock-algorand memajukan
 * pending→final dengan finality deterministik tanpa jaringan; provider nyata juga
 * memakai jalur ini saat nanti dipilih (ADR-018). Hanya `final` yang diterapkan —
 * `failed`/`pending` dibiarkan utk retry berikut (jangan korup row karena status
 * sementara adapter).
 */
export async function refreshAnchorStatus() {
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
  const orgId = (mem as { organization_id: string } | null)?.organization_id;
  if (!orgId) return { ok: false as const, error: "FORBIDDEN" };

  if (!isChainEnabled()) return { ok: false as const, error: "BLOCKCHAIN_DISABLED" };
  const adapter = getChainAdapter();
  if (adapter instanceof NoopChainAdapter) {
    return { ok: false as const, error: "BLOCKCHAIN_PROVIDER_PENDING" };
  }

  const svc = createServiceClient();
  const { data: rows } = await svc
    .from("chain_anchors")
    .select("id,transaction_ref")
    .eq("status", "pending")
    .eq("organization_id", orgId)
    .limit(200);
  let finalized = 0;
  for (const row of (rows as { id: string; transaction_ref: string | null }[] | null) ?? []) {
    if (!row.transaction_ref) continue;
    const st = await adapter.getStatus(row.transaction_ref);
    if (st.status === "final") {
      await svc
        .from("chain_anchors")
        .update({ status: "final", anchored_at: new Date().toISOString() })
        .eq("id", row.id);
      finalized += 1;
    }
    // status pending/failed dibiarkan (retry berikut) — tidak menurunkan row.
  }
  return { ok: true as const, finalized };
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
  // Sanitasi konten: hanya block ter-allowlist (lib/content-blocks.ts, CONTENT_AUTHORING.md);
  // tolak HTML arbitrer.
  const content = parsed.data.content;
  if (typeof content["html"] === "string" && content["html"].length > 0) {
    return { ok: false as const, error: "HTML_NOT_ALLOWED" };
  }
  if (
    parsed.data.type !== "article" &&
    (content["blocks"] !== undefined || content["markdown"] !== undefined)
  ) {
    return { ok: false as const, error: "BLOCK_INVALID" };
  }
  // Markdown langsung → blocks canonical (parser pure lib/markdown-blocks).
  if (typeof content["markdown"] === "string" && content["markdown"].trim().length > 0) {
    const md = parseMarkdownToBlocks(content["markdown"]);
    if (!md.ok) return { ok: false as const, error: "MARKDOWN_INVALID" };
    content["blocks"] = md.blocks;
    delete content["markdown"];
  }
  if (content["blocks"] !== undefined) {
    const sanitized = sanitizeContentBlocks(content["blocks"]);
    if (!sanitized.ok) return { ok: false as const, error: "BLOCK_INVALID" };
    content["blocks"] = sanitized.blocks;
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

  // Hook aplikasi (ADR-011): level yang selesai menjadwalkan review pertamanya
  // (+interval pertama). Hanya bila pasangan (enrollment, level) BELUM punya
  // baris review apa pun — recompute ulang tidak menggandakan dan review yang
  // sudah completed/dismissed tidak dijadwalkan ulang; index parsial
  // review_items_one_active menjaga anti-duplikat scheduled.
  let reviewScheduled = 0;
  const doneLevelIds = levelResults.filter((l) => l.done).map((l) => l.id);
  if (doneLevelIds.length > 0) {
    const { data: existingRows } = await supabase
      .from("review_items")
      .select("entity_id")
      .eq("enrollment_id", enr.id)
      .eq("entity_type", "level")
      .in("entity_id", doneLevelIds);
    const alreadyReviewed = new Set(
      ((existingRows as { entity_id: string }[] | null) ?? []).map((r) => r.entity_id),
    );
    const rows = firstReviewInsertRows(enr.id, doneLevelIds);
    const fresh = rows.filter((r) => !alreadyReviewed.has(r.entity_id));
    if (fresh.length > 0) {
      const { error } = await supabase.from("review_items").insert(fresh);
      if (error) return { ok: false as const, error: "REVIEW_SCHEDULE_FAILED" };
      reviewScheduled = fresh.length;
    }
  }

  // Auto-issue sertifikat (ADR/aturan guru: semua lesson wajib selesai + quiz
  // 100% + ujian akhir >= 70%). Evaluasi ulang penuh terjadi di RPC security
  // definer `auto_issue_certificates` — murid tidak bisa memalsukan skor karena
  // hanya attempts hasil grade server yang dihitung. Idempoten: sertifikat
  // ACTIVE untuk (enrollment, level) di-skip. Best-effort seperti agregasi
  // heartbeat: kegagalan auto-issue tidak boleh menggagalkan recompute.
  if (levelResults.some((l) => l.done)) {
    try {
      await supabase.rpc("auto_issue_certificates", {
        p_enrollment_id: parsed.data.enrollmentId,
      });
    } catch {
      // best-effort
    }
  }

  return { ok: true as const, lessonsDone, lessonsTotal, levels: levelResults, reviewScheduled };
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
      prompt_json: {
        text: parsed.data.promptText,
        ...(parsed.data.options.length > 0 ? { options: parsed.data.options } : {}),
      },
      difficulty: parsed.data.difficulty,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, questionId: (data as { id: string }).id };
}

const MAX_PACK_QUESTIONS = 500;

/**
 * Import bank soal via question pack (lib/question-pack.ts): satu baris per soal,
 * campur MCQ/true-false/esai. Setiap baris sah langsung dibuat (questions +
 * question_versions versi 1 + kunci + catatan guru). Kunci divalidasi terhadap
 * opsi nyata baris — baris rusak dilaporkan tanpa menggagalkan baris lain.
 */
export async function bulkImportQuestionPack(input: unknown) {
  const parsed = bulkImportQuestionPackSchema.safeParse(input);
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

  const { rows, errors } = parseQuestionPack(parsed.data.pack);
  if (rows.length === 0) return { ok: false as const, error: "NO_VALID_ROWS", errors };
  if (rows.length > MAX_PACK_QUESTIONS)
    return { ok: false as const, error: "ROWS_OVER_CAP", cap: MAX_PACK_QUESTIONS, errors };

  let created = 0;
  for (const row of rows) {
    const promptOptions = row.type === "single_choice" || row.type === "multiple_choice" ? row.options : [];
    const { data: q } = await supabase
      .from("questions")
      .insert({
        organization_id: org.organization_id,
        type: row.type,
        prompt_json: { text: row.prompt, ...(promptOptions.length > 0 ? { options: promptOptions } : {}) },
        difficulty: "medium",
        explanation_json: row.note ? { note: row.note } : {},
      })
      .select("id")
      .single();
    const qid = (q as { id: string } | null)?.id;
    if (!qid) {
      errors.push(`Baris ${row.line}: gagal membuat soal.`);
      continue;
    }
    const mapped = mapChoiceKey(row.key, row.type, promptOptions);
    const rule: Record<string, unknown> =
      row.type === "single_choice"
        ? { type: row.type, points: row.points, correctOptionId: mapped.id }
        : row.type === "multiple_choice"
          ? {
              type: row.type,
              points: row.points,
              correctOptionIds: mapped.ids,
              partialCredit: "exact",
            }
          : row.type === "true_false"
            ? {
                type: row.type,
                points: row.points,
                correctOptionId:
                  row.key.toLowerCase() === "salah" || row.key.toLowerCase() === "false" ? "false" : "true",
              }
            : { type: row.type, points: row.points };
    const { error: vErr } = await supabase.from("question_versions").insert({
      question_id: qid,
      version: 1,
      grading_json: rule,
      points: row.points,
    });
    if (vErr) errors.push(`Baris ${row.line}: gagal menyimpan kunci (${vErr.message}).`);
    else created++;
  }
  return { ok: true as const, created, errors };
}

export async function publishQuestionVersion(input: unknown) {
  const parsed = publishQuestionVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  // Kunci jawaban harus merujuk opsi yang benar-benar ada pada soal pilihan —
  // kunci typo/asing membuat kuis tak bisa dinilai (defect live: grading 0 diam-diam).
  const { data: base } = await supabase
    .from("questions")
    .select("type,prompt_json")
    .eq("id", parsed.data.questionId)
    .single();
  const b = base as { type: string; prompt_json: { options?: string[] } } | null;
  if (!b) return { ok: false as const, error: "NOT_FOUND" };
  const grading = parsed.data.grading as Record<string, unknown>;
  if (b.type === "single_choice" || b.type === "true_false") {
    const key = grading["correctOptionId"];
    const allowed = b.type === "true_false" ? ["true", "false"] : (b.prompt_json.options ?? []);
    if (typeof key !== "string" || !allowed.includes(key))
      return { ok: false as const, error: "INVALID_KEY" };
  }
  if (b.type === "multiple_choice") {
    const keys = grading["correctOptionIds"];
    const allowed = b.prompt_json.options ?? [];
    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      keys.some((k) => typeof k !== "string" || !allowed.includes(k))
    )
      return { ok: false as const, error: "INVALID_KEY" };
  }
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
        randomize: parsed.data.randomize,
        ...(parsed.data.poolSize !== undefined ? { poolSize: parsed.data.poolSize } : {}),
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
  const { error } = await supabase.from("responses").upsert(
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
    .select("id,assessment_id,status,question_order_json")
    .eq("id", attemptId)
    .single();
  const att = attempt as {
    id: string;
    assessment_id: string;
    status: string;
    question_order_json: { seed: string; order: string[] } | null;
  } | null;
  if (!att) return { ok: false as const, error: "NOT_FOUND" };
  // Soal disajikan via RPC definer tersanitasi (migration 000023): murid pemilik
  // attempt `in_progress` mendapat type/prompt_json TANPA grading/explanation.
  // Tabel soal TETAP teacher-only via RLS (kunci jawaban) — JANGAN dibaca langsung
  // dengan strict client di sini (defect live: kuis selalu kosong untuk murid).
  // Urutan soal = roll SERVER saat startAttempt (question_order_json); fallback posisi.
  const { data: rowsRaw } = await supabase.rpc("get_attempt_questions", {
    p_attempt_id: attemptId,
  });
  let rows =
    (rowsRaw as
      | {
          question_version_id: string;
          position: number;
          points: number;
          qtype: string;
          prompt_json: { text?: string; options?: string[] };
        }[]
      | null) ?? [];
  const ordered = att.question_order_json?.order;
  if (ordered && ordered.length > 0) {
    const byId = new Map(rows.map((r) => [r.question_version_id, r]));
    rows = ordered
      .map((id) => byId.get(id))
      .filter(
        (
          r,
        ): r is {
          question_version_id: string;
          position: number;
          points: number;
          qtype: string;
          prompt_json: { text?: string; options?: string[] };
        } => !!r,
      );
  }
  const out: (SanitizedQuestion & { savedAnswer: unknown })[] = [];
  for (const row of rows) {
    const { data: resp } = await supabase
      .from("responses")
      .select("answer_json")
      .eq("attempt_id", att.id)
      .eq("question_version_id", row.question_version_id)
      .limit(1)
      .single();
    out.push({
      ...sanitizeQuestionForAttempt({
        questionVersionId: row.question_version_id,
        position: row.position,
        points: Number(row.points),
        type: row.qtype as SanitizedQuestion["type"],
        promptJson: row.prompt_json,
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

// ---------- Alerts: acknowledge / snooze / resolve (RLS cohort guru) ----------
async function setAlertStatus(alertId: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data, error } = await supabase
    .from("alerts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", alertId)
    .select("id");
  if (error || ((data as { id: string }[] | null) ?? []).length === 0)
    return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  return { ok: true as const };
}

export async function acknowledgeAlert(input: unknown) {
  const parsed = alertIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  return setAlertStatus(parsed.data.alertId, { status: "acknowledged" });
}

export async function snoozeAlert(input: unknown) {
  const parsed = alertIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  return setAlertStatus(parsed.data.alertId, {
    status: "snoozed",
    snoozed_until: new Date(Date.now() + 3 * 86400000).toISOString(),
  });
}

export async function resolveAlert(input: unknown) {
  const parsed = resolveAlertSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  return setAlertStatus(parsed.data.alertId, { status: "resolved", resolved_note: parsed.data.note });
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

// ---------- Authoring: resolve version dari node (draft-only guard ADR-003) ----------
type Supa = Awaited<ReturnType<typeof createClient>>;

async function resolveVersionId(supabase: Supa, table: string, id: string): Promise<string | null> {
  if (table === "levels") {
    const { data } = await supabase.from("levels").select("course_version_id").eq("id", id).single();
    return (data as { course_version_id: string } | null)?.course_version_id ?? null;
  }
  if (table === "modules") {
    const { data } = await supabase
      .from("modules")
      .select("level_id,levels(course_version_id)")
      .eq("id", id)
      .single();
    const m = data as { level_id: string; levels: { course_version_id: string } | null } | null;
    return m?.levels?.course_version_id ?? null;
  }
  if (table === "lessons") {
    const { data } = await supabase
      .from("lessons")
      .select("module_id,modules(level_id,levels(course_version_id))")
      .eq("id", id)
      .single();
    const l = data as {
      module_id: string;
      modules: { levels: { course_version_id: string } | null } | null;
    } | null;
    return l?.modules?.levels?.course_version_id ?? null;
  }
  const { data } = await supabase
    .from("activities")
    .select("lesson_id,lessons(module_id,modules(level_id,levels(course_version_id)))")
    .eq("id", id)
    .single();
  const a = data as {
    lesson_id: string;
    lessons: { modules: { levels: { course_version_id: string } | null } | null } | null;
  } | null;
  return a?.lessons?.modules?.levels?.course_version_id ?? null;
}

async function isDraftVersion(supabase: Supa, versionId: string): Promise<boolean> {
  const { data } = await supabase.from("course_versions").select("published_at").eq("id", versionId).single();
  const v = data as { published_at: string | null } | null;
  return Boolean(v) && v?.published_at === null;
}

// ---------- Authoring: update node (HANYA versi draft) ----------
export async function updateContent(input: unknown) {
  const parsed = updateContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  if (!parsed.data.title && !parsed.data.objective) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const versionId = await resolveVersionId(supabase, parsed.data.table, parsed.data.id);
  if (!versionId || !(await isDraftVersion(supabase, versionId))) {
    return { ok: false as const, error: "PUBLISHED_IMMUTABLE" };
  }
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (parsed.data.title) patch["title"] = parsed.data.title;
  if (parsed.data.objective && (parsed.data.table === "levels" || parsed.data.table === "lessons")) {
    patch["objective"] = parsed.data.objective;
  }
  const { data, error } = await supabase
    .from(parsed.data.table)
    .update(patch)
    .eq("id", parsed.data.id)
    .select("id");
  if (error || ((data as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  }
  return { ok: true as const };
}

// ---------- Authoring: delete node (draft + tanpa attempt terpakai) ----------
export async function deleteContent(input: unknown) {
  const parsed = deleteContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const versionId = await resolveVersionId(supabase, parsed.data.table, parsed.data.id);
  if (!versionId || !(await isDraftVersion(supabase, versionId))) {
    return { ok: false as const, error: "PUBLISHED_IMMUTABLE" };
  }
  // Kumpulkan assessment di subtree; tolak bila sudah ada attempt.
  const assessmentIds = await collectAssessmentIds(supabase, parsed.data.table, parsed.data.id);
  if (assessmentIds.length > 0) {
    const { count } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .in("assessment_id", assessmentIds);
    if ((count ?? 0) > 0) return { ok: false as const, error: "HAS_ATTEMPTS" };
  }
  const { error } = await supabase.from(parsed.data.table).delete().eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: "DELETE_FAILED" };
  return { ok: true as const };
}

async function collectAssessmentIds(supabase: Supa, table: string, id: string): Promise<string[]> {
  const out: string[] = [];
  const lessons: string[] = [];
  if (table === "activities") {
    const { data } = await supabase.from("assessments").select("id").eq("activity_id", id);
    return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
  }
  if (table === "lessons") {
    lessons.push(id);
  } else {
    // levels | modules → kumpulkan semua lesson di subtree.
    let moduleIds: string[] = [];
    if (table === "levels") {
      const { data } = await supabase.from("modules").select("id").eq("level_id", id);
      moduleIds = ((data as { id: string }[] | null) ?? []).map((r) => r.id);
    } else {
      moduleIds = [id];
    }
    for (const mid of moduleIds) {
      const { data } = await supabase.from("lessons").select("id").eq("module_id", mid);
      for (const l of (data as { id: string }[] | null) ?? []) lessons.push(l.id);
    }
  }
  for (const lid of lessons) {
    const { data } = await supabase.from("activities").select("id").eq("lesson_id", lid);
    for (const a of (data as { id: string }[] | null) ?? []) {
      const { data: asmt } = await supabase.from("assessments").select("id").eq("activity_id", a.id);
      for (const s of (asmt as { id: string }[] | null) ?? []) out.push(s.id);
    }
  }
  return out;
}

// ---------- Authoring: versi baru dari published (ADR-003, tanpa attempt/enrollment) ----------
// Struktur versi terakhir disalin menjadi draft yang bisa diedit; versi published tak tersentuh.
export async function createCourseVersion(input: unknown) {
  const parsed = publishVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", parsed.data.courseId)
    .single();
  if (!course) return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  const { data: vers } = await supabase
    .from("course_versions")
    .select("version")
    .eq("course_id", parsed.data.courseId)
    .order("version", { ascending: false })
    .limit(1);
  const next = (((vers as { version: number }[] | null) ?? [])[0]?.version ?? 0) + 1;
  const { data: created, error } = await supabase
    .from("course_versions")
    .insert({ course_id: parsed.data.courseId, version: next })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  const dstVersionId = (created as { id: string }).id;
  // Salin struktur versi terakhir (published/draft) sebagai titik awal yang bisa diedit.
  const { data: srcVers } = await supabase
    .from("course_versions")
    .select("id")
    .eq("course_id", parsed.data.courseId)
    .neq("id", dstVersionId)
    .order("version", { ascending: false })
    .limit(1);
  const srcVersionId = ((srcVers as { id: string }[] | null) ?? [])[0]?.id;
  if (srcVersionId) {
    const copied = await copyVersionTree(supabase, srcVersionId, dstVersionId);
    if (!copied) return { ok: false as const, error: "COPY_FAILED" };
  }
  return { ok: true as const, versionId: dstVersionId, version: next };
}

// Menyalin tree versi → versi (levels→…→assessment+links+prereq internal). Tanpa attempts/enrollments.
async function copyVersionTree(supabase: Supa, srcVersionId: string, dstVersionId: string): Promise<boolean> {
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
    .select("id,position,title,objective,passing_score,mastery_threshold")
    .eq("course_version_id", srcVersionId)
    .order("position");
  for (const lv of (levels as
    | {
        id: string;
        position: number;
        title: string;
        objective: string;
        passing_score: number;
        mastery_threshold: number;
      }[]
    | null) ?? []) {
    const newLevelId = remap(lv.id);
    let { error } = await supabase.from("levels").insert({
      id: newLevelId,
      course_version_id: dstVersionId,
      position: lv.position,
      title: lv.title,
      objective: lv.objective,
      passing_score: lv.passing_score,
      mastery_threshold: lv.mastery_threshold,
    });
    if (error) return false;
    const { data: modules } = await supabase
      .from("modules")
      .select("id,position,title")
      .eq("level_id", lv.id)
      .order("position");
    for (const md of (modules as { id: string; position: number; title: string }[] | null) ?? []) {
      const newModuleId = remap(md.id);
      ({ error } = await supabase
        .from("modules")
        .insert({ id: newModuleId, level_id: newLevelId, position: md.position, title: md.title }));
      if (error) return false;
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,position,title,objective,estimated_minutes,required")
        .eq("module_id", md.id)
        .order("position");
      for (const le of (lessons as
        | {
            id: string;
            position: number;
            title: string;
            objective: string;
            estimated_minutes: number;
            required: boolean;
          }[]
        | null) ?? []) {
        const newLessonId = remap(le.id);
        ({ error } = await supabase.from("lessons").insert({
          id: newLessonId,
          module_id: newModuleId,
          position: le.position,
          title: le.title,
          objective: le.objective,
          estimated_minutes: le.estimated_minutes,
          required: le.required,
        }));
        if (error) return false;
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
          ({ error } = await supabase.from("activities").insert({
            id: newActId,
            lesson_id: newLessonId,
            position: a.position,
            type: a.type,
            title: a.title,
            content_json: a.content_json,
            required: a.required,
          }));
          if (error) return false;
          const { data: asmt } = await supabase
            .from("assessments")
            .select("id,settings_json,total_points")
            .eq("activity_id", a.id)
            .limit(1)
            .single();
          const srcAsmt = asmt as { id: string; settings_json: unknown; total_points: number } | null;
          if (srcAsmt) {
            const newAsmtId = randomUUID();
            ({ error } = await supabase.from("assessments").insert({
              id: newAsmtId,
              activity_id: newActId,
              settings_json: srcAsmt.settings_json,
              total_points: srcAsmt.total_points,
            }));
            if (error) return false;
            const { data: links } = await supabase
              .from("assessment_questions")
              .select("question_version_id,position,points")
              .eq("assessment_id", srcAsmt.id);
            for (const link of (links as
              { question_version_id: string; position: number; points: number }[] | null) ?? []) {
              ({ error } = await supabase.from("assessment_questions").insert({
                assessment_id: newAsmtId,
                question_version_id: link.question_version_id,
                position: link.position,
                points: link.points,
              }));
              if (error) return false;
            }
          }
        }
      }
    }
  }
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
  return true;
}

// ---------- Cohort: buat + suspend enrollment (API_CONTRACTS) ----------
// ---------- Bulk import (XLSX, server-side) ----------
// Parsing + validasi + penyediaan identitas lewat jalur PRIVILEGED (service
// client, server-only): memberships TIDAK punya policy insert untuk guru
// (provisioning akun = admin). Otorisasi guru tetap diperiksa di action:
// cohort/course miliknya (app client + RLS). Baris rusak dilaporkan per baris.

async function xlsxRows(file: File): Promise<unknown[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = xlsxRead(buf, { type: "buffer" });
  const first = wb.SheetNames[0];
  const ws = first ? wb.Sheets[first] : undefined;
  if (!ws) return [];
  return xlsxUtils.sheet_to_json(ws) as unknown[];
}

const EMAIL_CHUNK = 100;

/** Direktori user (id+email) via Auth Admin API, paginasi dengan rem keamanan.
 * PostgREST TIDAK mengekspos skema auth (query tabel users lewat REST selalu
 * 406 live) sehingga resolusi email HARUS lewat Admin API — defect lama: semua
 * impor bulk berakhir notFound diam-diam. Server-only (service key). */
async function fetchAuthDirectory(): Promise<{ id: string; email: string }[]> {
  const svc = createServiceClient();
  const out: { id: string; email: string }[] = [];
  const PER_PAGE = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: PER_PAGE });
    const users = error ? [] : (data?.users ?? []);
    for (const u of users) {
      if (u.id && u.email) out.push({ id: u.id, email: u.email });
    }
    if (users.length < PER_PAGE) break;
  }
  return out;
}

/** email (lowercase) → user id untuk daftar email impor. */
async function resolveEmailsToIds(emails: string[]): Promise<Map<string, string>> {
  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const out = new Map<string, string>();
  for (const u of await fetchAuthDirectory()) {
    const email = u.email.toLowerCase();
    if (wanted.has(email) && !out.has(email)) out.set(email, u.id);
  }
  return out;
}

/** Bulk daftarkan murid ke cohort milik guru (identitas dicocokkan via email). */
export async function bulkImportStudents(formData: FormData) {
  const file = formData.get("file");
  const cohortIdRaw = formData.get("cohortId");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "FILE_MISSING" };
  const fileErr = xlsxFileError(file);
  if (fileErr) return { ok: false as const, error: fileErr };
  if (typeof cohortIdRaw !== "string" || !uuidSchema.safeParse(cohortIdRaw).success)
    return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Cohort milik guru ini (RLS select cohort + filter teacher_id).
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id,organization_id")
    .eq("id", cohortIdRaw)
    .eq("teacher_id", uid)
    .single();
  const c = cohort as { id: string; organization_id: string } | null;
  if (!c) return { ok: false as const, error: "FORBIDDEN" };

  const sheetRows = await xlsxRows(file);
  const { rows, errors } = parseStudentRows(sheetRows);
  if (rows.length === 0) return { ok: false as const, error: "NO_VALID_ROWS", errors };
  if (rowsOverCap(rows.length, MAX_STUDENT_ROWS))
    return { ok: false as const, error: "ROWS_OVER_CAP", cap: MAX_STUDENT_ROWS, errors };

  // Resolusi email → user id via Auth Admin API (hanya server).
  const svc = createServiceClient();
  const emailToId = await resolveEmailsToIds(rows.map((r) => r.email));

  let added = 0;
  let existing = 0;
  const notFound: string[] = [];
  // Anggota cohort yang sudah ada (hindari duplikat; tanpa asumsi unique constraint).
  const { data: currentMembers } = await supabase
    .from("cohort_members")
    .select("student_id")
    .eq("cohort_id", c.id);
  const memberSet = new Set(
    ((currentMembers as { student_id: string }[] | null) ?? []).map((m) => m.student_id),
  );

  // Kumpulkan dulu baris yang benar-benar baru, lalu tulis dalam batch (chunked).
  const pending: { id: string; email: string; displayName: string }[] = [];
  for (const r of rows) {
    const userId = emailToId.get(r.email);
    if (!userId) {
      notFound.push(r.email);
      continue;
    }
    if (memberSet.has(userId)) {
      existing++;
      continue;
    }
    pending.push({ id: userId, email: r.email, displayName: r.displayName });
  }

  // Profil + membership (provisioning akun = privileged, bukan policy guru).
  const profileRows = pending.map((p) => ({
    id: p.id,
    organization_id: c.organization_id,
    display_name: p.displayName,
  }));
  const membershipRows = pending.map((p) => ({
    organization_id: c.organization_id,
    user_id: p.id,
    role: "student" as const,
    status: "active" as const,
  }));
  for (let i = 0; i < profileRows.length; i += EMAIL_CHUNK) {
    await svc.from("profiles").upsert(profileRows.slice(i, i + EMAIL_CHUNK), { onConflict: "id" });
  }
  for (let i = 0; i < membershipRows.length; i += EMAIL_CHUNK) {
    await svc
      .from("memberships")
      .upsert(membershipRows.slice(i, i + EMAIL_CHUNK), { onConflict: "organization_id,user_id" });
  }
  // Keanggotaan cohort lewat RLS guru (teacher insert policy), chunked.
  const CM_CHUNK = 50;
  for (let i = 0; i < pending.length; i += CM_CHUNK) {
    const chunk = pending.slice(i, i + CM_CHUNK);
    const { error: cmErr } = await supabase
      .from("cohort_members")
      .insert(chunk.map((p) => ({ cohort_id: c.id, student_id: p.id, status: "active" })));
    if (!cmErr) {
      added += chunk.length;
      continue;
    }
    // Batch gagal → coba per baris agar error bisa diatribusikan per email.
    for (const p of chunk) {
      const { error: oneErr } = await supabase.from("cohort_members").insert({
        cohort_id: c.id,
        student_id: p.id,
        status: "active",
      });
      if (oneErr) errors.push(`Murid ${p.email}: gagal ditambahkan ke cohort (${oneErr.message}).`);
      else added++;
    }
  }

  return { ok: true as const, added, existing, notFound, errors };
}

/** Bulk impor materi (module/lesson/activity) ke level draft kursus milik guru. */
export async function bulkImportContent(formData: FormData) {
  const file = formData.get("file");
  const courseIdRaw = formData.get("courseId");
  const levelIdRaw = formData.get("levelId");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "FILE_MISSING" };
  const fileErr = xlsxFileError(file);
  if (fileErr) return { ok: false as const, error: fileErr };
  if (
    typeof courseIdRaw !== "string" ||
    typeof levelIdRaw !== "string" ||
    !uuidSchema.safeParse(courseIdRaw).success ||
    !uuidSchema.safeParse(levelIdRaw).success
  )
    return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return { ok: false as const, error: "UNAUTHENTICATED" };

  // Kursus milik guru + level di dalam versi kursus tsb (RLS guru).
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseIdRaw)
    .eq("owner_id", uid)
    .single();
  if (!course) return { ok: false as const, error: "FORBIDDEN" };
  const { data: level } = await supabase
    .from("levels")
    .select("id,course_version_id")
    .eq("id", levelIdRaw)
    .single();
  const lv = level as { id: string; course_version_id: string } | null;
  if (!lv) return { ok: false as const, error: "FORBIDDEN" };
  const { data: cv } = await supabase
    .from("course_versions")
    .select("id")
    .eq("id", lv.course_version_id)
    .eq("course_id", courseIdRaw)
    .single();
  if (!cv) return { ok: false as const, error: "FORBIDDEN" };

  const sheetRows = await xlsxRows(file);
  const { rows, errors } = parseContentRows(sheetRows);
  if (rows.length === 0) return { ok: false as const, error: "NO_VALID_ROWS", errors };
  if (rowsOverCap(rows.length, MAX_CONTENT_ROWS))
    return { ok: false as const, error: "ROWS_OVER_CAP", cap: MAX_CONTENT_ROWS, errors };

  // Kolom Content JSON untuk article menerima {"markdown":"…"} — konversi ke
  // blocks canonical; kalau markdown rusak, aktivitas diisi kosong + error.
  const normalizeContentJson = (act: {
    activityType?: string;
    activityTitle?: string;
    contentJson?: unknown;
  }) => {
    const base = (act.contentJson ?? {}) as Record<string, unknown>;
    if (
      act.activityType === "article" &&
      typeof base["markdown"] === "string" &&
      base["markdown"].trim().length > 0
    ) {
      const md = parseMarkdownToBlocks(base["markdown"]);
      if (!md.ok) {
        errors.push(`Aktivitas "${act.activityTitle ?? "?"}": markdown tidak valid.`);
        return {} as Record<string, unknown>;
      }
      return { blocks: md.blocks };
    }
    return base;
  };

  let modules = 0;
  let lessons = 0;
  let activities = 0;
  const grouped = groupContentRows(rows);

  // Module: posisi dihitung sekali di JS, lalu insert batch (1 request).
  const { data: mLast } = await supabase
    .from("modules")
    .select("position")
    .eq("level_id", levelIdRaw)
    .order("position", { ascending: false })
    .limit(1);
  const mBase = (((mLast as { position: number }[] | null) ?? [])[0]?.position ?? -1) + 1;
  const moduleTitles = [...grouped.keys()];
  const { data: modRows, error: mErr } = await supabase
    .from("modules")
    .insert(moduleTitles.map((title, i) => ({ level_id: levelIdRaw, position: mBase + i, title })))
    .select("id,title");
  const moduleIdByTitle = new Map<string, string>();
  for (const m of (modRows as { id: string; title: string }[] | null) ?? []) {
    moduleIdByTitle.set(m.title, m.id);
  }
  if (mErr) errors.push(`Module batch: gagal dibuat (${mErr.message}).`);

  for (const [moduleTitle, lessonsMap] of grouped) {
    const moduleId = moduleIdByTitle.get(moduleTitle);
    if (!moduleId) {
      errors.push(`Module "${moduleTitle}": gagal dibuat.`);
      continue;
    }
    modules++;

    // Lesson per module: posisi dari 0 (module baru), insert batch.
    const lessonTitles = [...lessonsMap.keys()];
    const { data: lesRows, error: lErr } = await supabase
      .from("lessons")
      .insert(
        lessonTitles.map((title, i) => ({
          module_id: moduleId,
          position: i,
          title,
          objective: lessonsMap.get(title)?.[0]?.objective || "Materi pelajaran ini.",
          estimated_minutes: 15,
          required: true,
        })),
      )
      .select("id,title");
    const lessonIdByTitle = new Map<string, string>();
    for (const l of (lesRows as { id: string; title: string }[] | null) ?? []) {
      lessonIdByTitle.set(l.title, l.id);
    }
    if (lErr) errors.push(`Lesson batch di "${moduleTitle}": gagal dibuat (${lErr.message}).`);

    for (const [lessonTitle, activityRows] of lessonsMap) {
      const lessonId = lessonIdByTitle.get(lessonTitle);
      if (!lessonId) {
        errors.push(`Lesson "${lessonTitle}": gagal dibuat.`);
        continue;
      }
      lessons++;

      // Aktivitas per lesson: insert chunked (50), fallback per baris saat batch gagal.
      const ACT_CHUNK = 50;
      for (let i = 0; i < activityRows.length; i += ACT_CHUNK) {
        const chunk = activityRows.slice(i, i + ACT_CHUNK);
        const chunkRows = chunk.map((act) => normalizeContentJson(act));
        const { error: aErr } = await supabase.from("activities").insert(
          chunk.map((act, j) => ({
            lesson_id: lessonId,
            position: i + j,
            type: act.activityType as BulkActivityType,
            title: act.activityTitle,
            required: true,
            content_json: chunkRows[j] ?? {},
          })),
        );
        if (!aErr) {
          activities += chunk.length;
          continue;
        }
        for (let j = 0; j < chunk.length; j++) {
          const act = chunk[j]!;
          const { error: oneErr } = await supabase.from("activities").insert({
            lesson_id: lessonId,
            position: i + j,
            type: act.activityType as BulkActivityType,
            title: act.activityTitle,
            required: true,
            content_json: chunkRows[j] ?? {},
          });
          if (oneErr) errors.push(`Aktivitas "${act.activityTitle}": gagal dibuat.`);
          else activities++;
        }
      }
    }
  }
  return { ok: true as const, modules, lessons, activities, errors };
}

// ---------- Admin org: bulk upload guru + penugasan murid→kelas/subjek ----------
// Jalur PRIVILEGED (service client): membuat membership guru/murid, cohort lintas
// guru, dan enrollment lintas cohort adalah provisioning admin — bukan policy guru
// biasa. Otorisasi ORG-ADMIN diperiksa dulu di action (lib/org-admin.ts): guru
// aktif org YANG MEMILIKI ≥1 course di org (facet Owner, ADR-008). Guru biasa
// tetap dibatasi cohort miliknya (RBAC.md) — tidak mendapat akses admin.

/** Tahun akademik label (mis. 2026/2027) dari tanggal server. */
function currentAcademicYear(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1..12
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/** Bulk daftarkan guru (XLSX: Email, Nama, [Kelas ;/,-terpisah]) — org-admin. */
export async function bulkImportTeachers(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "FILE_MISSING" };
  const fileErr = xlsxFileError(file);
  if (fileErr) return { ok: false as const, error: fileErr };
  const ctx = await getOrgAdminContext();
  if (!ctx) return { ok: false as const, error: "FORBIDDEN" };

  const sheetRows = await xlsxRows(file);
  const { rows, errors } = parseTeacherRows(sheetRows);
  if (rows.length === 0) return { ok: false as const, error: "NO_VALID_ROWS", errors };
  if (rowsOverCap(rows.length, MAX_TEACHER_ROWS))
    return { ok: false as const, error: "ROWS_OVER_CAP", cap: MAX_TEACHER_ROWS, errors };

  const svc = createServiceClient();
  const emailToId = await resolveEmailsToIds(rows.map((r) => r.email));

  const notFound: string[] = [];
  const pending = rows.filter((r) => {
    if (!emailToId.has(r.email)) notFound.push(r.email);
    return emailToId.has(r.email);
  });

  // Profil + membership guru (provisioning = privileged).
  const profileRows = pending.map((p) => ({
    id: emailToId.get(p.email)!,
    organization_id: ctx.orgId,
    display_name: p.displayName,
  }));
  const membershipRows = pending.map((p) => ({
    organization_id: ctx.orgId,
    user_id: emailToId.get(p.email)!,
    role: "teacher" as const,
    status: "active" as const,
  }));
  for (let i = 0; i < profileRows.length; i += EMAIL_CHUNK) {
    await svc.from("profiles").upsert(profileRows.slice(i, i + EMAIL_CHUNK), { onConflict: "id" });
  }
  for (let i = 0; i < membershipRows.length; i += EMAIL_CHUNK) {
    await svc
      .from("memberships")
      .upsert(membershipRows.slice(i, i + EMAIL_CHUNK), { onConflict: "organization_id,user_id" });
  }

  // Kolom Kelas opsional: buat cohort (org, guru tsb) bila belum ada; laporkan bila
  // nama kelas sudah diampu guru lain di org yang sama.
  let classesCreated = 0;
  for (const p of pending) {
    for (const name of p.classNames) {
      const { data: existing } = await svc
        .from("cohorts")
        .select("id,teacher_id")
        .eq("organization_id", ctx.orgId)
        .eq("name", name)
        .maybeSingle();
      const ex = existing as { id: string; teacher_id: string } | null;
      if (ex) {
        if (ex.teacher_id !== emailToId.get(p.email)) {
          errors.push(`Kelas "${name}" sudah diampu guru lain (untuk ${p.email}).`);
        }
        continue;
      }
      const { error: cErr } = await svc.from("cohorts").insert({
        organization_id: ctx.orgId,
        teacher_id: emailToId.get(p.email)!,
        name,
        academic_year: currentAcademicYear(),
      });
      if (cErr) errors.push(`Kelas "${name}" untuk ${p.email}: gagal dibuat (${cErr.message}).`);
      else classesCreated++;
    }
  }

  return { ok: true as const, added: pending.length, existing: 0, notFound, classesCreated, errors };
}

/** Bulk penugasan murid → kelas (cohort) + subjek (course) — org-admin.
 * XLSX: Email, Kelas (opsional), Mapel (opsional); minimal satu per baris. */
export async function bulkImportStudentAssignments(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "FILE_MISSING" };
  const fileErr = xlsxFileError(file);
  if (fileErr) return { ok: false as const, error: fileErr };
  const ctx = await getOrgAdminContext();
  if (!ctx) return { ok: false as const, error: "FORBIDDEN" };

  const sheetRows = await xlsxRows(file);
  const { rows, errors } = parseStudentAssignmentRows(sheetRows);
  if (rows.length === 0) return { ok: false as const, error: "NO_VALID_ROWS", errors };
  if (rowsOverCap(rows.length, MAX_ASSIGNMENT_ROWS))
    return { ok: false as const, error: "ROWS_OVER_CAP", cap: MAX_ASSIGNMENT_ROWS, errors };

  const svc = createServiceClient();
  const emailToId = await resolveEmailsToIds(rows.map((r) => r.email));

  // Map nama → id utk kelas (cohort) & subjek (course) di org ini.
  const { data: cohortRows } = await svc.from("cohorts").select("id,name").eq("organization_id", ctx.orgId);
  const nameToCohort = new Map(
    ((cohortRows as { id: string; name: string }[] | null) ?? []).map((c) => [c.name, c.id]),
  );
  const { data: courseRows } = await svc.from("courses").select("id,title").eq("organization_id", ctx.orgId);
  const titleToCourse = new Map(
    ((courseRows as { id: string; title: string }[] | null) ?? []).map((c) => [c.title, c.id]),
  );

  const notFound: string[] = [];
  const unknownClasses = new Set<string>();
  const unknownSubjects = new Set<string>();
  const membershipIds = new Set<string>();
  const cmInserts: { cohort_id: string; student_id: string; status: "active" }[] = [];
  const enrInserts: { course_id: string; student_id: string; cohort_id: string; status: "active" }[] = [];
  let assigned = 0;

  for (const r of rows) {
    const studentId = emailToId.get(r.email);
    if (!studentId) {
      notFound.push(r.email);
      continue;
    }
    const cohortId = r.className ? nameToCohort.get(r.className) : undefined;
    const courseId = r.subjectName ? titleToCourse.get(r.subjectName) : undefined;
    if (r.className && !cohortId) unknownClasses.add(r.className);
    if (r.subjectName && !courseId) unknownSubjects.add(r.subjectName);
    if (!cohortId && !courseId) {
      errors.push(`Baris ${r.email}: kelas/subjek tidak ditemukan di org ini.`);
      continue;
    }
    assigned++;
    membershipIds.add(studentId);
    if (cohortId) cmInserts.push({ cohort_id: cohortId, student_id: studentId, status: "active" });
    if (cohortId && courseId) {
      enrInserts.push({ course_id: courseId, student_id: studentId, cohort_id: cohortId, status: "active" });
    }
  }

  // Provisioning membership murid + keanggotaan kelas + enrollment subjek (chunked).
  const membershipRows = [...membershipIds].map((uid) => ({
    organization_id: ctx.orgId,
    user_id: uid,
    role: "student" as const,
    status: "active" as const,
  }));
  for (let i = 0; i < membershipRows.length; i += EMAIL_CHUNK) {
    await svc
      .from("memberships")
      .upsert(membershipRows.slice(i, i + EMAIL_CHUNK), { onConflict: "organization_id,user_id" });
  }
  const CM_CHUNK = 50;
  for (let i = 0; i < cmInserts.length; i += CM_CHUNK) {
    const { error } = await svc
      .from("cohort_members")
      .upsert(cmInserts.slice(i, i + CM_CHUNK), { onConflict: "cohort_id,student_id" });
    if (error) errors.push(`Keanggotaan kelas batch gagal (${error.message}).`);
  }
  for (let i = 0; i < enrInserts.length; i += CM_CHUNK) {
    const { error } = await svc
      .from("enrollments")
      .upsert(enrInserts.slice(i, i + CM_CHUNK), { onConflict: "course_id,student_id,cohort_id" });
    if (error) errors.push(`Enrollment subjek batch gagal (${error.message}).`);
  }

  return {
    ok: true as const,
    assigned,
    notFound,
    unknownClasses: [...unknownClasses],
    unknownSubjects: [...unknownSubjects],
    errors,
  };
}

/** Mapping manual satu murid → kelas + subjek (grid kelas×subjek) — org-admin. */
export async function saveStudentMapping(input: unknown) {
  const parsed = saveStudentMappingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const ctx = await getOrgAdminContext();
  if (!ctx) return { ok: false as const, error: "FORBIDDEN" };
  const svc = createServiceClient();

  // Murid harus anggota org.
  const { data: prof } = await svc
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.studentId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!prof) return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };

  // Validasi kelas & subjek milik org (batch).
  const invalidCohorts: string[] = [];
  const validCohorts: string[] = [];
  if (parsed.data.cohortIds.length > 0) {
    const { data: cs } = await svc
      .from("cohorts")
      .select("id")
      .in("id", parsed.data.cohortIds)
      .eq("organization_id", ctx.orgId);
    const found = new Set(((cs as { id: string }[] | null) ?? []).map((c) => c.id));
    for (const id of parsed.data.cohortIds) (found.has(id) ? validCohorts : invalidCohorts).push(id);
  }
  const invalidCourses: string[] = [];
  const validCourses: string[] = [];
  if (parsed.data.courseIds.length > 0) {
    const { data: cs } = await svc
      .from("courses")
      .select("id")
      .in("id", parsed.data.courseIds)
      .eq("organization_id", ctx.orgId);
    const found = new Set(((cs as { id: string }[] | null) ?? []).map((c) => c.id));
    for (const id of parsed.data.courseIds) (found.has(id) ? validCourses : invalidCourses).push(id);
  }

  // Provisioning membership murid + cohort_members + enrollment (grid kelas×subjek).
  await svc.from("memberships").upsert(
    {
      organization_id: ctx.orgId,
      user_id: parsed.data.studentId,
      role: "student" as const,
      status: "active" as const,
    },
    { onConflict: "organization_id,user_id" },
  );
  let cohortMemberships = 0;
  if (validCohorts.length > 0) {
    const { data } = await svc
      .from("cohort_members")
      .upsert(
        validCohorts.map((cohortId) => ({
          cohort_id: cohortId,
          student_id: parsed.data.studentId,
          status: "active" as const,
        })),
        { onConflict: "cohort_id,student_id" },
      )
      .select("cohort_id");
    cohortMemberships = ((data as { cohort_id: string }[] | null) ?? []).length;
  }
  let enrollments = 0;
  if (validCohorts.length > 0 && validCourses.length > 0) {
    const rows = validCohorts.flatMap((cohortId) =>
      validCourses.map((courseId) => ({
        course_id: courseId,
        student_id: parsed.data.studentId,
        cohort_id: cohortId,
        status: "active" as const,
      })),
    );
    const { data } = await svc
      .from("enrollments")
      .upsert(rows, { onConflict: "course_id,student_id,cohort_id" })
      .select("id");
    enrollments = ((data as { id: string }[] | null) ?? []).length;
  }

  return { ok: true as const, cohortMemberships, enrollments, invalidCohorts, invalidCourses };
}

/** Tetapkan guru pengampu sebuah kelas (cohort.teacher_id) — org-admin. */
export async function assignTeacherToClass(input: unknown) {
  const parsed = assignTeacherToClassSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const ctx = await getOrgAdminContext();
  if (!ctx) return { ok: false as const, error: "FORBIDDEN" };
  const svc = createServiceClient();

  // Guru sasaran harus membership teacher aktif di org.
  const { data: t } = await svc
    .from("memberships")
    .select("user_id")
    .eq("user_id", parsed.data.teacherId)
    .eq("organization_id", ctx.orgId)
    .eq("role", "teacher")
    .eq("status", "active")
    .maybeSingle();
  if (!t) return { ok: false as const, error: "TEACHER_NOT_FOUND" };
  const { data: cohort } = await svc
    .from("cohorts")
    .select("id")
    .eq("id", parsed.data.cohortId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!cohort) return { ok: false as const, error: "CLASS_NOT_FOUND" };

  const { error } = await svc
    .from("cohorts")
    .update({ teacher_id: parsed.data.teacherId, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.cohortId);
  if (error) return { ok: false as const, error: "UPDATE_FAILED" };
  return { ok: true as const, teacherId: parsed.data.teacherId, cohortId: parsed.data.cohortId };
}

export async function createCohort(input: unknown) {
  const parsed = createCohortSchema.safeParse(input);
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
    .from("cohorts")
    .insert({
      organization_id: org.organization_id,
      teacher_id: userId,
      name: parsed.data.name,
      academic_year: parsed.data.academicYear,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: "CREATE_FAILED" };
  return { ok: true as const, cohortId: (data as { id: string }).id };
}

export async function suspendEnrollment(input: unknown) {
  const parsed = suspendEnrollmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  if (!(await requireAuth(supabase))) return { ok: false as const, error: "UNAUTHENTICATED" };
  // RLS UPDATE enrollments (guru cohort) menegakkan otorisasi.
  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "suspended" })
    .eq("id", parsed.data.enrollmentId)
    .select("id");
  if (error || ((data as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false as const, error: "NOT_FOUND_OR_FORBIDDEN" };
  }
  return { ok: true as const };
}

// ---------- Profile: ubah display name sendiri ----------
export async function updateProfile(input: unknown) {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "INVALID_INPUT" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) return { ok: false as const, error: "UNAUTHENTICATED" };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", userId);
  if (error) return { ok: false as const, error: "UPDATE_FAILED" };
  return { ok: true as const };
}
