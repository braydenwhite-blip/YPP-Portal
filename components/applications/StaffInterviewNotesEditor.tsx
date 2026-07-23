"use client";

import { useTransition } from "react";

import { saveStructuredInterviewNote } from "@/lib/application-actions";
import { StatusBadge } from "@/components/ui-v2";

type Note = {
  id: string;
  content: string;
  rating: number | null;
  recommendation: string | null;
  strengths: string | null;
  concerns: string | null;
  nextStepSuggestion: string | null;
  createdAt: string | Date;
  author: { id: string; name: string | null };
};

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

const fieldClass =
  "w-full rounded-[9px] border border-line bg-surface px-2.5 py-2 text-[13px] font-medium text-ink placeholder:text-ink-muted/70";
const labelClass =
  "flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted";

export function StaffInterviewNotesEditor({
  applicationId,
  actorId,
  notes,
  disabled = false,
}: {
  applicationId: string;
  actorId: string;
  notes: Note[];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const myNote = notes.find((note) => note.author.id === actorId) ?? null;
  const others = notes.filter((note) => note.author.id !== actorId);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        action={(formData) => {
          startTransition(async () => {
            await saveStructuredInterviewNote(formData);
          });
        }}
      >
        <input type="hidden" name="applicationId" value={applicationId} />
        <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
          Open notes pad for interviewers — edit anytime. Your note is saved to this
          application and visible to the hiring team.
        </p>
        <label className={labelClass}>
          Interview notes
          <textarea
            name="content"
            rows={6}
            required
            disabled={disabled || pending}
            defaultValue={myNote?.content ?? ""}
            placeholder="What stood out in the interview? Communication, judgment, fit, follow-ups…"
            className={`${fieldClass} min-h-[8rem] resize-y font-normal normal-case tracking-normal`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Recommendation
            <select
              name="recommendation"
              disabled={disabled || pending}
              defaultValue={myNote?.recommendation ?? ""}
              className={`${fieldClass} h-9 font-semibold normal-case tracking-normal`}
            >
              <option value="">No recommendation yet</option>
              <option value="STRONG_YES">Strong Yes</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label className={labelClass}>
            Rating
            <select
              name="rating"
              disabled={disabled || pending}
              defaultValue={myNote?.rating != null ? String(myNote.rating) : ""}
              className={`${fieldClass} h-9 font-semibold normal-case tracking-normal`}
            >
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}/5
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Strengths
            <textarea
              name="strengths"
              rows={2}
              disabled={disabled || pending}
              defaultValue={myNote?.strengths ?? ""}
              placeholder="Optional"
              className={`${fieldClass} resize-y font-normal normal-case tracking-normal`}
            />
          </label>
          <label className={labelClass}>
            Concerns
            <textarea
              name="concerns"
              rows={2}
              disabled={disabled || pending}
              defaultValue={myNote?.concerns ?? ""}
              placeholder="Optional"
              className={`${fieldClass} resize-y font-normal normal-case tracking-normal`}
            />
          </label>
        </div>
        <label className={labelClass}>
          Next step
          <textarea
            name="nextStepSuggestion"
            rows={2}
            disabled={disabled || pending}
            defaultValue={myNote?.nextStepSuggestion ?? ""}
            placeholder="Optional — what should happen next?"
            className={`${fieldClass} resize-y font-normal normal-case tracking-normal`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={disabled || pending}
            className="h-9 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : myNote ? "Update notes" : "Save notes"}
          </button>
          {myNote ? (
            <span className="text-[12px] text-ink-muted">
              Last saved{" "}
              {new Date(myNote.createdAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </form>

      {others.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            Other interviewer notes
          </p>
          {others.map((note) => (
            <div
              key={note.id}
              className="rounded-[10px] border border-line-soft px-3.5 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 text-[13.5px] font-semibold text-ink">
                  {note.author.name ?? "Interviewer"}
                </p>
                <span className="text-[12px] text-ink-muted">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {note.rating !== null ? (
                  <StatusBadge tone="neutral">{note.rating}/5</StatusBadge>
                ) : null}
                {note.recommendation ? (
                  <StatusBadge tone="brand">
                    {formatStatus(note.recommendation)}
                  </StatusBadge>
                ) : null}
              </div>
              <p className="m-0 mt-2 whitespace-pre-wrap text-[13px] text-ink">
                {note.content}
              </p>
              {note.strengths ? (
                <p className="m-0 mt-2 text-[13px] text-ink">
                  <strong>Strengths:</strong> {note.strengths}
                </p>
              ) : null}
              {note.concerns ? (
                <p className="m-0 mt-1 text-[13px] text-ink">
                  <strong>Concerns:</strong> {note.concerns}
                </p>
              ) : null}
              {note.nextStepSuggestion ? (
                <p className="m-0 mt-1 text-[13px] text-ink">
                  <strong>Next step:</strong> {note.nextStepSuggestion}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
