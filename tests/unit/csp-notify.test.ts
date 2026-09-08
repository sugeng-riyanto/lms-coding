import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyCspSpike } from "@/lib/csp-notify";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CSP_ALERT_WEBHOOK_URL;
});

describe("notifyCspSpike", () => {
  it("silent no-op when CSP_ALERT_WEBHOOK_URL is not set", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await notifyCspSpike({
      event: "ACTIVE",
      ratePerMin: 25,
      thresholdPerMin: 20,
      violationsPerMin: 25,
      blockedPerMin: 0,
      sampleSize: 25,
      total: 100,
      timestamp: "2026-09-08T00:00:00Z",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("fires POST to configured webhook URL", async () => {
    process.env.CSP_ALERT_WEBHOOK_URL = "https://hooks.example.com/csp";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    await notifyCspSpike({
      event: "ACTIVE",
      ratePerMin: 25,
      thresholdPerMin: 20,
      violationsPerMin: 25,
      blockedPerMin: 0,
      sampleSize: 25,
      total: 100,
      timestamp: "2026-09-08T00:00:00Z",
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      "https://hooks.example.com/csp",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body.source).toBe("lms-csp-alerting");
    expect(body.event).toBe("ACTIVE");
    expect(body.ratePerMin).toBe(25);
    expect(body.total).toBe(100);
    expect(body.timestamp).toBe("2026-09-08T00:00:00Z");
  });

  it("logs error when webhook fails (does not throw)", async () => {
    process.env.CSP_ALERT_WEBHOOK_URL = "https://hooks.example.com/csp";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await notifyCspSpike({
      event: "ACTIVE",
      ratePerMin: 25,
      thresholdPerMin: 20,
      violationsPerMin: 25,
      blockedPerMin: 0,
      sampleSize: 25,
      total: 100,
      timestamp: "2026-09-08T00:00:00Z",
    });
    expect(consoleSpy).toHaveBeenCalledWith("[csp-notify] webhook failed:", "network error");
  });

  it("logs error when webhook returns non-OK", async () => {
    process.env.CSP_ALERT_WEBHOOK_URL = "https://hooks.example.com/csp";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await notifyCspSpike({
      event: "ACTIVE",
      ratePerMin: 25,
      thresholdPerMin: 20,
      violationsPerMin: 25,
      blockedPerMin: 0,
      sampleSize: 25,
      total: 100,
      timestamp: "2026-09-08T00:00:00Z",
    });
    expect(consoleSpy).toHaveBeenCalledWith("[csp-notify] webhook returned 500 Internal Server Error");
  });
});
