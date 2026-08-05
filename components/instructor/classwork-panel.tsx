"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ClassCompletionAction } from "@/components/session8/instructor-class-widgets";
import { createClassworkItem } from "@/lib/classes/classwork-actions";

export type ClassworkAssignment = {
  id: string;
  title: string;
  description: string;
  type: string;
  attachmentUrl?: string | null;
  suggestedDueDate?: string | Date | null;
  sessionId?: string | null;
  createdAt: string | Date;
  isPublished?: boolean;
};

export type ClassworkSession = {
  id: string;
  topic: string;
  date: string | Date;
  startTime?: string | null;
  isCancelled?: boolean;
  materialsUrl?: string | null;
};

const CREATE_KINDS = [
  {
    id: "assignment" as const,
    label: "Assignment",
    hint: "Something to turn in",
    badge: "A",
  },
  {
    id: "material" as const,
    label: "Material",
    hint: "A link or reading",
    badge: "M",
  },
  {
    id: "question" as const,
    label: "Question",
    hint: "Ask the class",
    badge: "Q",
  },
  {
    id: "note" as const,
    label: "Note",
    hint: "A quick note",
    badge: "N",
  },
];

function kindLabel(type: string) {
  switch (type) {
    case "PROJECT":
      return "Assignment";
    case "EXPLORATION":
      return "Material";
    case "REFLECTION":
      return "Question";
    case "PRACTICE":
      return "Note";
    case "GROUP":
      return "Group work";
    default:
      return type;
  }
}

/** "Cohort A · Session 4" → "Class 4" */
function friendlySessionTitle(topic: string): string {
  const cleaned = topic.trim();
  const match = cleaned.match(/(?:^|[·\-—,])\s*Session\s+(\d+)\s*$/i);
  if (match) return `Class ${match[1]}`;
  const only = cleaned.match(/^Session\s+(\d+)$/i);
  if (only) return `Class ${only[1]}`;
  return cleaned || "Class";
}

