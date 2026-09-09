"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useState, useCallback, useEffect } from "react";

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
}

export function MarkdownEditor({ value, onChange, placeholder, className }: MarkdownEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [mdText, setMdText] = useState(value);

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
    },
  });

  // Sync external value changes (e.g., AI prompt paste)
  useEffect(() => {
    if (!editor) return;
    if (value === mdText) return;
    setMdText(value);
    if (value.startsWith("{")) {
      editor.commands.setContent(JSON.parse(value));
    } else if (value.trim().length > 0) {
      markdownToTiptap(value).then((html) => {
        editor.commands.setContent(html);
      });
    }
  }, [value, editor]);

  const switchToMarkdown = useCallback(() => {
    if (editor) {
      const json = JSON.stringify(editor.getJSON());
      setMdText(tiptapToMarkdown(json));
    }
    setMode("markdown");
  }, [editor]);

  const switchToWysiwyg = useCallback(async () => {
    if (editor && mdText.trim().length > 0) {
      const html = await markdownToTiptap(mdText);
      editor.commands.setContent(html);
    }
    setMode("wysiwyg");
  }, [editor, mdText]);

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
        {/* Mode toggle */}
        <button
          type="button"
          onClick={mode === "wysiwyg" ? switchToMarkdown : switchToWysiwyg}
          className="ml-auto rounded bg-slate-100 px-2 py-1 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {mode === "wysiwyg" ? "📝 Markdown" : "✨ Editor"}
        </button>
      </div>

      {/* Content area */}
      {mode === "wysiwyg" ? (
        <EditorContent editor={editor} className="prose prose-sm max-w-none p-4 dark:prose-invert min-h-[200px] focus:outline-none [&_.ProseMirror]:min-h-[180px]" />
      ) : (
        <textarea
          value={mdText}
          onChange={handleMdChange}
          className="w-full min-h-[200px] resize-y border-0 bg-transparent p-4 font-mono text-sm focus:outline-none"
          placeholder={placeholder ?? "Write markdown..."}
          spellCheck={false}
        />
      )}
    </div>
  );
}
