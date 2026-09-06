import { detectRisk } from "@/lib/progress";

const ROWS = [
  { name: "Murid 01", progress: 82, mastery: 0.78, lastActive: "2 jam lalu", grade: "A-" },
  { name: "Murid 02", progress: 41, mastery: 0.45, lastActive: "9 hari lalu", grade: "C" },
  { name: "Murid 03", progress: 65, mastery: 0.69, lastActive: "1 hari lalu", grade: "B" },
];

export default function TeacherPage() {
  const signals = detectRisk({
    inactiveDays: 9,
    attemptsLast7d: 3,
    scoreDelta: 0,
    avgSecondsPerItem: 12,
    accuracy: 0.4,
    prereqMastery: 0.5,
    progressPct: 41,
    expectedPct: 70,
  });

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Dashboard kelas</h1>
      <section aria-label="Ringkasan" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Terdaftar", "3"],
          ["Aktif 7 hari", "2"],
          ["On-track", "1"],
          ["Perlu perhatian", "1"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </section>

      <h2 className="mt-8 text-xl font-semibold">Matriks cohort</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">Murid</th>
              <th className="p-2">Progress</th>
              <th className="p-2">Mastery</th>
              <th className="p-2">Terakhir aktif</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name} className="border-b">
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{r.progress}%</td>
                <td className="p-2">
                  {Math.round(r.mastery * 100)}% <span className="text-slate-500">({r.grade})</span>
                </td>
                <td className="p-2">{r.lastActive}</td>
                <td className="p-2">{r.progress < 50 ? "⚠ Perlu perhatian" : "✓ On-track"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Warna bukan satu-satunya pembeda — status selalu ada teksnya.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Sinyal risiko (explainable)</h2>
      <ul className="mt-3 space-y-2">
        {signals.map((s) => (
          <li key={s.code} className="rounded-xl border p-3">
            <span className="font-mono text-xs font-bold">{s.code}</span>
            <p className="text-sm">{s.message}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded border px-3 py-1 text-sm">Acknowledge</button>
              <button className="rounded border px-3 py-1 text-sm">Snooze</button>
              <button className="rounded border px-3 py-1 text-sm">Resolve + catat intervensi</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
