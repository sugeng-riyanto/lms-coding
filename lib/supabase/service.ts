import { createClient } from "@supabase/supabase-js";

/**
 * Service client — HANYA untuk trusted server code yang benar-benar butuh bypass RLS
 * (grading otomatis, receipts integrasi). JANGAN pernah impor dari Client Components.
 * Diproteksi berlapis: env server-only + import dari Server Actions/Route Handlers saja.
 */
export function createServiceClient() {
  if (typeof window !== "undefined") throw new Error("SERVICE_CLIENT_BROWSER_FORBIDDEN");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Missing SUPABASE server env");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
