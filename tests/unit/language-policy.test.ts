import { readFileSync } from "node:fs";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import {
  INDONESIAN_UI_WORDS,
  INDO_WORD_RE,
  noIndonesianShellText,
} from "../../tools/eslint-rules/no-indonesian-shell-text.mjs";

/**
 * Kebijakan bahasa UI (docs/language-policy.md): shell publik WAJIB English;
 * dashboard peran sengaja Bahasa Indonesia. Rule `lms/no-indonesian-shell-text`
 * aktif pada path shell DAN pada permukaan yang sudah bilingual penuh
 * (TRANSLATED_SURFACES di bawah, disinkronkan dengan eslint.config.mjs): di
 * sana literal Indonesia hardcoded adalah regresi — string baru harus masuk
 * dictionary lib/ui-text dan dipakai via t()/mkT.
 */

// Keep in sync with eslint.config.mjs TRANSLATED_SURFACES.
const TRANSLATED_SURFACES = [
  "app/(teacher)/teacher/page.{ts,tsx}",
  "app/(teacher)/teacher/alert-controls.{ts,tsx}",
  "app/(teacher)/teacher/analytics/**/*.{ts,tsx}",
  "app/(teacher)/teacher/certificates/**/*.{ts,tsx}",
  "app/(student)/learn/**/*.{ts,tsx}",
  "components/charts.{ts,tsx}",
  "components/dashboard.{ts,tsx}",
  "components/anchor-status.{ts,tsx}",
];

function lint(code: string): string[] {
  const linter = new Linter({ configType: "flat" });
  const messages = linter.verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { lms: { rules: { "no-indonesian-shell-text": noIndonesianShellText } } },
        rules: { "lms/no-indonesian-shell-text": "error" },
      },
    ],
    { filename: "app/public-probe.tsx" },
  );
  return messages.map((m) => m.message);
}

describe("lms/no-indonesian-shell-text (Linter)", () => {
  it("passes English shell copy", () => {
    expect(lint("export default function T(){return <p>Valid certificate</p>;}")).toEqual([]);
    expect(
      lint('export default function T(){return <button aria-label="Toggle light/dark theme">☰</button>;}'),
    ).toEqual([]);
    expect(
      lint("export default function T(){return <p>Sign in with the account provided by your school.</p>;}"),
    ).toEqual([]);
  });

  it("flags Indonesian UI words in JSX text", () => {
    expect(lint("export default function T(){return <p>Verifikasi sertifikat</p>;}")).toHaveLength(1);
    expect(lint("export default function T(){return <p>Halaman tidak ditemukan</p>;}")).toHaveLength(1);
  });

  it("flags Indonesian words in aria-label/alt/placeholder literals", () => {
    const attr = lint('export default function T(){return <p aria-label="Buka navigasi">☰</p>;}');
    expect(attr).toHaveLength(1);
    const alt = lint('export default function T(){return <img alt="Muat ulang" src="x" />;}');
    expect(alt).toHaveLength(1);
  });

  it("does not flag English text or near-homographs", () => {
    expect(
      lint("export default function T(){return <p>Loading progress for level one, course two.</p>;}"),
    ).toEqual([]);
    expect(
      lint("export default function T(){return <p>Open the certificate PDF (2 pages) below.</p>;}"),
    ).toEqual([]);
    expect(lint('export default function T(){return <p title="Service status">Status</p>;}')).toEqual([]);
  });
});

describe("language policy invariants", () => {
  it("word list is non-empty and every entry matches its own regex", () => {
    expect(INDONESIAN_UI_WORDS.length).toBeGreaterThan(30);
    for (const w of INDONESIAN_UI_WORDS) {
      expect(INDO_WORD_RE.test(w)).toBe(true);
    }
  });

  it("multi-word phrases are matched as whole phrases", () => {
    expect(INDO_WORD_RE.test("kata sandi")).toBe(true);
    expect(INDO_WORD_RE.test("tidak ditemukan")).toBe(true);
  });

  it("does not false-positive on English near-homographs", () => {
    for (const s of ["Service status", "Level 1 — Fondasi", "Course catalog", "student data"]) {
      expect(INDO_WORD_RE.test(s)).toBe(false);
    }
  });

  it("flags common Indonesian UI words", () => {
    for (const s of ["Masuk", "Sertifikat", "Analitik kelas", "Antrian penilaian", "Pengaturan"]) {
      expect(INDO_WORD_RE.test(s)).toBe(true);
    }
  });
});

describe("eslint.config.mjs: translated surfaces are gated too", () => {
  it("applies lms/no-indonesian-shell-text to TRANSLATED_SURFACES (not just shells)", () => {
    const cfg = readFileSync("eslint.config.mjs", "utf8");
    expect(cfg).toMatch(/TRANSLATED_SURFACES/);
    for (const pattern of TRANSLATED_SURFACES) {
      // Every surface pattern appears in the config AND is wired to the rule.
      expect(cfg, `missing pattern ${pattern}`).toContain(pattern);
    }
    // The translated block sits next to the shell block and enables the rule.
    const translatedBlock = cfg.slice(cfg.indexOf("TRANSLATED_SURFACES"));
    expect(translatedBlock).toMatch(/rules: \{ "lms\/no-indonesian-shell-text": "warn" \}/);
  });

  it("still ignores the bilingual ternary idiom (expression containers are dynamic)", () => {
    expect(lint('export default function T(){return <p>{l === "id" ? "Tema:" : "Theme:"}</p>;}')).toEqual([]);
  });
});
