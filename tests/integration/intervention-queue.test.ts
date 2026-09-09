import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync("features/actions.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260909120000_intervention_queue.sql", "utf8");
const validation = readFileSync("lib/validation.ts", "utf8");
const alertControls = readFileSync("app/(teacher)/teacher/alert-controls.tsx", "utf8");
const studentDetail = readFileSync("app/(teacher)/teacher/students/[studentId]/page.tsx", "utf8");
const notificationBell = readFileSync("components/notification-bell.tsx", "utf8");
const appShell = readFileSync("components/app-shell.tsx", "utf8");

describe("Intervention queue: migration", () => {
  it("alerts table has assigned_to, due_at, follow_up_assessment_id, escalation_level columns", () => {
    expect(migration).toMatch(/assigned_to.*uuid.*references auth\.users/);
    expect(migration).toMatch(/due_at.*timestamptz/);
    expect(migration).toMatch(/follow_up_assessment_id.*uuid.*references public\.assessments/);
    expect(migration).toMatch(/escalation_level.*smallint.*not null.*default 0/);
  });

  it("alerts status CHECK includes 'reopened'", () => {
    expect(migration).toMatch(/'reopened'/);
    expect(migration).toMatch(/alerts_status_check/);
  });

  it("notifications table created with RLS", () => {
    expect(migration).toMatch(/create table if not exists public\.notifications/);
    expect(migration).toMatch(/user_id.*uuid.*references auth\.users/);
    expect(migration).toMatch(/type text not null/);
    expect(migration).toMatch(/title text not null/);
    expect(migration).toMatch(/read_at timestamptz/);
    expect(migration).toMatch(/enable row level security/);
    expect(migration).toMatch(/notifications_owner_select/);
  });

  it("indexes created for performance", () => {
    expect(migration).toMatch(/idx_alerts_assigned_to/);
    expect(migration).toMatch(/idx_alerts_due_at/);
    expect(migration).toMatch(/idx_notifications_user_unread/);
  });
});

describe("Intervention queue: validation schemas", () => {
  it("assignAlertSchema defined", () => {
    expect(validation).toMatch(/assignAlertSchema.*=.*z\.object/);
    expect(validation).toMatch(/assignedTo.*uuidSchema/);
    expect(validation).toMatch(/dueAt.*z\.string\(\)\.datetime/);
  });

  it("reopenAlertSchema defined", () => {
    expect(validation).toMatch(/reopenAlertSchema.*=.*z\.object/);
    expect(validation).toMatch(/reason.*z\.string\(\)\.max\(2000\)/);
  });

  it("createNotificationSchema defined", () => {
    expect(validation).toMatch(/createNotificationSchema.*=.*z\.object/);
    expect(validation).toMatch(/userId.*uuidSchema/);
    expect(validation).toMatch(/type.*z\.string\(\)\.max\(50\)/);
    expect(validation).toMatch(/title.*z\.string\(\)\.max\(200\)/);
  });

  it("markNotificationReadSchema defined", () => {
    expect(validation).toMatch(/markNotificationReadSchema.*=.*z\.object/);
    expect(validation).toMatch(/notificationId.*uuidSchema/);
  });

  it("createAlertSchema defined", () => {
    expect(validation).toMatch(/createAlertSchema.*=.*z\.object/);
    expect(validation).toMatch(/cohortId.*uuidSchema/);
    expect(validation).toMatch(/studentId.*uuidSchema/);
    expect(validation).toMatch(/code.*z\.string\(\)\.max\(50\)/);
  });
});

describe("Intervention queue: server actions", () => {
  it("assignAlert action exported", () => {
    expect(actions).toMatch(/export async function assignAlert/);
  });

  it("reopenAlert action exported", () => {
    expect(actions).toMatch(/export async function reopenAlert/);
  });

  it("autoEscalateOverdue action exported", () => {
    expect(actions).toMatch(/export async function autoEscalateOverdue/);
    expect(actions).toMatch(/escalation_level \+ 1/);
    expect(actions).toMatch(/Math\.min.*escalation_level.*5/);
  });

  it("createAlert action exported", () => {
    expect(actions).toMatch(/export async function createAlert/);
  });

  it("createNotification action exported", () => {
    expect(actions).toMatch(/export async function createNotification/);
  });

  it("markNotificationRead action exported", () => {
    expect(actions).toMatch(/export async function markNotificationRead/);
  });

  it("assignAlert sets status to 'acknowledged' and updates assigned_to", () => {
    expect(actions).toMatch(/assignAlert/);
    expect(actions).toMatch(/assigned_to: parsed\.data\.assignedTo/);
    expect(actions).toMatch(/status: "acknowledged"/);
  });

  it("reopenAlert sets status to 'reopened'", () => {
    expect(actions).toMatch(/export async function reopenAlert/);
    expect(actions).toMatch(/status: "reopened"/);
  });
});

describe("Intervention queue: UI components", () => {
  it("AlertControls has assign, reopen, and due date UI", () => {
    expect(alertControls).toMatch(/assignSelf/);
    expect(alertControls).toMatch(/reopen/);
    expect(alertControls).toMatch(/due_at/);
    expect(alertControls).toMatch(/escalation_level/);
    expect(alertControls).toMatch(/isOverdue/);
  });

  it("AlertControls accepts currentUserId prop", () => {
    expect(alertControls).toMatch(/currentUserId\?: string/);
  });

  it("Student detail page fetches alert history", () => {
    expect(studentDetail).toMatch(/alertHistory/);
    expect(studentDetail).toMatch(/from\("alerts"\)/);
    expect(studentDetail).toMatch(/resolved_note/);
    expect(studentDetail).toMatch(/escalation_level/);
  });

  it("NotificationBell component exists with mark-read functionality", () => {
    expect(notificationBell).toMatch(/markNotificationRead/);
    expect(notificationBell).toMatch(/unreadCount/);
    expect(notificationBell).toMatch(/aria-expanded/);
    expect(notificationBell).toMatch(/role="menu"/);
  });

  it("AppShell integrates NotificationBell", () => {
    expect(appShell).toMatch(/NotificationBell/);
    expect(appShell).toMatch(/notifications/);
  });
});
