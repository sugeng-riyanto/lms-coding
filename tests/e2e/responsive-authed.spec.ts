import { test, expect, type Page } from "@playwright/test";

/**
 * Responsive layout gate untuk route TEROTENTIKASI (peran murid/guru/wali).
 *
 * Melengkapi `responsive.spec.ts` (publik) untuk janji "responsif di semua device"
 * di kelas nyata: dashboard murid (/learn, /catalog, /review), kuis (locked view),
 * dasbor guru (/teacher, /teacher/analytics, /teacher/grading), dan portal wali
 * (/guardian) diukur @360/768/1440 dengan kriteria yang sama (tanpa horizontal
 * overflow, tanpa elemen melewati tepi kanan, tanpa container meng-clip).
 *
 * Butuh backend hidup + seed (akun demo). Tanpa backend: seluruh test di-skip
 * dengan alasan eksplisit — bukan gagal (pola critical.spec.ts).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

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

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill("DemoPass-2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 });
}

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 640 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

// Attempt seed murid01 yang sudah disubmit (locked view deterministik).
const SUBMITTED_QUIZ = "/quiz/36c1dfa1-ff0a-4595-898e-c9cc5734086b";

const ROLE_ROUTES = [
  { role: "murid", email: "murid01@demo.local", paths: ["/learn", "/catalog", "/review", SUBMITTED_QUIZ] },
  {
    role: "guru",
    email: "guru@demo.local",
    paths: [
      "/teacher",
      "/teacher/analytics",
      "/teacher/grading",
      "/teacher/certificates",
      "/teacher/cohorts",
    ],
  },
  { role: "wali", email: "wali@demo.local", paths: ["/guardian"] },
] as const;

test.describe("responsive authed: tanpa overflow horizontal", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.name} (${vp.width}px)`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const { role, email, paths } of ROLE_ROUTES) {
        for (const path of paths) {
          test(`${role} ${path}`, async ({ page }) => {
            test.skip(
              !(await isBackendReady(page)),
              "Backend Supabase tidak aktif. Seed + langkah: docs/e2e-setup.md.",
            );
            await login(page, email);
            const res = await page.goto(path);
            expect(res?.status(), `${path} HTTP`).toBe(200);
            await page.evaluate(() => document.fonts.ready);

            const m = await page.evaluate(() => {
              const vw = window.innerWidth;
              const docOverflow =
                Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - vw;
              const isTiny = (el: Element) => {
                const r = el.getBoundingClientRect();
                return r.width <= 1 || r.height <= 1;
              };
              const describe = (el: Element, extra: string): string => {
                const tag = el.tagName.toLowerCase();
                const id = el.id ? `#${el.id}` : "";
                const cls = el.classList.length ? `.${[...el.classList].slice(0, 3).join(".")}` : "";
                const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
                return `${tag}${id}${cls}${text ? ` "${text}"` : ""} ${extra}`;
              };
              const wide = [...document.querySelectorAll("body *")]
                .filter((el) => !isTiny(el))
                .filter((el) => el.getBoundingClientRect().right > vw + 1)
                .map((el) => describe(el, `right=${Math.round(el.getBoundingClientRect().right)}px`));
              const clippers = [...document.querySelectorAll("body *")]
                .filter((el) => {
                  if (isTiny(el)) return false;
                  const s = getComputedStyle(el);
                  return ["auto", "scroll", "hidden", "clip"].includes(s.overflowX);
                })
                .filter((el) => el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1)
                .map((el) => describe(el, `scrollW=${el.scrollWidth} clientW=${el.clientWidth}`));
              const meta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
              const hasText = (document.body?.innerText ?? "").trim().length > 0;
              return { docOverflow, wide, clippers, meta, hasText };
            });

            expect(m.hasText, `${path} merender konten (tidak vakum)`).toBe(true);
            expect(m.meta, `${path} punya viewport meta`).toMatch(/width=device-width/);
            expect(
              m.docOverflow,
              `${path} overflow dokumen (${m.docOverflow}px) — cek elemen right > viewport`,
            ).toBeLessThanOrEqual(1);
            expect(m.wide, `${path} elemen melewati tepi kanan: ${m.wide.join("; ")}`).toEqual([]);
            expect(m.clippers, `${path} container overflow-x meng-clip: ${m.clippers.join("; ")}`).toEqual(
              [],
            );
          });
        }
      }
    });
  }
});
