import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mode demo DEV-ONLY (tanpa Supabase lokal).
 *
 * Tujuan: di `next dev` tanpa env Supabase, halaman guarded (murid/guru/profil)
 * tetap RENDER (state kosong + banner "Mode demo") alih-alih melempar
 * Missing-env → error boundary. Ini MURNI untuk pengalaman preview lokal.
 *
 * Pengamanan:
 * - Hanya aktif bila `NODE_ENV === "development"` DAN env Supabase tidak ada.
 *   Produksi (`next build`/`next start`, NODE_ENV=production) TIDAK pernah
 *   memakai mode ini — env hilang di produksi tetap gagal (fail closed).
 * - Dataset SELALU kosong: tidak ada data palsu yang disajikan sebagai nyata.
 * - Server actions & API handlers memakai `createStrictClient`
 *   (lihat lib/supabase/server.ts) sehingga TIDAK ada write yang sukses
 *   secara diam-diam tanpa backend.
 * - Role demo tidak pernah dibaca dari user_metadata; guard server
 *   mengembalikan identitas demo secara eksplisit (lihat lib/auth/guards.ts).
 */
export const DEMO_USER_ID = "00000000-0000-0000-0000-00000000dead";

export function isDemoBackend(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

const NO_ROW = Object.freeze({ message: "No rows found", details: "", hint: "", code: "PGRST116" });

type DemoRowResult = { data: unknown; error: unknown; count?: number };

/**
 * Query builder demo: setiap filter no-op, hasil SELALU kosong
 * ([] untuk list, null + error PGRST116 untuk .single(), count 0).
 */
class DemoQueryBuilder implements PromiseLike<DemoRowResult> {
  #mode: "list" | "single" | "maybeSingle" | "count" = "list";

  select(_columns?: string, opts?: { count?: string; head?: boolean }): this {
    if (opts?.head || opts?.count === "exact") this.#mode = "count";
    return this;
  }

  single(): this {
    this.#mode = "single";
    return this;
  }

  maybeSingle(): this {
    this.#mode = "maybeSingle";
    return this;
  }

  // Modifier filter/urutan: no-op — dataset demo selalu kosong.
  eq(): this {
    return this;
  }

  neq(): this {
    return this;
  }

  in(): this {
    return this;
  }

  not(): this {
    return this;
  }

  contains(): this {
    return this;
  }

  ilike(): this {
    return this;
  }

  gte(): this {
    return this;
  }

  lte(): this {
    return this;
  }

  range(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  #result(): DemoRowResult {
    if (this.#mode === "count") return { data: null, error: null, count: 0 };
    if (this.#mode === "single") return { data: null, error: NO_ROW };
    if (this.#mode === "maybeSingle") return { data: null, error: null };
    return { data: [], error: null };
  }

  then<TResult1 = DemoRowResult, TResult2 = never>(
    onfulfilled?: ((value: DemoRowResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = this.#result();
    try {
      const value = onfulfilled ? onfulfilled(result) : result;
      return Promise.resolve(value as TResult1 | TResult2);
    } catch (err) {
      return onrejected ? Promise.resolve(onrejected(err)) : Promise.reject(err);
    }
  }
}

/** Client Supabase demo: auth tanpa session-user nyata + query kosong. */
export function createDemoClient() {
  const demo: Record<string, unknown> = {
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: DEMO_USER_ID, role: "authenticated", demo: true } },
        error: null,
      }),
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: (_table: string) => new DemoQueryBuilder(),
    rpc: async () => ({ data: null, error: NO_ROW }),
  };
  return demo as unknown as SupabaseClient;
}
