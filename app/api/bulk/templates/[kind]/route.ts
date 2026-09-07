import { createClient } from "@/lib/supabase/server";
import { getOrgAdminContext } from "@/lib/org-admin";
import { BULK_TEMPLATES, type BulkTemplateKind } from "@/lib/bulk-template";
import { buildXlsxBuffer, xlsxDownloadHeaders } from "@/lib/bulk-xlsx";

export const dynamic = "force-dynamic";

const ADMIN_KINDS: BulkTemplateKind[] = ["teachers", "assignments"];

/** Unduh template XLSX bulk (header + contoh valid). Guru untuk
 * students/content; org-admin untuk teachers/assignments (cermin aksi impor). */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const def = (BULK_TEMPLATES as Record<string, (typeof BULK_TEMPLATES)[BulkTemplateKind] | undefined>)[kind];
  if (!def) return new Response("UNKNOWN_TEMPLATE", { status: 404 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!uid) return new Response("UNAUTHENTICATED", { status: 401 });

  if ((ADMIN_KINDS as string[]).includes(kind)) {
    const ctx = await getOrgAdminContext();
    if (!ctx) return new Response("FORBIDDEN", { status: 403 });
  } else {
    const { data: mem } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", uid)
      .eq("role", "teacher")
      .eq("status", "active")
      .limit(1)
      .single();
    if (!mem) return new Response("FORBIDDEN", { status: 403 });
  }

  const buf = buildXlsxBuffer(def.sheet, def.headers, def.sample);
  return new Response(new Uint8Array(buf), { headers: xlsxDownloadHeaders(def.fileName) });
}
