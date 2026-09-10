import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression tests for teacher dashboards.
 *
 * Signs in as guru@demo.local, navigates to each teacher-facing page,
 * and compares screenshots against committed baselines.
 */

const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL ?? "guru@demo.local";

function requireTeacherPassword(): string {
  const pw = process.env.E2E_TEACHER_PASSWORD ?? process.env.E2E_STUDENT_PASSWORD;
  if (!pw) throw new Error("E2E_TEACHER_PASSWORD (or E2E_STUDENT_PASSWORD) not set.");
  return pw;
}

async function loginAsTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEACHER_EMAIL);
  await page.getByLabel("Password").fill(requireTeacherPassword());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/teacher**", { timeout: 20_000 });
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

const BACKEND_READY = process.env.E2E_TEACHER_PASSWORD || process.env.E2E_STUDENT_PASSWORD;

test.describe("visual regression: teacher dashboards", () => {
  test.skip(!BACKEND_READY, "Backend not available — set E2E_TEACHER_PASSWORD + SUPABASE_URL.");

  test("teacher main dashboard", async ({ page }) => {
    await loginAsTeacher(page);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-dashboard.png", {
      fullPage: true,
      mask: [page.locator('[class*="notification"]'), page.locator('[class*="presence"]')],
    });
  });

  test("courses list", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /course/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-courses.png", {
      fullPage: true,
    });
  });

  test("grading queue", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /grad/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-grading.png", {
      fullPage: true,
      mask: [page.locator("time")],
    });
  });

  test("question bank", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /question/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-questions.png", {
      fullPage: true,
    });
  });

  test("analytics", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /analytic/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-analytics.png", {
      fullPage: true,
    });
  });

  test("security monitor", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /secur/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-security.png", {
      fullPage: true,
      mask: [page.locator("time")],
    });
  });

  test("certificates", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /certific/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-certificates.png", {
      fullPage: true,
      mask: [page.locator("time")],
    });
  });

  test("settings", async ({ page }) => {
    await loginAsTeacher(page);
    await navigateViaLink(page, /setting/i);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("teacher-settings.png", {
      fullPage: true,
    });
  });
});
