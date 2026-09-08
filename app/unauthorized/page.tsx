import Link from "next/link";

// Nonce CSP (lib/csp.ts) requires dynamic rendering.
export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">No access</h1>
      <p className="mt-2 text-slate-600">
        Your account does not have the role required for this page. Contact your teacher or the school
        administrator if you believe this is a mistake.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800"
        >
          Home
        </Link>
        <Link href="/profile" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          View profile
        </Link>
      </div>
    </main>
  );
}
