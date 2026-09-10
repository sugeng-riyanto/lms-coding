import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression tests for student dashboards.
 *
 * These tests sign in as murid01, navigate to each student-facing page,
 * and compare screenshots against committed baselines. A layout change
 * will cause a pixel-diff failure that must be intentional (update the
 * baseline with `npx playwright test --update-snapshots`).
 *
 * Runs only against a live backend (Supabase) — skipped in CI without creds.
 */

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "murid01@demo.local";

function requireStudentPassword(): string {
  const pw = process.env.E2E_STUDENT_PASSWORD;
  if (!pw) throw new Error("E2E_STUDENT_PASSWORD not set — visual regression tests require a live backend.");
  return pw;
}

async function loginAsStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(STUDENT_EMAIL);
  await page.getByLabel("Password").fill(requireStudentPassword());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/learn", { timeout: 20_000 });
  await page.waitForTimeout(2000);
}

async function navigateViaLink(page: Page, pattern: RegExp) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const link = page.getByRole("link", { name: pattern }).first();
  if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
    await link.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}

const BACKEND_READY = process.env.E2E_STUDENT_PASSWORD && process.env.SUPABASE_URL;

test.describe("visual regression: student dashboards", () => {
  test.skip(!BACKEND_READY, "Backend not available — set E2E_STUDENT_PASSWORD + SUPABASE_URL.");

  test("learn dashboard", async ({ page }) => {
    await loginAsStudent(page);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-learn-dashboard.png", {
      fullPage: true,
      mask: [page.locator('[class*="notification"]'), page.locator('[class*="presence"]')],
    });
  });

  test("catalog", async ({ page }) => {
    await loginAsStudent(page);
    await navigateViaLink(page, /catalog/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-catalog.png", {
      fullPage: true,
    });
  });

  test("certificates", async ({ page }) => {
    await loginAsStudent(page);
    await navigateViaLink(page, /certific/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-certificates.png", {
      fullPage: true,
      mask: [page.locator("time")], // timestamps may differ
    });
  });

  test("review queue", async ({ page }) => {
    await loginAsStudent(page);
    await navigateViaLink(page, /review/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-review-queue.png", {
      fullPage: true,
    });
  });

  test("analytics", async ({ page }) => {
    await loginAsStudent(page);
    await navigateViaLink(page, /analytic/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-analytics.png", {
      fullPage: true,
    });
  });

  test("settings", async ({ page }) => {
    await loginAsStudent(page);
    await navigateViaLink(page, /setting/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-settings.png", {
      fullPage: true,
    });
  });

  test("login page (unauthenticated)", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-login-page.png", {
      fullPage: true,
    });
  });

  test("landing page (unauthenticated)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("student-landing.png", {
      fullPage: true,
    });
  });
});
