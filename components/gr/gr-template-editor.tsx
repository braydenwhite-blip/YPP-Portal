"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addGRTemplateGoal,
  removeGRTemplateGoal,
  approveGRTemplate,
  addGRTemplateComment,
  resolveGRTemplateComment,
} from "@/lib/gr-actions";
import { formatEnum } from "@/lib/format-utils";

interface TemplateEditorProps {
  template: {
    id: string;
    title: string;
    roleType: string;
    officerPosition: string | null;
    roleMission: string;
    version: number;
    status?: string;
    goals?: Array<{
      id: string;
      title: string;
      description: string;
      timePhase: string;
      sortOrder: number;
    }>;
    successCriteria?: Array<{ id: string; timePhase: string; criteria: string }>;
    comments?: Array<{
      id: string;
      body: string;
      createdAt: string;
      author: { name: string | null; email: string | null };
    }>;
    resources?: Array<{ id: string; resource?: { title: string; url: string } | null }>;
  } | null;
}

const TIME_PHASES = [
  { value: "FIRST_MONTH", label: "First month" },
  { value: "FIRST_QUARTER", label: "First quarter" },
  { value: "LONG_TERM", label: "Long term" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructors",
  CHAPTER_PRESIDENT: "Chapter Presidents",
  GLOBAL_LEADERSHIP: "Global Leadership",
};

export default function GRTemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalPhase, setGoalPhase] = useState("LONG_TERM");

  const goals = template?.goals ?? [];
  const successCriteria = template?.successCriteria ?? [];
  const comments = template?.comments ?? [];
  const resources = template?.resources ?? [];
  const isApproved = template?.status === "GR_APPROVED";

  if (!template) {
    return (
      <div className="p-4 text-amber-600 font-medium">No valid template context loaded.</div>
    );
  }

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const fd = new FormData();
    fd.set("templateId", template.id);
    fd.set("title", goalTitle.trim());
    fd.set("description", goalDescription.trim() || goalTitle.trim());
    fd.set("timePhase", goalPhase);
    fd.set("sortOrder", String(goals.length));
    run(async () => {
      await addGRTemplateGoal(fd);
      setGoalTitle("");
      setGoalDescription("");
      setGoalPhase("LONG_TERM");
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.set("templateId", template.id);
    fd.set("body", commentText.trim());
    run(async () => {
      await addGRTemplateComment(fd);
      setCommentText("");
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-line-soft pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-[18px] font-semibold text-ink">{template.title}</h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              {ROLE_LABELS[template.roleType] ?? formatEnum(template.roleType)}
              {template.officerPosition ? ` · ${template.officerPosition}` : ""}
              {" · "}v{template.version}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-surface-soft px-2 py-1 text-[12px] font-medium text-ink-muted">
              {isApproved ? "Approved" : "Draft"}
            </span>
            {!isApproved ? (
              <button
                type="button"
                disabled={isPending || goals.length === 0}
                className="rounded-lg bg-ink px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("templateId", template.id);
                  run(() => approveGRTemplate(fd));
                }}
              >
                Approve for assignment
              </button>
            ) : null}
          </div>
        </div>
        <p className="m-0 mt-3 rounded-lg bg-surface-soft px-3 py-2 text-[13px] text-ink-muted">
          {template.roleMission || "No mission statement yet."}
        </p>
      </div>

      {error ? <p className="m-0 text-[13px] text-red-600">{error}</p> : null}

      <div>
        <h3 className="m-0 text-[15px] font-semibold text-ink">
          Goals ({goals.length})
        </h3>
        <p className="m-0 mt-1 mb-3 text-[13px] text-ink-muted">
          These copy onto every person when this template is assigned.
        </p>

        {goals.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-line-soft bg-surface-soft px-4 py-3 text-[13px] text-ink-muted">
            No goals yet. Add the responsibilities this role should always carry.
          </p>
        ) : (
          <div className="mb-4 flex flex-col gap-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-line-soft px-4 py-3"
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {formatEnum(goal.timePhase)}
                  </span>
                  <h4 className="m-0 mt-1 text-[14px] font-medium text-ink">{goal.title}</h4>
                  <p className="m-0 mt-1 text-[13px] text-ink-muted">{goal.description}</p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  className="shrink-0 text-[12px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("goalId", goal.id);
                    run(() => removeGRTemplateGoal(fd));
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAddGoal}
          className="grid gap-3 rounded-xl border border-line-soft bg-surface-soft p-4"
        >
          <strong className="text-[14px] text-ink">Add a goal</strong>
          <label className="text-[12px] font-medium text-ink-muted">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-line-soft bg-surface px-3 py-2 text-[13px] text-ink"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g. Lead weekly team huddle"
              required
            />
          </label>
          <label className="text-[12px] font-medium text-ink-muted">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-line-soft bg-surface px-3 py-2 text-[13px] text-ink"
              rows={2}
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              placeholder="What success looks like…"
            />
          </label>
          <label className="text-[12px] font-medium text-ink-muted">
            Time phase
            <select
              className="mt-1 w-full rounded-lg border border-line-soft bg-surface px-3 py-2 text-[13px] text-ink"
              value={goalPhase}
              onChange={(e) => setGoalPhase(e.target.value)}
            >
              {TIME_PHASES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isPending || !goalTitle.trim()}
            className="justify-self-start rounded-lg bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Add goal"}
          </button>
        </form>
      </div>

      {successCriteria.length > 0 ? (
        <div>
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-ink">Success criteria</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {successCriteria.map((criteria) => (
              <div key={criteria.id} className="rounded-lg border border-line-soft bg-surface-soft p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {formatEnum(criteria.timePhase)}
                </span>
                <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink">{criteria.criteria}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {resources.length > 0 ? (
        <div>
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-ink">Resources</h3>
          <div className="flex flex-wrap gap-2">
            {resources.map(
              (item) =>
                item.resource && (
                  <a
                    key={item.id}
                    href={item.resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-md bg-surface-soft px-3 py-1.5 text-[12px] font-medium text-ink no-underline transition hover:bg-line-soft"
                  >
                    {item.resource.title}
                  </a>
                )
            )}
          </div>
        </div>
      ) : null}

      <div className="border-t border-line-soft pt-6">
        <h3 className="m-0 mb-3 text-[15px] font-semibold text-ink">Notes</h3>
        {comments.length > 0 ? (
          <div className="mb-4 max-h-[300px] space-y-3 overflow-y-auto pr-2">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-line-soft bg-surface-soft p-3 text-[12px]"
              >
                <div>
                  <div className="mb-1 flex items-center gap-2 text-ink-muted">
                    <span className="font-semibold text-ink">
                      {comment.author?.name || "Someone"}
                    </span>
                    <span>·</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="m-0 leading-relaxed text-ink">{comment.body}</p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("commentId", comment.id);
                    run(() => resolveGRTemplateComment(fd));
                  }}
                  className="rounded bg-surface px-2 py-1 text-[11px] font-semibold text-ink-muted transition hover:text-ink"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 rounded-lg border border-line-soft px-3 py-2 text-[13px] text-ink"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !commentText.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Comment
          </button>
        </form>
      </div>
    </div>
  );
}
