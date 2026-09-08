"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { PROFILE } from "@/lib/ui-text/profile";

export function EditProfile({ initialName, lang }: { initialName: string; lang: Lang }) {
  const router = useRouter();
  const t = mkT(PROFILE, lang);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateProfile({ displayName: name });
    setBusy(false);
    setNotice(res.ok ? t("updated") : fmt(t("failed"), { error: res.error }));
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} aria-label={t("editAria")} className="rounded-xl border p-4">
      <label htmlFor="display-name" className="font-semibold">
        {t("displayName")}
      </label>
      <input
        id="display-name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        minLength={2}
        maxLength={100}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      />
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
      <button
        disabled={busy}
        className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {t("save")}
      </button>
    </form>
  );
}
