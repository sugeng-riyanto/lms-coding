"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { setWeeklyGoal } from "@/features/actions";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import type { WeeklyGoalUnit } from "@/lib/progress-planning";
import { LEARN } from "@/lib/ui-text/learn";

interface GoalResult {
  ok: boolean;
  error?: string;
  unit?: WeeklyGoalUnit;
  goal?: number;
}

async function run(_prev: GoalResult | null, formData: FormData): Promise<GoalResult> {
  const unit = formData.get("unit") as WeeklyGoalUnit;
  const value = Number(formData.get("value"));
  return (await setWeeklyGoal({
    enrollmentId: formData.get("enrollmentId") as string,
    unit,
    value,
  })) as GoalResult;
}

export function WeeklyGoalForm({
  enrollmentId,
  unit,
  goal,
  lang = "id",
}: {
  enrollmentId: string;
  unit: WeeklyGoalUnit;
  goal: number;
  lang?: Lang;
}) {
  const t = mkT(LEARN, lang);
  const router = useRouter();
  const [result, formAction, pending] = useActionState(run, null);
  const [selectedUnit, setSelectedUnit] = useState<WeeklyGoalUnit>(unit);

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        router.refresh();
      }}
      className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3"
    >
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div>
        <label htmlFor="goal-unit" className="text-sm font-semibold">
          {t("goalUnitLabel")}
        </label>
        <select
          id="goal-unit"
          name="unit"
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value as WeeklyGoalUnit)}
          className="mt-1 rounded-lg border px-3 py-2 text-sm"
        >
          <option value="minutes">{t("goalUnitMinutes")}</option>
          <option value="completions">{t("goalUnitCompletions")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="goal-value" className="text-sm font-semibold">
          {selectedUnit === "minutes" ? t("goalValueLabelMinutes") : t("goalValueLabelCompletions")}
        </label>
        <input
          id="goal-value"
          name="value"
          type="number"
          min={1}
          max={selectedUnit === "minutes" ? 2000 : 50}
          defaultValue={goal}
          required
          className="mt-1 w-32 rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <button
        disabled={pending}
        className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
      >
        {pending ? t("goalSaving") : t("goalSave")}
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-red-700">
          {fmt(t("goalFailed"), { err: result.error ?? "" })}
        </p>
      )}
      {result && result.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {result.unit === "minutes"
            ? fmt(t("goalSavedMinutes"), { goal: result.goal ?? 0 })
            : fmt(t("goalSavedCompletions"), { goal: result.goal ?? 0 })}
        </p>
      )}
    </form>
  );
}
