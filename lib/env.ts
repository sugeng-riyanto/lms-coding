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
