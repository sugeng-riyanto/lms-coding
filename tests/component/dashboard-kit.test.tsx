// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeterBar, ProgressRing, StatCard, StateBadge } from "@/components/dashboard";

describe("dashboard kit — angka berupa teks, aksesibel", () => {
  it("StatCard menampilkan nilai + label", () => {
    render(<StatCard label="Terdaftar" value="3" hint="Murid" />);
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Terdaftar")).toBeDefined();
  });

  it("ProgressRing: persen berupa teks + aria-valuenow", () => {
    render(<ProgressRing pct={42} label="Progress mingguan" />);
    expect(screen.getByText("42%")).toBeDefined();
    expect(screen.getByRole("progressbar", { name: "Progress mingguan" }).getAttribute("aria-valuenow")).toBe(
      "42",
    );
  });

  it("ProgressRing menjepit 0..100", () => {
    const { rerender } = render(<ProgressRing pct={999} label="x" />);
    expect(screen.getByText("100%")).toBeDefined();
    rerender(<ProgressRing pct={-5} label="x" />);
    expect(screen.getByText("0%")).toBeDefined();
  });

  it("MeterBar memakai role progressbar + label", () => {
    render(<MeterBar pct={70} label="Mastery Level 1" />);
    expect(screen.getByRole("progressbar", { name: "Mastery Level 1" })).toBeDefined();
  });

  it("StateBadge selalu berteks (bukan warna saja)", () => {
    render(<StateBadge state="locked" />);
    expect(screen.getByText("Terkunci")).toBeDefined();
  });
});
