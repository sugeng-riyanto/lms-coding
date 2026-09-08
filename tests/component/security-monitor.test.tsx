// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecurityMonitor } from "@/components/security-monitor";
import type { CspAlertState } from "@/lib/csp-alerts";

const base: CspAlertState = {
  alertActive: false,
  ratePerMin: 4,
  violationsPerMin: 4,
  blockedPerMin: 0,
  windowMs: 60_000,
  thresholdPerMin: 20,
  sampleSize: 4,
  total: 40,
  blockedTotal: 1,
  lastViolationAt: 1_700_000_000_000,
  lastUpdated: 1_700_000_000_000,
};

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

const hourlyBuckets = [
  { bucket: "2026-09-08T03:00:00Z", violations: 5, blocked: 1 },
  { bucket: "2026-09-08T04:00:00Z", violations: 3, blocked: 0 },
];
const dailyBuckets = [{ bucket: "2026-09-01", violations: 10, blocked: 0 }];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SecurityMonitor", () => {
  it("state tenang: banner hijau + ambang + metrik agregat", () => {
    render(<SecurityMonitor initial={base} lang="id" />);
    expect(screen.getByRole("status").textContent).toContain("Tidak ada spike laporan CSP");
    expect(screen.getByText("4/menit")).toBeTruthy();
    expect(screen.getByText("ambang 20/menit")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("spike: banner alert + teks injection attempt", () => {
    render(
      <SecurityMonitor initial={{ ...base, alertActive: true, ratePerMin: 25, sampleSize: 25 }} lang="id" />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Spike laporan CSP terdeteksi");
    expect(alert.textContent).toContain("injection");
    expect(screen.getByText("25/menit")).toBeTruthy();
  });

  it("refresh sukses memperbarui state + digest", async () => {
    const refreshed: CspAlertState = { ...base, ratePerMin: 30, alertActive: true, sampleSize: 30 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/operator/csp-alerts")) return Promise.resolve(okJson({ data: refreshed }));
        if (url.includes("/api/operator/csp-digest"))
          return Promise.resolve(
            okJson({ data: { buckets: hourlyBuckets, total: 9, windowDays: 1, bucketGranularity: "hour" } }),
          );
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }),
    );
    render(<SecurityMonitor initial={base} lang="id" />);
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Spike laporan CSP terdeteksi");
    });
    expect(screen.getByText("30/menit")).toBeTruthy();
  });

  it("refresh gagal: error ditampilkan, state lama tetap", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    render(<SecurityMonitor initial={base} lang="id" />);
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Gagal memuat ulang");
    });
    expect(screen.getByText("4/menit")).toBeTruthy();
  });

  it("7d toggle memicu fetch dengan days=7", async () => {
    const digestCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/operator/csp-alerts")) return Promise.resolve(okJson({ data: base }));
        if (url.includes("/api/operator/csp-digest")) {
          const isDaily = url.includes("days=7");
          digestCalls.push(isDaily ? "7d" : "1d");
          return Promise.resolve(
            okJson({
              data: {
                buckets: isDaily ? dailyBuckets : hourlyBuckets,
                total: isDaily ? 10 : 9,
                windowDays: isDaily ? 7 : 1,
                bucketGranularity: isDaily ? "day" : "hour",
              },
            }),
          );
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }),
    );
    const user = userEvent.setup();
    render(<SecurityMonitor initial={base} lang="id" />);

    // Populate digest via refresh
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Riwayat 24/ })).toBeTruthy());

    // Click 7d toggle using userEvent (handles React event delegation)
    await user.click(screen.getByRole("radio", { name: "7 hari" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Riwayat 7/ })).toBeTruthy();
      expect(digestCalls).toContain("7d");
    });
  });

  it("24h toggle kembali ke days=1", async () => {
    const digestCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/operator/csp-alerts")) return Promise.resolve(okJson({ data: base }));
        if (url.includes("/api/operator/csp-digest")) {
          const isDaily = url.includes("days=7");
          digestCalls.push(isDaily ? "7d" : "1d");
          return Promise.resolve(
            okJson({
              data: {
                buckets: isDaily ? dailyBuckets : hourlyBuckets,
                total: isDaily ? 10 : 9,
                windowDays: isDaily ? 7 : 1,
                bucketGranularity: isDaily ? "day" : "hour",
              },
            }),
          );
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }),
    );
    const user = userEvent.setup();
    render(<SecurityMonitor initial={base} lang="id" />);

    // Populate
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Riwayat 24/ })).toBeTruthy());

    // Switch to 7d
    await user.click(screen.getByRole("radio", { name: "7 hari" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Riwayat 7/ })).toBeTruthy());

    // Switch back to 24h
    await user.click(screen.getByRole("radio", { name: "24 jam" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Riwayat 24/ })).toBeTruthy();
      expect(digestCalls).toContain("1d");
    });
  });

  it("refresh button disabled saat busy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<SecurityMonitor initial={base} lang="id" />);
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Memuat ulang\u2026" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });
});
