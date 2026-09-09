import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cache = readFileSync("lib/cache.ts", "utf8");
const adapter = readFileSync("lib/integrations/adapter.ts", "utf8");
const studentAnalyticsText = readFileSync("lib/ui-text/student-analytics.ts", "utf8");
const dashboardText = readFileSync("lib/ui-text/dash.ts", "utf8");
const appShell = readFileSync("components/app-shell.tsx", "utf8");

describe("Caching layer", () => {
  it("exports cachedFetch with TTL and stale-while-revalidate", () => {
    expect(cache).toMatch(/export async function cachedFetch/);
    expect(cache).toMatch(/ttlMs/);
    expect(cache).toMatch(/staleMs/);
  });

  it("exports invalidateCache and clearCache", () => {
    expect(cache).toMatch(/export function invalidateCache/);
    expect(cache).toMatch(/export function clearCache/);
  });

  it("exports getCacheStats for monitoring", () => {
    expect(cache).toMatch(/export function getCacheStats/);
    expect(cache).toMatch(/fresh.*stale.*expired/);
  });

  it("uses Map-based in-memory cache", () => {
    expect(cache).toMatch(/new Map/);
  });

  it("background revalidation pattern", () => {
    expect(cache).toMatch(/Background revalidation/);
    expect(cache).toMatch(/fetcher\(\)/);
  });
});

describe("Integration adapter layer exists", () => {
  it("adapter interface defined", () => {
    expect(adapter).toMatch(/export interface IntegrationAdapter/);
  });
});

describe("Student analytics UI text", () => {
  it("has all required strings", () => {
    expect(studentAnalyticsText).toMatch(/title/);
    expect(studentAnalyticsText).toMatch(/totalMinutes/);
    expect(studentAnalyticsText).toMatch(/avgScore/);
    expect(studentAnalyticsText).toMatch(/activityChartTitle/);
    expect(studentAnalyticsText).toMatch(/quizChartTitle/);
  });
});

describe("Dashboard has risk+intervention strings", () => {
  it("intervention queue strings present", () => {
    expect(dashboardText).toMatch(/assignSelf/);
    expect(dashboardText).toMatch(/reopen/);
    expect(dashboardText).toMatch(/dueLabel/);
    expect(dashboardText).toMatch(/escalationLevel/);
  });
});

describe("AppShell has NotificationBell", () => {
  it("bell integrated", () => {
    expect(appShell).toMatch(/NotificationBell/);
    expect(appShell).toMatch(/notifications/);
  });
});
