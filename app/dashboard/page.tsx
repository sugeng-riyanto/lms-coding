import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertServerResolvedRole, type Role } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Prioritas dashboard per peran — role di-resolve server-side (memberships),
// TIDAK pernah dari user_metadata/client. Setiap tujuan tetap di-guard ulang.
const DASHBOARD_BY_ROLE: { role: Role; path: string }[] = [
  { role: "teacher", path: "/teacher" },
  { role: "guardian", path: "/guardian" },
  { role: "student", path: "/learn" },
];

/** Hub peran: arahkan user yang baru login ke dashboard yang sesuai perannya. */
export default async function DashboardHub() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!userId) redirect("/login");

  const { data: rows } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");
  const memberships = (rows as { role: string }[] | null) ?? [];

  for (const { role, path } of DASHBOARD_BY_ROLE) {
    if (memberships.some((m) => assertServerResolvedRole(m.role) === role)) redirect(path);
  }
  // Terautentikasi tanpa membership aktif → profil (data sendiri + logout).
  redirect("/profile");
}
