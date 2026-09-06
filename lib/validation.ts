import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCourseSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).default(""),
});

export const publishVersionSchema = z.object({
  courseId: uuidSchema,
});

export const reorderSiblingsSchema = z.object({
  table: z.enum(["levels", "modules", "lessons", "activities"]),
  parentColumn: z.enum(["course_version_id", "level_id", "module_id", "lesson_id"]),
  parentId: uuidSchema,
  orderedIds: z.array(uuidSchema).min(1).max(200),
});

export const archiveCourseSchema = z.object({
  courseId: uuidSchema,
});

export const duplicateCourseSchema = z.object({
  courseId: uuidSchema,
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
});

export const enrollStudentSchema = z.object({
  courseId: uuidSchema,
  studentId: uuidSchema,
  cohortId: uuidSchema,
});

export const recordLearningEventSchema = z.object({
  enrollmentId: uuidSchema,
  eventType: z.enum(["lesson_opened", "activity_completed", "draft_saved", "heartbeat"]),
  entityType: z.enum(["lesson", "activity"]),
  entityId: uuidSchema,
  clientEventId: z.string().min(8).max(100),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const startAttemptSchema = z.object({
  assessmentId: uuidSchema,
  enrollmentId: uuidSchema,
  idempotencyKey: z.string().min(8).max(100),
});

export const saveResponseSchema = z.object({
  attemptId: uuidSchema,
  questionVersionId: uuidSchema,
  answer: z.unknown(),
});

export const submitAttemptSchema = z.object({
  attemptId: uuidSchema,
  idempotencyKey: z.string().min(8).max(100),
});

export const gradeResponseSchema = z.object({
  responseId: uuidSchema,
  manualScore: z.number().min(0).max(100),
  feedback: z.string().max(5000).default(""),
});

export const issueCertificateSchema = z.object({
  enrollmentId: uuidSchema,
  levelId: uuidSchema,
  idempotencyKey: z.string().min(8).max(100),
});

export const revokeCertificateSchema = z.object({
  certificateId: uuidSchema,
  reason: z.string().min(5).max(2000),
});

export const robloxCompletionSchema = z.object({
  event_id: z.string().min(1).max(100),
  place_id: z.string().min(1).max(50),
  roblox_user_id: z.string().min(1).max(50),
  challenge_id: z.string().uuid(),
  score: z.number().min(0).max(100),
  issued_at: z.string().datetime(),
  nonce: z.string().min(16).max(100),
  signature: z.string().min(32),
});

export const verifyPublicIdSchema = z.object({
  publicId: z.string().min(10).max(100),
});
