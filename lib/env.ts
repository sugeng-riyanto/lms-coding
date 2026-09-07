import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10).optional(),
  CERTIFICATE_SIGNING_SECRET: z.string().min(32),
  BLOCKCHAIN_ANCHOR_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  BLOCKCHAIN_PROVIDER: z.string().optional(),
  BLOCKCHAIN_NETWORK: z.string().optional(),
  // Algorand (rekomendasi ADR-018): KOSONG sampai provider dipilih manusia +
  // kredensial aman tersedia; kosong = shell inert (Noop → BLOCKCHAIN_PROVIDER_PENDING).
  BLOCKCHAIN_ALGORAND_RPC_URL: z.string().optional(),
  BLOCKCHAIN_ALGORAND_API_KEY: z.string().optional(),
  AI_FEEDBACK_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Provider AI draft feedback (ADR-017): kosong = fitur menolak runtime
  // AI_PROVIDER_UNCONFIGURED; file env tetap valid tanpa provider.
  AI_PROVIDER: z.string().optional(),
  AI_PROVIDER_BASE_URL: z.string().optional(),
  AI_PROVIDER_API_KEY: z.string().optional(),
  // Code runner multi-bahasa: NONAKTIF default (fail-closed). Eksekusi di
  // sandbox EKSTERNAL (provider Piston-compatible), bukan server LMS.
  CODE_RUNNER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CODE_RUNNER_PROVIDER: z.string().optional(),
  CODE_RUNNER_BASE_URL: z.string().optional(),
  CODE_RUNNER_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    CERTIFICATE_SIGNING_SECRET: process.env.CERTIFICATE_SIGNING_SECRET,
    BLOCKCHAIN_ANCHOR_ENABLED: process.env.BLOCKCHAIN_ANCHOR_ENABLED,
    BLOCKCHAIN_PROVIDER: process.env.BLOCKCHAIN_PROVIDER,
    BLOCKCHAIN_NETWORK: process.env.BLOCKCHAIN_NETWORK,
    BLOCKCHAIN_ALGORAND_RPC_URL: process.env.BLOCKCHAIN_ALGORAND_RPC_URL,
    BLOCKCHAIN_ALGORAND_API_KEY: process.env.BLOCKCHAIN_ALGORAND_API_KEY,
    AI_FEEDBACK_ENABLED: process.env.AI_FEEDBACK_ENABLED,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_PROVIDER_BASE_URL: process.env.AI_PROVIDER_BASE_URL,
    AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY,
    CODE_RUNNER_ENABLED: process.env.CODE_RUNNER_ENABLED,
    CODE_RUNNER_PROVIDER: process.env.CODE_RUNNER_PROVIDER,
    CODE_RUNNER_BASE_URL: process.env.CODE_RUNNER_BASE_URL,
    CODE_RUNNER_API_KEY: process.env.CODE_RUNNER_API_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  cached = parsed.data;
  return parsed.data;
}

/** Reset cache — hanya untuk tests. */
export function __resetEnvCache(): void {
  cached = null;
}
