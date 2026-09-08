import Link from "next/link";

// Nonce CSP (lib/csp.ts) memerlukan dynamic rendering agar inline scripts
// halaman 404 ikut diberi nonce.
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">The address you visited does not exist or has moved.</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800"
        >
          Home
        </Link>
        <Link href="/learn" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          Back to learning
        </Link>
      </div>
    </main>
  );
}
