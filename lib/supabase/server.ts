import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createDemoClient, isDemoBackend } from "@/lib/supabase/demo";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Server Supabase client per-request (jangan di-cache antar request).
 * Pola resmi @supabase/ssr 0.12.x + Next.js Proxy.
 *
 * `createClient()` dipakai jalur RENDER (Server Components): di `next dev`
 * tanpa env Supabase ia mengembalikan demo client kosong (mode demo berlabel,
 * lihat lib/supabase/demo.ts) agar halaman guarded tetap render.
 * `createStrictClient()` dipakai jalur WRITE/API (server actions, route
 * handlers): env hilang → THROW (fail closed, tidak pernah sukses diam-diam).
 */
export async function createClient(): Promise<ServerClient> {
  if (isDemoBackend()) {
    // Demo client tidak menyamai tipe generik SupabaseClient secara struktural;
    // API runtime yang dipakai halaman (from/select + auth.getClaims) dipenuhi.
    return createDemoClient() as unknown as ServerClient;
  }
  return createStrictClient();
}

/** Variant ketat untuk server actions & API handlers. */
export async function createStrictClient(): Promise<ServerClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Dipanggil dari Server Component: Proxy yang menulis cookie.
        }
      },
    },
  });
}
