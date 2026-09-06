import { test, expect } from "@playwright/test";

test("landing → login → learn critical path renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Belajar mandiri/i })).toBeVisible();
  await page.getByRole("link", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Target hari ini" })).toBeVisible();
  // keyboard-only: tab mencapai tombol utama
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeAttached();
});

test("public verifier demo tidak bocor PII", async ({ page }) => {
  const res = await page.request.get("/api/public/certificates/demo-valid-certificate");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("valid");
  expect(JSON.stringify(body)).not.toMatch(/email|password|answer/i);
});
