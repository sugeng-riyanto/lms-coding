import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/permissions";
import { assertServerResolvedRole } from "@/lib/permissions";
import { DEMO_USER_ID, isDemoBackend } from "@/lib/supabase/demo";

export interface SessionIdentity {
  userId: string;
  role: Role;
  organizationIds: string[];
}

/**
 * Guard server-side: session valid (getClaims) → profile aktif →
 * membership aktif dengan salah satu role yang diizinkan.
 * Role TIDAK PERNAH dibaca dari user_metadata/client.
 *
 * Mode demo (DEV-ONLY, tanpa env Supabase): identitas demo dikembalikan agar
 * shell murid/guru tetap render (state kosong + banner). Halaman di bawahnya
 * memakai demo client kosong sehingga TIDAK ada data nyata/palsu.
 */
export async function requireActiveMembership(allowed: Role[]): Promise<SessionIdentity> {
  if (isDemoBackend()) {
    return { userId: DEMO_USER_ID, role: allowed[0] ?? "student", organizationIds: [] };
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", userId).single();
  if (!profile || (profile as { status: string }).status !== "active") redirect("/account-inactive");

  const { data: rows } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active");
  const memberships = (rows as { organization_id: string; role: string }[] | null) ?? [];
  const hit = memberships.find((m) => allowed.includes(assertServerResolvedRole(m.role)));
  if (!hit) redirect("/unauthorized");

  return {
    userId,
    role: assertServerResolvedRole(hit.role),
    organizationIds: memberships.map((m) => m.organization_id),
  };
}
