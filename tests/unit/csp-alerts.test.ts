import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetCspAlerts, cspAlertState, recordCspBlocked, recordCspViolation } from "@/lib/csp-alerts";

const T0 = 1_700_000_000_000;

beforeEach(() => {
  __resetCspAlerts();
  process.env.CSP_ALERT_THRESHOLD_PER_MIN = "20";
});

afterEach(() => {
  delete process.env.CSP_ALERT_THRESHOLD_PER_MIN;
  __resetCspAlerts();
});

describe("cspAlertState", () => {
  it("state awal tenang: tidak aktif, sampleSize 0", async () => {
    const s = await cspAlertState(T0);
    expect(s.alertActive).toBe(false);
    expect(s.sampleSize).toBe(0);
    expect(s.total).toBe(0);
    expect(s.thresholdPerMin).toBe(20);
    expect(s.windowMs).toBe(60_000);
  });

  it("di bawah threshold: tidak spike, rate benar", async () => {
    for (let i = 0; i < 10; i++) recordCspViolation(T0 + i);
    const s = await cspAlertState(T0 + 10);
    expect(s.violationsPerMin).toBe(10);
    expect(s.alertActive).toBe(false);
    expect(s.sampleSize).toBe(10);
    expect(s.lastViolationAt).toBe(T0 + 9);
  });

  it("rate ≥ threshold memicu spike", async () => {
    for (let i = 0; i < 20; i++) recordCspViolation(T0 + i);
    expect((await cspAlertState(T0 + 20)).alertActive).toBe(true);
    // Satu lagi menaikkan rate.
    recordCspViolation(T0 + 21);
    expect((await cspAlertState(T0 + 22)).ratePerMin).toBe(21);
  });

  it("event lama keluar window → spike turun (decay)", async () => {
    for (let i = 0; i < 30; i++) recordCspViolation(T0 + i);
    expect((await cspAlertState(T0 + 30)).alertActive).toBe(true);
    // Semua event berumur > window (61 detik kemudian).
    const s = await cspAlertState(T0 + 30 + 61_000);
    expect(s.alertActive).toBe(false);
    expect(s.sampleSize).toBe(0);
    // total tetap tercatat (sejak boot) meski sampleSize 0.
    expect(s.total).toBe(30);
  });

  it("attempt yang di-block (rate-limiter) ikut dihitung untuk spike", async () => {
    for (let i = 0; i < 19; i++) recordCspViolation(T0 + i);
    recordCspBlocked(T0 + 19);
    const s = await cspAlertState(T0 + 20);
    expect(s.violationsPerMin).toBe(19);
    expect(s.blockedPerMin).toBe(1);
    expect(s.blockedTotal).toBe(1);
    expect(s.alertActive).toBe(true); // 19+1 = 20 ≥ threshold
  });

  it("threshold dari env dibaca & nilai buruk fallback ke 20", async () => {
    process.env.CSP_ALERT_THRESHOLD_PER_MIN = "3";
    for (let i = 0; i < 3; i++) recordCspViolation(T0 + i);
    expect((await cspAlertState(T0 + 3)).alertActive).toBe(true);

    process.env.CSP_ALERT_THRESHOLD_PER_MIN = "abc";
    __resetCspAlerts();
    recordCspViolation(T0);
    expect((await cspAlertState(T0)).thresholdPerMin).toBe(20);
    expect((await cspAlertState(T0)).alertActive).toBe(false);
  });

  it("window 60 s membatasi sample (event lama keluar window)", async () => {
    // 5000 event tersebar 1 detik → rentang ~83 menit; hanya menit terakhir masuk.
    for (let i = 0; i < 5_000; i++) recordCspViolation(T0 + i * 1_000);
    const s = await cspAlertState(T0 + 5_000 * 1_000);
    expect(s.total).toBe(5_000);
    expect(s.sampleSize).toBe(60);
    expect(s.ratePerMin).toBe(60);
  });

  it("ring buffer terbatas (MAX_EVENTS) — tidak tumbuh tak terbatas", async () => {
    // 5000 event berjarak 1 ms → semuanya dalam window; buffer di-cap 2000.
    for (let i = 0; i < 5_000; i++) recordCspViolation(T0 + i);
    const s = await cspAlertState(T0 + 5_000);
    expect(s.total).toBe(5_000);
    expect(s.sampleSize).toBe(2_000);
  });

  it("state tidak pernah mengekspos URI/directive detail (hanya agregat)", async () => {
    for (let i = 0; i < 5; i++) recordCspViolation(T0 + i);
    const json = JSON.stringify(await cspAlertState(T0 + 5));
    expect(json).not.toMatch(/https?:|script-sample|blocked-uri|document-uri/i);
  });
});
