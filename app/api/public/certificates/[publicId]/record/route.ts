import { NextResponse } from "next/server";
import { verifyPublicIdSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { createStrictClient as createClient } from "@/lib/supabase/server";

/**
 * GET /api/public/certificates/{publicId}/record
 * Digital record sertifikat, machine-readable, untuk verifikasi pihak ketiga
 * (sekolah lain / pemberi kerja / sistem lain). Menyajikan apa yang kertas tidak
 * bisa bawa: payload_hash PENUH + kelengkapan per modul (tanpa batas 6 baris PDF).
 *
 * Postur privasi (minimum disclosure, ADR-009):   *   - Hanya kolom whitelist dari RPC kurasi get_public_certificate_record
 *     (security definer, di-revoke dari PUBLIC; migration
 *     20260907123000_public_certificate_record_rpc). View mentah tetap 0 baris
 *     untuk anon.
 *   - TIDAK ada email, jawaban, nilai detail, waktu belajar, atau storage path.
 *   - Aritmetika kelengkapan IDENTIK dengan PDF halaman 2 dan Rekam digital web,
 *     jadi kertas ↔ web ↔ JSON tidak pernah berselisih.
 */
export const dynamic = "force-dynamic";

export type PublicCertificateRecordModule = {
  position: number;
  title: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  activitiesCompleted: number;
  activitiesTotal: number;
  percent: number;
};

type RpcModule = {
  position: number;
  title: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  activitiesCompleted: number;
  activitiesTotal: number;
  percent: number;
};

type RecordRpcRow = {
  status: string;
  displayName: string | null;
  courseTitle: string | null;
  levelTitle: string | null;
  issuedAt: string | null;
  serialNo: string | null;
  payloadHash: string | null;
  chainAnchored: boolean | null;
  chainAnchorStatus: string | null;
  contentPercent: number | null;
  modules: RpcModule[] | null;
};

function anchorStatusOf(raw: string | null | undefined): "none" | "pending" | "final" | "failed" {
  return raw === "pending" || raw === "final" || raw === "failed" ? raw : "none";
}

export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const parsed = verifyPublicIdSchema.safeParse({ publicId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "Invalid certificate ID." } },
      { status: 400 },
    );
  }
  if (!checkRateLimit(`record:${parsed.data.publicId.slice(0, 8)}`, 30, 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests." } },
      { status: 429 },
    );
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_certificate_record", {
      p_public_id: parsed.data.publicId,
    });
    if (error || !data) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }
    const row = data as unknown as RecordRpcRow;
    const generatedAt = new Date().toISOString();

    if (row.status === "revoked") {
      return NextResponse.json({
        schema: "certificate.digital-record/v1",
        status: "revoked",
        generatedAt,
        certificate: { issuedAt: row.issuedAt ?? null },
      });
    }

    const modules: PublicCertificateRecordModule[] = (row.modules ?? []).map((m) => ({
      position: m.position,
      title: m.title,
      lessonsCompleted: Number(m.lessonsCompleted ?? 0),
      lessonsTotal: Number(m.lessonsTotal ?? 0),
      activitiesCompleted: Number(m.activitiesCompleted ?? 0),
      activitiesTotal: Number(m.activitiesTotal ?? 0),
      percent: Number(m.percent ?? 0),
    }));

    const payloadHash = row.payloadHash ?? "";

    return NextResponse.json({
      schema: "certificate.digital-record/v1",
      status: "valid",
      generatedAt,
      recipient: { displayName: row.displayName ?? null },
      certificate: {
        publicId: parsed.data.publicId,
        courseTitle: row.courseTitle ?? null,
        levelTitle: row.levelTitle ?? null,
        issuedAt: row.issuedAt ?? null,
        serialNo: row.serialNo ?? null,
      },
      authenticity: {
        algorithm: "SHA-256",
        serialization: "canonical-json",
        payloadHash,
        fingerprint: payloadHash ? payloadHash.slice(0, 12).toUpperCase() : null,
        chainAnchored: row.chainAnchored === true,
        chainAnchor: { status: anchorStatusOf(row.chainAnchorStatus) },
      },
      completeness: {
        contentPercent: Number(row.contentPercent ?? 0),
        modules,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "VERIFIER_ERROR", message: "Verification failed." } },
      { status: 500 },
    );
  }
}
