/**
 * Code runner (multi-bahasa) — LMS coding "dunia nyata".
 *
 * Menjalankan kode murid di SANDBOX EKSTERNAL (provider Piston-compatible),
 * BUKAN di server LMS: kode+stdin dikirim ke endpoint yang dikonfigurasi via
 * env dan stdout/stderr/exit code dikembalikan ke murid. Default NONAKTIF
 * (fail-closed): tanpa CODE_RUNNER_ENABLED=true → error CODE_RUNNER_DISABLED.
 *
 * - `provider=mock` → deterministik tanpa jaringan (untuk preview & tests).
 * - `provider=http` → POST Piston `/execute` (language + files + stdin),
 *   timeout 15 s, apiKey opsional sebagai header Authorization.
 * - Tidak pernah menyimpan kode/output; hanya allowlist bahasa; ukuran dibatasi.
 *
 * Mirip pola adapters lain (AI draft ADR-017, chain anchor ADR-018): config
 * dibaca di createCodeRunnerProvider() (dipanggil hanya server-side).
 */

export interface CodeRunnerLanguage {
  id: string;
  label: string;
  /** Nama yang dikirim ke provider Piston. */
  piston: string;
  /** Ekstensi file default. */
  file: string;
  /** Contoh kode starter untuk UI. */
  starter: string;
}

/** Allowlist bahasa (bisa diperluas tanpa mengubah kontrak adapter). */
export const CODE_RUNNER_LANGUAGES: CodeRunnerLanguage[] = [
  {
    id: "python",
    label: "Python",
    piston: "python",
    file: "main.py",
    starter: 'print("Halo dunia")\n',
  },
  {
    id: "javascript",
    label: "JavaScript",
    piston: "javascript",
    file: "main.js",
    starter: "console.log('Halo dunia');\n",
  },
  {
    id: "typescript",
    label: "TypeScript",
    piston: "typescript",
    file: "main.ts",
    starter: "console.log('Halo dunia');\n",
  },
  {
    id: "c",
    label: "C",
    piston: "c",
    file: "main.c",
    starter: '#include <stdio.h>\nint main(void) {\n  printf("Halo dunia\\n");\n  return 0;\n}\n',
  },
  {
    id: "cpp",
    label: "C++",
    piston: "c++",
    file: "main.cpp",
    starter: '#include <iostream>\nint main() {\n  std::cout << "Halo dunia" << std::endl;\n  return 0;\n}\n',
  },
  {
    id: "java",
    label: "Java",
    piston: "java",
    file: "Main.java",
    starter:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Halo dunia");\n  }\n}\n',
  },
  {
    id: "go",
    label: "Go",
    piston: "go",
    file: "main.go",
    starter: 'package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Halo dunia")\n}\n',
  },
  {
    id: "rust",
    label: "Rust",
    piston: "rust",
    file: "main.rs",
    starter: 'fn main() {\n  println!("Halo dunia");\n}\n',
  },
  {
    id: "ruby",
    label: "Ruby",
    piston: "ruby",
    file: "main.rb",
    starter: 'puts "Halo dunia"\n',
  },
  {
    id: "php",
    label: "PHP",
    piston: "php",
    file: "main.php",
    starter: '<?php\necho "Halo dunia\\n";\n',
  },
  {
    id: "csharp",
    label: "C#",
    piston: "csharp",
    file: "main.cs",
    starter:
      'using System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Halo dunia");\n  }\n}\n',
  },
];

/** Alias input guru/murid → id canonical (case-insensitive). */
const LANGUAGE_ALIASES: Record<string, string> = {
  py: "python",
  python3: "python",
  js: "javascript",
  node: "javascript",
  nodejs: "javascript",
  ts: "typescript",
  cpp: "cpp",
  "c++": "cpp",
  golang: "go",
  cs: "csharp",
  "c#": "csharp",
};

export const CODE_RUNNER_MAX_CHARS = 20_000;
export const CODE_RUNNER_MAX_STDIN_CHARS = 4_000;
const CODE_AI_MAX_CHARS = 8_000;

export type RunErrorCode =
  | "CODE_RUNNER_DISABLED"
  | "UNSUPPORTED_LANGUAGE"
  | "CODE_TOO_LARGE"
  | "STDIN_TOO_LARGE"
  | "PROVIDER_UNCONFIGURED"
  | "PROVIDER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "BAD_RESPONSE";

export interface CodeRunInput {
  language: string;
  code: string;
  stdin?: string;
}

