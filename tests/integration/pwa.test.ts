import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = readFileSync("public/manifest.json", "utf8");
const sw = readFileSync("public/sw.js", "utf8");

describe("PWA: manifest.json", () => {
  it("has required fields", () => {
    const m = JSON.parse(manifest);
    expect(m.name).toBe("Coding School LMS");
    expect(m.short_name).toBeDefined();
    expect(m.start_url).toBeDefined();
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBeDefined();
    expect(m.icons).toBeDefined();
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });

  it("icons have correct sizes", () => {
    const m = JSON.parse(manifest);
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
});

describe("PWA: service worker", () => {
  it("has cache name and precache URLs", () => {
    expect(sw).toMatch(/CACHE_NAME/);
    expect(sw).toMatch(/PRECACHE_URLS/);
  });

  it("handles install event with precaching", () => {
    expect(sw).toMatch(/addEventListener\("install"/);
    expect(sw).toMatch(/cache\.addAll/);
    expect(sw).toMatch(/skipWaiting/);
  });

  it("cleans old caches on activate", () => {
    expect(sw).toMatch(/addEventListener\("activate"/);
    expect(sw).toMatch(/caches\.keys/);
    expect(sw).toMatch(/clients\.claim/);
  });

  it("uses network-first for API, cache-first for static", () => {
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/supabase/);
    expect(sw).toMatch(/caches\.match/);
  });

  it("skips non-GET and server actions", () => {
    expect(sw).toMatch(/request\.method !== "GET"/);
    expect(sw).toMatch(/Next-Action/);
  });
});
