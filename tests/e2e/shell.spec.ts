import { test, expect, type Page } from "@playwright/test";

/**
 * Shell aplikasi live: sidebar + drawer + pengaturan + keluar per peran.
 * Butuh backend hidup + seed (pola skip critical.spec.ts).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Lazy getter — throws only when a test actually needs the password, so
 * hermetic CI (no backend → specs skip) still runs public specs. No silent
 * fallback to the rotated-out DemoPass-2026!.
 */
function requireStudentPassword(): string {
  const pw = process.env.E2E_STUDENT_PASSWORD;
  if (!pw) {
    throw new Error(
      "E2E_STUDENT_PASSWORD is not set. " +
        "Export it or add it to .env.local before running e2e specs that need authentication. " +
        "The old fallback (DemoPass-2026!) has been removed after the password rotation.",
    );
  }
  return pw;
}

async function isBackendReady(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get("/api/health");
    if (!res.ok()) return false;
    const body = (await res.json()) as { envConfigured?: boolean };
    if (body.envConfigured !== true) return false;
    const auth = await page.request.get(`${SUPABASE_URL}/auth/v1/health`, {
      timeout: 3_000,
      headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : undefined,
    });
    return auth.ok();
  } catch {
    return false;
  }
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(requireStudentPassword());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 });
}

test.describe("shell per peran", () => {
  test("murid: sidebar + pengaturan + drawer mobile", async ({ page }) => {
    test.skip(!(await isBackendReady(page)), "Backend tidak aktif.");
    await login(page, "murid01@demo.local");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/learn");
    const aside = page.locator("aside");
    await expect(aside.getByRole("link", { name: "Katalog" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Pengaturan" })).toBeVisible();
    await expect(aside.getByRole("button", { name: "Keluar" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Akun & preferensi" })).toBeVisible();
    await expect(page.getByText("murid01@demo.local")).toBeVisible();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/learn");
    await expect(page.getByRole("button", { name: "Buka navigasi" })).toBeVisible();
    await page.getByRole("button", { name: "Buka navigasi" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review" })).toBeVisible();
  });

  test("guru: nav lengkap + admin + keluar berfungsi", async ({ page }) => {
    test.skip(!(await isBackendReady(page)), "Backend tidak aktif.");
    await login(page, "guru@demo.local");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/teacher");
    const aside = page.locator("aside");
    for (const name of ["Dasbor", "Kelas", "Penilaian", "Bank Soal", "Analitik", "Admin"]) {
      await expect(aside.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await page.goto("/settings");
    await expect(page.getByText("guru@demo.local")).toBeVisible();
    // Tombol Keluar di panel Sesi (sidebar sudah dicek di atas; sudut kiri-bawah
    // viewport dev ditempati indikator devtools Next yang menutup klik).
    await page.locator("main").getByRole("button", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("wali: ringkasan + pengaturan", async ({ page }) => {
    test.skip(!(await isBackendReady(page)), "Backend tidak aktif.");
    await login(page, "wali@demo.local");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/guardian");
    const aside = page.locator("aside");
    await expect(aside.getByRole("link", { name: "Ringkasan" })).toBeVisible();
    await expect(aside.getByRole("button", { name: "Keluar" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByText("wali@demo.local")).toBeVisible();
  });
});
