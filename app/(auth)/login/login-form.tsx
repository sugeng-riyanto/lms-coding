"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { isDemoBackend } from "@/lib/supabase/demo";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setStatus("done");
      // The role hub (/dashboard) redirects according to server-side membership:
      // teacher → /teacher, guardian → /guardian, student → /learn.
      router.push("/dashboard");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    }
  }

  return (
    <main id="main" className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="card-lift rounded-3xl border bg-white p-6 shadow-[var(--shadow-lift)] sm:p-8 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-base font-black text-white shadow-[var(--glow-btn)]"
            >
              CS
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
          </div>
          <ThemeToggle />
        </div>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Use the account provided by your school.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" aria-label="Sign in form">
          <div>
            <label htmlFor="email" className="font-semibold">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="font-semibold">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>
          {status === "error" && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
              {message}
            </p>
          )}
          {status === "done" && (
            <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
              Signed in — redirecting…
            </p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-[var(--glow-btn)] transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
          >
            {status === "loading" ? "Checking…" : "Sign in"}
          </button>
        </form>
        {isDemoBackend() ? (
          <p className="mt-4 text-sm text-slate-500">
            Demo mode: use a sample account from <code>supabase/seed.sql</code>.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Connected to the school server. Use the account your institution provided.
          </p>
        )}
      </div>
    </main>
  );
}
