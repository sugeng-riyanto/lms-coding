// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileDrawer, NavLinks } from "@/components/app-nav";
import { navForRole } from "@/lib/role-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/actions", () => ({ signOut: vi.fn().mockResolvedValue({ ok: true }) }));

afterEach(cleanup);

describe("NavLinks — tautan peran + status aktif", () => {
  it("murid melihat 5 tautan; aktif ditandai aria-current", () => {
    render(<NavLinks items={navForRole("student", false)} />);
    for (const label of ["Belajar", "Katalog", "Review", "Sertifikat", "Pengaturan"]) {
      expect(screen.getByRole("link", { name: label })).toBeDefined();
    }
    expect(screen.getByRole("link", { name: "Belajar" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Katalog" }).getAttribute("aria-current")).toBeNull();
  });

  it("guru non-admin tidak melihat tautan Admin; admin melihatnya", () => {
    const { unmount } = render(<NavLinks items={navForRole("teacher", false)} />);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    expect(screen.getByRole("link", { name: "Bank Soal" })).toBeDefined();
    unmount();
    render(<NavLinks items={navForRole("teacher", true)} />);
    expect(screen.getByRole("link", { name: "Admin" })).toBeDefined();
  });

  it("wali hanya Ringkasan + Pengaturan", () => {
    render(<NavLinks items={navForRole("guardian", false)} />);
    expect(screen.getByRole("link", { name: "Ringkasan" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Pengaturan" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Belajar" })).toBeNull();
  });
});

describe("MobileDrawer — hamburger membuka/menutup", () => {
  it("tertutup default; terbuka via hamburger; tertutup via Escape dan tautan", () => {
    render(<MobileDrawer eyebrow="Area Belajar Murid" items={navForRole("student", false)} lang="id" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Buka navigasi" }));
    expect(screen.getByRole("dialog", { name: /Navigasi/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "Buka navigasi" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Buka navigasi" }));
    fireEvent.click(screen.getByRole("link", { name: "Katalog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("drawer memuat tombol Keluar (logout semua peran)", () => {
    render(<MobileDrawer eyebrow="Dasbor Kelas" items={navForRole("teacher", false)} lang="id" />);
    fireEvent.click(screen.getByRole("button", { name: "Buka navigasi" }));
    expect(screen.getByRole("button", { name: "Keluar" })).toBeDefined();
  });
});
