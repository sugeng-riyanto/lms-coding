import { describe, expect, it } from "vitest";
import {
  PYODIDE_CDN_URL,
  PYODIDE_VERSION,
  buildStdinReader,
  isPythonTraceback,
  mapPyodideError,
  runPythonInBrowser,
} from "@/lib/browser-python";

describe("buildStdinReader — baris-per-baris dengan EOF eksplisit", () => {
  it("stdin kosong → langsung EOF", () => {
    expect(buildStdinReader("")()).toBeUndefined();
  });

  it("satu nilai tanpa newline → satu baris + newline, lalu EOF", () => {
    const next = buildStdinReader("5");
    expect(next()).toBe("5\n");
    expect(next()).toBeUndefined();
  });

  it("banyak baris dengan newline akhir → setiap baris + newline, lalu EOF", () => {
    const next = buildStdinReader("a\nb\n");
    expect(next()).toBe("a\n");
    expect(next()).toBe("b\n");
    expect(next()).toBeUndefined();
  });

  it("baris kosong tunggal tetap satu input kosong (bukan EOF prematur)", () => {
    const next = buildStdinReader("\n");
    expect(next()).toBe("\n");
    expect(next()).toBeUndefined();
  });

  it("stdin tanpa newline akhir tetap memakai seluruh baris", () => {
    const next = buildStdinReader("10\n20");
    expect(next()).toBe("10\n");
    expect(next()).toBe("20\n");
    expect(next()).toBeUndefined();
  });
});

describe("mapPyodideError — fail-closed, kode stabil", () => {
  it("timeout muat → PROVIDER_TIMEOUT", () => {
    expect(mapPyodideError(new Error("PYODIDE_LOAD_TIMEOUT"))).toMatchObject({
      ok: false,
      error: "PROVIDER_TIMEOUT",
    });
  });

  it("muat gagal → PROVIDER_ERROR dengan saran sandbox server", () => {
    const out = mapPyodideError(new Error("PYODIDE_LOAD_FAILED"));
    expect(out).toMatchObject({ ok: false, error: "PROVIDER_ERROR" });
    expect("message" in out && out.message).toContain("sandbox server");
  });

  it("runtime timeout → PROVIDER_TIMEOUT (bukan error generik)", () => {
    expect(mapPyodideError(new Error("PY_RUN_TIMEOUT"))).toMatchObject({
      ok: false,
      error: "PROVIDER_TIMEOUT",
    });
  });

  it("error lain → PROVIDER_ERROR membawa pesan asli", () => {
    const out = mapPyodideError(new Error("boom detail"));
    expect(out).toMatchObject({ ok: false, error: "PROVIDER_ERROR" });
    expect("message" in out && out.message).toContain("boom detail");
  });
});

describe("runPythonInBrowser — guard ukuran tanpa menyentuh DOM (Node-safe)", () => {
  it("kode kosong & terlalu besar ditolak sebelum muat runtime", async () => {
    expect(await runPythonInBrowser({ code: "" })).toMatchObject({
      ok: false,
      error: "CODE_TOO_LARGE",
    });
    expect(await runPythonInBrowser({ code: "a".repeat(20_001) })).toMatchObject({
      ok: false,
      error: "CODE_TOO_LARGE",
    });
  });

  it("stdin terlalu besar ditolak", async () => {
    expect(await runPythonInBrowser({ code: "print(1)", stdin: "x".repeat(4_001) })).toMatchObject({
      ok: false,
      error: "STDIN_TOO_LARGE",
    });
  });

  it("di luar browser → fail-closed tanpa crash", async () => {
    const out = await runPythonInBrowser({ code: "print(1)" });
    expect(out.ok).toBe(false);
  });
});

describe("isPythonTraceback — deteksi exception Python dari message error", () => {
  it("traceback Python (Pyodide memformatnya ke message) → true", () => {
    const tb =
      'Traceback (most recent call last):\n  File "<exec>", line 2, in <module>\nZeroDivisionError: division by zero';
    expect(isPythonTraceback(new Error(tb))).toBe(true);
    expect(isPythonTraceback(tb)).toBe(true);
  });

  it("error infra biasa → false (tidak ada false positive)", () => {
    expect(isPythonTraceback(new Error("PYODIDE_LOAD_FAILED"))).toBe(false);
    expect(isPythonTraceback(new Error("PY_RUN_TIMEOUT"))).toBe(false);
    expect(isPythonTraceback("boom")).toBe(false);
    expect(isPythonTraceback(undefined)).toBe(false);
  });
});

describe("konstanta CDN", () => {
  it("URL entry Pyodide konsisten dengan versi ter-pin", () => {
    expect(PYODIDE_CDN_URL).toBe(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`);
  });
});
