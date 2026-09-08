import type { Metadata } from "next";

export const metadata: Metadata = { title: "Service status — Autonomous Learning LMS" };

async function getHealth(base: string) {
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    return (await res.json()) as { status: string; timeUtc: string; envConfigured: boolean };
  } catch {
    return null;
  }
}

export default async function HealthPage() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const data = await getHealth(base);
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Service status</h1>
      {data ? (
        <dl className="mt-6 space-y-2 rounded-xl border p-5">
          <div className="flex justify-between">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-semibold" role="status">
              {data.status}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Server time (UTC)</dt>
            <dd className="font-mono">{data.timeUtc}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Environment configured</dt>
            <dd className="font-semibold">{data.envConfigured ? "yes" : "no"}</dd>
          </div>
        </dl>
      ) : (
        <p role="alert" className="mt-6 rounded-xl border p-5">
          The health endpoint could not be reached.
        </p>
      )}
    </main>
  );
}
