/**
 * Content blocks allowlist untuk halaman materi kaya (gaya tutorial codewithharry).
 *
 * Satu aktivitas `article` dapat membawa `content.blocks`: urutan blok yang
 * di-allowlist (heading/paragraph/image/code/embed_youtube/embed_pdf/
 * embed_audio/embed_file) sehingga siswa membaca SATU halaman dengan teks,
 * ilustrasi, dan media ter-embed — bukan HTML arbitrer.
 *
 * Aturan keamanan:
 *  - kind di luar allowlist => invalid (typo authoring langsung terlihat).
 *  - hanya field yang di-allowlist per kind yang diteruskan (extras dibuang).
 *  - URL hanya http(s); YouTube direkonstruksi dari id via youtubeEmbedSrc.
 *  - image WAJIB punya alt/caption (aksesibilitas; konten alt juga jadi label).
 *  - HTML tidak pernah dirender sebagai HTML (React meng-escape teks).
 */
import { z } from "zod";

/** https/http saja; selain itu null. (single source — dipakai media-embed juga.) */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Host yang boleh dimuat di iframe generic (embed_web). Sempit dan eksplisit:
 * sim interaktif sains/math yang dipakai sekolah (PhET, oPhysics) + preview
 * Google Drive. Host lain DIBLOKIR — perluas hanya lewat edit + e2e, sama
 * seperti kebijakan CSP frame-src (lib/csp.ts).
 */
export const EMBED_IFRAME_HOSTS = new Set([
  "phet.colorado.edu", // sim sains interaktif (Buoyancy Basics, dll)
  "ophysics.com", // sim fisika/matematika (L12 pendulum, dll)
  "drive.google.com", // preview file Google Drive (PDF/video)
]);

/** URL http(s) dengan host di allowlist iframe generic; selain itu null. */
export function isAllowedIframeHost(url: string): boolean {
  if (!isSafeHttpUrl(url)) return false;
  try {
    return EMBED_IFRAME_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Ubah URL Google Drive menjadi src preview iframe (drive.google.com/file/d/
 * {id}/preview) — cara aman embed PDF/video Drive tanpa API. Mendukung bentuk:
 *   https://drive.google.com/file/d/{id}/view?usp=...
 *   https://drive.google.com/file/d/{id}/edit
 *   https://drive.google.com/open?id={id}
 * Bukan URL Drive / bukan http(s) → null (komponen memilih fallback non-iframe).
 */
export function gdrivePreviewSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "drive.google.com") return null;
    const fileMatch = /^\/file\/d\/([\w-]+)/.exec(u.pathname);
    const id = fileMatch?.[1] ?? u.searchParams.get("id");
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  } catch {
    return null;
  }
}

/** Ubah URL YouTube menjadi src embed youtube-nocookie (atau null bila tidak valid). */
export function youtubeEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
    let id: string | null = null;
    if (u.hostname === "youtu.be") {
      id = u.pathname.split("/")[1] ?? null;
    } else if (YT_HOSTS.has(u.hostname)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? null;
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] ?? null;
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export const BLOCK_KINDS = [
  "heading",
  "paragraph",
  "image",
  "code",
  "embed_youtube",
  "embed_pdf",
  "embed_audio",
  "embed_file",
  "embed_web",
  "embed_video",
] as const;

export type ContentBlockKind = (typeof BLOCK_KINDS)[number];

export type ContentBlock = {
  kind: ContentBlockKind;
  [key: string]: unknown;
};

export const MAX_BLOCKS = 60;

const LIMITS: Record<ContentBlockKind, Record<string, number>> = {
  heading: { text: 200 },
  paragraph: { text: 20_000 },
  image: { url: 2_000, caption: 500, alt: 300 },
  code: { code: 20_000, language: 40 },
  embed_youtube: { url: 2_000, title: 300 },
  embed_pdf: { url: 2_000, title: 300 },
  embed_audio: { url: 2_000, transcript: 5_000 },
  embed_file: { url: 2_000, title: 300 },
  embed_web: { url: 2_000, title: 300 },
  embed_video: { url: 2_000, title: 300 },
};

