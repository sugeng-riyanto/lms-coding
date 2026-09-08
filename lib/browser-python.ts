/**
 * Eksekusi Python DI BROWSER via Pyodide (WebAssembly) — "coding dunia nyata"
 * tanpa sandbox server: kode & stdout/stderr TIDAK pernah meninggalkan
 * perangkat murid (tidak ada POST /api/code/run, tidak ada log server).
 *
 * Gated oleh NEXT_PUBLIC_CODE_RUNNER_IN_BROWSER=true (default false). Saat
 * aktif, kebijakan CSP mendapat kelonggaran SEMPIT: 'wasm-unsafe-eval' +
 * host CDN Pyodide (lib/csp.ts). Modul ini hanya dijalankan dari Client
 * Component; helper murni (buildStdinReader, mapPyodideError, …) aman diuji
 * di Node tanpa DOM.
 *
 * Batasan jujur (terdokumentasi di PROGRESS): Pyodide berjalan di MAIN
 * THREAD, jadi kode berat/looping tak berujung dapat membekukan tab — sandbox
 * eksternal (Piston) tetap default produksi untuk konten resmi. Migrasi ke
 * Web Worker (worker-src) adalah langkah berikutnya yang terpisah.
 */

import {
  CODE_RUNNER_MAX_CHARS,
  CODE_RUNNER_MAX_STDIN_CHARS,
  type CodeRunOutcome,
  validateRunInput,
} from "@/lib/code-runner";

