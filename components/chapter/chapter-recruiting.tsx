"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import InstructorApplicantsCommandCenter from "@/components/instructor-applicants/InstructorApplicantsCommandCenter";
import {
  Button,
  EmptyStateV2,
  ModalFooterV2,
  ModalV2,
  StatusBadge,
} from "@/components/ui-v2";
import {
  closeChapterPosition,
  createChapterPosition,
  reopenChapterPosition,
} from "@/lib/application-actions";

export type ChapterRecruitingPosition = {
  id: string;
  title: string;
  type: string;
  isOpen: boolean;
  applicationCount: number;
  createdAt: string;
};

export type PipelineAppSerialized = {
  id: string;
  status: string;
  materialsReadyAt: string | null;
  interviewScheduledAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
  overdue?: boolean;
  subjectsOfInterest: string | null;
  legalName: string | null;
  preferredFirstName: string | null;
  lastName: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationReviews: Array<{
    summary: string | null;
    nextStep: string | null;
    overallRating: string | null;
  }>;
  chairDecision: { action: string; decidedAt: string } | null;
  applicationTrack: string;
  instructorSubtype: string;
  workshopOutlinePresent: boolean;
};

type View = "positions" | "applicants";

function typeLabel(type: string) {
  return type.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function AddPositionModal({
  open,
  onClose,
  chapterId,
}: {
  open: boolean;
  onClose: () => void;
  chapterId: string;
}) {
  const titleId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("chapterId", chapterId);
    formData.set("visibility", "CHAPTER_ONLY");

    const classOrSubject = String(formData.get("classOrSubject") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    formData.delete("classOrSubject");
    if (classOrSubject) {
      formData.set(
        "description",
        description
          ? `Class / subject: ${classOrSubject}\n\n${description}`
          : `Class / subject: ${classOrSubject}`
      );
    }

    startTransition(async () => {
      try {
        await createChapterPosition(formData);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create position");
      }
    });
  }

  return (
    <ModalV2 open={open} onClose={pending ? () => undefined : onClose} labelledBy={titleId} size="lg" locked={pending}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h2 id={titleId} className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            Add position
          </h2>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            Open a chapter role people can apply to — usually an instructor seat.
          </p>
        </div>

        {error ? (
          <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] sm:col-span-2">
            <span className="font-semibold text-ink">Title</span>
            <input
              required
              name="title"
              placeholder="e.g. Behavioral Science Instructor"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Role</span>
            <select
              name="type"
              defaultValue="INSTRUCTOR"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            >
              <option value="INSTRUCTOR">Instructor</option>
              <option value="MENTOR">Mentor</option>
              <option value="STAFF">Staff</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Class / subject</span>
            <input
              name="classOrSubject"
              placeholder="e.g. Behavioral Science, Robotics"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-ink">Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="What this person will teach or own in your chapter…"
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-ink">Requirements</span>
          <textarea
            name="requirements"
            rows={3}
            placeholder="Experience, availability, and must-haves…"
            className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Interview</span>
            <select
              name="interviewRequired"
              defaultValue="true"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            >
              <option value="true">Required</option>
              <option value="false">Optional</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Application deadline</span>
            <input
              type="date"
              name="applicationDeadline"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-semibold text-ink">Target start</span>
            <input
              type="date"
              name="targetStartDate"
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
            />
          </label>
        </div>

        <ModalFooterV2>
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Creating…" : "Create position"}
          </Button>
        </ModalFooterV2>
      </form>
    </ModalV2>
  );
}

function PositionsPanel({
  positions,
  onAdd,
}: {
  positions: ChapterRecruitingPosition[];
  onAdd: () => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleOpen(position: ChapterRecruitingPosition) {
    setPendingId(position.id);
    const formData = new FormData();
    formData.set("positionId", position.id);
    try {
      if (position.isOpen) await closeChapterPosition(formData);
      else await reopenChapterPosition(formData);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (positions.length === 0) {
    return (
      <EmptyStateV2
        title="No open roles yet"
        body="Add an instructor position so people can apply to teach in your chapter."
        action={
          <Button type="button" variant="primary" size="md" onClick={onAdd}>
            Add position
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {positions.map((position) => (
        <article
          key={position.id}
          className="flex flex-col gap-3 rounded-2xl border border-[#dadce0] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.06)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="m-0 truncate text-[15px] font-semibold text-[#202124]">{position.title}</h3>
              <p className="m-0 mt-1 text-[12.5px] text-[#5f6368]">{typeLabel(position.type)}</p>
            </div>
            <StatusBadge tone={position.isOpen ? "success" : "neutral"}>
              {position.isOpen ? "Open" : "Closed"}
            </StatusBadge>
          </div>

          <p className="m-0 text-[13px] text-[#5f6368]">
            {position.applicationCount === 0
              ? "No applications yet"
              : `${position.applicationCount} application${position.applicationCount === 1 ? "" : "s"}`}
          </p>

          <div className="mt-auto flex flex-wrap gap-2 border-t border-[#f1f3f4] pt-3">
            <Link
              href={`/chapter/recruiting/positions/${position.id}/edit`}
              className="rounded-full border border-[#dadce0] px-3 py-1.5 text-[12.5px] font-medium text-[#3c4043] no-underline hover:bg-[#f8f9fa]"
            >
              Edit
            </Link>
            <button
              type="button"
              disabled={pendingId === position.id}
              onClick={() => toggleOpen(position)}
              className="cursor-pointer rounded-full border border-[#dadce0] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#3c4043] hover:bg-[#f8f9fa] disabled:opacity-50"
            >
              {position.isOpen ? "Close" : "Reopen"}
            </button>
          </div>
        </article>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#dadce0] bg-white/70 px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-[20px] font-semibold text-brand-700">
          +
        </span>
        <span className="text-[14px] font-semibold text-[#202124]">Add position</span>
      </button>
    </div>
  );
}

export function ChapterRecruitingPage({
  chapterId,
  chapterName,
  positions,
  pipelineApps,
  archivedApps,
  actorId,
  workflowEnabled,
}: {
  chapterId: string;
  chapterName: string;
  positions: ChapterRecruitingPosition[];
  pipelineApps: PipelineAppSerialized[];
  archivedApps: PipelineAppSerialized[];
  actorId: string;
  workflowEnabled: boolean;
}) {
  const [view, setView] = useState<View>("positions");
  const [addOpen, setAddOpen] = useState(false);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              Recruiting
            </h1>
            <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
              {chapterName} — open roles and applicants for this chapter only.
            </p>
          </div>
          {view === "positions" ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Add position
            </button>
          ) : null}
        </header>

        <div className="mb-6 inline-flex rounded-full border border-[#dadce0] bg-white p-1 shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
          {(
            [
              { id: "positions", label: "Positions", count: positions.filter((p) => p.isOpen).length },
              { id: "applicants", label: "Applicants", count: pipelineApps.length },
            ] as const
          ).map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={[
                  "cursor-pointer rounded-full border-0 px-4 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#202124] text-white"
                    : "bg-transparent text-[#5f6368] hover:text-[#202124]",
                ].join(" ")}
              >
                {tab.label}
                <span className={active ? "ml-1.5 text-white/70" : "ml-1.5 text-[#80868b]"}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {view === "positions" ? (
          <PositionsPanel positions={positions} onAdd={() => setAddOpen(true)} />
        ) : workflowEnabled ? (
          <div className="rounded-2xl border border-[#dadce0] bg-white p-3 shadow-[0_1px_2px_rgba(60,64,67,0.06)] sm:p-4">
            <InstructorApplicantsCommandCenter
              pipelineApps={pipelineApps}
              archivedApps={archivedApps}
              chapters={[]}
              reviewers={[]}
              interviewers={[]}
              actorId={actorId}
              showChapterFilter={false}
              showKindFilter={false}
            />
          </div>
        ) : (
          <EmptyStateV2
            title="Applicant board is off"
            body="The instructor applicant pipeline is disabled in this environment. You can still post positions above."
          />
        )}
      </div>

      <AddPositionModal open={addOpen} onClose={() => setAddOpen(false)} chapterId={chapterId} />
    </main>
  );
}
