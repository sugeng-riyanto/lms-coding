import { test, expect, type Page } from "@playwright/test";

/**
 * E2E critical path (lihat docs/e2e-setup.md).
 *
 * Dua mode:
 * - Backend MATI (sandbox/CI tanpa Supabase): smoke publik + verifier demo
 *   (fallback deterministik) selalu dijalankan. Alur yang butuh session di-skip
 *   dengan alasan eksplisit — bukan gagal.
 * - Backend HIDUP (Supabase lokal + seed, lihat docs/e2e-setup.md): deteksi via
 *   GET /api/health (envConfigured=true), lalu login murid seed dan verifikasi
 *   dashboard /learn.
 */

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "murid01@demo.local";
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD ?? "DemoPass-2026!";

/** Backend siap bila /api/health 200 dan melaporkan env terkonfigurasi. */
async function isBackendReady(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get("/api/health");
    if (!res.ok()) return false;
    const body = (await res.json()) as { envConfigured?: boolean };
    return body.envConfigured === true;
  } catch {
    return false;
  }
}

test("landing → login shell (public, tanpa backend)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Belajar mandiri/i })).toBeVisible();
  await page.getByRole("link", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
});

test("keyboard-only: Tab memunculkan skip-link dalam fokus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Lewati ke konten utama" })).toBeFocused();
});

test("student login → dashboard /learn (butuh Supabase lokal + seed)", async ({ page }) => {
  test.skip(
    !(await isBackendReady(page)),
    "Backend Supabase tidak aktif di environment ini. Seed + langkah: docs/e2e-setup.md.",
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill(STUDENT_EMAIL);
  await page.getByLabel("Kata sandi").fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();

  // Login sukses → redirect /learn; dashboard murid merender heading utama.
  await expect(page).toHaveURL(/\/learn/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Target hari ini/ })).toBeVisible();
});

test("public verifier demo tidak bocor PII", async ({ page }) => {
  const backend = await isBackendReady(page);
  const res = await page.request.get("/api/public/certificates/demo-valid-certificate");

  // Kontrak inti: TIDAK ADA PII (email/password/answer) dalam bentuk apa pun.
  const text = await res.text();
  expect(text).not.toMatch(/email|password|answer/i);

  if (!backend) {
    // Tanpa DB, route memakai fallback demo deterministik → 200 + status valid.
    expect(res.status()).toBe(200);
    const body = JSON.parse(text) as { status?: string };
    expect(body.status).toBe("valid");
    return;
  }

  // Dengan DB hidup: seed demo certificate (docs/e2e-setup.md) menghasilkan 200;
  // sampai RLS anon certificates_public diperbaiki (Phase 6), anon mendapat 404
  // tanpa PII — keduanya boleh, PII dilarang.
  expect([200, 404]).toContain(res.status());
});
