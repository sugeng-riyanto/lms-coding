import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { EditProfile } from "@/app/profile/edit-profile";
import { LogoutButton } from "@/app/profile/logout-button";
import { COMMON, type Lang } from "@/lib/i18n";

/**
 * Panel pengaturan milik-sendiri: akun (RLS: baris sendiri), preferensi
 * perangkat (tema/teks tersimpan lokal), dan sesi (keluar). Tanpa data
 * orang lain — aman untuk semua peran.
 */
export async function SettingsPanel({ lang, children }: { lang?: Lang; children?: React.ReactNode }) {
  const l = lang ?? "id";
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
      <section
        aria-label={COMMON.myAccount[l]}
        className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"
      >
        <h2 className="font-bold">{COMMON.myAccount[l]}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{COMMON.email[l]}</dt>
            <dd className="font-semibold break-all">{email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{COMMON.displayName[l]}</dt>
            <dd className="font-semibold">{p?.display_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">{COMMON.roles[l]} (server)</dt>
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
        aria-label={l === "id" ? "Preferensi tampilan" : "Display preferences"}
        className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"
      >
        <h2 className="font-bold">{COMMON.devicePrefs[l]}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{COMMON.devicePrefsBody[l]}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm">{l === "id" ? "Tema:" : "Theme:"}</span>
          <ThemeToggle lang={l} />
          {children}
        </div>
      </section>

      <section
        aria-label={l === "id" ? "Sesi" : "Session"}
        className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900"
      >
        <h2 className="font-bold">{l === "id" ? "Sesi" : "Session"}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {l === "id" ? "Keluar dari akun ini di perangkat ini." : "Sign out of this account on this device."}
        </p>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
