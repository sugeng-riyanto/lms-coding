// AI draft feedback (Phase 4 KURANG; ADR-014/015/017).
//
// Server-only: dipanggil dari Server Actions/Route Handlers saja (AC-6).
//   - buildPrompt/extractAnswerText: murni, data minimization (tanpa identitas
//     murid, nilai lain, data siswa lain; potong 4000 char).
//   - AiDraftProvider + createAiProvider(): adapter mock (deterministik, TANPA
//     jaringan — default pengujian) / http (POST JSON ke base URL dari env,
//     timeout 10s, error terswallow + log redact) / null saat unconfigured.
//
// TIDAK mengimpor lib/env di top-level agar file client yang keliru mengimpor
// file ini tidak ikut menarik getServerEnv; config provider dibaca di
// createAiProvider() (dipanggil hanya di server action).

export const AI_DRAFT_LABEL = "DRAFT AI — perlu persetujuan guru";
export const AI_ANSWER_MAX_CHARS = 4000;
export const AI_PROMPT_MAX_CHARS = 12_000;

export interface AiDraftRequest {
  qtype: string;
  promptText: string;
  answerText: string;
  orgName?: string;
}

export interface AiDraftResult {
  body: string;
  model: string;
}

/** Adapter provider (ADR-017). */
export interface AiDraftProvider {
  readonly kind: "mock" | "http";
  generate(input: AiDraftRequest): Promise<AiDraftResult>;
}

export interface AiProviderConfig {
  enabled: boolean;
  provider: string | undefined;
  baseUrl: string | undefined;
  apiKey: string | undefined;
}

// ---------------------------------------------------------------------------
// Prompt & ekstraksi jawaban (murni; AC-5 data minimization)
// ---------------------------------------------------------------------------

/** Normalisasi teks jawaban dari berbagai bentuk answer_json. */
export function extractAnswerText(answer: unknown, max = AI_ANSWER_MAX_CHARS): string {
  if (answer === null || answer === undefined) return "";
  let text: string;
  if (typeof answer === "string") {
    text = answer;
  } else if (Array.isArray(answer)) {
    text = answer
      .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      .filter(Boolean)
      .join(", ");
  } else if (typeof answer === "object") {
    try {
      text = JSON.stringify(answer);
    } catch {
      text = "[jawaban tidak dapat dibaca]";
    }
  } else {
    text = String(answer);
  }
  return text.slice(0, max);
}

/** Komposisi prompt: hanya jenis soal + teks soal + jawaban (+ nama org). */
export function buildPrompt(input: AiDraftRequest): string {
  const qtypeLabel = (input.qtype || "unknown").replace(/_/g, " ");
  const org = input.orgName ? `\nOrganisasi: ${input.orgName}` : "";
  const promptText = (input.promptText || "").slice(0, 3000);
  const answerText = extractAnswerText(input.answerText);
  const prompt = [
    "Kamu adalah asisten guru. Beri draf feedback singkat (2–4 kalimat, bahasa Indonesia,",
    "mendorong perbaikan) untuk jawaban murid berikut. JANGAN menyebutkan identitas murid.",
    "Jawaban boleh sebagian benar; tunjukkan apa yang sudah baik dan apa yang perlu diperbaiki.",
    "",
    `Jenis soal: ${qtypeLabel}`,
    `Soal: ${promptText}`,
    `Jawaban murid: ${answerText || "(kosong)"}`,
    org,
    "",
    "Draf feedback:",
  ].join("\n");
  return prompt.slice(0, AI_PROMPT_MAX_CHARS);
}

// ---------------------------------------------------------------------------
// Provider mock (deterministik, tanpa jaringan)
// ---------------------------------------------------------------------------

const MOCK_MODEL = "mock-draft-v1";

export function mockDraftBody(input: AiDraftRequest): string {
  const hasAnswer = extractAnswerText(input.answerText).length > 0;
  const lead = hasAnswer
    ? "Jawabanmu sudah menunjukkan usaha yang baik."
    : "Jawabanmu masih kosong — coba tulis langkah awal penyelesaiannya.";
  return [
    `${AI_DRAFT_LABEL}`,
    "",
    lead,
    `Periksa kembali pemahamanmu tentang: ${(input.promptText || "topik soal").slice(0, 200)}.`,
    "Uraikan prosesmu langkah demi langkah agar guru bisa memberi umpan balik yang lebih spesifik.",
  ].join("\n");
}

function createMockProvider(): AiDraftProvider {
  return {
    kind: "mock",
    async generate(input) {
      return { body: mockDraftBody(input), model: MOCK_MODEL };
    },
  };
}

// ---------------------------------------------------------------------------
// Provider HTTP (opsional; key dari env server-only)
// ---------------------------------------------------------------------------

const HTTP_TIMEOUT_MS = 10_000;

/** Log ter-redact: tanpa jawaban murid, tanpa key/token (AC-7). */
function redactedLog(message: string, detail?: unknown): void {
  console.error(`[ai-feedback] ${message}`, detail === undefined ? "" : "[redacted]");
}

function createHttpProvider(config: { baseUrl: string; apiKey: string }): AiDraftProvider {
  return {
    kind: "http",
    async generate(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      try {
        const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/draft-feedback`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ prompt: buildPrompt(input) }),
          signal: controller.signal,
        });
        if (!res.ok) {
          redactedLog(`provider http ${res.status}`);
          throw new Error(`HTTP_${res.status}`);
        }
        const json = (await res.json()) as { feedback?: unknown; body?: unknown; model?: unknown };
        const body =
          typeof json.feedback === "string" ? json.feedback : typeof json.body === "string" ? json.body : "";
        if (!body) {
          redactedLog("provider http: response tanpa body teks");
          throw new Error("EMPTY_BODY");
        }
        return {
          body: `${AI_DRAFT_LABEL}\n\n${body}`.slice(0, AI_ANSWER_MAX_CHARS),
          model: typeof json.model === "string" ? json.model : "http-provider",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Pabrik provider
// ---------------------------------------------------------------------------

/** null = unconfigured (fitur menolak AI_PROVIDER_UNCONFIGURED tanpa jaringan). */
export function createAiProvider(config: AiProviderConfig): AiDraftProvider | null {
  if (!config.enabled) return null;
  const provider = (config.provider ?? "").trim().toLowerCase();
  if (provider === "mock") return createMockProvider();
  if (provider === "http") {
    const baseUrl = (config.baseUrl ?? "").trim();
    const apiKey = (config.apiKey ?? "").trim();
    if (!baseUrl || !apiKey) return null;
    return createHttpProvider({ baseUrl, apiKey });
  }
  return null;
}
