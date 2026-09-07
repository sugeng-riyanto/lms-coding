import { NextResponse } from "next/server";
import { verifyPublicIdSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { createStrictClient as createClient } from "@/lib/supabase/server";

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
    // RPC kurasi (000019): security definer, granted ke anon, mengembalikan persis
    // kolom whitelist. View certificates_public TETAP terkunci utk anon (0 baris),
    // jadi satu-satunya jalur verifikasi publik adalah RPC ini.
    const { data, error } = await supabase.rpc("get_public_certificate", {
      p_public_id: parsed.data.publicId,
    });
    if (error || !data) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }
    const row = data as Record<string, unknown>;
    if (row["status"] === "revoked") {
      return NextResponse.json({ status: "revoked", issuedAt: row["issuedAt"] });
    }
    const rawAnchorStatus = row["chainAnchorStatus"];
    const anchorStatus: "none" | "pending" | "final" | "failed" =
      rawAnchorStatus === "pending" || rawAnchorStatus === "final" || rawAnchorStatus === "failed"
        ? rawAnchorStatus
        : "none";
    return NextResponse.json({
      status: "valid",
      displayName: row["displayName"],
      courseTitle: row["courseTitle"],
      levelTitle: row["levelTitle"],
      issuedAt: row["issuedAt"],
      serialNo: row["serialNo"],
      fingerprint:
        typeof row["payloadHash"] === "string"
          ? String(row["payloadHash"]).slice(0, 12).toUpperCase()
          : undefined,
      chainAnchored: row["chainAnchored"] === true,
      chainAnchor: { status: anchorStatus },
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
        chainAnchor: { status: "none" },
      });
    }
    return NextResponse.json(
      { error: { code: "VERIFIER_ERROR", message: "Verifikasi gagal." } },
      { status: 500 },
    );
  }
}
