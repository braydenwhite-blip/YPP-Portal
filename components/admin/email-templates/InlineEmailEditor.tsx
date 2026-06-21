"use client";

import { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

/**
 * Reusable presentational editor for a one-off email: a subject input plus a
 * restricted Tiptap WYSIWYG body. Emits plain HTML (already variable-substituted
 * by the caller). No save logic — purely controlled by `value`/`onChange`, so it
 * can be dropped into any send site that wants inline editing.
 */

const LINK_OK = /^(https?:|mailto:)/i;

export interface InlineEmailEditorProps {
  subject: string;
  onSubjectChange: (subject: string) => void;
  /** Initial body HTML (seeds the editor once on mount). */
  initialBodyHtml: string;
  onBodyChange: (html: string) => void;
}

export function InlineEmailEditor({
  subject,
  onSubjectChange,
  initialBodyHtml,
  onBodyChange,
}: InlineEmailEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        isAllowedUri: (url) => LINK_OK.test(url),
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: initialBodyHtml,
    editorProps: { attributes: { class: "ete-content" } },
    onUpdate: ({ editor }) => onBodyChange(editor.getHTML()),
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL (https://… or mailto:)", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (LINK_OK.test(url)) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="h-9 rounded-[8px] border border-line bg-surface px-3 text-[13.5px] text-ink outline-none focus-visible:border-brand-400"
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink">Message</span>
        <div className="overflow-hidden rounded-[9px] border border-line bg-surface">
          {editor ? (
            <div className="flex flex-wrap gap-1 border-b border-line bg-idle-50 px-2 py-1.5">
              <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                <strong>B</strong>
              </Btn>
              <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <em>I</em>
              </Btn>
              <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                • List
              </Btn>
              <Btn active={editor.isActive("link")} onClick={setLink}>
                🔗 Link
              </Btn>
            </div>
          ) : null}
          <div className="min-h-[160px] cursor-text px-3 py-2.5 text-[13.5px] leading-relaxed" onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[6px] px-2 py-1 text-[12px] font-semibold " +
        (active ? "bg-brand-100 text-brand-700" : "text-ink hover:bg-brand-50")
      }
    >
      {children}
    </button>
  );
}
