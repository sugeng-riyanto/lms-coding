import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Sertifikatku: unduh PDF resmi (permission-checked) + verifikasi + cetak. */
async function getMine(userId: string) {
  const supabase = await createClient();
  const { data: enrs } = await supabase.from("enrollments").select("id").eq("student_id", userId);
  const ids = ((enrs as { id: string }[] | null) ?? []).map((e) => e.id);
  if (ids.length === 0) return [];
  const { data: certs } = await supabase
    .from("certificates")
    .select("public_id,serial_no,status,issued_at,level_id")
    .in("enrollment_id", ids)
    .order("issued_at", { ascending: false });
  const out: { publicId: string; serial: string; status: string; issuedAt: string; level: string }[] = [];
  for (const c of (certs as
    { public_id: string; serial_no: string; status: string; issued_at: string; level_id: string }[] | null) ??
    []) {
    const { data: lv } = await supabase.from("levels").select("title").eq("id", c.level_id).single();
    out.push({
      publicId: c.public_id,
      serial: c.serial_no,
      status: c.status,
      issuedAt: c.issued_at,
      level: (lv as { title: string } | null)?.title ?? "—",
    });
  }
  return out;
}

export default async function MyCertificatesPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub ?? "";
  let certs: Awaited<ReturnType<typeof getMine>> = [];
  try {
    certs = await getMine(userId);
  } catch {
    certs = [];
  }
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Sertifikatku</h1>
      {certs.length === 0 ? (
        <p className="mt-6 rounded-xl border p-5" role="status">
          Belum ada sertifikat. Selesaikan level hingga eligible, lalu minta guru menerbitkan.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {certs.map((c) => (
            <li key={c.publicId} className="rounded-xl border p-4">
              <p className="font-semibold">{c.level}</p>
              <p className="font-mono text-sm text-slate-600">
                {c.serial} · {c.status} · {c.issuedAt}
              </p>
              {c.status === "active" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/certificates/${c.publicId}/pdf`}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Unduh PDF resmi
                  </a>
                  <Link
                    href={`/certificates/${c.publicId}`}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  >
                    Cetak
                  </Link>
                  <Link
                    href={`/verify/${c.publicId}`}
                    className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  >
                    Verifikasi
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-sm text-red-700">
                  Sertifikat ini dicabut; unduhan valid tidak tersedia.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
