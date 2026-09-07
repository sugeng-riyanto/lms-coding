// Org-admin context (server-only): gate untuk halaman/aksi admin org.
//
// ADR-008: Owner/Guru adalah SATU kapabilitas — tidak ada role `owner` terpisah.
// Facet "Owner" diekspresikan via `courses.owner_id`. Karena itu org-admin di sini
// = guru yang (a) punya membership teacher aktif di org DAN (b) memiliki ≥1 course
// di org tsb. Guru biasa (anggota tapi bukan pemilik course) TETAP terbatas pada
// cohort miliknya (RBAC.md: "guru membaca murid hanya jika mengajar cohort terkait");
// mereka TIDAK mendapat akses admin org-wide.

import { createClient } from "@/lib/supabase/server";

export interface OrgAdminContext {
  uid: string;
  orgId: string;
}

/**
 * Cek org-admin: claims → membership teacher aktif → memiliki ≥1 course di org.
 * Mengembalikan konteks { uid, orgId } atau null (bukan admin / sesi tak valid).
 */
export async function getOrgAdminContext(): Promise<OrgAdminContext | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return null;

  const { data: mem } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", uid)
    .eq("role", "teacher")
    .eq("status", "active")
    .limit(1)
    .single();
  const orgId = (mem as { organization_id: string } | null)?.organization_id;
  if (!orgId) return null;

  // Facet Owner: harus memiliki course di org tsb.
  const { data: owned } = await supabase
    .from("courses")
    .select("id")
    .eq("owner_id", uid)
    .eq("organization_id", orgId)
    .limit(1);
  if (!owned || owned.length === 0) return null;

  return { uid, orgId };
}
