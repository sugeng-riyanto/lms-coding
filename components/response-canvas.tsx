"use client";

/**
 * Area kanvas pada kartu grading (guru): kanvas MURID (read-only — coretan
 * jawaban sains/math) di atas kanvas umpan balik GURU (editable). Keduanya
 * dibaca/simpan per (attempt, soal, peran) via getCanvasStrokes/saveCanvasStrokes
 * — RLS memastikan guru hanya cohort-nya, murid hanya attempt-nya.
 */
import { useEffect, useState } from "react";
import { getCanvasStrokes } from "@/features/actions";
import { mkT, type Lang } from "@/lib/i18n";
import { CANVAS } from "@/lib/ui-text/canvas";
import type { CanvasStroke } from "@/lib/canvas";
import { CanvasPad } from "@/components/canvas-pad";

export function ResponseCanvasArea({
  attemptId,
  questionVersionId,
  lang,
}: {
  attemptId: string;
  questionVersionId: string;
  lang: Lang;
}) {
  const t = mkT(CANVAS, lang);
  const [student, setStudent] = useState<CanvasStroke[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void getCanvasStrokes({ attemptId, questionVersionId }).then((res) => {
      if (!alive) return;
      if (!res.ok) setFailed(true);
      else setStudent(res.student);
    });
    return () => {
      alive = false;
    };
  }, [attemptId, questionVersionId]);

  if (failed) {
    return <p className="mt-2 text-sm text-red-700">{t("loadFailed")}</p>;
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <div>
        {student === null ? (
          <p className="text-sm text-slate-400">…</p>
        ) : (
          <CanvasPad
            attemptId={attemptId}
            questionVersionId={questionVersionId}
            lang={lang}
            role="student"
            readOnly
            initialStrokes={student}
            title={t("titleStudent")}
          />
        )}
      </div>
      <div>
        <CanvasPad
          attemptId={attemptId}
          questionVersionId={questionVersionId}
          lang={lang}
          role="teacher"
          title={t("titleTeacherFeedback")}
        />
      </div>
    </div>
  );
}
