import { describe, expect, it } from "vitest";
import {
  CODE_RUNNER_LANGUAGES,
  buildCodeAiPrompt,
  buildPistonPayload,
  createCodeRunnerProvider,
  createHttpCodeRunnerProvider,
  createMockCodeRunnerProvider,
  parsePistonResponse,
  resolveLanguage,
  validateRunInput,
} from "@/lib/code-runner";

describe("resolveLanguage — allowlist & alias", () => {
  it("mengenali id canonical dan alias umum", () => {
    expect(resolveLanguage("python")).toBe("python");
    expect(resolveLanguage("py")).toBe("python");
    expect(resolveLanguage("js")).toBe("javascript");
    expect(resolveLanguage("TypeScript")).toBe("typescript");
    expect(resolveLanguage("c++")).toBe("cpp");
    expect(resolveLanguage("golang")).toBe("go");
    expect(resolveLanguage("kotlin")).toBeNull();
    expect(resolveLanguage("")).toBeNull();
  });

  it("allowlist lintas-bahasa tersedia (dunia coding)", () => {
    const ids = CODE_RUNNER_LANGUAGES.map((l) => l.id);
    for (const id of [
      "python",
      "javascript",
      "typescript",
      "c",
      "cpp",
      "java",
      "go",
      "rust",
      "ruby",
      "php",
      "csharp",
    ]) {
      expect(ids).toContain(id);
    }
  });
});

describe("validateRunInput", () => {
  it("menolak bahasa tak dikenal & kode kosong/terlalu besar", () => {
    expect(validateRunInput({ language: "kotlin", code: "x" })).toMatchObject({
      ok: false,
      error: "UNSUPPORTED_LANGUAGE",
    });
    expect(validateRunInput({ language: "python", code: "" })).toMatchObject({
      ok: false,
      error: "CODE_TOO_LARGE",
    });
    expect(validateRunInput({ language: "python", code: "a".repeat(20_001) })).toMatchObject({
      ok: false,
      error: "CODE_TOO_LARGE",
    });
  });

  it("valid input lolos", () => {
    expect(validateRunInput({ language: "python", code: "print(1)", stdin: "5" })).toBeNull();
  });
});

describe("buildPistonPayload & parsePistonResponse", () => {
  it("payload berisi satu file + stdin sesuai bahasa", () => {
    const p = buildPistonPayload({ language: "cpp", code: "int main() {}", stdin: "x" });
    expect(p).toMatchObject({
      language: "c++",
      version: "*",
      stdin: "x",
    });
    expect((p.files as { name: string }[])[0]?.name).toBe("main.cpp");
  });

  it("parse stdout/stderr/exitCode", () => {
    const out = parsePistonResponse([{ language: "python", run: { stdout: "halo\n", stderr: "", code: 0 } }]);
    expect(out).toMatchObject({ ok: true, stdout: "halo\n", stderr: "", exitCode: 0 });
  });

  it("parse exit code != 0 sebagai sukses transport tapi exit non-zero", () => {
    const out = parsePistonResponse([{ run: { stdout: "", stderr: "boom", code: 1 } }]);
    expect(out).toMatchObject({ ok: true, exitCode: 1, stderr: "boom" });
  });

  it("respons rusak → BAD_RESPONSE", () => {
    expect(parsePistonResponse({})).toMatchObject({ ok: false, error: "BAD_RESPONSE" });
    expect(parsePistonResponse([{ run: null }])).toMatchObject({ ok: false, error: "BAD_RESPONSE" });
  });
});

describe("provider mock & factory fail-closed", () => {
  it("mock deterministik, tanpa eksekusi nyata, exit 0", async () => {
    const out = await createMockCodeRunnerProvider().run({
      language: "python",
      code: "print('x')\nprint('y')",
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.stdout).toContain("[mode mock");
      expect(out.stdout).toContain("2 baris");
      expect(out.exitCode).toBe(0);
    }
  });

  it("factory: nonaktif atau provider tak dikenal → null (fail-closed)", () => {
    expect(
      createCodeRunnerProvider({ enabled: false, provider: "mock", baseUrl: "", apiKey: "" }),
    ).toBeNull();
    expect(
      createCodeRunnerProvider({ enabled: true, provider: "unknown", baseUrl: "", apiKey: "" }),
    ).toBeNull();
    expect(
      createCodeRunnerProvider({ enabled: true, provider: "mock", baseUrl: "", apiKey: "" }),
    ).not.toBeNull();
  });
});

describe("createHttpCodeRunnerProvider (fetch diinjeksi)", () => {
  it("mengirim POST ke /execute dan memetakan respons", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify([{ run: { stdout: "42\n", stderr: "", code: 0 } }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const provider = createHttpCodeRunnerProvider(
      "https://judge.example/api/v2/piston",
      "s3cr3t",
      fakeFetch as typeof fetch,
    );
    const out = await provider.run({ language: "python", code: "print(42)" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/api/v2/piston/execute");
    expect((calls[0]?.init?.headers as Record<string, string>)?.authorization).toBe("Bearer s3cr3t");
    expect(out).toMatchObject({ ok: true, stdout: "42\n", exitCode: 0 });
  });

  it("HTTP error → PROVIDER_ERROR", async () => {
    const provider = createHttpCodeRunnerProvider(
      "https://judge.example/execute",
      undefined,
      (async () => new Response("nope", { status: 429 })) as typeof fetch,
    );
    const out = await provider.run({ language: "python", code: "x" });
    expect(out).toMatchObject({ ok: false, error: "PROVIDER_ERROR" });
  });
});

describe("buildCodeAiPrompt — data minimization", () => {
  it("memuat kode + output, tanpa identitas murid", () => {
    const p = buildCodeAiPrompt({
      language: "Python",
      code: "print(1)",
      stdout: "1",
      stderr: "",
      exitCode: 0,
    });
    expect(p).toContain("print(1)");
    expect(p).toContain("stdout:");
    expect(p).toContain("Bahasa: Python");
    expect(p).not.toContain("@");
    expect(p).not.toContain("murid01");
  });
});