/** Versi Pyodide di-pin (perilaku stdin/stdout stabil sejak 0.26). */
export const PYODIDE_VERSION = "0.26.4";
export const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`;
export const PYODIDE_ENTRY_URL = `${PYODIDE_CDN_URL}/pyodide.js`;
/** Muatan ~10 MB WASM; beri waktu lebar di koneksi sekolah. */
export const PYODIDE_LOAD_TIMEOUT_MS = 60_000;
export const BROWSER_RUN_TIMEOUT_MS = 15_000;

/** Kontrak minimal API Pyodide yang dipakai (hindari any; versi di-pin). */
export interface PyodideInstance {
  /**
   * `write` = handler byte-perfect (Uint8Array per write; kembalikan jumlah
   * byte yang dipakai). `batched` memotong newline per baris dan `raw` hanya
   * memberi satu char-code per panggilan — keduanya tidak cocok untuk
   * menangkap stdout utuh (lihat streams.ts Pyodide 0.26).
   */
  setStdout(opts: { write: (buffer: Uint8Array) => number }): void;
  setStderr(opts: { write: (buffer: Uint8Array) => number }): void;
  setStdin(opts: { stdin: () => string | undefined; autoEOF: boolean }): void;
  runPython(code: string): unknown;
}

type PyodideLoader = (opts?: { indexURL?: string }) => Promise<PyodideInstance>;

interface PyodideGlobal {
  loadPyodide?: PyodideLoader;
}

const globalForPyodide = (): PyodideGlobal => globalThis as unknown as PyodideGlobal;

/**
 * Ubah stdin statis → callback baris-per-baris. Setiap baris diberi akhiran
 * "\n" agar input() Python membaca SATU baris per panggilan (buffer Pyodide
 * bersifat push; tanpa newline, sisa stdin bisa terbaca sekaligus). EOF
 * ditandai undefined (dengan autoEOF=true di setStdin).
 */
export function buildStdinReader(stdin: string): () => string | undefined {
  if (!stdin) return () => undefined;
  const chunks = stdin.split("\n");
  if (chunks.length > 0 && chunks[chunks.length - 1] === "") chunks.pop();
  let i = 0;
  return () => {
    if (i >= chunks.length) return undefined;
    const line = chunks[i] ?? "";
    i += 1;
    return `${line}\n`;
  };
}

/**
 * Deteksi exception Python: Pyodide 0.26 memformat traceback ke dalam
 * `message` error yang dilempar (TIDAK lewat sys.stderr). False positif
 * mustahil untuk error infra (pesan kita tidak pernah memuat pola ini).
 */
export function isPythonTraceback(value: unknown): boolean {
  const msg = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  return msg.includes("Traceback (most recent call last)");
}

/** Petakan error infra (bukan exception Python) → outcome fail-closed. */
export function mapPyodideError(err: unknown): Extract<CodeRunOutcome, { ok: false }> {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "UNKNOWN";
  if (msg === "PYODIDE_LOAD_TIMEOUT")
    return {
      ok: false,
      error: "PROVIDER_TIMEOUT",
      message: "Memuat runtime Python (WebAssembly) terlalu lama. Periksa koneksi internet, lalu coba lagi.",
    };
  if (msg === "PYODIDE_LOAD_FAILED")
    return {
      ok: false,
      error: "PROVIDER_ERROR",
      message:
        "Runtime Python tidak bisa dimuat dari CDN. Periksa koneksi internet, atau minta admin mengaktifkan sandbox server (CODE_RUNNER_PROVIDER=http).",
    };
  if (msg === "PY_RUN_TIMEOUT")
    return {
      ok: false,
      error: "PROVIDER_TIMEOUT",
      message:
        "Kode memakan waktu terlalu lama (>15 detik). Hindari perulangan tak berujung di mode browser.",
    };
  return {
    ok: false,
    error: "PROVIDER_ERROR",
    message: `Gagal menjalankan Python di browser: ${msg}`,
  };
}

function injectScript(url: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("BROWSER_ONLY"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-pyodide-entry]");
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = url;
    el.async = true;
    el.setAttribute("data-pyodide-entry", "true");
    const timer = window.setTimeout(() => {
      el.remove();
      reject(new Error("PYODIDE_LOAD_TIMEOUT"));
    }, timeoutMs);
    el.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      el.remove();
      reject(new Error("PYODIDE_LOAD_FAILED"));
    };
    document.head.appendChild(el);
  });
}

async function waitForLoader(timeoutMs: number): Promise<PyodideLoader> {
  const win = globalForPyodide();
  const deadline = Date.now() + timeoutMs;
  while (!win.loadPyodide) {
    if (Date.now() > deadline) throw new Error("PYODIDE_LOAD_TIMEOUT");
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return win.loadPyodide;
}

/** Instance Pyodide dimuat SEKALI (singleton); gagal → bisa dicoba ulang. */
let instancePromise: Promise<PyodideInstance> | null = null;

export async function loadPyodideInstance(): Promise<PyodideInstance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      await injectScript(PYODIDE_ENTRY_URL, PYODIDE_LOAD_TIMEOUT_MS);
      const loader = await waitForLoader(PYODIDE_LOAD_TIMEOUT_MS);
      return loader({ indexURL: `${PYODIDE_CDN_URL}/` });
    })();
    instancePromise.catch(() => {
      instancePromise = null;
    });
  }
  return instancePromise;
}

/** Reset loader (dipakai tests/keadaan darurat). */
export function resetPyodideSingleton(): void {
  instancePromise = null;
}

/**
 * Jalankan kode Python di browser. Validasi ukuran sama seperti rute server
 * (validateRunInput). Exception Python → exit code 1 + stderr (paritas dengan
 * respons Piston); error infra/CDN → fail-closed outcome.
 */
export async function runPythonInBrowser(input: {
  code: string;
  stdin?: string;
  /** Waktu tunggu hasil; tidak menginterupsi Python yang sedang berjalan. */
  timeoutMs?: number;
}): Promise<CodeRunOutcome> {
  const stdin = typeof input.stdin === "string" ? input.stdin : "";
  const invalid = validateRunInput({ language: "python", code: input.code, stdin });
  if (invalid) return invalid;
  if (input.code.length > CODE_RUNNER_MAX_CHARS)
    return {
      ok: false,
      error: "CODE_TOO_LARGE",
      message: `Kode melebihi batas ${CODE_RUNNER_MAX_CHARS} karakter.`,
    };
  if (stdin.length > CODE_RUNNER_MAX_STDIN_CHARS)
    return {
      ok: false,
      error: "STDIN_TOO_LARGE",
      message: `Input melebihi batas ${CODE_RUNNER_MAX_STDIN_CHARS} karakter.`,
    };

  let stdout = "";
  let stderr = "";
  // `batched` (Pyodide 0.26) menghilangkan newline per baris → output
  // menggumpal ("a" + "b" → "ab"). Handler `write` menerima Uint8Array
  // utuh per write — byte-perfect, identik eksekusi native.
  const outDecoder = new TextDecoder("utf-8", { fatal: false });
  const errDecoder = new TextDecoder("utf-8", { fatal: false });
  try {
    const py = await loadPyodideInstance();
    const reader = buildStdinReader(stdin);
    py.setStdout({
      write: (buf) => {
        stdout += outDecoder.decode(buf, { stream: true });
        return buf.length;
      },
    });
    py.setStderr({
      write: (buf) => {
        stderr += errDecoder.decode(buf, { stream: true });
        return buf.length;
      },
    });
    py.setStdin({ stdin: reader, autoEOF: true });
    const timeoutMs = input.timeoutMs ?? BROWSER_RUN_TIMEOUT_MS;
    await Promise.race([
      Promise.resolve().then(() => py.runPython(input.code)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PY_RUN_TIMEOUT")), timeoutMs)),
    ]);
    // Flush decoder sisa buffer (bila ada byte split antre).
    stdout += outDecoder.decode();
    stderr += errDecoder.decode();
    return { ok: true, stdout, stderr, exitCode: stderr.trim() ? 1 : 0 };
  } catch (err) {
    stdout += outDecoder.decode();
    stderr += errDecoder.decode();
    // Exception Python: stderr handler jarang menerima traceback (Pyodide 0.26
    // memformatnya ke `message` error), jadi deteksi eksplisit → exit 1,
    // paritas dengan respons Piston (bukan kegagalan infrastruktur).
    if (stderr.trim() || isPythonTraceback(err)) {
      return {
        ok: true,
        stdout,
        stderr: stderr.trim() ? stderr : err instanceof Error ? err.message : String(err),
        exitCode: 1,
      };
    }
    return mapPyodideError(err);
  }
}
