import type {
  IntegrationAdapter,
  LmsCourse,
  LmsUser,
  LmsGrade,
  ConfigField,
} from "./adapter";
import { registerAdapter } from "./adapter";

/**
 * Google Classroom integration adapter.
 *
 * Uses Google Classroom API v1 for:
 * - Course listing
 * - Roster sync (students + teachers)
 * - Grade passback (courseWork rosters)
 *
 * OAuth2 flow is handled server-side via /api/integrations/google-classroom/callback.
 */

interface GoogleClassroomConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken: string;
  refreshToken: string;
}

class GoogleClassroomAdapter implements IntegrationAdapter {
  readonly provider = "google_classroom";
  private config: GoogleClassroomConfig;

  constructor(config: GoogleClassroomConfig) {
    this.config = config;
  }

  private async apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`https://classroom.googleapis.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.config.refreshToken) return false;
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.config.accessToken = data.access_token;
      return true;
    } catch {
      return false;
    }
  }

  async verify(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.apiFetch("/courses?pageSize=1");
      if (res.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) return { ok: false, error: "Token refresh failed" };
        const retry = await this.apiFetch("/courses?pageSize=1");
        return retry.ok
          ? { ok: true }
          : { ok: false, error: `API error: ${retry.status}` };
      }
      return res.ok ? { ok: true } : { ok: false, error: `API error: ${res.status}` };
    } catch (e) {
      return { ok: false, error: `Network error: ${String(e)}` };
    }
  }

  async listCourses(): Promise<LmsCourse[]> {
    const res = await this.apiFetch("/courses?courseStates=ACTIVE&pageSize=100");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.courses ?? []).map((c: Record<string, unknown>) => ({
      externalCourseId: c.id as string,
      name: c.name as string,
      section: c.section as string | undefined,
      description: c.description as string | undefined,
    }));
  }

  async syncRoster(externalCourseId: string): Promise<LmsUser[]> {
    const users: LmsUser[] = [];

    // Fetch students
    const studentsRes = await this.apiFetch(
      `/courses/${externalCourseId}/students?pageSize=100`,
    );
    if (studentsRes.ok) {
      const data = await studentsRes.json();
      for (const s of data.students ?? []) {
        users.push({
          externalUserId: s.userId as string,
          email: s.profile?.emailAddress ?? "",
          displayName: s.profile?.name?.fullName ?? "",
          role: "student",
        });
      }
    }

    // Fetch teachers
    const teachersRes = await this.apiFetch(
      `/courses/${externalCourseId}/teachers?pageSize=100`,
    );
    if (teachersRes.ok) {
      const data = await teachersRes.json();
      for (const t of data.teachers ?? []) {
        users.push({
          externalUserId: t.userId as string,
          email: t.profile?.emailAddress ?? "",
          displayName: t.profile?.name?.fullName ?? "",
          role: "teacher",
        });
      }
    }

    return users;
  }

  async syncGrades(
    externalCourseId: string,
    grades: LmsGrade[],
  ): Promise<{ synced: number; errors: string[] }> {
    // Google Classroom grade passback via courseWork studentSubmissions
    // Requires courseWorkId mapping stored in external_identities
    const errors: string[] = [];
    let synced = 0;

    for (const grade of grades) {
      try {
        const res = await this.apiFetch(
          `/courses/${externalCourseId}/courseWork/${grade.externalAssignmentId}/studentSubmissions/${grade.externalUserId}:patch`,
          {
            method: "PATCH",
            body: JSON.stringify({
              draftGrade: grade.score,
            }),
          },
        );
        if (res.ok) synced++;
        else errors.push(`Failed for ${grade.externalUserId}: ${res.status}`);
      } catch (e) {
        errors.push(`Error for ${grade.externalUserId}: ${String(e)}`);
      }
    }

    return { synced, errors };
  }

  getConfigFields(): ConfigField[] {
    return [
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", required: true },
      { key: "redirectUri", label: "Redirect URI", type: "url", required: true },
    ];
  }
}

// Register adapter
registerAdapter("google_classroom", () =>
  new GoogleClassroomAdapter({
    clientId: process.env.GOOGLE_CLASSROOM_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_CLASSROOM_REDIRECT_URI ?? "",
    accessToken: "",
    refreshToken: "",
  }),
);

export { GoogleClassroomAdapter };