/**
 * Media opsional pada butir soal (kuis) — "Provide in the materials or quiz".
 * Dipakai prompt_json.media; disanitasi dengan aturan SAMA seperti blok materi:
 * hanya jenis + field yang di-allowlist, URL http(s) + host iframe di-allowlist.
 */
export const QUESTION_MEDIA_TYPES = ["youtube", "pdf", "web", "video", "image", "audio"] as const;
export type QuestionMediaType = (typeof QUESTION_MEDIA_TYPES)[number];

export interface QuestionMediaSpec {
  type: QuestionMediaType;
  url: string;
  title?: string;
  transcript?: string;
  caption?: string;
  alt?: string;
}

export function sanitizeQuestionMedia(input: unknown): QuestionMediaSpec | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const type = src["type"];
  if (typeof type !== "string" || !(QUESTION_MEDIA_TYPES as readonly string[]).includes(type)) return null;
  const url = src["url"];
  if (typeof url !== "string" || !isSafeHttpUrl(url)) return null;
  const t = type as QuestionMediaType;
  const spec: QuestionMediaSpec = { type: t, url: url.slice(0, 2_000) };
  if (t === "web" && !isAllowedIframeHost(url)) return null;
  if (t === "youtube" && youtubeEmbedSrc(url) === null) return null;
  const str = (k: string, max: number) => {
    const v = src[k];
    return typeof v === "string" && v.trim().length > 0 ? v.slice(0, max).trim() : undefined;
  };
  const title = str("title", 300);
  if (title) spec.title = title;
  if (t === "audio") {
    const transcript = str("transcript", 5_000);
    if (transcript) spec.transcript = transcript;
  }
  if (t === "image") {
    const caption = str("caption", 500);
    if (caption) spec.caption = caption;
    const alt = str("alt", 300);
    if (alt) spec.alt = alt;
    else if (!caption) return null; // image wajib alt/caption (aksesibilitas)
  }
  return spec;
}

export type SanitizeBlocksResult =
  { ok: true; blocks: ContentBlock[] } | { ok: false; error: "BLOCK_INVALID"; message: string };

const kindSchema = z.enum(BLOCK_KINDS);

/**
 * Validasi + normalisasi blok materi. Menolak seluruh input bila: bukan array,
 * melebihi MAX_BLOCKS, kind tak dikenal, field wajib hilang/salah tipe, URL tak
 * aman, image tanpa alt/caption. Output canonical: hanya field allowlist, teks
 * di-truncate ke batas, tipe dipaksa string.
 */
