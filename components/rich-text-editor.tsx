"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
  value: string | null;
  onChange: (json: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Lightweight rich text editor built on Tiptap.
 * Supports: Bold, Italic, Bullet List, Ordered List, H2, H3, Link.
 * Stores content as Tiptap JSON (stringified) in the parent's state.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 140,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: parseContent(value),
    editorProps: {
      attributes: {
        class: "rte-content",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = value ?? "";
    if (next !== current) {
      editor.commands.setContent(parseContent(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          padding: "6px 8px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-alt)",
        }}
      >
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <div style={{ width: 1, background: "var(--border)", margin: "2px 4px" }} />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          H3
        </ToolbarButton>
        <div style={{ width: 1, background: "var(--border)", margin: "2px 4px" }} />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          1. List
        </ToolbarButton>
        <div style={{ width: 1, background: "var(--border)", margin: "2px 4px" }} />
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={setLink}
          title="Link"
        >
          🔗
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div
        style={{
          minHeight,
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.6,
          cursor: "text",
        }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .rte-content:focus {
          outline: none;
        }
        .rte-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted);
          pointer-events: none;
          height: 0;
        }
        .rte-content h2 { font-size: 18px; font-weight: 700; margin: 12px 0 6px; }
        .rte-content h3 { font-size: 15px; font-weight: 600; margin: 10px 0 4px; }
        .rte-content p { margin: 0 0 8px; }
        .rte-content ul, .rte-content ol { padding-left: 20px; margin: 0 0 8px; }
        .rte-content li { margin: 2px 0; }
        .rte-content a { color: var(--ypp-purple); text-decoration: underline; }
        .rte-content strong { font-weight: 700; }
        .rte-content em { font-style: italic; }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "3px 8px",
        borderRadius: "var(--radius-xs)",
        border: "1px solid transparent",
        background: active ? "var(--ypp-purple-100)" : "transparent",
        color: active ? "var(--ypp-purple-700)" : "var(--text)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1.4,
      }}
    >
      {children}
    </button>
  );
}

// ─── Companion: render stored JSON as styled HTML ────────────────────────────

interface RichTextContentProps {
  content: string | null | undefined;
  style?: React.CSSProperties;
}

/**
 * Renders Tiptap JSON content as styled HTML.
 * Falls back to plain text if content is not valid JSON.
 */
export function RichTextContent({ content, style }: RichTextContentProps) {
  if (!content) return null;

  const html = jsonToHtml(content);
  return (
    <div
      className="rte-display"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontSize: 14, lineHeight: 1.6, ...style }}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseContent(value: string | null | undefined) {
  if (!value) return "";
  try {
    return JSON.parse(value);
  } catch {
    // Plain text fallback
    return value;
  }
}

function jsonToHtml(json: string): string {
  try {
    const doc = JSON.parse(json) as TiptapDoc;
    return renderNode(doc);
  } catch {
    // Plain text escaped
    return escapeHtml(json);
  }
}

type TiptapNode = {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
  attrs?: Record<string, string | number | boolean>;
};

type TiptapDoc = TiptapNode & { type: "doc" };

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(renderNode).join("");
    case "paragraph":
      return `<p>${(node.content ?? []).map(renderNode).join("") || ""}</p>`;
    case "heading": {
      const level = node.attrs?.level ?? 2;
      return `<h${level}>${(node.content ?? []).map(renderNode).join("")}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${(node.content ?? []).map(renderNode).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map(renderNode).join("")}</ol>`;
    case "listItem":
      return `<li>${(node.content ?? []).map(renderNode).join("")}</li>`;
    case "text": {
      let text = escapeHtml(node.text ?? "");
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = `<strong>${text}</strong>`;
        else if (mark.type === "italic") text = `<em>${text}</em>`;
        else if (mark.type === "link") {
          const href = escapeHtml(mark.attrs?.href ?? "");
          text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
      }
      return text;
    }
    default:
      return (node.content ?? []).map(renderNode).join("");
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
