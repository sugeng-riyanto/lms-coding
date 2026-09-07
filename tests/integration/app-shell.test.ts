import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { navForRole } from "@/lib/role-nav";

/**
 * Shell + pengaturan semua RBAC (misi: navigasi jelas per peran, responsif,
 * pengaturan & keluar tersedia di semua peran; RBAC.md tidak menambah
 * kapabilitas — pengaturan = akun sendiri).
 */

describe("navForRole — peta tautan per peran", () => {
  it("murid: belajar/katalog/review/sertifikat/pengaturan", () => {
    expect(navForRole("student", false).map((n) => n.href)).toEqual([
      "/learn",
      "/catalog",
      "/review",
      "/certificates",
      "/settings",
    ]);
  });

  it("guru: dasbor→sertifikat + admin hanya bila org-admin", () => {
    const biasa = navForRole("teacher", false).map((n) => n.href);
    expect(biasa).toContain("/teacher/grading");
    expect(biasa).toContain("/settings");
    expect(biasa).not.toContain("/teacher/admin/map");
    expect(navForRole("teacher", true).map((n) => n.href)).toContain("/teacher/admin/map");
  });

  it("wali: ringkasan + pengaturan saja", () => {
    expect(navForRole("guardian", false).map((n) => n.href)).toEqual(["/guardian", "/settings"]);
  });
});

describe("layout peran memakai AppShell", () => {
  const student = readFileSync("app/(student)/layout.tsx", "utf8");
  const teacher = readFileSync("app/(teacher)/layout.tsx", "utf8");
  const guardian = readFileSync("app/(guardian)/layout.tsx", "utf8");
  const shell = readFileSync("components/app-shell.tsx", "utf8");

  it("ketiga layout guard + render AppShell dengan nav perannya", () => {
    expect(student).toMatch(/requireActiveMembership\(\["student"\]\)/);
    expect(student).toMatch(/navForRole\("student"/);
    expect(teacher).toMatch(/requireActiveMembership\(\["teacher"\]\)/);
    expect(teacher).toMatch(/navForRole\("teacher"/);
    expect(guardian).toMatch(/requireActiveMembership\(\["guardian"\]\)/);
    expect(guardian).toMatch(/navForRole\("guardian"/);
    for (const src of [student, teacher, guardian]) {
      expect(src).toMatch(/<AppShell/);
    }
  });

  it("shell: sidebar desktop + drawer mobile + topbar (tema, pengaturan, keluar)", () => {
    expect(shell).toMatch(/hidden w-64[^"]*md:flex/);
    expect(shell).toMatch(/<MobileDrawer/);
    expect(shell).toMatch(/href="\/settings"/);
    expect(shell).toMatch(/<ThemeToggle/);
    expect(shell).toMatch(/<LogoutButton/);
    // Halaman merender <main> sendiri — shell tidak boleh bersarang <main>.
    expect(shell).not.toMatch(/<main/);
  });
});

describe("route /settings — semua peran", () => {
  const page = readFileSync("app/settings/page.tsx", "utf8");
  const panel = readFileSync("components/settings-panel.tsx", "utf8");

  it("guard tiga peran + shell + panel akun/preferensi/sesi", () => {
    expect(page).toMatch(/requireActiveMembership\(\["student", "teacher", "guardian"\]\)/);
    expect(page).toMatch(/<AppShell/);
    expect(page).toMatch(/<SettingsPanel/);
    expect(panel).toMatch(/aria-label="Akun saya"/);
    expect(panel).toMatch(/aria-label="Preferensi tampilan"/);
    expect(panel).toMatch(/aria-label="Sesi"/);
    expect(panel).toMatch(/<LogoutButton/);
    expect(panel).toMatch(/Peran \(server\)/);
  });
});
