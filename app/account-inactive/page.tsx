import Link from "next/link";

export default function AccountInactivePage() {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Akun nonaktif</h1>
      <p className="mt-2 text-slate-600" role="status">
        Akun Anda berstatus nonaktif (ditangguhkan atau dinonaktifkan). Hubungi admin sekolah untuk
        pengaktifan kembali.
      </p>
      <div className="mt-6">
        <Link href="/login" className="rounded-lg border px-5 py-2 font-semibold hover:bg-slate-50">
          Kembali ke login
        </Link>
      </div>
    </main>
  );
}
