import { notFound } from "next/navigation";
import { createStrictClient as createClient } from "@/lib/supabase/server";

/** PDF route (/api/certificates/{publicId}/pdf) requires owner-student or cohort-teacher (ADR-009). */
async function canViewPdf(publicId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    // RLS on certificates (own / cohort teacher) decides; anon gets no row.
    const { data } = await supabase.from("certificates").select("id").eq("public_id", publicId).maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

async function fetchVerification(publicId: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/public/certificates/${encodeURIComponent(publicId)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Verifier error");
  return (await res.json()) as {
    status: string;
    displayName?: string;
    courseTitle?: string;
    levelTitle?: string;
    issuedAt?: string;
    serialNo?: string;
    fingerprint?: string;
    chainAnchored?: boolean;
    chainAnchor?: { status: "none" | "pending" | "final" | "failed" };
  };
}

export default async function VerifyPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let data: Awaited<ReturnType<typeof fetchVerification>>;
  try {
    data = await fetchVerification(publicId, baseUrl);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-bold">Verifikasi tidak tersedia</h1>
        <p role="alert" className="mt-2">
          Coba lagi nanti. Tidak ada data pribadi yang ditampilkan.
        </p>
      </main>
    );
  }
  if (!data) notFound();

  const valid = data.status === "valid";
  const authorizedForPdf = valid ? await canViewPdf(publicId) : false;
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <p className="text-sm font-semibold text-slate-500">Verifikasi sertifikat</p>
      <h1 className="mt-1 text-3xl font-bold">{valid ? "Sertifikat valid ✓" : `Status: ${data.status}`}</h1>
      <dl className="mt-6 space-y-2 rounded-xl border p-5">
        {data.displayName && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Penerima</dt>
            <dd className="font-semibold">{data.displayName}</dd>
          </div>
        )}
        {data.courseTitle && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Course</dt>
            <dd className="font-semibold">{data.courseTitle}</dd>
          </div>
        )}
        {data.levelTitle && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Level</dt>
            <dd className="font-semibold">{data.levelTitle}</dd>
          </div>
        )}
        {data.issuedAt && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Terbit</dt>
            <dd className="font-semibold">{data.issuedAt}</dd>
          </div>
        )}
        {data.serialNo && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Serial</dt>
            <dd className="font-mono">{data.serialNo}</dd>
          </div>
        )}
        {data.fingerprint && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Payload hash</dt>
            <dd className="font-mono">cocok ({data.fingerprint})</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-500">Record</dt>
          <dd className="font-semibold">{valid ? "valid" : data.status}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Blockchain</dt>
          <dd className="font-semibold">
            {data.chainAnchor?.status === "final" ? (
              <span className="text-emerald-700 dark:text-emerald-300">
                terverifikasi di blockchain (anchor final)
              </span>
            ) : data.chainAnchor?.status === "pending" ? (
              <span className="text-amber-700 dark:text-amber-300">
                anchor pending — belum final; tidak diklaim terverifikasi blockchain
              </span>
            ) : data.chainAnchor?.status === "failed" ? (
              <span className="text-red-700 dark:text-red-300">anchor gagal — hubungi penerbit</span>
            ) : (
              "tidak di-anchor (verifikasi tetap kriptografis)"
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800">
          ✓ PDF 2 halaman (A4)
        </span>
        <span className="text-xs text-slate-500">
          Halaman 2 berisi informasi umum &amp; kelengkapan konten (tabel + statistik), dengan QR dan kode
          unik yang sama dengan halaman 1.
        </span>
      </div>
      {valid && authorizedForPdf && (
        <div className="mt-4">
          <a
            href={`/api/certificates/${encodeURIComponent(publicId)}/pdf`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Buka PDF sertifikat (2 halaman)
            <span aria-hidden>↓</span>
          </a>
        </div>
      )}
      {valid && !authorizedForPdf && (
        <p className="mt-4 text-xs text-slate-500">
          PDF hanya dapat dibuka oleh penerima sertifikat atau guru kelas setelah masuk — demi privasi,
          halaman publik ini tidak memuat dokumen tersebut.
        </p>
      )}
      <p className="mt-4 text-sm text-slate-500">
        Halaman publik ini tidak menampilkan email, tanggal lahir, jawaban, nilai detail, atau storage path.
      </p>
    </main>
  );
}
