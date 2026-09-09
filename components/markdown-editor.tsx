"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useState, useCallback, useEffect, useRef } from "react";

const lowlight = createLowlight(common);

/** Convert markdown to HTML (simplified, no extra deps). */
async function markdownToTiptap(md: string): Promise<string> {
  try {
    const { unified } = await import("unified");
    const { default: remarkParse } = await import("remark-parse");
    const { default: remarkGfm } = await import("remark-gfm");
    const { default: remarkHtml } = await import("remark-html");

    const html = String(
      await unified().use(remarkParse).use(remarkGfm).use(remarkHtml).process(md),
    );
    return html;
  } catch {
    return `<p>${md.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`;
  }
}

/** Convert Tiptap JSON to markdown (simplified HTML→MD). */
function tiptapToMarkdown(json: string): string {
  try {
    const doc = JSON.parse(json);
    return extractText(doc.content ?? []);
  } catch {
    return json;
  }
}

function extractText(nodes: unknown[]): string {
  const lines: string[] = [];
  for (const node of nodes as { type?: string; content?: unknown[]; text?: string; attrs?: Record<string, unknown> }[]) {
    if (node.type === "heading") {
      const level = (node.attrs?.level as number) ?? 1;
      lines.push(`${"#".repeat(level)} ${extractText(node.content ?? [])}`);
    } else if (node.type === "paragraph") {
      lines.push(extractText(node.content ?? []));
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const items = (node.content ?? []) as { content?: unknown[] }[];
      for (const item of items) {
        lines.push(`- ${extractText(item.content ?? [])}`);
      }
    } else if (node.type === "codeBlock") {
      const lang = (node.attrs?.language as string) ?? "";
      lines.push(`\`\`\`${lang}`);
      lines.push(extractText(node.content ?? []));
      lines.push("```");
    } else if (node.type === "blockquote") {
      const inner = extractText(node.content ?? []);
      lines.push(
        inner
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n"),
      );
    } else if (node.type === "image") {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      lines.push(`![${alt}](${src})`);
    } else if (node.type === "hardBreak") {
      lines.push("");
    } else if (node.text) {
      lines.push(node.text);
    }
    if (node.content && node.type !== "bulletList" && node.type !== "orderedList") {
      const inner = extractText(node.content);
      if (inner && !lines.includes(inner)) lines.push(inner);
    }
  }
  return lines.join("\n");
}

interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  onAutosave?: (markdown: string) => Promise<void>;
}

export function MarkdownEditor({ value, onChange, placeholder, className, onAutosave }: MarkdownEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "markdown" | "preview">("wysiwyg");
  const [mdText, setMdText] = useState(value);
  const [previewHtml, setPreviewHtml] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update preview when entering preview mode
  const enterPreview = useCallback(async () => {
    setMode("preview");
    if (mdText.trim().length > 0) {
      const html = await markdownToTiptap(mdText);
      setPreviewHtml(html);
    } else {
      setPreviewHtml("");
    }
  }, [mdText]);

  // Autosave with debounce
  const triggerAutosave = useCallback(
    (content: string) => {
      if (!onAutosave) return;
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      setSaveStatus("saving");
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await onAutosave(content);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("error");
        }
      }, 1000);
    },
    [onAutosave]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing your content..." }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: value ? (value.startsWith("{") ? value : "") : "",
    onUpdate: ({ editor: e }) => {
      const json = JSON.stringify(e.getJSON());
      const md = tiptapToMarkdown(json);
      setMdText(md);
      onChange(md);
      triggerAutosave(md);
    },
  });

  // Sync external value changes (e.g., AI prompt paste)
  useEffect(() => {
    if (!editor) return;
    if (value === mdText) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync
    setMdText(value);
    if (value.startsWith("{")) {
      editor.commands.setContent(JSON.parse(value));
    } else if (value.trim().length > 0) {
      markdownToTiptap(value).then((html) => {
        editor.commands.setContent(html);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mdText omitted intentionally
  }, [value, editor]);

  const switchToMarkdown = useCallback(() => {
    if (editor) {
      const json = JSON.stringify(editor.getJSON());
      setMdText(tiptapToMarkdown(json));
    }
    setMode("markdown");
  }, [editor]);

  const handleMdChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMdText(e.target.value);
      onChange(e.target.value);
    },
    [onChange],
  );

  if (!editor) return null;

  return (
    <div className={`overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${className ?? ""}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 text-sm font-bold ${editor.isActive("bold") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 text-sm italic ${editor.isActive("italic") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded px-2 py-1 text-sm font-mono ${editor.isActive("code") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          &lt;/&gt;
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded px-2 py-1 text-sm font-bold ${editor.isActive("heading", { level: 2 }) ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded px-2 py-1 text-sm font-bold ${editor.isActive("heading", { level: 3 }) ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          H3
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-2 py-1 text-sm ${editor.isActive("bulletList") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded px-2 py-1 text-sm ${editor.isActive("orderedList") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded px-2 py-1 text-sm ${editor.isActive("blockquote") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          &quot;&quot;
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`rounded px-2 py-1 text-sm font-mono ${editor.isActive("codeBlock") ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
        >
          {"{ }"}
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Image URL:");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          🖼
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Link URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          🔗
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        {/* Save status */}
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          {saveStatus === "saving" && (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span>Save failed</span>
            </>
          )}
        </div>
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        {/* Mode toggles */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("wysiwyg")}
            className={`rounded px-2 py-1 text-xs font-semibold ${mode === "wysiwyg" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
          >
            ✨ Editor
          </button>
          <button
            type="button"
            onClick={() => { setMode("markdown"); switchToMarkdown(); }}
            className={`rounded px-2 py-1 text-xs font-semibold ${mode === "markdown" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
          >
            📝 Markdown
          </button>
          <button
            type="button"
            onClick={enterPreview}
            className={`rounded px-2 py-1 text-xs font-semibold ${mode === "preview" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
          >
            👁 Preview
          </button>
        </div>
      </div>

      {/* Content area */}
      {mode === "wysiwyg" && (
        <EditorContent editor={editor} className="prose prose-sm max-w-none p-4 dark:prose-invert min-h-[200px] focus:outline-none [&_.ProseMirror]:min-h-[180px]" />
      )}
      {mode === "markdown" && (
        <textarea
          value={mdText}
          onChange={handleMdChange}
          className="w-full min-h-[200px] resize-y border-0 bg-transparent p-4 font-mono text-sm focus:outline-none"
          placeholder={placeholder ?? "Write markdown..."}
          spellCheck={false}
        />
      )}
      {mode === "preview" && (
        <div className="min-h-[200px] border-t bg-slate-50/50 p-4 dark:bg-slate-800/50">
          {mdText.trim().length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nothing to preview — write some content first.</p>
          ) : (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}
          <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500">
            This is how students will see the published article.
          </p>
        </div>
      )}
    </div>
  );
}
