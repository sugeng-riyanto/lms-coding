import Link from "next/link";
import { getLang, mkT } from "@/lib/i18n";
import { COURSE } from "@/lib/ui-text/course";
import { NewCourseForm } from "./new-course-form";

export default async function NewCoursePage() {
  const lang = await getLang();
  const t = mkT(COURSE, lang);
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/teacher" className="text-sm text-blue-700 underline">
        {t("backToDashboard")}
      </Link>
      <h1 className="mt-2 text-3xl font-bold">{t("newTitle")}</h1>
      <p className="mt-2 text-slate-600">{t("newIntro")}</p>
      <NewCourseForm lang={lang} />
    </main>
  );
}