function formatDue(iso: string | Date | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function ClassworkPanel({
  offeringId,
  sessions,
  assignments,
  offeringEnded,
  alreadyCompleted,
}: {
  offeringId: string;
  sessions: ClassworkSession[];
  assignments: ClassworkAssignment[];
  offeringEnded: boolean;
  alreadyCompleted: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<(typeof CREATE_KINDS)[number]["id"] | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => !s.isCancelled);

  function startCreate(next: (typeof CREATE_KINDS)[number]["id"]) {
    setKind(next);
    setMenuOpen(false);
    setError(null);
  }

  function submit(formData: FormData) {
    if (!kind) return;
    setError(null);
    formData.set("offeringId", offeringId);
    formData.set("kind", kind);
    startTransition(async () => {
      try {
        await createClassworkItem(formData);
        setKind(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not post. Try again.");
      }
    });
  }

  const feed = [...assignments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[18px] font-normal text-[#202124]">Work</h2>
          <p className="m-0 mt-0.5 text-[13px] text-[#5f6368]">
            Assignments, materials, questions, and notes for your class.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1967d2] px-4 text-[13px] font-medium text-white hover:bg-[#1557b0]"
          >
            + Create
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[#dadce0] bg-white py-1 shadow-[0_8px_24px_rgba(60,64,67,0.18)]">
              {CREATE_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => startCreate(k.id)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-[#f8f9fa]"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[12px] font-semibold text-[#174ea6]">
                    {k.badge}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-medium text-[#202124]">
                      {k.label}
                    </span>
                    <span className="block text-[12px] text-[#5f6368]">{k.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {kind ? (
        <form
          action={submit}
          className="rounded-xl border border-[#dadce0] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="m-0 text-[14px] font-medium text-[#202124]">
              New {CREATE_KINDS.find((k) => k.id === kind)?.label.toLowerCase()}
            </p>
            <button
              type="button"
              onClick={() => setKind(null)}
              className="text-[13px] font-medium text-[#5f6368] hover:text-[#202124]"
            >
              Cancel
            </button>
          </div>
          <label className="block text-[13px] font-medium text-[#202124]" htmlFor="cw-title">
            Title
          </label>
          <input
            id="cw-title"
            name="title"
            required
            placeholder={
              kind === "question"
                ? "What do you want students to answer?"
                : kind === "material"
                  ? "Reading, slide deck, worksheet…"
                  : "Title"
            }
            className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />
          <label
            className="mt-3 block text-[13px] font-medium text-[#202124]"
            htmlFor="cw-body"
          >
            {kind === "material" ? "Details (optional)" : "Details"}
          </label>
          <textarea
            id="cw-body"
            name="body"
            rows={4}
            placeholder="Anything students should see…"
            className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />
          {(kind === "material" || kind === "assignment" || kind === "note") && (
            <>
              <label
                className="mt-3 block text-[13px] font-medium text-[#202124]"
                htmlFor="cw-link"
              >
                Link (optional)
              </label>
              <input
                id="cw-link"
                name="linkUrl"
                type="url"
                placeholder="https://"
                className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
              />
            </>
          )}
          {(kind === "assignment" || kind === "question") && (
            <>
              <label
                className="mt-3 block text-[13px] font-medium text-[#202124]"
                htmlFor="cw-due"
              >
                Due date (optional)
              </label>
              <input
                id="cw-due"
                name="dueAtLocal"
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
              />
            </>
          )}
          {activeSessions.length > 0 ? (
            <>
              <label
                className="mt-3 block text-[13px] font-medium text-[#202124]"
                htmlFor="cw-session"
              >
                Link to a class day (optional)
              </label>
              <select
                id="cw-session"
                name="sessionId"
                className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {activeSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {friendlySessionTitle(s.topic)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {error ? (
            <p className="m-0 mt-2 text-[13px] text-[#c5221f]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              disabled={pending}
              className="min-h-10 rounded-full bg-[#1967d2] px-4 text-[13px] font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
            >
              {pending ? "Posting…" : "Post to class"}
            </button>
          </div>
        </form>
      ) : null}

      {feed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dadce0] bg-white px-6 py-10 text-center">
          <p className="m-0 text-[15px] text-[#5f6368]">
            Nothing here yet. Hit Create to add something.
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none divide-y divide-[#e0e0e0] overflow-hidden rounded-xl border border-[#e0e0e0] bg-white p-0 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
          {feed.map((a) => {
            const due = formatDue(a.suggestedDueDate);
            return (
              <li key={a.id} className="px-4 py-3.5">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[11px] font-semibold text-[#174ea6]">
                    {kindLabel(a.type).charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="m-0 text-[14px] font-medium text-[#202124]">
                        {a.title}
                      </p>
                      <span className="text-[11.5px] font-medium text-[#5f6368]">
                        {kindLabel(a.type)}
                      </span>
                    </div>
                    {a.description ? (
                      <p className="m-0 mt-1 line-clamp-2 text-[12.5px] leading-5 text-[#5f6368]">
                        {a.description}
                      </p>
                    ) : null}
                    <p className="m-0 mt-1.5 text-[12px] text-[#80868b]">
                      {[due ? `Due ${due}` : null, a.attachmentUrl ? "Has link" : null]
                        .filter(Boolean)
                        .join(" · ") || "Posted to class"}
                    </p>
                    {a.attachmentUrl ? (
                      <a
                        href={a.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-[12.5px] font-medium text-[#1967d2] hover:underline"
                      >
                        Open link ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-[#e0e0e0] bg-white p-4">
        <p className="m-0 text-[14px] font-medium text-[#202124]">End of class</p>
        <div className="mt-2">
          <ClassCompletionAction
            offeringId={offeringId}
            offeringEnded={offeringEnded}
            alreadyCompleted={alreadyCompleted}
          />
        </div>
      </div>
    </div>
  );
}
