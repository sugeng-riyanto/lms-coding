/**
 * nav-routes.test.ts — Static assertion that every sidebar href resolves
 * to a real page.tsx route in app/. Catches broken links at test time,
 * before any user hits a 404.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* ── Discover all page routes from app/ ─────────────────────────────── */

function findPageRoutes(dir: string, base: string): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    // Normalize to forward slashes for URL-style comparison
    const rel = join(base, entry).split("\\").join("/");
    if (entry === "page.tsx" || entry === "page.ts") {
      // Convert filesystem path to URL route.
      // Strip route groups like (auth), (student), (teacher), (guardian), (public)
      let route = rel
        .replace(/\/?page\.tsx$/, "")
        .replace(/\/?page$/, "")
        .replace(/\([^/]+\)\//g, "") // strip (group)/ segments
        .replace(/\([^/]+\/?$/, "") // strip leading (group) without trailing /
        .replace(/\[([^\]]+)\]/g, ":$1") // [id] → :id
        .replace(/\/+/g, "/") // collapse double slashes
        .replace(/\/$/, ""); // remove trailing slash
      if (!route.startsWith("/")) route = "/" + route;
      routes.push(route || "/");
    } else if (statSync(full).isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
      routes.push(...findPageRoutes(full, rel));
    }
  }
  return routes;
}

const appDir = join(process.cwd(), "app");
const allRoutes = findPageRoutes(appDir, "");

/* ── Import the nav definition ──────────────────────────────────────── */

import { navForRole } from "@/lib/role-nav";

const studentNav = navForRole("student", false, "en");
const teacherNav = navForRole("teacher", true, "en");
const guardianNav = navForRole("guardian", false, "en");

const allNavItems = [...studentNav, ...teacherNav, ...guardianNav];
const allHrefs = [...new Set(allNavItems.map((n) => n.href))];

/** Check if a nav href matches any discovered route. */
function routeExists(href: string): boolean {
  return allRoutes.some(
    (r) => r === href || r.startsWith(href + "/") || href.startsWith(r + "/"),
  );
}

/* ── Tests ──────────────────────────────────────────────────────────── */

describe("Nav links resolve to real routes", () => {
  for (const href of allHrefs) {
    it(`${href} has a page.tsx in app/`, () => {
      expect(
        routeExists(href),
        `Nav href "${href}" does not match any route in app/. Available routes:\n${allRoutes.join("\n")}`,
      ).toBe(true);
    });
  }
});

describe("Landing page links resolve to real routes", () => {
  const landingHrefs = ["/login", "/learn", "/teacher", "/guardian", "/catalog", "/settings"];
  for (const href of landingHrefs) {
    it(`${href} has a page.tsx in app/`, () => {
      expect(routeExists(href), `Landing href "${href}" has no matching route`).toBe(true);
    });
  }
});

describe("Dashboard hub links resolve", () => {
  const hubHrefs = ["/learn", "/teacher", "/guardian", "/profile"];
  for (const href of hubHrefs) {
    it(`${href} has a page.tsx in app/`, () => {
      expect(routeExists(href), `Dashboard hub href "${href}" has no matching route`).toBe(true);
    });
  }
});

describe("Every page.tsx route is reachable from at least one nav or hub link", () => {
  it("all static routes are in the nav or hub", () => {
    const navAndHub = new Set([
      ...allHrefs,
      "/login",
      "/learn",
      "/teacher",
      "/guardian",
      "/catalog",
      "/settings",
      "/profile",
      "/dashboard",
      "/health",
      "/unauthorized",
      "/account-inactive",
      "/",
    ]);

    // Skip dynamic routes like /:param or /activities/:id
    const orphanRoutes = allRoutes.filter((r) => {
      if (r.includes(":")) return false; // dynamic routes — skip
      return !navAndHub.has(r) && ![...navAndHub].some((h) => r.startsWith(h + "/"));
    });

    expect(orphanRoutes, `Routes with no nav link: ${orphanRoutes.join(", ")}`).toEqual([]);
  });
});
