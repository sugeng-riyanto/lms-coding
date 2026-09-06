export type Role = "teacher" | "student" | "guardian";

export interface Membership {
  organizationId: string;
  userId: string;
  role: Role;
  status: "active" | "suspended";
}

export type Capability =
  | "manage_own_courses"
  | "manage_own_cohort_enrollments"
  | "view_own_cohort_progress"
  | "learn_on_active_enrollment"
  | "submit_own_attempt"
  | "manual_grade"
  | "view_linked_child_summary"
  | "download_own_certificate"
  | "verify_certificate";

const TEACHER_CAPS: Capability[] = [
  "manage_own_courses",
  "manage_own_cohort_enrollments",
  "view_own_cohort_progress",
  "manual_grade",
  "verify_certificate",
];

const STUDENT_CAPS: Capability[] = [
  "learn_on_active_enrollment",
  "submit_own_attempt",
  "download_own_certificate",
  "verify_certificate",
];

const GUARDIAN_CAPS: Capability[] = ["view_linked_child_summary", "verify_certificate"];

export function capabilitiesFor(role: Role): Capability[] {
  if (role === "teacher") return TEACHER_CAPS;
  if (role === "student") return STUDENT_CAPS;
  return GUARDIAN_CAPS;
}

export function can(role: Role, capability: Capability): boolean {
  return capabilitiesFor(role).includes(capability);
}

/**
 * Totally server-side role resolution contract: role TIDAK BOLEH dibaca
 * dari user_metadata / client payload. Caller harus resolve dari
 * memberships (server-controlled) atau app_metadata.
 */
export function assertServerResolvedRole(role: string | null | undefined): Role {
  if (role === "teacher" || role === "student" || role === "guardian") return role;
  throw new Error("FORBIDDEN: role must be resolved server-side");
}
