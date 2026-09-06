// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PrintButton } from "@/app/(student)/certificates/[publicId]/print-button";

afterEach(cleanup);

describe("PrintButton (component test)", () => {
  it("render dengan label dan fokus keyboard", () => {
    render(<PrintButton />);
    const btn = screen.getByRole("button", { name: /cetak/i });
    expect(btn).toBeTruthy();
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});
