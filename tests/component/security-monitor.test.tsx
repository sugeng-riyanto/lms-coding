// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SecurityMonitor", () => {
  it("state tenang: banner hijau + ambang + metrik agregat", () => {
    render(<SecurityMonitor initial={base} />);
    expect(screen.getByRole("status").textContent).toContain("Tidak ada spike laporan CSP");
    expect(screen.getByText("4/menit")).toBeTruthy();
    expect(screen.getByText("ambang 20/menit")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy(); // total
    expect(screen.getByText("1")).toBeTruthy(); // blocked total
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("spike: banner alert + teks injection attempt", () => {
    render(<SecurityMonitor initial={{ ...base, alertActive: true, ratePerMin: 25, sampleSize: 25 }} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Spike laporan CSP terdeteksi");
    expect(alert.textContent).toContain("injection");
    expect(screen.getByText("25/menit")).toBeTruthy();
  });

  it("refresh sukses memperbarui state (fetch /api/operator/csp-alerts)", async () => {
    const refreshed: CspAlertState = { ...base, ratePerMin: 30, alertActive: true, sampleSize: 30 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: refreshed }),
      }),
    );
    render(<SecurityMonitor initial={base} />);
    screen.getByRole("button", { name: "Muat ulang" }).click();
    // Tunggu microtask fetch + setState.
    await vi.waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Spike laporan CSP terdeteksi");
    });
    expect(screen.getByText("30/menit")).toBeTruthy();
  });

  it("refresh gagal: error ditampilkan, state lama tetap", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    render(<SecurityMonitor initial={base} />);
    screen.getByRole("button", { name: "Muat ulang" }).click();
    await vi.waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Gagal memuat ulang");
    });
    expect(screen.getByText("4/menit")).toBeTruthy(); // state lama
  });
});
