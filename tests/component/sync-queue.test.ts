// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { enqueueEvent, flushQueue, pendingCount, type QueuedEvent } from "@/lib/sync-queue";

const evt = (id: string): QueuedEvent => ({
  enrollmentId: "e1",
  eventType: "draft_saved",
  entityType: "lesson",
  entityId: "l1",
  clientEventId: id,
  metadata: {},
});

describe("offline retry queue", () => {
  it("enqueue tanpa duplikasi", () => {
    localStorage.clear();
    enqueueEvent("s1", evt("a"));
    enqueueEvent("s1", evt("a"));
    enqueueEvent("s1", evt("b"));
    expect(pendingCount("s1")).toBe(2);
  });
  it("flush menghapus yang sukses, menyimpan yang gagal", async () => {
    localStorage.clear();
    enqueueEvent("s2", evt("a"));
    enqueueEvent("s2", evt("fail"));
    const res = await flushQueue("s2", async (e) => ({ ok: e.clientEventId !== "fail" }));
    expect(res).toEqual({ sent: 1, remaining: 1 });
    expect(pendingCount("s2")).toBe(1);
  });
  it("reconnect mengosongkan antrekan", async () => {
    localStorage.clear();
    enqueueEvent("s3", evt("a"));
    const res = await flushQueue("s3", async () => ({ ok: true }));
    expect(res).toEqual({ sent: 1, remaining: 0 });
  });
});
