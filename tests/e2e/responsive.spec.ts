import { test, expect } from "@playwright/test";

/**
 * Responsive layout gate (menutup gap Phase 7 "uji 2 viewport ... E2E browser").
 *
 * Memformalkan audit ad-hoc @360/768/1440 (0 horizontal overflow di semua route
 * publik) menjadi spec E2E yang di-commit. Untuk tiap route publik × viewport:
 *   1. Tidak ada horizontal overflow dokumen (html/body scrollWidth == lebar viewport).
 *   2. Tidak ada elemen terlihat yang melewati tepi kanan viewport.
 *   3. Tidak ada container overflow-x yang meng-clip kontennya (sr-only 1px diabaikan).
 *   4. Viewport meta `width=device-width` ada (rendering mobile sungguhan).
 *
 * Route yang diukur adalah halaman publik (tanpa session): /, /login, /health,
 * /unauthorized, dan /verify/<publicId> — state halaman boleh berbeda-beda
 * tergantung backend (mis. /verify render state valid/404), yang diuji tetap
 * layout-nya: tidak boleh ada overflow apa pun yang dirender.
 */

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 640 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const ROUTES = ["/", "/login", "/health", "/unauthorized", "/verify/demo-valid-certificate"] as const;

test.describe("responsive: tidak ada overflow horizontal", () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.name} (${vp.width}px)`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const path of ROUTES) {
        test(`${path}`, async ({ page }) => {
          const res = await page.goto(path);
          // Layout final setelah font siap (swap bisa menggeser ukuran teks).
          await page.evaluate(() => document.fonts.ready);

          const m = await page.evaluate(() => {
            const vw = window.innerWidth;
            const docOverflow =
              Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - vw;
            const isTiny = (el: Element) => {
              const r = el.getBoundingClientRect();
              return r.width <= 1 || r.height <= 1; // sr-only / offscreen sengaja
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

          // Route non-200 (mis. /verify/<id> tanpa row: notFound() → fallback 404
          // Next yang bodynya kosong di dev) tidak punya konten layout untuk diukur;
          // hanya overflow dokumen yang tetap dicek. State 200 (mode demo tanpa env,
          // atau backend hidup + row terbaca) menjalankan audit penuh.
          if (res && res.status() !== 200) {
            test.info().annotations.push({
              type: "state",
              description: `HTTP ${res.status()} (fallback tanpa konten) — audit konten dilewati; hanya overflow dicek`,
            });
            expect(m.docOverflow).toBeLessThanOrEqual(1);
            return;
          }

          expect(m.hasText, `${path} merender konten (tidak vakum)`).toBe(true);
          expect(m.meta, `${path} punya viewport meta`).toMatch(/width=device-width/);
          // Toleransi 1px (sub-pixel rounding); audit menemukan 0 overflow.
          expect(
            m.docOverflow,
            `${path} overflow dokumen (${m.docOverflow}px) — cek elemen right > viewport`,
          ).toBeLessThanOrEqual(1);
          expect(m.wide, `${path} elemen melewati tepi kanan viewport: ${m.wide.join("; ")}`).toEqual([]);
          expect(
            m.clippers,
            `${path} container overflow-x meng-clip konten: ${m.clippers.join("; ")}`,
          ).toEqual([]);
        });
      }
    });
  }
});
