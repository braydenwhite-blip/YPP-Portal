"use client";

import { useMemo, useState } from "react";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

const ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ESCAPE_LOOKUP[char] ?? char);
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  return out;
}

function renderMarkdown(source: string): string {
  if (!source.trim()) return "";

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      paragraph.push(renderInline(lines[i]));
      i += 1;
    }
    blocks.push(`<p>${paragraph.join("<br />")}</p>`);
  }

  return blocks.join("");
}

export default function MarkdownEditor({
  name,
  defaultValue = "",
  rows = 6,
  required,
  disabled,
  placeholder,
  ariaLabel,
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview">("write");

  const html = useMemo(() => renderMarkdown(value), [value]);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className={`button small ${mode === "write" ? "" : "outline"}`}
            onClick={() => setMode("write")}
            disabled={disabled}
            aria-pressed={mode === "write"}
            style={{ marginTop: 0 }}
          >
            Write
          </button>
          <button
            type="button"
            className={`button small ${mode === "preview" ? "" : "outline"}`}
            onClick={() => setMode("preview")}
            disabled={disabled}
            aria-pressed={mode === "preview"}
            style={{ marginTop: 0 }}
          >
            Preview
          </button>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Markdown: **bold**, *italic*, [link](url), - list, # heading
        </span>
      </div>

      {mode === "write" ? (
        <textarea
          className="input"
          name={name}
          rows={rows}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={ariaLabel}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div
            className="markdown-preview"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              minHeight: rows * 20,
              background: "var(--bg-subtle, #fafafa)",
              fontSize: 14,
              lineHeight: 1.5,
            }}
            dangerouslySetInnerHTML={{ __html: html || '<p style="color:var(--muted);margin:0;">Nothing to preview.</p>' }}
          />
        </>
      )}
    </div>
  );
}
