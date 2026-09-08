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
  it("CSP nonce-based hidup di proxy.ts/lib/csp.ts; next.config memegang header dasar", () => {
    // CSP TIDAK boleh statis di next.config (di-union dengan nonce policy dan
    // memblokir semua script) — harus di proxy.ts via lib/csp.ts.
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).not.toMatch(/Content-Security-Policy/);
    expect(cfg).toMatch(/X-Frame-Options/);
    expect(cfg).toMatch(/X-Content-Type-Options/);

    const proxy = readFileSync("proxy.ts", "utf8");
    expect(proxy).toMatch(/x-nonce/);
    expect(proxy).toMatch(/cspHeaderName/);
    expect(proxy).toMatch(/CSP_REPORT_ONLY/);

    const csp = readFileSync("lib/csp.ts", "utf8");
    expect(csp).toMatch(/nonce-/);
    expect(csp).toMatch(/strict-dynamic/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/youtube-nocookie\.com/);
    expect(csp).toMatch(/docs\.google\.com/);
    expect(csp).toMatch(/\*\.supabase\.co/);
    expect(csp).toMatch(/report-uri/);
    expect(csp).toMatch(/CSP_REPORT_ENDPOINT/);
  });
});

describe("P11: error boundaries dasar", () => {
  it("error.tsx + not-found.tsx ada dan tanpa stack ke user", async () => {
    const err = readFileSync("app/error.tsx", "utf8");
    expect(err).toMatch(/reset/);
    expect(err).not.toMatch(/error\.stack/);
    // i18n-driven shell: references the pageNotFound dictionary key (both langs)
    expect(readFileSync("app/not-found.tsx", "utf8")).toMatch(/COMMON\.pageNotFound\[/);
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

describe("P11: sertifikat PDF — tanda tangan digital penerbit", () => {
  it("PDF memuat nama penandatangan resmi + label penerbit + fingerprint", () => {
    const src = readFileSync("app/api/certificates/[publicId]/pdf/route.ts", "utf8");
    expect(src).toMatch(/Sugeng Riyanto, M\.Sc\./);
    expect(src).toMatch(/Certificate Issuer/);
    expect(src).toMatch(/layout: "landscape"/);
    expect(src).toMatch(/payload_hash\.slice\(0, 12\)/);
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
