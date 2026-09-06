"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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
      router.push("/learn");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Login gagal. Coba lagi.");
    }
  }

  return (
    <main id="main" className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">Masuk</h1>
      <p className="mt-2 text-slate-600">Guru dan murid memakai akun sekolah. Session refresh otomatis.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" aria-label="Form login">
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
            Kata sandi
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
            Berhasil — mengalihkan…
          </p>
        )}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {status === "loading" ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        Demo lokal: gunakan user dari <code>supabase/seed.sql</code>.
      </p>
    </main>
  );
}
