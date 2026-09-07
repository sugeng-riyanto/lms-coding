import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Modernisasi dashboard (presentasi saja — query/RLS tidak berubah):
 * ketiga dashboard peran memakai kit visual yang sama + aria progressbar.
 */

const learn = readFileSync("app/(student)/learn/page.tsx", "utf8");
const teacher = readFileSync("app/(teacher)/teacher/page.tsx", "utf8");
const guardian = readFileSync("app/(guardian)/guardian/page.tsx", "utf8");
const kit = readFileSync("components/dashboard.tsx", "utf8");

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

describe("murid /learn — hero + journey", () => {
  it("hero rekomendasi + ring mingguan + journey level + tautan per level", () => {
    expect(learn).toMatch(/Langkah berikutnya/);
    expect(learn).toMatch(/ProgressRing/);
    expect(learn).toMatch(/Jalur level/);
    expect(learn).toMatch(/Buka level/);
    expect(learn).not.toMatch(/Halo, Pelajar/);
  });
});

describe("guru /teacher — kartu + aksi", () => {
  it("stat cards + matriks responsif + kartu aksi (tautan admin tetap gated)", () => {
    expect(teacher).toMatch(/StatCard/);
    expect(teacher).toMatch(/md:hidden/);
    expect(teacher).toMatch(/Kelola kelas/);
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
