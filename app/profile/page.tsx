import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang, mkT } from "@/lib/i18n";
import { PROFILE } from "@/lib/ui-text/profile";
import { LogoutButton } from "./logout-button";
import { EditProfile } from "./edit-profile";

export const dynamic = "force-dynamic";

/** Profil minimal: data sendiri + peran + tombol keluar. */
export default async function ProfilePage() {
  const supabase = await createClient();
  const lang = await getLang();
  const t = mkT(PROFILE, lang);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, status")
    .eq("id", userId)
    .single();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", userId);

  const p = profile as { display_name: string; status: string } | null;
  const roles = ((memberships as { role: string; status: string }[] | null) ?? []).map(
    (m) => `${m.role} (${m.status})`,
  );

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      {p ? (
        <dl className="mt-6 space-y-2 rounded-xl border p-5">
          <div className="flex justify-between">
            <dt className="text-slate-500">{t("displayName")}</dt>
            <dd className="font-semibold">{p.display_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">{t("status")}</dt>
            <dd className="font-semibold" role="status">
              {p.status}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">{t("roles")}</dt>
            <dd className="font-semibold">{roles.length > 0 ? roles.join(", ") : "—"}</dd>
          </div>
        </dl>
      ) : (
        <p role="alert" className="mt-6 rounded-xl border p-5">
          {t("unavailable")}
        </p>
      )}
      <div className="mt-6 space-y-4">
        {p && <EditProfile initialName={p.display_name} lang={lang} />}
        <LogoutButton lang={lang} />
      </div>
    </main>
  );
}
