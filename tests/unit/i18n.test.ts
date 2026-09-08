import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMON, DEFAULT_LANG, EYEBROW, isLang, NAV, pick, t } from "@/lib/i18n";
import { setLanguageSchema } from "@/lib/validation";
import { DASH } from "@/lib/ui-text/dash";
import { CERT } from "@/lib/ui-text/cert";
import { ANALYTICS } from "@/lib/ui-text/analytics";
import { LEARN } from "@/lib/ui-text/learn";
import { CHART_TEXT, STATE_TEXT } from "@/lib/ui-text/chart-kit";
import { STUDENT_DETAIL } from "@/lib/ui-text/student-detail";
import { QUIZ } from "@/lib/ui-text/quiz";
import { REVIEW } from "@/lib/ui-text/review";
import { ACTIVITY } from "@/lib/ui-text/activity";
import { GUARDIAN } from "@/lib/ui-text/guardian";
import { PROFILE } from "@/lib/ui-text/profile";
import { UPLOAD } from "@/lib/ui-text/upload";

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
    ["STUDENT_DETAIL", STUDENT_DETAIL],
    ["QUIZ", QUIZ],
    ["REVIEW", REVIEW],
    ["ACTIVITY", ACTIVITY],
    ["GUARDIAN", GUARDIAN],
    ["PROFILE", PROFILE],
    ["UPLOAD", UPLOAD],
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
        "Spaced review",
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

  it("default UI language is English (English-first pilot; users opt into Indonesian)", () => {
    expect(DEFAULT_LANG).toBe("en");
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

describe("login-screen language persistence (pre-auth choice → profile)", () => {
  const loginPage = readFileSync("app/(auth)/login/page.tsx", "utf8");
  const loginForm = readFileSync("app/(auth)/login/login-form.tsx", "utf8");
  const actions = readFileSync("features/actions.ts", "utf8");
  const validation = readFileSync("lib/validation.ts", "utf8");

  it("persistLoginLanguage accepts only id/en (reuses the language enum)", () => {
    expect(validation).toMatch(
      /persistLoginLanguageSchema = z\.object\(\{\s*lang: z\.enum\(\["id", "en"\]\)/,
    );
  });

  it("login page resolves the profile language when a session exists, else the visitor cookie", () => {
    // profile wins for signed-in visitors: profiles.language is read per user id
    expect(loginPage).toMatch(/from\("profiles"\)\.select\("language"\)\.eq\("id", userId\)/);
    // cookie is only the anonymous fallback
    expect(loginPage).toMatch(/store\.get\(LANG_COOKIE\)/);
    // default is English when neither a profile value nor a cookie exists
    expect(loginPage).toMatch(/DEFAULT_LOGIN_LANG/);
  });

  it("login form persists the chosen language after a successful sign-in (best-effort)", () => {
    expect(loginForm).toMatch(/signInWithPassword/);
    expect(loginForm).toMatch(/persistLoginLanguage\(\{ lang \}\)/);
    // The visitor can pick before submitting (toggle writes the cookie).
    expect(loginForm).toMatch(/LANG_COOKIE}=/);
  });

  it("the action validates, is idempotent, and only lets a NON-default stored preference win", () => {
    const fn = actions.slice(actions.indexOf("export async function persistLoginLanguage"));
    const body = fn.slice(0, fn.indexOf("\n// ---------- Course authoring"));
    expect(body).toContain("persistLoginLanguageSchema.safeParse");
    expect(body).toContain('"UNAUTHENTICATED"');
    // Same language stored → no write (idempotent).
    expect(body).toContain("existing === lang");
    // Explicit non-default (en) is authoritative over the visitor cookie.
    expect(body).toContain('existing === "en"');
    expect(body).toContain("store.set(LANG_COOKIE, existing");
    // Fresh account (default 'id') persists the visitor's choice.
    expect(body).toContain('from("profiles").update({ language: lang }).eq("id", userId)');
  });
});
