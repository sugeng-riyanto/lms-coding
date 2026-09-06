import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

/** Profil minimal: data sendiri + peran + tombol keluar. */
export default async function ProfilePage() {
  const supabase = await createClient();
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
      <h1 className="text-3xl font-bold">Profil</h1>
      {p ? (
        <dl className="mt-6 space-y-2 rounded-xl border p-5">
          <div className="flex justify-between">
            <dt className="text-slate-500">Nama tampilan</dt>
            <dd className="font-semibold">{p.display_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-semibold" role="status">
              {p.status}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Peran (server)</dt>
            <dd className="font-semibold">{roles.length > 0 ? roles.join(", ") : "—"}</dd>
          </div>
        </dl>
      ) : (
        <p role="alert" className="mt-6 rounded-xl border p-5">
          Profil belum tersedia. Hubungi admin sekolah.
        </p>
      )}
      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}
