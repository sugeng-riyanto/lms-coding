"use client";

import { useMemo, useState } from "react";
import { runPythonInBrowser } from "@/lib/browser-python";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { CODE } from "@/lib/ui-text/code-runner";
import {
  CODE_RUNNER_LANGUAGES,
  browserEngineFor,
  buildCodeAiPrompt,
  type CodeRunOutcome,
} from "@/lib/code-runner";

/** Eksekusi in-browser (Pyodide) hanya aktif bila operator mengizinkan. */
const BROWSER_RUN_ENABLED = process.env.NEXT_PUBLIC_CODE_RUNNER_IN_BROWSER === "true";

/** Hasil tampilan: memungkinkan error UI non-provider (mis. 401) juga. */
type RunDisplay = CodeRunOutcome | { ok: false; error: string; message: string };

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }
}

export function CodeRunner({
  starterCode,
  starterLanguage = "python",
  lang,
}: {
  starterCode?: string;
  starterLanguage?: string;
  lang: Lang;
}) {
  const t = mkT(CODE, lang);
  const initialLang = CODE_RUNNER_LANGUAGES.some((l) => l.id === starterLanguage)
    ? starterLanguage
    : "python";
  const [langId, setLangId] = useState(initialLang);
  const [code, setCode] = useState(starterCode ?? "");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunDisplay | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);

  const def = useMemo(
    () => CODE_RUNNER_LANGUAGES.find((l) => l.id === langId) ?? CODE_RUNNER_LANGUAGES[0]!,
    [langId],
  );

  /** Mesin untuk bahasa aktif: pyodide (in-browser) bila diizinkan, else null. */
  const engine = BROWSER_RUN_ENABLED ? browserEngineFor(langId) : null;

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      if (engine === "pyodide") {
        // Python: eksekusi WASM di perangkat murid — tanpa POST ke server.
        const outcome = await runPythonInBrowser({ code, stdin });
        setResult(outcome);
        return;
      }
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: langId, code, stdin }),
      });
      let body: RunDisplay;
      try {
        body = (await res.json()) as RunDisplay;
      } catch {
        body = { ok: false, error: "PROVIDER_ERROR", message: t("badResponse") };
      }
      if (res.status === 401) {
        body = { ok: false, error: "UNAUTHORIZED", message: t("unauthorized") };
      }
      setResult(body);
    } catch {
      setResult({
        ok: false,
        error: "PROVIDER_ERROR",
        message: t("networkError"),
      });
    } finally {
      setRunning(false);
    }
  }

  async function copyCode() {
    await copyText(code);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 2000);
  }

  const aiPrompt = buildCodeAiPrompt({
    language: def.label,
    code,
    stdout: result?.ok ? result.stdout : undefined,
    stderr: result?.ok ? result.stderr : undefined,
    exitCode: result?.ok ? result.exitCode : null,
  });

  async function copyAi() {
    await copyText(aiPrompt);
    setAiCopied(true);
    window.setTimeout(() => setAiCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-soft)] dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="text-sm font-bold">{t("title")}</p>
        <button
          type="button"
          onClick={copyCode}
          disabled={!code}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-50 dark:border-slate-600"
        >
          {codeCopied ? t("copied") : t("copyCode")}
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div>
            <label htmlFor="cr-lang" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("language")}
              {engine === "pyodide" && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                  {t("inBrowserWasm")}
                </span>
              )}
            </label>
            <select
              id="cr-lang"
              value={langId}
              onChange={(e) => setLangId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm sm:w-44"
            >
              {CODE_RUNNER_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            {!code && (
              <button
                type="button"
                onClick={() => setCode(def.starter)}
                className="mt-1.5 block text-xs font-semibold text-blue-700 underline dark:text-blue-300"
              >
                {fmt(t("loadExample"), { language: def.label })}
              </button>
            )}
          </div>
          <div>
            <label htmlFor="cr-stdin" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("stdinLabel")}
            </label>
            <input
              id="cr-stdin"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder={t("stdinPlaceholder")}
              className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cr-code" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {fmt(t("codeLabel"), { language: def.label })}
          </label>
          <textarea
            id="cr-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            rows={10}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-900 p-3 font-mono text-sm leading-relaxed text-slate-100 dark:border-slate-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running || !code.trim()}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
          >
            {running ? t("running") : t("run")}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {engine === "pyodide" ? t("browserEngineNote") : t("externalEngineNote")}
          </p>
        </div>

        {result && !result.ok && (
          <p
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            <strong>{result.error}</strong> — {result.message}
          </p>
        )}

        {result?.ok && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {t("output")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                exit code: <strong>{result.exitCode ?? "—"}</strong>
              </p>
            </div>
            <pre
              className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-950"
              role="status"
            >
              {result.stdout || t("stdoutEmpty")}
              {result.stderr ? `\n\n— stderr —\n${result.stderr}` : ""}
            </pre>
          </div>
        )}

        <details className="rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40">
          <summary className="cursor-pointer text-xs font-semibold text-blue-800 select-none dark:text-blue-300">
            {t("aiPromptTitle")}
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">{t("aiPromptBody")}</p>
            <pre className="max-h-56 overflow-auto rounded-lg border bg-white p-2 text-[11px] whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {aiPrompt}
            </pre>
            <button
              type="button"
              onClick={copyAi}
              className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-soft)] transition hover:-translate-y-px hover:shadow-[var(--shadow-lift)]"
            >
              {aiCopied ? t("copied") : t("copyAiPrompt")}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
