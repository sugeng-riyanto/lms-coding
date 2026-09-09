import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLang, mkT } from "@/lib/i18n";
import { COURSE } from "@/lib/ui-text/course";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  archived: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function TeacherCoursesPage() {
  const lang = await getLang();
  const t = mkT(COURSE, lang);
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id,title,slug,description,status,created_at")
    .order("created_at", { ascending: false });

  const rows = (courses as
    | { id: string; title: string; slug: string; description: string; status: string; created_at: string }[]
    | null) ?? [];

  const statusLabel = (status: string) =>
    status === "published"
      ? t("statusPublished")
      : status === "archived"
        ? t("statusArchived")
        : t("statusDraft");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("listIntro")}</p>
        </div>
        <Link
          href="/teacher/courses/new"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
        >
          {t("newTitle")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-3xl">📚</p>
          <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">{t("listEmpty")}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("listEmptyDesc")}</p>
          <Link
            href="/teacher/courses/new"
            className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
          >
            {t("newTitle")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/teacher/courses/${c.id}`}
                className="group block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                    {c.title}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[c.status] ?? STATUS_STYLES.draft}`}
                  >
                    {statusLabel(c.status)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                  {c.description || "—"}
                </p>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  /{c.slug} ·{" "}
                  {new Date(c.created_at).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}