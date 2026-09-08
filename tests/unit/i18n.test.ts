import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMON, DEFAULT_LANG, EYEBROW, isLang, NAV, pick, t } from "@/lib/i18n";
import { setLanguageSchema } from "@/lib/validation";
import { DASH } from "@/lib/ui-text/dash";
import { CERT } from "@/lib/ui-text/cert";
import { ANALYTICS } from "@/lib/ui-text/analytics";
import { LEARN } from "@/lib/ui-text/learn";
import { CHART_TEXT } from "@/components/charts";
import { STATE_TEXT } from "@/components/dashboard";

/** Flatten a nested dictionary ({ id, en } pairs) into the set of pairs. */
function pairs(dict: Record<string, unknown>): Array<{ id: string; en: string }> {
  const out: Array<{ id: string; en: string }> = [];
  for (const v of Object.values(dict)) {
    if (v && typeof v === "object" && "id" in v && "en" in v) {
      out.push(v as { id: string; en: string });
    }
  }
  return out;
}

describe("i18n dictionary parity (every key in both languages)", () => {
  for (const [name, dict] of [
    ["NAV", NAV],
    ["EYEBROW", EYEBROW],
    ["COMMON", COMMON],
  ] as const) {
    it(`${name}: every entry has non-empty id and en`, () => {
      const list = pairs(dict as unknown as Record<string, unknown>);
      expect(list.length).toBeGreaterThan(0);
      for (const p of list) {
        expect(p.id.trim().length, `id empty for ${name}`).toBeGreaterThan(0);
        expect(p.en.trim().length, `en empty for ${name}`).toBeGreaterThan(0);
      }
    });

    it(`${name}: id and en are never identical strings (real translation, not a copy)`, () => {
      // Proper nouns that are identical by design (language autonyms, brands).
      const identicalOk = new Set(["Bahasa Indonesia", "Export CSV"]);
      for (const p of pairs(dict as unknown as Record<string, unknown>)) {
        // Abbreviations / proper nouns may coincide (e.g. "Security", "Email");
        // only flag exact duplicates of multi-word phrases. Template strings
        // with placeholders are language-neutral fragments (e.g. " · tx {ref}").
        if (p.id.includes("{")) continue;
        if (p.id.split(" ").length > 1 && p.id === p.en && !identicalOk.has(p.id)) {
          expect(p.id, `"${p.id}" identical in both languages`).not.toBe(p.en);
        }
      }
    });
  }

  it("all NAV/EYEBROW/COMMON keys are reachable through t()", () => {
    for (const lang of ["id", "en"] as const) {
      for (const key of Object.keys({ ...NAV, ...EYEBROW, ...COMMON })) {
        const v = t(key as keyof typeof COMMON, lang);
        expect(v.length).toBeGreaterThan(0);
        expect(v).not.toBe(key); // fallback to key means the entry is missing
      }
    }
  });
});

describe("page dictionaries (lib/ui-text + kit) parity — 100% UI strings dua bahasa", () => {
  const pageDicts = [
    ["DASH", DASH],
    ["CERT", CERT],
    ["ANALYTICS", ANALYTICS],
    ["LEARN", LEARN],
    ["CHART_TEXT", CHART_TEXT],
    ["STATE_TEXT", STATE_TEXT],
  ] as const;

  for (const [name, dict] of pageDicts) {
    it(`${name}: setiap key punya id + en non-empty`, () => {
      const list = pairs(dict as unknown as Record<string, unknown>);
      expect(list.length).toBeGreaterThan(0);
      for (const p of list) {
        expect(p.id.trim().length, `id empty for ${name}`).toBeGreaterThan(0);
        expect(p.en.trim().length, `en empty for ${name}`).toBeGreaterThan(0);
      }
    });

    it(`${name}: id/en tidak identik untuk frasa multi-kata (bukan salinan)`, () => {
      // Istilah serapan yang memang identik (brand/kata teknis internasional).
      const identicalOk = new Set([
        "Export CSV",
        "Anchor batch",
        "Item analysis",
        "Cohort",
        "Assessment",
        "Status",
        "Mastery",
        "Lesson",
        "PDF",
        "Audio",
        "Progress",
        "✓ On-track",
        "✓ anchor final",
        "anchor pending",
        "Admin: mapping",
      ]);
      for (const p of pairs(dict as unknown as Record<string, unknown>)) {
        if (p.id.includes("{")) continue; // placeholder fragments stay language-neutral
        if (p.id.split(" ").length > 1 && p.id === p.en && !identicalOk.has(p.id)) {
          expect(p.id, `"${p.id}" identical in both languages`).not.toBe(p.en);
        }
      }
    });
  }
});

describe("i18n helpers", () => {
  it("isLang accepts only 'id' and 'en'", () => {
    expect(isLang("id")).toBe(true);
    expect(isLang("en")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang("")).toBe(false);
  });

  it("pick returns the requested language value", () => {
    expect(pick({ id: "Masuk", en: "Sign in" }, "id")).toBe("Masuk");
    expect(pick({ id: "Masuk", en: "Sign in" }, "en")).toBe("Sign in");
  });

  it("default language is Indonesian (backwards compatible)", () => {
    expect(DEFAULT_LANG).toBe("id");
  });
});

describe("profiles.language migration (20260908000002)", () => {
  const sql = readFileSync("supabase/migrations/20260908000002_user_language_preference.sql", "utf8");

  it("adds profiles.language with default 'id'", () => {
    expect(sql).toMatch(/add column language text not null default 'id'/i);
  });

  it("constrains language to ('id','en')", () => {
    expect(sql).toMatch(/check \(language in \('id', 'en'\)\)/i);
  });

  it("relies on the existing self-update RLS policy (no new broad UPDATE policy)", () => {
    // Per-user preference must stay self-service: the migration must NOT open
    // a new update path beyond the existing own-row policy.
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/grant update/i);
  });
});

describe("setLanguage server action validation", () => {
  it("accepts 'id' and 'en'", () => {
    expect(setLanguageSchema.safeParse({ lang: "id" }).success).toBe(true);
    expect(setLanguageSchema.safeParse({ lang: "en" }).success).toBe(true);
  });

  it("rejects unknown languages and malformed payloads", () => {
    expect(setLanguageSchema.safeParse({ lang: "fr" }).success).toBe(false);
    expect(setLanguageSchema.safeParse({}).success).toBe(false);
    expect(setLanguageSchema.safeParse({ lang: "EN" }).success).toBe(false);
    expect(setLanguageSchema.safeParse(null).success).toBe(false);
  });
});
