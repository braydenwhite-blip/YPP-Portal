"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import {
  createInstructorReceivedFeedback,
  type InstructorReceivedFeedbackRow,
} from "@/lib/instructor-feedback-actions";

const SOURCES = [
  { value: "PARENT", label: "Parent" },
  { value: "OFFICER", label: "Officer" },
  { value: "STUDENT", label: "Student" },
  { value: "PARTNER", label: "Partner" },
] as const;

type FeedbackSource = (typeof SOURCES)[number]["value"];

const SOURCE_LABEL: Record<FeedbackSource, string> = {
  PARENT: "Parent",
  OFFICER: "Officer",
  STUDENT: "Student",
  PARTNER: "Partner",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Manual feedback entry for Parent / Officer / Student / Partner.
 * Same data model powers future automated surveys.
 */
export function InstructorFeedbackSection({
  instructorId,
  canEdit,
  initialRows,
  embed = false,
  lockedSource,
  defaultCategory,
}: {
  instructorId: string;
  canEdit: boolean;
  initialRows: InstructorReceivedFeedbackRow[];
  embed?: boolean;
  /** When set, source is fixed (Parent or Officer section). */
  lockedSource?: FeedbackSource;
  defaultCategory?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<FeedbackSource>(lockedSource ?? "PARENT");
  const [feedbackDate, setFeedbackDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState(defaultCategory ?? "General");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createInstructorReceivedFeedback({
          instructorId,
          source: lockedSource ?? source,
          feedbackDate,
          category,
          rating,
          comment: comment.trim() || null,
        });
        setComment("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save feedback.");
      }
    });
  }

  const form = canEdit ? (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {!lockedSource ? (
          <label className="block text-[12px] font-medium text-ink-muted">
            Source
            <select
              className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
              value={source}
              onChange={(e) => setSource(e.target.value as FeedbackSource)}
            >
              {SOURCES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-[12px] font-medium text-ink-muted">
          Date received
          <input
            type="date"
            className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            value={feedbackDate}
            onChange={(e) => setFeedbackDate(e.target.value)}
          />
        </label>
        <label className="block text-[12px] font-medium text-ink-muted">
          Category
          <input
            className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Communication"
          />
        </label>
        <label className="block text-[12px] font-medium text-ink-muted">
          Rating (1–5)
          <input
            type="number"
            min={1}
            max={5}
            className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="block text-[12px] font-medium text-ink-muted">
        Comments (optional)
        <textarea
          className="mt-1 w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            lockedSource === "PARENT"
              ? "Paste or summarize the parent email…"
              : "Observation notes…"
          }
        />
      </label>
      {error ? <p className="m-0 text-[13px] text-danger-700">{error}</p> : null}
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={submit}>
        {pending
          ? "Saving…"
          : lockedSource === "PARENT"
            ? "Save parent feedback"
            : lockedSource === "OFFICER"
              ? "Save officer feedback"
              : "Save feedback"}
      </Button>
    </div>
  ) : null;

  if (embed) {
    return (
      <div className="grid gap-3">
        {initialRows.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-line-soft border-t border-line-soft p-0">
            {initialRows.map((row) => (
              <li key={row.id} className="py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="m-0 text-[13.5px] font-medium text-ink">
                    {row.category} · {row.rating}/5
                  </p>
                  <time className="text-[12px] text-ink-muted" dateTime={row.feedbackDate}>
                    {formatDate(row.feedbackDate)}
                  </time>
                </div>
                {row.comment ? (
                  <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] leading-5 text-ink-muted">
                    {row.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">None yet.</p>
        )}
        {form}
      </div>
    );
  }

  return (
    <section className="rounded-[14px] border border-line-card bg-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[16px] font-semibold text-ink">
          {lockedSource ? `${SOURCE_LABEL[lockedSource]} feedback` : "Feedback"}
        </h2>
      </div>
      {initialRows.length > 0 ? (
        <ul className="m-0 mt-3 list-none divide-y divide-line-card overflow-hidden rounded-[12px] border border-line-card p-0">
          {initialRows.map((row) => (
            <li key={row.id} className="px-3.5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 text-[13.5px] font-semibold text-ink">
                  {SOURCE_LABEL[row.source] ?? row.source} · {row.category} · {row.rating}/5
                </p>
                <time className="text-[11.5px] text-ink-muted" dateTime={row.feedbackDate}>
                  {formatDate(row.feedbackDate)}
                </time>
              </div>
              {row.comment ? (
                <p className="m-0 mt-1 text-[13px] leading-5 text-ink-muted">{row.comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No feedback logged yet.</p>
      )}
      {canEdit ? <div className="mt-4 border-t border-line-card pt-4">{form}</div> : null}
    </section>
  );
}
