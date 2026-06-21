"use client";

/**
 * Truthful, override-aware preview of the decision email shown in the confirm
 * modal, with an optional one-off inline edit. It fetches the resolved template
 * (DB override or default, interpolated for this applicant) from
 * `/api/email-templates/resolve-decision` so the preview matches exactly what
 * will be sent — fixing the previous drift where the snippet's copy differed
 * from the actual email. When the chair edits, the override is reported upward
 * and threaded through `chairDecide` for this send only.
 */

import { useEffect, useRef, useState } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import { InlineEmailEditor } from "@/components/admin/email-templates/InlineEmailEditor";

export interface DecisionEmailOverride {
  subject: string;
  bodyHtml: string;
}

export interface DecisionEmailEditorProps {
  applicationId: string;
  action: ChairDecisionAction;
  /** Already-formatted rationale (matches what the server will send). */
  rationale: string;
  onOverrideChange: (override: DecisionEmailOverride | null) => void;
}

export default function DecisionEmailEditor({
  applicationId,
  action,
  rationale,
  onOverrideChange,
}: DecisionEmailEditorProps) {
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const onOverrideChangeRef = useRef(onOverrideChange);
  onOverrideChangeRef.current = onOverrideChange;

  // (Re)resolve whenever the action or rationale changes. Editing + any prior
  // override are cleared so the chair starts from the current template.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setEditing(false);
    onOverrideChangeRef.current(null);
    fetch("/api/email-templates/resolve-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, action, rationale }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { subject: string; bodyHtml: string } | null) => {
        if (stale) return;
        if (data) {
          setResolved(data);
          setDraftSubject(data.subject);
          setDraftBody(data.bodyHtml);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [applicationId, action, rationale]);

  function startEditing() {
    if (!resolved) return;
    setDraftSubject(resolved.subject);
    setDraftBody(resolved.bodyHtml);
    setEditing(true);
    onOverrideChange({ subject: resolved.subject, bodyHtml: resolved.bodyHtml });
  }

  function stopEditing() {
    setEditing(false);
    onOverrideChange(null);
  }

  return (
    <div className="rounded-[12px] border border-line-soft bg-surface-strong p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Email to applicant
        </p>
        {!loading && resolved ? (
          <button
            type="button"
            onClick={editing ? stopEditing : startEditing}
            className="text-[12px] font-semibold text-brand-700 hover:underline"
          >
            {editing ? "Use default wording" : "Edit email before sending"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="m-0 text-[12px] text-ink-muted">Loading preview…</p>
      ) : !resolved ? (
        <p className="m-0 text-[12px] text-ink-muted">Preview unavailable.</p>
      ) : editing ? (
        <InlineEmailEditor
          subject={draftSubject}
          onSubjectChange={(s) => {
            setDraftSubject(s);
            onOverrideChange({ subject: s, bodyHtml: draftBody });
          }}
          initialBodyHtml={draftBody}
          onBodyChange={(html) => {
            setDraftBody(html);
            onOverrideChange({ subject: draftSubject, bodyHtml: html });
          }}
        />
      ) : (
        <div>
          <p className="m-0 mb-1 text-[13px] font-semibold text-ink">{resolved.subject}</p>
          <div
            className="email-decision-preview text-[12.5px] leading-relaxed text-ink-muted"
            dangerouslySetInnerHTML={{ __html: resolved.bodyHtml }}
          />
        </div>
      )}
    </div>
  );
}
