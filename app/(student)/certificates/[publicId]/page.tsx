import { notFound } from "next/navigation";
import { PrintButton } from "./print-button";

/**
 * Halaman sertifikat siap cetak A4 landscape.
 * Murid mengunduh/mencetak via browser print → PDF (private, butuh login + ownership).
 * Revoked → tidak menampilkan sertifikat valid.
 */
async function getCertificate(publicId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/public/certificates/${encodeURIComponent(publicId)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("fetch failed");
  return (await res.json()) as {
    status: string;
    displayName?: string;
    courseTitle?: string;
    levelTitle?: string;
    issuedAt?: string;
    serialNo?: string;
    fingerprint?: string;
  };
}

export default async function CertificatePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  let data: Awaited<ReturnType<typeof getCertificate>>;
  try {
    data = await getCertificate(publicId);
  } catch {
    return (
      <main id="main" className="p-8">
        <p role="alert">Sertifikat tidak dapat dimuat.</p>
      </main>
    );
  }
  if (!data || data.status !== "valid") notFound();

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-4 flex gap-2 print:hidden">
        <PrintButton />
        <a
          href={`/verify/${encodeURIComponent(publicId)}`}
          className="rounded-lg border px-4 py-2 font-semibold"
        >
          Halaman verifikasi
        </a>
      </div>
      <section
        aria-label="Sertifikat kelulusan"
        className="certificate-a4 rounded-2xl border-4 border-double border-slate-800 p-10 text-center print:rounded-none"
      >
        <p className="text-sm tracking-widest text-slate-500">SEKOLAH DEMO</p>
        <h1 className="mt-2 text-4xl font-bold">Certificate of Completion</h1>
        <p className="mt-6 text-slate-600">Diberikan kepada</p>
        <p className="mt-1 text-3xl font-bold">{data.displayName}</p>
        <p className="mt-4 text-slate-600">atas penyelesaian</p>
        <p className="mt-1 text-xl font-semibold">
          {data.courseTitle} — {data.levelTitle}
        </p>
        <div className="mt-6 flex items-center justify-between text-left text-sm">
          <div>
            <p>
              Tanggal terbit: <strong>{data.issuedAt}</strong>
            </p>
            <p>
              Nomor serial: <span className="font-mono">{data.serialNo}</span>
            </p>
            <p>
              Fingerprint: <span className="font-mono">{data.fingerprint}</span>
            </p>
            <p className="mt-2 text-slate-500">Pernyataan kompetensi — bukan nilai detail.</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/certificates/${encodeURIComponent(publicId)}/qr`}
            alt="QR verifikasi sertifikat"
            width={128}
            height={128}
          />
        </div>
        <p className="mt-6 text-sm text-slate-500">Guru penandatangan: ___________________</p>
      </section>
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } .certificate-a4 { border-width: 6px; } }`}</style>
    </main>
  );
}