export type CodeRunOutcome =
  | { ok: true; stdout: string; stderr: string; exitCode: number | null }
  | { ok: false; error: RunErrorCode; message: string };

export interface CodeRunnerProvider {
  readonly kind: "mock" | "http";
  run(input: CodeRunInput): Promise<CodeRunOutcome>;
}

export interface CodeRunnerConfig {
  enabled: boolean;
  provider: string | undefined;
  baseUrl: string | undefined;
  apiKey: string | undefined;
}

/** Resolve bahasa input (alias/liyuran) → id allowlist; null bila tak dikenal. */
export function resolveLanguage(input: string | undefined | null): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  const canonical = LANGUAGE_ALIASES[key] ?? key;
  return CODE_RUNNER_LANGUAGES.some((l) => l.id === canonical) ? canonical : null;
}

export function languageDef(id: string): CodeRunnerLanguage | null {
  return CODE_RUNNER_LANGUAGES.find((l) => l.id === id) ?? null;
}

/**
 * Engine in-browser (WebAssembly) untuk bahasa tertentu — bagian dari strategi
 * "coding dunia nyata": bahasa ringan/amatir dijalankan DI PERANGKAT murid
 * (Pyodide), sisanya tetap di sandbox eksternal (Piston). Murni fungsi:
 * keputusan UI & client tidak pernah menyentuh jaringan/server.
 */
export type BrowserEngineId = "pyodide";

/**
 * Bahasa yang didukung eksekusi in-browser. Python via Pyodide (WASM).
 * JS/TS/C/C++/Java/dll TIDAK ada di sini — tetap sandbox eksternal agar
 * tidak menurunkan keamanan (eval JS in-browser butuh 'unsafe-eval' =
 * DITOLAK oleh kebijakan CSP proyek).
 */
export const IN_BROWSER_LANGUAGES: ReadonlySet<string> = new Set(["python"]);

/** Mesin in-browser untuk id bahasa canonical; null bila sandbox eksternal. */
export function browserEngineFor(languageId: string): BrowserEngineId | null {
  return IN_BROWSER_LANGUAGES.has(languageId) ? "pyodide" : null;
}

/** Validasi ukuran/format sebelum dikirim ke provider (hanya error yang mungkin). */
export function validateRunInput(input: CodeRunInput): Extract<CodeRunOutcome, { ok: false }> | null {
  const lang = resolveLanguage(input.language);
  if (!lang) return { ok: false, error: "UNSUPPORTED_LANGUAGE", message: "Bahasa tidak didukung." };
  const code = typeof input.code === "string" ? input.code : "";
  if (code.length === 0) return { ok: false, error: "CODE_TOO_LARGE", message: "Kode kosong." };
  if (code.length > CODE_RUNNER_MAX_CHARS)
    return {
      ok: false,
      error: "CODE_TOO_LARGE",
      message: `Kode melebihi batas ${CODE_RUNNER_MAX_CHARS} karakter.`,
    };
  const stdin = typeof input.stdin === "string" ? input.stdin : "";
  if (stdin.length > CODE_RUNNER_MAX_STDIN_CHARS)
    return {
      ok: false,
      error: "STDIN_TOO_LARGE",
      message: `Input melebihi batas ${CODE_RUNNER_MAX_STDIN_CHARS} karakter.`,
    };
  return null;
}

/** Canonical input siap dikirim (setelah validasi). */
export function normalizeRunInput(input: CodeRunInput): {
  language: CodeRunnerLanguage;
  code: string;
  stdin: string;
} {
  const lang = languageDef(resolveLanguage(input.language) ?? "python") ?? CODE_RUNNER_LANGUAGES[0]!;
  return { language: lang, code: input.code, stdin: typeof input.stdin === "string" ? input.stdin : "" };
}

/** Payload Piston: satu file + stdin. */
export function buildPistonPayload(input: CodeRunInput): Record<string, unknown> {
  const n = normalizeRunInput(input);
  return {
    language: n.language.piston,
    version: "*",
    files: [{ name: n.language.file, content: n.code }],
    stdin: n.stdin,
  };
}

/** Parse respons Piston → CodeRunOutcome (murni). */
export function parsePistonResponse(body: unknown): CodeRunOutcome {
  if (!Array.isArray(body) || !body[0] || typeof body[0] !== "object") {
    return { ok: false, error: "BAD_RESPONSE", message: "Respons provider tidak dikenali." };
  }
  const first = body[0] as { run?: unknown; language?: string };
  const run = first.run as
    { stdout?: unknown; stderr?: unknown; code?: unknown; output?: unknown } | undefined;
  if (!run || typeof run !== "object") {
    return { ok: false, error: "BAD_RESPONSE", message: "Respons provider tidak memiliki blok run." };
  }
  const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
  const stdout = str(run.stdout ?? run.output);
  const exitCode = typeof run.code === "number" ? run.code : null;
  return { ok: true, stdout, stderr: str(run.stderr), exitCode };
}

