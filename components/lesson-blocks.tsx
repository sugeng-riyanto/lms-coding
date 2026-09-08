"use client";

/**
 * Renderer blok materi terkontrol (lib/content-blocks.ts adalah batas validasi).
 * Merender HANYA kind yang di-allowlist — tidak ada HTML arbitrer; semua string
 * di-render lewat React (ter-escape). Gambar wajib alt (dari alt, fallback
 * caption) untuk aksesibilitas.
 */
import { CodeBlock } from "@/components/code-block";
import {
  EmbedAudio,
  EmbedFile,
  EmbedPdf,
  EmbedVideo,
  EmbedWeb,
  EmbedYoutube,
} from "@/components/media-embed";
import type { ContentBlock } from "@/lib/content-blocks";

export function LessonBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return (
              <h2 key={i} className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {typeof b.text === "string" ? b.text : ""}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                {typeof b.text === "string" ? b.text : ""}
              </p>
            );
          case "image": {
            const alt =
              (typeof b.alt === "string" && b.alt.trim()) ||
              (typeof b.caption === "string" && b.caption.trim()) ||
              "Ilustrasi materi";
            const caption = typeof b.caption === "string" ? b.caption : "";
            return (
              <figure key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={typeof b.url === "string" ? b.url : ""}
                  alt={alt}
                  loading="lazy"
                  className="max-h-96 w-full rounded-xl border border-slate-200 object-contain dark:border-slate-600"
                />
                {caption ? (
                  <figcaption className="mt-1 text-center text-xs text-slate-500">{caption}</figcaption>
                ) : null}
              </figure>
            );
          }
          case "code":
            return (
              <CodeBlock
                key={i}
                code={typeof b.code === "string" ? b.code : ""}
                language={typeof b.language === "string" ? b.language : "text"}
              />
            );
          case "embed_youtube":
            return (
              <EmbedYoutube
                key={i}
                url={typeof b.url === "string" ? b.url : ""}
                title={typeof b.title === "string" ? b.title : undefined}
              />
            );
          case "embed_pdf":
            return (
              <EmbedPdf
                key={i}
                url={typeof b.url === "string" ? b.url : ""}
                title={typeof b.title === "string" ? b.title : undefined}
              />
            );
          case "embed_audio":
            return (
              <EmbedAudio
                key={i}
                url={typeof b.url === "string" ? b.url : ""}
                transcript={typeof b.transcript === "string" ? b.transcript : undefined}
              />
            );
          case "embed_file":
            return (
              <EmbedFile
                key={i}
                url={typeof b.url === "string" ? b.url : ""}
                title={typeof b.title === "string" ? b.title : undefined}
              />
            );
          case "embed_web":
            return (
              <EmbedWeb
                key={i}
                url={typeof b.url === "string" ? b.url : ""}
                title={typeof b.title === "string" ? b.title : undefined}
              />
            );
          case "embed_video":
            return (
              <EmbedVideo
                key={i}
                url={typeof b.url === "string" ? b.url : ""}
                title={typeof b.title === "string" ? b.title : undefined}
              />
            );
          default:
            // kind tak dikenal tidak pernah dirender (pertahanan lapis kedua).
            return null;
        }
      })}
    </div>
  );
}
