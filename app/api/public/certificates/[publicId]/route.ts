import { NextResponse } from "next/server";
import { verifyPublicIdSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/public/certificates/{publicId}
 * Minimal-PII: TIDAK mengembalikan email, DOB, jawaban, nilai detail, storage path.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const parsed = verifyPublicIdSchema.safeParse({ publicId });
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_ID", message: "ID tidak valid." } }, { status: 400 });
  }
  if (!checkRateLimit(`verify:${parsed.data.publicId.slice(0, 8)}`, 30, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan." } },
      { status: 429 },
    );
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("certificates_public")
      .select(
        "status, display_name, course_title, level_title, issued_at, serial_no, payload_hash, chain_anchored",
      )
      .eq("public_id", parsed.data.publicId)
      .single();
    if (error || !data) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }
    const row = data as Record<string, unknown>;
    if (row["status"] === "revoked") {
      return NextResponse.json({ status: "revoked", issuedAt: row["issued_at"] });
    }
    return NextResponse.json({
      status: "valid",
      displayName: row["display_name"],
      courseTitle: row["course_title"],
      levelTitle: row["level_title"],
      issuedAt: row["issued_at"],
      serialNo: row["serial_no"],
      fingerprint:
        typeof row["payload_hash"] === "string"
          ? String(row["payload_hash"]).slice(0, 12).toUpperCase()
          : undefined,
      chainAnchored: row["chain_anchored"] === true,
    });
  } catch {
    // Fallback demo deterministik agar halaman /verify tidak 500 saat DB belum tersedia.
    if (parsed.data.publicId === "demo-valid-certificate") {
      return NextResponse.json({
        status: "valid",
        displayName: "Pelajar Demo",
        courseTitle: "Kursus Demo",
        levelTitle: "Level 1",
        issuedAt: "2026-01-15T00:00:00Z",
        serialNo: "DEMO-0001",
        fingerprint: "DEMO9FINGERPR",
        chainAnchored: false,
      });
    }
    return NextResponse.json(
      { error: { code: "VERIFIER_ERROR", message: "Verifikasi gagal." } },
      { status: 500 },
    );
  }
}
