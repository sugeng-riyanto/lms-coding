"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordLearningEvent, startAttempt } from "@/features/actions";
import { makeClientEventId } from "@/lib/sync-queue";
import { UploadBox } from "@/components/upload-box";
import { CodeBlock } from "@/components/code-block";
import { CodeRunner } from "@/components/code-runner";
import { EmbedAudio, EmbedFile, EmbedPdf, EmbedYoutube } from "@/components/media-embed";
import { LessonBlocks } from "@/components/lesson-blocks";
import type { ContentBlock } from "@/lib/content-blocks";
import { useEngagementHeartbeat, useOfflineFlush } from "./use-sync";
import { ReflectionBox } from "./reflection-box";
import { fmt, mkT, type Lang } from "@/lib/i18n";
import { ACTIVITY } from "@/lib/ui-text/activity";
import type { ActivityData } from "./page";

export function ActivityView({
  activity,
  enrollmentId,
  lang,
}: {
  activity: ActivityData;
  enrollmentId: string;
  lang: Lang;
}) {
  const router = useRouter();
  const t = mkT(ACTIVITY, lang);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const c = activity.content;
  // Waktu belajar jujur: heartbeat hanya saat visible+aktif (di-clamp),
  // event offline diantrekan dan di-flush saat reconnect.
  const enabled = enrollmentId.length > 0;
  useEngagementHeartbeat({
    enrollmentId,
    entityType: "activity",
    entityId: activity.id,
    studentKey: enrollmentId,
    enabled,
  });
  useOfflineFlush({ studentKey: enrollmentId, enabled });

  async function markComplete() {
    if (!enrollmentId) {
      setNotice(t("noEnrollment"));
      return;
    }
    setBusy(true);
    const res = await recordLearningEvent({
      enrollmentId,
      eventType: "activity_completed",
      entityType: "activity",
      entityId: activity.id,
      clientEventId: makeClientEventId(),
      metadata: {},
    });
    setBusy(false);
    setNotice(res.ok ? t("markedComplete") : fmt(t("failed"), { error: res.error }));
  }

  async function startQuiz() {
    if (!activity.assessmentId || !enrollmentId) {
      setNotice(t("quizNotReady"));
      return;
    }
    setBusy(true);
    const res = await startAttempt({
      assessmentId: activity.assessmentId,
      enrollmentId,
      idempotencyKey: makeClientEventId(),
    });
    setBusy(false);
    if (!res.ok) setNotice(fmt(t("startFailed"), { error: res.error }));
    else router.push(`/quiz/${res.attemptId}`);
  }

  const completeBtn = (
    <>
      <button
        onClick={markComplete}
        disabled={busy}
        className="mt-4 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {t("markComplete")}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </>
  );

  if (activity.type === "article") {
    const blocks = Array.isArray(c["blocks"]) ? (c["blocks"] as ContentBlock[]) : [];
    const body = typeof c["body"] === "string" ? c["body"] : t("contentNotFilled");
    return (
      <div className="mt-4">
        {blocks.length > 0 ? (
          // Halaman materi kaya (gaya tutorial): blok teks + ilustrasi + media embed.
          <LessonBlocks blocks={blocks} />
        ) : (
          <p className="whitespace-pre-wrap">{body}</p>
        )}
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "video_link") {
    const url = typeof c["url"] === "string" ? c["url"] : "";
    const transcript = typeof c["transcript"] === "string" ? c["transcript"] : "";
    return (
      <div className="mt-4">
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {t("watchVideo")}
          </a>
        )}
        {transcript && (
          <details className="mt-3 rounded border p-3">
            <summary className="font-semibold">Transcript</summary>
            <p className="mt-2 text-sm">{transcript}</p>
          </details>
        )}
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "resource") {
    const url = typeof c["url"] === "string" ? c["url"] : "";
    return (
      <div className="mt-4">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {t("downloadMaterial")}
          </a>
        ) : (
          <p>{t("noFile")}</p>
        )}
        {completeBtn}
      </div>
    );
  }
  // ---- LMS coding: blok kode + media ter-embed (migration 000014) ----
  if (activity.type === "code_board") {
    const code = typeof c["code"] === "string" ? c["code"] : "";
    const language = typeof c["language"] === "string" ? c["language"] : "";
    const transcript = typeof c["transcript"] === "string" ? c["transcript"] : "";
    return (
      <div className="mt-4">
        {code ? (
          <CodeBlock code={code} language={language} />
        ) : (
          <p className="text-sm text-slate-500">{t("codeNotProvided")}</p>
        )}
        {transcript ? (
          <details className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
            <summary className="cursor-pointer font-semibold">{t("transcript")}</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {transcript}
            </p>
          </details>
        ) : null}
        <div className="mt-3">
          <CodeRunner starterCode={code} starterLanguage={language} />
        </div>
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "embed_youtube") {
    const url = typeof c["url"] === "string" ? c["url"] : "";
    const title = typeof c["title"] === "string" ? c["title"] : "";
    return (
      <div className="mt-4">
        <EmbedYoutube url={url} title={title} />
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "embed_pdf") {
    const url = typeof c["url"] === "string" ? c["url"] : "";
    const title = typeof c["title"] === "string" ? c["title"] : "";
    return (
      <div className="mt-4">
        <EmbedPdf url={url} title={title} />
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "embed_audio") {
    const url = typeof c["url"] === "string" ? c["url"] : "";
    const transcript = typeof c["transcript"] === "string" ? c["transcript"] : "";
    return (
      <div className="mt-4">
        <EmbedAudio url={url} transcript={transcript} />
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "embed_file") {
    const url = typeof c["url"] === "string" ? c["url"] : "";
    const title = typeof c["title"] === "string" ? c["title"] : "";
    return (
      <div className="mt-4">
        <EmbedFile url={url} title={title} />
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "quiz") {
    return (
      <div className="mt-4">
        <p>{t("quizIntro")}</p>
        <button
          onClick={startQuiz}
          disabled={busy}
          className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {t("startQuiz")}
        </button>
      </div>
    );
  }
  if (activity.type === "assignment_upload") {
    return (
      <div className="mt-4">
        <UploadBox lang={lang} onUploaded={() => setNotice(t("fileUploadedHint"))} />
        {completeBtn}
      </div>
    );
  }
  if (activity.type === "roblox_challenge") {
    // Tahap A: website MEMBUKA Roblox (link), bukan iframe; completion manual/teacher-verified.
    const placeId = typeof c["placeId"] === "string" ? c["placeId"] : "";
    const instruction = typeof c["instruction"] === "string" ? c["instruction"] : "";
    const expected = typeof c["expectedEvidence"] === "string" ? c["expectedEvidence"] : "";
    return (
      <div className="mt-4 rounded-xl border p-4">
        <p className="text-sm font-semibold">{t("robloxTitle")}</p>
        {instruction && <p className="mt-2 text-sm">{instruction}</p>}
        {placeId && (
          <a
            href={`https://www.roblox.com/games/${encodeURIComponent(placeId)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
          >
            {t("openRoblox")}
          </a>
        )}
        {expected && (
          <p className="mt-3 text-sm text-slate-600">{fmt(t("expectedEvidence"), { evidence: expected })}</p>
        )}
        <p className="mt-3 text-xs text-slate-500">{t("robloxNote")}</p>
        <div>{completeBtn}</div>
      </div>
    );
  }
  if (activity.type === "reflection") {
    return (
      <div className="mt-4">
        <ReflectionBox activityId={activity.id} enrollmentId={enrollmentId} lang={lang} />
        <div className="mt-2">{completeBtn}</div>
      </div>
    );
  }
  // fallback
  return (
    <div className="mt-4">
      <p className="text-sm text-slate-600">{t("contentUnavailable")}</p>
      {completeBtn}
    </div>
  );
}