export function sanitizeContentBlocks(input: unknown): SanitizeBlocksResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "BLOCK_INVALID", message: "content.blocks harus berupa array." };
  }
  if (input.length === 0) {
    return { ok: false, error: "BLOCK_INVALID", message: "content.blocks tidak boleh kosong." };
  }
  if (input.length > MAX_BLOCKS) {
    return {
      ok: false,
      error: "BLOCK_INVALID",
      message: `Terlalu banyak blok (maks ${MAX_BLOCKS}).`,
    };
  }
  const blocks: ContentBlock[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, error: "BLOCK_INVALID", message: `Blok #${i + 1} bukan objek.` };
    }
    const kind = (raw as { kind?: unknown }).kind;
    const parsedKind = kindSchema.safeParse(kind);
    if (!parsedKind.success) {
      return { ok: false, error: "BLOCK_INVALID", message: `Blok #${i + 1} punya kind tak dikenal.` };
    }
    const k = parsedKind.data;
    const src = raw as Record<string, unknown>;
    const limits = LIMITS[k];
    const pick = (field: string): string | null => {
      const v = src[field];
      if (typeof v !== "string") return null;
      return v.slice(0, limits[field]);
    };

    const required = (field: string): { ok: true; value: string } | { ok: false } => {
      const v = pick(field);
      if (v === null || v.trim().length === 0) return { ok: false };
      return { ok: true, value: v };
    };
    // Opsional: hanya disertakan saat terisi (payload canonical ringkas).
    const opt = (field: string): Record<string, string> => {
      const v = (pick(field) ?? "").trim();
      return v.length > 0 ? { [field]: v } : {};
    };

    let block: ContentBlock;
    switch (k) {
      case "heading": {
        const r = required("text");
        if (!r.ok) return { ok: false, error: "BLOCK_INVALID", message: `Heading #${i + 1} butuh teks.` };
        block = { kind: k, text: r.value };
        break;
      }
      case "paragraph": {
        const r = required("text");
        if (!r.ok) return { ok: false, error: "BLOCK_INVALID", message: `Paragraf #${i + 1} butuh teks.` };
        block = { kind: k, text: r.value };
        break;
      }
      case "image": {
        const url = required("url");
        const alt = pick("alt") ?? "";
        const caption = pick("caption") ?? "";
        if (!url.ok || !isSafeHttpUrl(url.value)) {
          return { ok: false, error: "BLOCK_INVALID", message: `Gambar #${i + 1} butuh URL http(s) valid.` };
        }
        if (alt.trim().length === 0 && caption.trim().length === 0) {
          return {
            ok: false,
            error: "BLOCK_INVALID",
            message: `Gambar #${i + 1} wajib punya alt atau caption (aksesibilitas).`,
          };
        }
        block = { kind: k, url: url.value, ...(alt.trim() ? { alt } : {}), ...opt("caption") };
        break;
      }
      case "code": {
        const code = required("code");
        const language = (pick("language") ?? "").trim() || "text";
        if (!code.ok) return { ok: false, error: "BLOCK_INVALID", message: `Kode #${i + 1} butuh isi.` };
        block = { kind: k, code: code.value, language };
        break;
      }
      case "embed_youtube": {
        const url = required("url");
        if (!url.ok || youtubeEmbedSrc(url.value) === null) {
          return {
            ok: false,
            error: "BLOCK_INVALID",
            message: `YouTube #${i + 1}: URL tak valid (youtube.com/youtu.be).`,
          };
        }
        block = { kind: k, url: url.value, ...opt("title") };
        break;
      }
      case "embed_pdf": {
        const url = required("url");
        if (!url.ok || !isSafeHttpUrl(url.value)) {
          return { ok: false, error: "BLOCK_INVALID", message: `PDF #${i + 1} butuh URL http(s) valid.` };
        }
        block = { kind: k, url: url.value, ...opt("title") };
        break;
      }
      case "embed_audio": {
        const url = required("url");
        if (!url.ok || !isSafeHttpUrl(url.value)) {
          return { ok: false, error: "BLOCK_INVALID", message: `Audio #${i + 1} butuh URL http(s) valid.` };
        }
        block = { kind: k, url: url.value, ...opt("transcript") };
        break;
      }
      case "embed_file": {
        const url = required("url");
        if (!url.ok || !isSafeHttpUrl(url.value)) {
          return { ok: false, error: "BLOCK_INVALID", message: `Berkas #${i + 1} butuh URL http(s) valid.` };
        }
        block = { kind: k, url: url.value, ...opt("title") };
        break;
      }
      case "embed_web": {
        // iframe generic: HANYA host di allowlist (PhET/oPhysics/Drive).
        const url = required("url");
        if (!url.ok || !isAllowedIframeHost(url.value)) {
          return {
            ok: false,
            error: "BLOCK_INVALID",
            message: `Web #${i + 1}: host tidak diizinkan (PhET/oPhysics/Google Drive).`,
          };
        }
        block = { kind: k, url: url.value, ...opt("title") };
        break;
      }
      case "embed_video": {
        // Video: preview Google Drive (iframe) ATAU file video langsung (<video>).
        const url = required("url");
        if (!url.ok || !isSafeHttpUrl(url.value)) {
          return { ok: false, error: "BLOCK_INVALID", message: `Video #${i + 1} butuh URL http(s) valid.` };
        }
        block = { kind: k, url: url.value, ...opt("title") };
        break;
      }
    }
    blocks.push(block);
  }
  return { ok: true, blocks };
}
