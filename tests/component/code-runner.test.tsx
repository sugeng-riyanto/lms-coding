// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CodeRunner } from "@/components/code-runner";

const renderRunner = (props: { starterCode: string; starterLanguage: string }) =>
  render(<CodeRunner {...props} lang="id" />);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CodeRunner", () => {
  it("merender kontrol: bahasa, kode, stdin, tombol jalankan, prompt AI", () => {
    renderRunner({ starterCode: 'print("halo")\n', starterLanguage: "python" });
    expect(screen.getByLabelText(/Bahasa/)).toBeDefined();
    expect(screen.getByLabelText(/Kode \(Python\)/)).toBeDefined();
    expect(screen.getByLabelText(/Input \(stdin/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Jalankan/ })).toBeDefined();
    expect(screen.getByText(/Prompt AI/)).toBeDefined();
  });

  it("runner nonaktif di server → pesan fail-closed (bukan diam)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: "CODE_RUNNER_DISABLED",
              message: "Code runner belum diaktifkan di server ini.",
            }),
            { status: 503, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    renderRunner({ starterCode: 'print("halo")\n', starterLanguage: "python" });
    fireEvent.click(screen.getByRole("button", { name: /Jalankan/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("CODE_RUNNER_DISABLED");
    expect(alert.textContent).toContain("belum diaktifkan");
  });

  it("sukses → output & exit code tampil; request memuat kode+stdin", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { language: string; stdin: string };
      expect(body.language).toBe("python");
      expect(body.stdin).toBe("5");
      return new Response(JSON.stringify({ ok: true, stdout: "5\n", stderr: "", exitCode: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderRunner({ starterCode: "print('x')\n", starterLanguage: "python" });
    fireEvent.change(screen.getByLabelText(/Input \(stdin/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Jalankan/ }));
    const output = await screen.findByText((content, el) => el?.tagName === "PRE" && content === "5");
    expect(output).toBeDefined();
    const exitP = screen.getByText((content, el) => el?.tagName === "P" && /exit code:/.test(content));
    expect(exitP.textContent).toContain("0");
  });
});
