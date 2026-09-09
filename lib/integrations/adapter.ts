/**
 * Integration adapter interface for external LMS platforms.
 * Google Classroom and LTI 1.3 both implement this interface.
 */

export interface LmsUser {
  externalUserId: string;
  email: string;
  displayName: string;
  role: "student" | "teacher";
}

export interface LmsCourse {
  externalCourseId: string;
  name: string;
  section?: string;
  description?: string;
}

export interface LmsGrade {
  externalUserId: string;
  externalAssignmentId: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface IntegrationAdapter {
  readonly provider: string;

  /** Verify credentials and return connection status */
  verify(): Promise<{ ok: boolean; error?: string }>;

  /** List courses from the external platform */
  listCourses(): Promise<LmsCourse[]>;

  /** Sync roster (students + teachers) from external course */
  syncRoster(externalCourseId: string): Promise<LmsUser[]>;

  /** Push grades back to the external platform */
  syncGrades(externalCourseId: string, grades: LmsGrade[]): Promise<{ synced: number; errors: string[] }>;

  /** Get adapter-specific configuration UI fields */
  getConfigFields(): ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "url";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

/**
 * Registry of available integration adapters.
 * Add new adapters here to make them available in the UI.
 */
const adapters = new Map<string, () => IntegrationAdapter>();

export function registerAdapter(provider: string, factory: () => IntegrationAdapter) {
  adapters.set(provider, factory);
}

export function getAdapter(provider: string): IntegrationAdapter | null {
  const factory = adapters.get(provider);
  return factory ? factory() : null;
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}
