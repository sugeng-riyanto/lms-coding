import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const ownFiles = walk("app").concat(walk("lib"), walk("features"), walk("components"));
const ownSource = ownFiles.map((f) => ({ f, src: readFileSync(f, "utf8") }));
const clients = ownSource.filter(({ src }) => src.includes('"use client"'));
const students = ownSource.filter(({ f }) => f.includes("app/(student)"));

describe("P11: CSP + secure headers", () => {
  it("next.config.ts menetapkan CSP, frame-ancestors none, nosniff", () => {
    const src = readFileSync("next.config.ts", "utf8");
    expect(src).toMatch(/Content-Security-Policy/);
    expect(src).toMatch(/frame-ancestors 'none'|X-Frame-Options/);
    expect(src).toMatch(/X-Content-Type-Options/);
  });
});

describe("P11: error boundaries dasar", () => {
  it("error.tsx + not-found.tsx ada dan tanpa stack ke user", async () => {
    const err = readFileSync("app/error.tsx", "utf8");
    expect(err).toMatch(/reset/);
    expect(err).not.toMatch(/error\.stack/);
    expect(readFileSync("app/not-found.tsx", "utf8")).toMatch(/tidak ditemukan/i);
  });
});

describe("P11: secret tidak bocor ke client bundle", () => {
  it("tidak ada file client mereferensikan secret/service key", () => {
    for (const { f, src } of clients) {
      expect(src, f).not.toMatch(/SUPABASE_SECRET_KEY|CERTIFICATE_SIGNING_SECRET|ROBLOX_WEBHOOK_SECRET/);
      expect(src, f).not.toMatch(/supabase\/service/);
    }
  });
  it("service client dijaga: tolak browser + butuh env server", async () => {
    expect(readFileSync("lib/supabase/service.ts", "utf8")).toMatch(/typeof window !== "undefined"/);
    const { createServiceClient } = await import("@/lib/supabase/service");
    expect(() => createServiceClient()).toThrow();
  });
});

describe("P11: answer key tidak ke browser murid", () => {
  it("komponen murid tidak menyentuh grading_json/autoGrade", () => {
    for (const { f, src } of students) {
      expect(src, f).not.toMatch(/grading_json|autoGrade|correctOptionId/);
    }
  });
});

describe("P11: rate limit di endpoint sensitif", () => {
  it("verify, qr, pdf, export, roblox, submit memakai checkRateLimit", () => {
    for (const f of [
      "app/api/public/certificates/[publicId]/route.ts",
      "app/api/certificates/[publicId]/qr/route.ts",
      "app/api/certificates/[publicId]/pdf/route.ts",
      "app/api/teacher/export/route.ts",
      "app/api/integrations/roblox/completions/route.ts",
    ]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/checkRateLimit/);
    }
    expect(readFileSync("features/actions.ts", "utf8")).toMatch(/checkRateLimit\(`submit:/);
  });
});

describe("P11: upload protection", () => {
  it("allowlist MIME + batas size di UploadBox", () => {
    const src = readFileSync("components/upload-box.tsx", "utf8");
    expect(src).toMatch(/application\/pdf/);
    expect(src).toMatch(/MAX_BYTES|10 \* 1024 \* 1024/);
    expect(src).toMatch(/upsert: false/);
  });
});