/**
 * Provider mock (deterministik, tanpa jaringan) — preview & tests. TIDAK
 * mengeksekusi kode; hasil ditandai eksplisit agar tak disangka eksekusi asli.
 */
export function createMockCodeRunnerProvider(): CodeRunnerProvider {
  return {
    kind: "mock",
    async run(input: CodeRunInput) {
      const n = normalizeRunInput(input);
      const lines = n.code.split(/\r?\n/).length;
      const stdout = `[mode mock — tidak ada eksekusi nyata]\nKode ${n.language.label} diterima (${lines} baris, ${n.code.length} karakter).\nstdin: ${n.stdin.length > 0 ? `"${n.stdin.slice(0, 60)}"` : "(kosong)"}\n`;
      return { ok: true, stdout, stderr: "", exitCode: 0 };
    },
  };
}

/** Timeout helper (AbortController). */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(timer);
  }
}

function pistonError(code: RunErrorCode, message: string): CodeRunOutcome {
  return { ok: false, error: code, message };
}

/** Provider http (Piston-compatible `/execute`). fetch diinjeksi untuk tests. */
export function createHttpCodeRunnerProvider(
  baseUrl: string,
  apiKey?: string,
  fetcher: typeof fetch = fetch,
): CodeRunnerProvider {
  const endpoint = baseUrl.endsWith("/execute") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/execute`;
  return {
    kind: "http",
    async run(input: CodeRunInput) {
      const payload = buildPistonPayload(input);
      try {
        const res = await withTimeout(
          fetcher(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(payload),
          }),
          15_000,
        );
        if (!res.ok) {
          return pistonError("PROVIDER_ERROR", `Provider menolak (HTTP ${res.status}).`);
        }
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          return pistonError("BAD_RESPONSE", "Respons provider bukan JSON.");
        }
        return parsePistonResponse(json);
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        return pistonError(
          aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR",
          aborted ? "Provider tidak merespons dalam 15 detik." : "Gagal menghubungi provider kode.",
        );
      }
    },
  };
}

/** Buat provider dari env config (fail-closed bila nonaktif). */
export function createCodeRunnerProvider(config: CodeRunnerConfig): CodeRunnerProvider | null {
  if (!config.enabled) return null;
  if (config.provider === "mock") return createMockCodeRunnerProvider();
  if (config.provider === "http") {
    if (!config.baseUrl) return null;
    return createHttpCodeRunnerProvider(config.baseUrl, config.apiKey);
  }
  return null;
}

/** Prompt AI "bantu pahami/perbaiki kode" — data minimization (kode+output saja). */
export function buildCodeAiPrompt(input: {
  language?: string;
  code: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
}): string {
  const lang = input.language?.trim() || "kode";
  const code = (input.code ?? "").slice(0, CODE_AI_MAX_CHARS);
  const stdout = (input.stdout ?? "").trim();
  const stderr = (input.stderr ?? "").trim();
  const exit = input.exitCode ?? null;
  const outputBlock =
    stdout || stderr || exit !== null
      ? [
          "",
          "OUTPUT/STATUS:",
          stdout ? `stdout:\n${stdout.slice(0, 4_000)}` : null,
          stderr ? `stderr:\n${stderr.slice(0, 4_000)}` : null,
          exit !== null ? `exit code: ${exit}` : null,
        ]
          .filter((x): x is string => Boolean(x))
          .join("\n")
      : "";
  return [
    "Kamu adalah mentor coding untuk LMS sekolah. Bantu murid memahami dan memperbaiki kode di bawah.",
    "",
    `Bahasa: ${lang}`,
    `Kode:\n${code}`,
    outputBlock,
    "",
    "Tugas:",
    "- Jelaskan dengan sederhana apa yang dilakukan kode ini.",
    "- Bila ada error (stderr/exit code ≠ 0), tunjukkan penyebabnya dan cara memperbaikinya.",
    "- Beri contoh perbaikan minimal; jangan menulis ulang seluruh kode tanpa diminta.",
    "- Bahasa penjelasan: Indonesia (kode tetap apa adanya).",
  ]
    .filter((x): x is string => Boolean(x))
    .join("\n");
}
