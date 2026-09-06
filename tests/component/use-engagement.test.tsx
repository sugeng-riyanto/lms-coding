// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useEngagementHeartbeat } from "@/app/(student)/activities/[activityId]/use-sync";
import { pendingCount } from "@/lib/sync-queue";
import { MAX_HEARTBEAT_ACTIVE_MS } from "@/lib/active-time";

const recordLearningEvent = vi.fn();
vi.mock("@/features/actions", () => ({
  recordLearningEvent: (...args: unknown[]) => recordLearningEvent(...args),
}));

type HarnessProps = {
  enabled: boolean;
  enrollmentId: string;
  entityType: "lesson" | "activity";
  entityId: string;
};

function Harness(props: HarnessProps) {
  useEngagementHeartbeat({
    enrollmentId: props.enrollmentId,
    entityType: props.entityType,
    entityId: props.entityId,
    studentKey: props.enrollmentId,
    enabled: props.enabled,
  });
  return null;
}

const base: HarnessProps = {
  enabled: true,
  enrollmentId: "enr-1",
  entityType: "activity",
  entityId: "act-1",
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderHarness(over: Partial<typeof base> = {}) {
  return render(<Harness {...base} {...over} />);
}

async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Simulasi aktivitas pointer nyata. */
function activity() {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
  });
}

describe("useEngagementHeartbeat — waktu belajar jujur", () => {
  it("mengirim heartbeat 30s saat tab visible & aktif, activeMs ter-clamp", async () => {
    recordLearningEvent.mockResolvedValue({ ok: true });
    renderHarness();
    await tick(30_000);
    expect(recordLearningEvent).toHaveBeenCalledTimes(1);
    const call = recordLearningEvent.mock.calls[0]?.[0] as {
      eventType: string;
      metadata: { activeMs: number };
    };
    expect(call.eventType).toBe("heartbeat");
    expect(call.metadata.activeMs).toBeLessThanOrEqual(MAX_HEARTBEAT_ACTIVE_MS);
    // tick berikutnya 30s lagi, masih aktif → heartbeat kedua
    activity();
    await tick(30_000);
    expect(recordLearningEvent).toHaveBeenCalledTimes(2);
  });

  it("tab tersembunyi → TIDAK mengirim heartbeat (waktu tidak dihitung)", async () => {
    recordLearningEvent.mockResolvedValue({ ok: true });
    const spy = vi.spyOn(Document.prototype, "visibilityState", "get").mockReturnValue("hidden");
    renderHarness();
    activity();
    await tick(90_000); // tiga tick dalam keadaan hidden
    expect(recordLearningEvent).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("idle > 60s → heartbeat berhenti; aktivitas baru menghidupkan lagi", async () => {
    recordLearningEvent.mockResolvedValue({ ok: true });
    renderHarness();
    await tick(30_000); // t=30s aktif (dari mount) → kirim
    await tick(30_000); // t=60s, delta 60s belum > 60s → kirim
    expect(recordLearningEvent).toHaveBeenCalledTimes(2);
    await tick(30_000); // t=90s, delta 90s > 60s (idle) → TIDAK kirim
    expect(recordLearningEvent).toHaveBeenCalledTimes(2);
    activity(); // aktivitas baru
    await tick(30_000); // t=120s → kirim lagi
    expect(recordLearningEvent).toHaveBeenCalledTimes(3);
  });

  it("gagal server → heartbeat masuk retry queue (offline, tanpa duplikasi)", async () => {
    recordLearningEvent.mockResolvedValue({ ok: false, error: "EVENT_FAILED" });
    renderHarness();
    await tick(30_000);
    expect(pendingCount("enr-1")).toBe(1);
    // kiriman berikutnya menambah antrean (client_event_id berbeda, bukan duplikasi)
    activity();
    await tick(30_000);
    expect(pendingCount("enr-1")).toBe(2);
  });

  it("disabled (tanpa enrollment) → tidak pernah mengirim", async () => {
    recordLearningEvent.mockResolvedValue({ ok: true });
    renderHarness({ enabled: false, enrollmentId: "" });
    await tick(90_000);
    expect(recordLearningEvent).not.toHaveBeenCalled();
  });
});
