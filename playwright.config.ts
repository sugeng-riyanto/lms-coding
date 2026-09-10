import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000", trace: "on-first-retry" },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
      animations: "disabled",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "visual-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // CI (hermetic, tanpa .env): Playwright menjalankan `next dev` sendiri di
  // :3000 dalam mode demo (env Supabase absen → login/alur session di-skip,
  // spec publik/responsif jalan). Untuk memakai server eksternal (mis. dev
  // lokal yang sudah hidup atau deployment preview), set E2E_BASE_URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- -p 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
