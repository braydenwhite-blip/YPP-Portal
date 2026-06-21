"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Button, ModalV2, ModalFooterV2, StatusBadge } from "@/components/ui-v2";
import { interpolate, interpolateSubject } from "@/lib/email-templates/interpolate";
import { emailShell } from "@/lib/email-templates/shell";
import type { EmailTemplateVar } from "@/lib/email-templates/registry";

/**
 * Admin editor for a single email template. Edits the subject (plain text) and
 * body (restricted Tiptap WYSIWYG → HTML) with `{{variable}}` tokens, shows a
 * live preview rendered with sample values, and saves/resets via the
 * `/api/email-templates` routes.
 */

const LINK_OK = /^(https?:|mailto:|\{\{)/i;

export interface EmailTemplateEditorProps {
  templateKey: string;
  templateName: string;
  variables: EmailTemplateVar[];
  /** Sample values used for the live preview, keyed by variable. */
  sampleVars: Record<string, string>;
  /** Current effective subject (override or default). */
  initialSubject: string;
  /** Current effective body HTML (override or default). */
  initialBodyHtml: string;
  /** Whether a stored override currently exists (controls Reset availability). */
  isCustomized: boolean;
}

export function EmailTemplateEditor({
  templateKey,
  templateName,
  variables,
  sampleVars,
  initialSubject,
  initialBodyHtml,
  isCustomized,
}: EmailTemplateEditorProps) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
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
        // Allow http(s)/mailto and our {{var}} placeholder hrefs.
        isAllowedUri: (url) => LINK_OK.test(url),
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: initialBodyHtml,
    editorProps: { attributes: { class: "ete-content" } },
    onUpdate: ({ editor }) => setBodyHtml(editor.getHTML()),
  });

  const insertVariable = useCallback(
    (key: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{{${key}}}`).run();
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL (https://… or {{variable}})", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (LINK_OK.test(url)) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      window.alert("Links must start with https://, mailto:, or a {{variable}}.");
    }
  }, [editor]);

  // Live preview: interpolate with sample values + wrap in the branded shell.
  const previewDoc = useMemo(() => {
    const html = interpolate(bodyHtml, sampleVars);
    return emailShell(html);
  }, [bodyHtml, sampleVars]);
  const previewSubject = useMemo(
    () => interpolateSubject(subject, sampleVars),
    [subject, sampleVars]
  );

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/email-templates/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          subject,
          body: editor?.getHTML() ?? bodyHtml,
          bodyJson: editor?.getJSON() ?? null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to save template");
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }, [templateKey, subject, bodyHtml, editor, router]);

  const doReset = useCallback(async () => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/email-templates/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to reset template");
      }
      setConfirmReset(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset template");
    } finally {
      setResetting(false);
    }
  }, [templateKey, router]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Editor column */}
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-9.5 rounded-[9px] border border-line bg-surface px-3 text-[14px] text-ink outline-none focus-visible:border-brand-400"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink">Body</span>
          <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
            {editor ? (
              <div className="flex flex-wrap gap-1 border-b border-line bg-idle-50 px-2 py-1.5">
                <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <strong>B</strong>
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <em>I</em>
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                  H2
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                  H3
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                  • List
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                  1. List
                </ToolbarBtn>
                <ToolbarBtn active={editor.isActive("link")} onClick={setLink}>
                  🔗 Link
                </ToolbarBtn>
              </div>
            ) : null}
            <div className="min-h-[220px] cursor-text px-3.5 py-3 text-[14px] leading-relaxed" onClick={() => editor?.commands.focus()}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {variables.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-ink">Insert a variable</span>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={`${v.label} — e.g. ${v.sample}`}
                  className="rounded-[7px] border border-line bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-100"
                >
                  {"{{"}{v.key}{"}}"}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-ink-muted">
              Click to insert. Variables are replaced with real values when the email is sent.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-[8px] bg-blocked-50 px-3 py-2 text-[13px] text-blocked-700">{error}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} loading={saving}>
            Save template
          </Button>
          {isCustomized ? (
            <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={saving}>
              Reset to default
            </Button>
          ) : null}
          {savedAt ? (
            <StatusBadge tone="success">Saved</StatusBadge>
          ) : null}
        </div>
      </div>

      {/* Preview column */}
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-ink">Live preview</span>
        <div className="rounded-[10px] border border-line bg-idle-50 p-3">
          <p className="mb-2 text-[12px] text-ink-muted">
            Subject: <span className="font-semibold text-ink">{previewSubject}</span>
          </p>
          <iframe
            title="Email preview"
            srcDoc={previewDoc}
            className="h-[560px] w-full rounded-[8px] border border-line bg-white"
          />
        </div>
        <p className="text-[12px] text-ink-muted">
          Preview uses sample values. The branded header and footer are added automatically.
        </p>
      </div>

      <ModalV2
        open={confirmReset}
        onClose={() => (resetting ? undefined : setConfirmReset(false))}
        locked={resetting}
        size="sm"
        accent="danger"
        labelledBy="reset-template-title"
      >
        <h2 id="reset-template-title" className="text-[16px] font-semibold text-ink">
          Reset “{templateName}” to default?
        </h2>
        <p className="text-[14px] leading-snug text-ink-muted">
          This removes your customization and restores the original wording. This cannot be
          undone.
        </p>
        <ModalFooterV2>
          <Button variant="secondary" onClick={() => setConfirmReset(false)} disabled={resetting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={doReset} loading={resetting}>
            Reset to default
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </div>
  );
}

function ToolbarBtn({
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
