"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/features/actions";
import { COMMON, type Lang } from "@/lib/i18n";

export function LogoutButton({ lang = "id" }: { lang?: Lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-red-300 px-5 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {busy ? COMMON.signOutBusy[lang] : COMMON.signOut[lang]}
    </button>
  );
}
