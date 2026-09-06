import { notFound } from "next/navigation";

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
            <dt className="text-slate-500">Fingerprint</dt>
            <dd className="font-mono">{data.fingerprint}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-500">Record</dt>
          <dd className="font-semibold">{valid ? "valid" : data.status}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Blockchain</dt>
          <dd className="font-semibold">
            {data.chainAnchored ? "anchored" : "tidak di-anchor (verifikasi tetap kriptografis)"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-slate-500">
        Halaman publik ini tidak menampilkan email, tanggal lahir, jawaban, nilai detail, atau storage path.
      </p>
    </main>
  );
}
