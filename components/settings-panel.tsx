import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { EditProfile } from "@/app/profile/edit-profile";
import { LogoutButton } from "@/app/profile/logout-button";

/**
 * Panel pengaturan milik-sendiri: akun (RLS: baris sendiri), preferensi
 * perangkat (tema/teks tersimpan lokal), dan sesi (keluar). Tanpa data
 * orang lain — aman untuk semua peran.
 */
export async function SettingsPanel({ children }: { children?: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email ?? "—";

  const { data: profile } = userId
    ? await supabase.from("profiles").select("display_name, status").eq("id", userId).single()
    : { data: null };
  const { data: memberships } = userId
    ? await supabase.from("memberships").select("role, status").eq("user_id", userId)
    : { data: null };
  const p = profile as { display_name: string; status: string } | null;
  const roles = ((memberships as { role: string; status: string }[] | null) ?? []).map(
    (m) => `${m.role} (${m.status})`,
  );

  return (
    <div className="space-y-4">
      <section aria-label="Akun saya" className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="font-bold">Akun saya</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-semibold break-all">{email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Nama tampilan</dt>
            <dd className="font-semibold">{p?.display_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Peran (server)</dt>
            <dd className="font-semibold">{roles.length > 0 ? roles.join(", ") : "—"}</dd>
          </div>
        </dl>
        {p && (
          <div className="mt-4">
            <EditProfile initialName={p.display_name} />
          </div>
        )}
      </section>

      <section
        aria-label="Preferensi tampilan"
        className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"
      >
        <h2 className="font-bold">Preferensi tampilan</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Tersimpan di perangkat ini saja.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm">Tema:</span>
          <ThemeToggle />
          {children}
        </div>
      </section>

      <section aria-label="Sesi" className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="font-bold">Sesi</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Keluar dari akun ini di perangkat ini.
        </p>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
