import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Modernisasi dashboard (presentasi saja — query/RLS tidak berubah):
 * ketiga dashboard peran memakai kit visual yang sama + aria progressbar.
 * Copy UI hidup di dictionary per-halaman (lib/ui-text/*) agar kedua bahasa
 * (id/en) tercakup; halaman memanggil getLang() + mkT(dict, lang).
 */

const learn = readFileSync("app/(student)/learn/page.tsx", "utf8");
const teacher = readFileSync("app/(teacher)/teacher/page.tsx", "utf8");
const guardian = readFileSync("app/(guardian)/guardian/page.tsx", "utf8");
const kit = readFileSync("components/dashboard.tsx", "utf8");
const learnText = readFileSync("lib/ui-text/learn.ts", "utf8");
const dashText = readFileSync("lib/ui-text/dash.ts", "utf8");

describe("kit dipakai ketiga dashboard", () => {
  it("learn/teacher/guardian mengimpor dari components/dashboard", () => {
    for (const src of [learn, teacher, guardian]) {
      expect(src).toMatch(/from "@\/components\/dashboard"/);
    }
  });

  it("kit menyediakan StatCard + ProgressRing + MeterBar + StateBadge ber-aria", () => {
    for (const name of ["StatCard", "ProgressRing", "MeterBar", "StateBadge"]) {
      expect(kit).toContain(`export function ${name}`);
    }
    expect(kit).toMatch(/role="progressbar"/);
    expect(kit).toMatch(/aria-valuenow/);
  });
});

describe("murid /learn — hero + journey (bilingual dictionary)", () => {
  it("copy hero/journey ada dua bahasa di dictionary per-halaman, dan halaman memakainya", () => {
    expect(learnText).toMatch(/nextStep: \{ id: "Langkah berikutnya", en: "Next step"/);
    expect(learnText).toMatch(/pathTitle: \{ id: "Jalur level", en: "Level path"/);
    expect(learnText).toMatch(/openLevel: \{ id: "Buka level", en: "Open level"/);
    // Halaman menarik bahasa dari getLang() lalu memakai dictionary.
    expect(learn).toMatch(/getLang\(\)/);
    expect(learn).toMatch(/mkT\(LEARN, lang\)/);
    expect(learn).toMatch(/import \{ LEARN \} from "@\/lib\/ui-text\/learn"/);
  });

  it("hero rekomendasi + ring mingguan + journey level tetap dirender", () => {
    expect(learn).toMatch(/ProgressRing/);
    expect(learn).not.toMatch(/Halo, Pelajar/);
  });
});

describe("guru /teacher — kartu + aksi (bilingual dictionary)", () => {
  it("stat cards + matriks responsif + kartu aksi (tautan admin tetap gated)", () => {
    expect(teacher).toMatch(/StatCard/);
    expect(teacher).toMatch(/md:hidden/);
    expect(dashText).toMatch(/toolsTitle: \{ id: "Kelola kelas", en: "Manage classes"/);
    expect(teacher).toMatch(/from "@\/lib\/ui-text\/dash"/);
    expect(teacher).toMatch(/mkT\(DASH, lang\)/);
    expect(teacher).toMatch(/href: "\/teacher\/grading"/);
    expect(teacher).toMatch(/href: "\/teacher\/certificates"/);
    expect(teacher).toMatch(/adminCtx && \[/);
    expect(teacher).toMatch(/href: "\/teacher\/admin\/map"/);
  });
});

describe("wali /guardian — ring + wording kosong jujur", () => {
  it("ring progress + tanpa '0 dari 0' mentah", () => {
    expect(guardian).toMatch(/ProgressRing/);
    expect(guardian).toMatch(/Belum ada progres tercatat/);
    expect(guardian).not.toMatch(/dari \{c\.levelTotal \|\| 0\}/);
  });
});
