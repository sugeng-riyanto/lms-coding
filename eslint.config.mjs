import flatConfig from "eslint-config-next/core-web-vitals";
import { noIndonesianShellText } from "./tools/eslint-rules/no-indonesian-shell-text.mjs";

/**
 * Rule lokal: larang hex hardcoded (#rrggbb) di dalam nilai className
 * komponen. Bayangan & gradien harus memakai token elevasi
 * (--shadow-soft / --shadow-lift / --glow-btn, kelas gradien palet, atau
 * --surface-grad-* untuk permukaan sidebar/drawer gelap). Lihat
 * docs/design-system.md.
 */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

// Path shell yang wajib English (lihat docs/language-policy.md).
const SHELL_FILES = [
  "app/(auth)/**/*.{ts,tsx}",
  "app/(public)/**/*.{ts,tsx}",
  "app/error.{ts,tsx}",
  "app/not-found.{ts,tsx}",
  "app/layout.{ts,tsx}",
  "app/page.{ts,tsx}",
  "app/health/**/*.{ts,tsx}",
  "app/unauthorized/**/*.{ts,tsx}",
  "app/account-inactive/**/*.{ts,tsx}",
  "components/theme-toggle.{ts,tsx}",
];

// Permukaan yang sudah bilingual penuh lewat t()/mkT + dictionary
// (lib/ui-text/{dash,cert,analytics,learn}): teks Indonesia BOLEH muncul,
// tetapi hanya via dictionary — literal Indonesia inline adalah regresi.
const TRANSLATED_SURFACES = [
  "app/(teacher)/teacher/page.{ts,tsx}",
  "app/(teacher)/teacher/alert-controls.{ts,tsx}",
  "app/(teacher)/teacher/analytics/**/*.{ts,tsx}",
  "app/(teacher)/teacher/certificates/**/*.{ts,tsx}",
  "app/(student)/learn/**/*.{ts,tsx}",
  "app/(student)/quiz/**/*.{ts,tsx}",
  "app/(student)/review/**/*.{ts,tsx}",
  "app/(student)/activities/**/*.{ts,tsx}",
  "app/(guardian)/**/*.{ts,tsx}",
  "app/profile/**/*.{ts,tsx}",
  "components/upload-box.{ts,tsx}",
  "components/charts.{ts,tsx}",
  "components/dashboard.{ts,tsx}",
  "components/anchor-status.{ts,tsx}",
];

function textOf(value) {
  if (!value) return null;
  if (value.type === "Literal" || value.type === "StringLiteral") {
    return typeof value.value === "string" ? value.value : null;
  }
  if (value.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis.map((q) => q.value.cooked ?? "").join("");
  }
  return null;
}

const noHardcodedElevationHex = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flags raw hex colors inside className that should use the elevation tokens",
      recommended: false,
    },
    messages: {
      rawHex:
        'Hex hardcoded "{{hex}}" di className. Pakai token elevasi (shadow-[var(--shadow-soft)] / var(--shadow-lift) / var(--glow-btn)), kelas gradien palet (from-…/to-…), atau --surface-grad-* untuk permukaan gelap — lihat docs/design-system.md.',
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      if (!text) return;
      const m = HEX_RE.exec(text);
      if (m?.[0]) {
        context.report({ node, messageId: "rawHex", data: { hex: m[0] } });
      }
    };
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== "className") return;
        const value = node.value;
        if (!value) return;
        if (value.type === "JSXExpressionContainer") {
          check(node, textOf(value.expression));
        } else {
          check(node, textOf(value));
        }
      },
    };
  },
};

const config = [
  ...flatConfig,
  {
    plugins: {
      lms: {
        rules: {
          "no-hardcoded-elevation-hex": noHardcodedElevationHex,
          "no-indonesian-shell-text": noIndonesianShellText,
        },
      },
    },
    rules: { "lms/no-hardcoded-elevation-hex": "warn" },
  },
  {
    files: SHELL_FILES,
    rules: { "lms/no-indonesian-shell-text": "warn" },
  },
  {
    files: TRANSLATED_SURFACES,
    rules: { "lms/no-indonesian-shell-text": "warn" },
  },
  {
    ignores: ["node_modules/**", ".next/**", "playwright-report/**", "test-results/**"],
  },
];

export default config;
