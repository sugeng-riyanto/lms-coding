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

/** URL Supabase (sama dengan .env.example) — dipakai untuk cek koneksi nyata. */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
/** Hosted GoTrue menolak probe tanpa header apikey (401); lokal mengabaikannya. */
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Backend siap bila /api/health ready (env valid) DAN Supabase benar-benar
 * terjangkau. Env placeholder (mis. hasil `cp .env.example .env` tanpa stack
 * lokal) membuat /api/health tetap 200 — probe koneksi mencegah false-ready
 * sehingga test login di-skip, bukan gagal.
 */
async function supabaseReachable(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get(`${SUPABASE_URL}/auth/v1/health`, {
      timeout: 3_000,
      headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : undefined,
    });
    return res.ok();
  } catch {
    return false;
  }
}

async function isBackendReady(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get("/api/health");
    if (!res.ok()) return false;
    const body = (await res.json()) as { envConfigured?: boolean };
    return body.envConfigured === true && (await supabaseReachable(page));
  } catch {
    return false;
  }
}

test("landing → login shell (public, tanpa backend)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Belajar coding secara mandiri/i })).toBeVisible();
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
  const res = await page.request.get("/api/public/certificates/demo-valid-certificate");

  // Kontrak inti: TIDAK ADA PII (email/password/answer) dalam bentuk apa pun.
  const text = await res.text();
  expect(text).not.toMatch(/email|password|answer/i);

  const health = await page.request.get("/api/health");
  const healthBody = health.ok()
    ? ((await health.json()) as { envConfigured?: boolean })
    : { envConfigured: false };

  if (healthBody.envConfigured === false) {
    // Tanpa env (mode demo): strict client throw → fallback demo deterministik 200.
    expect(res.status()).toBe(200);
    const body = JSON.parse(text) as { status?: string };
    expect(body.status).toBe("valid");
    return;
  }

  // Env terkonfigurasi (placeholder tanpa DB, atau DB hidup): 200 hanya bila row
  // demo terbaca (seed + RLS anon Phase 6); tanpa itu 404. Keduanya tanpa PII.
  expect([200, 404]).toContain(res.status());
});
