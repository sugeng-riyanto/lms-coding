import { describe, expect, it, vi } from "vitest";
import {
  AI_ANSWER_MAX_CHARS,
  AI_DRAFT_LABEL,
  buildPrompt,
  createAiProvider,
  extractAnswerText,
  mockDraftBody,
} from "@/lib/ai-feedback";

describe("extractAnswerText — normalisasi answer_json", () => {
  it("string langsung", () => {
    expect(extractAnswerText("jawaban panjang")).toBe("jawaban panjang");
  });

  it("array (multiple choice) digabung dengan koma", () => {
    expect(extractAnswerText(["a", "b"])).toBe("a, b");
  });

  it("objek di-JSON-stringify (file/deskripsi)", () => {
    expect(extractAnswerText({ filename: "x.py", description: "proyek" })).toContain("proyek");
  });

  it("null/undefined/angka", () => {
    expect(extractAnswerText(null)).toBe("");
    expect(extractAnswerText(undefined)).toBe("");
    expect(extractAnswerText(42)).toBe("42");
  });

  it("terpotong di AI_ANSWER_MAX_CHARS", () => {
    const long = "x".repeat(AI_ANSWER_MAX_CHARS + 500);
    expect(extractAnswerText(long)).toHaveLength(AI_ANSWER_MAX_CHARS);
  });
});

describe("buildPrompt — data minimization (AC-5)", () => {
  it("memuat jenis soal, teks soal, jawaban; tanpa identitas murid", () => {
    const p = buildPrompt({
      qtype: "essay_manual",
      promptText: "Jelaskan loop?",
      answerText: "for i in range(10)",
    });
    expect(p).toContain("essay manual");
    expect(p).toContain("Jelaskan loop?");
    expect(p).toContain("for i in range(10)");
    // Identitas murid tidak pernah masuk prompt (data minimization).
    expect(p).not.toContain("email");
    expect(p).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/); // tidak ada nama murid
  });

  it("orgName disertakan bila diberikan; absen bila tidak", () => {
    expect(buildPrompt({ qtype: "q", promptText: "s", answerText: "a", orgName: "SMA N 1" })).toContain(
      "SMA N 1",
    );
    expect(buildPrompt({ qtype: "q", promptText: "s", answerText: "a" })).not.toContain("Organisasi:");
  });

  it("jawaban kosong ditandai (kosong), bukan dihilangkan", () => {
    expect(buildPrompt({ qtype: "q", promptText: "s", answerText: "" })).toContain("(kosong)");
  });

  it("dibatasi AI_PROMPT_MAX_CHARS", () => {
    const p = buildPrompt({ qtype: "q", promptText: "s".repeat(20_000), answerText: "a".repeat(20_000) });
    expect(p.length).toBeLessThanOrEqual(12_000);
  });
});

describe("mock provider — deterministik, tanpa jaringan", () => {
  it("createAiProvider: enabled=false → null (AI_DISABLED)", () => {
    expect(
      createAiProvider({ enabled: false, provider: "mock", baseUrl: undefined, apiKey: undefined }),
    ).toBeNull();
  });

  it("provider mock → kind mock, generate deterministik + label draft", async () => {
    const p = createAiProvider({ enabled: true, provider: "mock", baseUrl: undefined, apiKey: undefined });
    expect(p?.kind).toBe("mock");
    const input = { qtype: "essay_manual", promptText: "Soal X", answerText: "jawaban" };
    const a = await p!.generate(input);
    const b = await p!.generate(input);
    expect(a.body).toBe(b.body); // deterministik
    expect(a.body).toContain(AI_DRAFT_LABEL);
    expect(a.model).toBe("mock-draft-v1");
  });

  it("mockDraftBody: jawaban kosong → ajakan menulis", () => {
    expect(mockDraftBody({ qtype: "q", promptText: "s", answerText: "" })).toContain("masih kosong");
  });

  it("provider http tanpa baseUrl/apiKey → null (AI_PROVIDER_UNCONFIGURED)", () => {
    expect(createAiProvider({ enabled: true, provider: "http", baseUrl: "", apiKey: "" })).toBeNull();
  });

  it("provider tidak dikenal → null", () => {
    expect(createAiProvider({ enabled: true, provider: "openai", baseUrl: "x", apiKey: "y" })).toBeNull();
  });
});

describe("http provider — POST JSON, timeout, error dilempar (AC-7)", () => {
  it("sukses: POST ke {base}/draft-feedback dengan Bearer key; body berlabel", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ feedback: "Bagus, tapi cek sintaks.", model: "gpt-test" }),
      } as unknown as Response;
    }) as typeof fetch);
    const p = createAiProvider({
      enabled: true,
      provider: "http",
      baseUrl: "https://x.test/api/",
      apiKey: "secret",
    });
    const out = await p!.generate({ qtype: "essay_manual", promptText: "Soal", answerText: "Jawaban" });
    expect(out.body).toContain(AI_DRAFT_LABEL);
    expect(out.body).toContain("Bagus");
    expect(out.model).toBe("gpt-test");
    expect(calls[0]!.url).toBe("https://x.test/api/draft-feedback");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(String(calls[0]!.init.body)).toContain("Jawaban");
    vi.unstubAllGlobals();
  });

  it("HTTP non-OK → throws (action menangkap → AI_PROVIDER_ERROR)", async () => {
    vi.stubGlobal("fetch", (async () => ({ ok: false, status: 500 }) as unknown as Response) as typeof fetch);
    const p = createAiProvider({
      enabled: true,
      provider: "http",
      baseUrl: "https://x.test",
      apiKey: "secret",
    });
    await expect(p!.generate({ qtype: "q", promptText: "s", answerText: "a" })).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
