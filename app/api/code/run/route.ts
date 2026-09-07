import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import {
  CODE_RUNNER_MAX_CHARS,
  CODE_RUNNER_MAX_STDIN_CHARS,
  createCodeRunnerProvider,
  validateRunInput,
  type CodeRunOutcome,
} from "@/lib/code-runner";

export const dynamic = "force-dynamic";

/**
 * POST /api/code/run — jalankan kode di sandbox EKSTERNAL (provider
 * Piston-compatible yang dikonfigurasi). Wajib login; body kecil; fail-closed.
 * Kode/output TIDAK pernah disimpan atau dicatat.
 */
const bodySchema = z.object({
  language: z.string().min(1).max(40),
  code: z.string().max(CODE_RUNNER_MAX_CHARS),
  stdin: z.string().max(CODE_RUNNER_MAX_STDIN_CHARS).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Silakan masuk dulu." }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw: unknown = await req.json();
    const res = bodySchema.safeParse(raw);
    if (!res.success) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Payload tidak valid." }, { status: 400 });
    }
    parsed = res.data;
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Body harus JSON." }, { status: 400 });
  }

  const invalid = validateRunInput(parsed);
  if (invalid) {
    const status = invalid.error === "UNSUPPORTED_LANGUAGE" ? 400 : 413;
    return NextResponse.json(invalid, { status });
  }

  const env = getServerEnv();
  const provider = createCodeRunnerProvider({
    enabled: env.CODE_RUNNER_ENABLED,
    provider: env.CODE_RUNNER_PROVIDER,
    baseUrl: env.CODE_RUNNER_BASE_URL,
    apiKey: env.CODE_RUNNER_API_KEY,
  });
  if (!provider) {
    const outcome: CodeRunOutcome = {
      ok: false,
      error: "CODE_RUNNER_DISABLED",
      message:
        "Code runner belum diaktifkan di server ini (CODE_RUNNER_ENABLED). Hubungi administrator sekolah.",
    };
    return NextResponse.json(outcome, { status: 503 });
  }

  let outcome: CodeRunOutcome;
  try {
    outcome = await provider.run(parsed);
  } catch {
    outcome = {
      ok: false,
      error: "PROVIDER_ERROR",
      message: "Gagal menjalankan kode. Coba lagi sebentar.",
    };
  }

  if (!outcome.ok) {
    const status =
      outcome.error === "PROVIDER_TIMEOUT" ? 504 : outcome.error === "PROVIDER_UNCONFIGURED" ? 503 : 502;
    return NextResponse.json(outcome, { status });
  }
  return NextResponse.json(outcome);
}
