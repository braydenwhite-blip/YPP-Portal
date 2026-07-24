"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  createMentorshipNote,
  type MentorshipNoteRow,
} from "@/lib/instructor-feedback-actions";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** Ongoing mentor notes attached to a mentee — visible during future reviews. */
export function MentorshipNotesPanel({
  menteeId,
  initialNotes,
  canEdit,
  compact = false,
}: {
  menteeId: string;
  initialNotes: MentorshipNoteRow[];
  canEdit: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!body.trim()) {
      setError("Write a short note.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createMentorshipNote({ menteeId, body: body.trim() });
        setBody("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save note.");
      }
    });
  }

  const visible = compact ? initialNotes.slice(0, 3) : initialNotes;
  const hiddenCount = compact
    ? Math.max(0, initialNotes.length - visible.length)
    : 0;

  return (
    <section>
      <h3 className="m-0 text-[15px] font-semibold text-ink">Your notes</h3>
      <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
        Private reminders for next time
      </p>

      {visible.length > 0 ? (
        <ul className="m-0 mt-3 list-none divide-y divide-line-soft border-t border-line-soft p-0">
          {visible.map((note) => (
            <li key={note.id} className="py-2.5">
              <p className="m-0 text-[12px] text-ink-muted">
                {note.authorName} · {formatDate(note.createdAt)}
              </p>
              <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-5 text-ink">
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No notes yet.</p>
      )}

      {hiddenCount > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[13px] font-medium text-brand-700">
            Show {hiddenCount} older
          </summary>
          <ul className="m-0 mt-2 list-none divide-y divide-line-soft p-0">
            {initialNotes.slice(3).map((note) => (
              <li key={note.id} className="py-2.5">
                <p className="m-0 text-[12px] text-ink-muted">
                  {note.authorName} · {formatDate(note.createdAt)}
                </p>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-5 text-ink">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {canEdit ? (
        <div className="mt-3">
          <label className="block text-[12px] font-medium text-ink-muted">
            New note
            <textarea
              className="mt-1 w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-400"
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Follow up on classroom management…"
              disabled={pending}
            />
          </label>
          {error ? <p className="m-0 mt-1.5 text-[13px] text-danger-700">{error}</p> : null}
          <div className="mt-2">
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
