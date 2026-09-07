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

type ModuleRow = { id: string; title: string; position: number };
type LessonRow = { id: string; module_id: string; required: boolean };
type ActivityRow = { id: string; lesson_id: string; required: boolean };

type DigitalRecord = {
  serialNo: string;
  payloadHash: string;
  contentPct: number;
  rows: { title: string; lessonsLabel: string; actsLabel: string; pct: number }[];
};

/**
 * Full per-module completeness + payload hash for an authorised viewer
 * (recipient student or cohort teacher — RLS enforced). The web record is never
 * truncated, unlike the paper PDF which caps the module table to keep 2 pages.
 */
async function fetchDigitalRecord(publicId: string): Promise<DigitalRecord | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: cert } = await supabase
      .from("certificates")
      .select("level_id,enrollment_id,serial_no,payload_hash")
      .eq("public_id", publicId)
      .maybeSingle();
    if (!cert) return null;

    const { data: mods } = await supabase
      .from("modules")
      .select("id,title,position")
      .eq("level_id", cert.level_id)
      .order("position");
    const modules = (mods ?? []) as ModuleRow[];
    const moduleIds = modules.map((m) => m.id);
    const { data: les } = moduleIds.length
      ? await supabase.from("lessons").select("id,module_id,required").in("module_id", moduleIds)
      : { data: [] as unknown };
    const lessons = (les ?? []) as LessonRow[];
    const lessonIds = lessons.map((l) => l.id);
    const { data: acts } = lessonIds.length
      ? await supabase.from("activities").select("id,lesson_id,required").in("lesson_id", lessonIds)
      : { data: [] as unknown };
    const activities = (acts ?? []) as ActivityRow[];

    const completedLessons = new Set<string>();
    if (lessonIds.length > 0) {
      const { data: snaps } = await supabase
        .from("progress_snapshots")
        .select("entity_id,status,percent")
        .eq("enrollment_id", cert.enrollment_id)
        .eq("entity_type", "lesson")
        .in("entity_id", lessonIds);
      for (const s of (snaps ?? []) as { entity_id: string; status: string; percent: number }[]) {
        if (s.status === "completed" || Number(s.percent) >= 100) completedLessons.add(s.entity_id);
      }
    }
    const completedActs = new Set<string>();
    if (activities.length > 0) {
      const { data: evs } = await supabase
        .from("learning_events")
        .select("entity_id")
        .eq("enrollment_id", cert.enrollment_id)
        .eq("event_type", "activity_completed")
        .eq("entity_type", "activity")
        .in(
          "entity_id",
          activities.map((a) => a.id),
        );
      for (const ev of (evs ?? []) as { entity_id: string }[]) completedActs.add(ev.entity_id);
    }

    // Mirrors the PDF's page-2 arithmetic exactly so the web record and the paper
    // certificate never disagree.
    let totalDone = 0;
    let totalReq = 0;
    const rows = modules.map((m) => {
      const ls = lessons.filter((l) => l.module_id === m.id);
      const reqL = ls.filter((l) => l.required);
      const doneL = ls.filter((l) => completedLessons.has(l.id)).length;
      const as = activities.filter((a) => ls.some((l) => l.id === a.lesson_id));
      const reqA = as.filter((a) => a.required);
      const doneA = as.filter((a) => completedActs.has(a.id)).length;
      const req = reqL.length + reqA.length;
      const done = doneL + doneA;
      totalReq += req;
      totalDone += done;
      return {
        title: m.title,
        lessonsLabel: `${doneL}/${reqL.length}`,
        actsLabel: `${doneA}/${reqA.length}`,
        pct: req > 0 ? Math.round((done / req) * 100) : 100,
      };
    });

    return {
      serialNo: cert.serial_no,
      payloadHash: cert.payload_hash,
      contentPct: totalReq > 0 ? Math.round((totalDone / totalReq) * 100) : 100,
      rows,
    };
  } catch {
    return null;
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
  const digitalRecord = valid && authorizedForPdf ? await fetchDigitalRecord(publicId) : null;
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
          Halaman 2 berisi informasi umum &amp; statistik ringkas kelengkapan (tabel + grafik), dengan QR dan
          kode unik yang sama dengan halaman 1. Rincian per modul ada di rekam digital web, bukan di kertas.
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
      {digitalRecord && (
        <section className="mt-6 rounded-xl border p-5" aria-labelledby="digital-record-heading">
          <h2 id="digital-record-heading" className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Rekam digital &amp; keaslian
          </h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Payload hash (SHA-256)</dt>
              <dd className="break-all font-mono text-xs">{digitalRecord.payloadHash}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt className="text-slate-500">Cara pengecekan keaslian</dt>
              <dd className="max-w-xs text-xs text-slate-600 dark:text-slate-300">
                Hash dikunci saat sertifikat terbit; verifier menghitung ulang dari catatan — perubahan data
                apa pun membuat pemeriksaan gagal (payload hash tidak cocok).
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Rincian lengkap per modul tidak dicetak di sertifikat (PDF halaman 2 hanya memuat ringkasan
            agregat agar dokumen selalu 2 halaman) — halaman ini selalu menampilkan semua modul.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    No.
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Module
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Lessons (done/total)
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Activities (done/total)
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Completeness
                  </th>
                </tr>
              </thead>
              <tbody>
                {digitalRecord.rows.map((row, i) => (
                  <tr key={`${row.title}-${i}`} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium">{row.title}</td>
                    <td className="py-2 pr-3">{row.lessonsLabel}</td>
                    <td className="py-2 pr-3">{row.actsLabel}</td>
                    <td className="py-2 font-semibold">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            <span className="text-slate-500">Konten level selesai: </span>
            <span className="font-semibold">{digitalRecord.contentPct}%</span>
          </p>
        </section>
      )}
      <p className="mt-4 text-sm text-slate-500">
        Halaman publik ini tidak menampilkan email, tanggal lahir, jawaban, nilai detail, atau storage path.
      </p>
    </main>
  );
}
