"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import ActiveLoadBadge from "@/components/instructor-applicants/ActiveLoadBadge";
import { assignInterviewer, removeInterviewer } from "@/lib/instructor-application-actions";
import { Button, StatusBadge, cn } from "@/components/ui-v2";

export type LeadInterviewerCandidate = {
  id: string;
  name: string | null;
  email: string;
  chapterMatch: boolean;
  interviewerActiveLoad: number;
  interviewerLastAssignedAt: Date | string | null;
};

export type InterviewerAssignmentRole = "LEAD" | "SECOND";

const ROLE_COPY: Record<
  InterviewerAssignmentRole,
  { assignLabel: string; chipLabel: string; listLabel: string; errorNoun: string }
> = {
  LEAD: {
    assignLabel: "Assign lead interviewer",
    chipLabel: "Lead interviewer",
    listLabel: "Lead interviewer candidates",
    errorNoun: "lead interviewer",
  },
  SECOND: {
    assignLabel: "Assign second interviewer",
    chipLabel: "Second interviewer",
    listLabel: "Second interviewer candidates",
    errorNoun: "second interviewer",
  },
};

export function InterviewerAssignDropdown({
  applicationId,
  role,
  currentAssignment,
  candidates,
  label,
  disabledReason,
}: {
  applicationId: string;
  role: InterviewerAssignmentRole;
  currentAssignment: {
    id: string;
    interviewer: { id: string; name: string | null };
  } | null;
  candidates: LeadInterviewerCandidate[];
  label?: string;
  /** When set, the button stays disabled and shows this as a title hint. */
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy = ROLE_COPY[role];

  const displayLabel = currentAssignment?.interviewer.name ?? label ?? copy.assignLabel;
  const blocked = Boolean(disabledReason);
  const currentId = currentAssignment?.interviewer.id ?? null;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const filtered = candidates.filter((candidate) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (candidate.name ?? "").toLowerCase().includes(q) ||
      candidate.email.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    return 0;
  });

  function handleClear() {
    if (!currentAssignment) return;
    setError(null);
    startTransition(async () => {
      try {
        const removeFd = new FormData();
        removeFd.set("assignmentId", currentAssignment.id);
        const removed = await removeInterviewer(removeFd);
        if (!removed.success) {
          setError(removed.error ?? `Failed to clear ${copy.errorNoun}.`);
          return;
        }
        setOpen(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to clear ${copy.errorNoun}.`);
      }
    });
  }

  function handlePick(interviewerId: string) {
    setError(null);
    startTransition(async () => {
      try {
        // Tap the current person again → clear (unassigned).
        if (currentAssignment && currentAssignment.interviewer.id === interviewerId) {
          const removeFd = new FormData();
          removeFd.set("assignmentId", currentAssignment.id);
          const removed = await removeInterviewer(removeFd);
          if (!removed.success) {
            setError(removed.error ?? `Failed to clear ${copy.errorNoun}.`);
            return;
          }
          setOpen(false);
          setSearch("");
          router.refresh();
          return;
        }

        // Replace: remove current, then assign the new person.
        if (currentAssignment) {
          const removeFd = new FormData();
          removeFd.set("assignmentId", currentAssignment.id);
          const removed = await removeInterviewer(removeFd);
          if (!removed.success) {
            setError(removed.error ?? `Failed to replace ${copy.errorNoun}.`);
            return;
          }
        }

        const assignFd = new FormData();
        assignFd.set("applicationId", applicationId);
        assignFd.set("interviewerId", interviewerId);
        assignFd.set("role", role);
        const result = await assignInterviewer(assignFd);
        if (!result.success) {
          setError(result.error ?? `Failed to assign ${copy.errorNoun}.`);
          return;
        }
        setOpen(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to update ${copy.errorNoun}.`);
      }
    });
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <Button
        type="button"
        variant="primary"
        size="md"
        className="w-full min-w-0 justify-between"
        aria-expanded={open}
        aria-haspopup="listbox"
        title={disabledReason ?? displayLabel}
        disabled={isPending || blocked || (candidates.length === 0 && !currentAssignment)}
        loading={isPending}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <span aria-hidden="true" className="ml-0.5 shrink-0 text-[11px] opacity-80">
          {open ? "▴" : "▾"}
        </span>
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute inset-x-0 z-30 mt-2 w-full max-w-[min(100vw-2rem,22rem)] rounded-[12px] border border-line-soft bg-surface p-3 shadow-card"
          )}
          role="listbox"
          aria-label={copy.listLabel}
        >
          <input
            className="input mb-2 w-full"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />

          {currentAssignment ? (
            <button
              type="button"
              disabled={isPending}
              className="mb-2 flex w-full cursor-pointer items-center justify-center rounded-[8px] border border-dashed border-line-soft px-3 py-2 text-[12.5px] font-semibold text-ink-muted hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800 disabled:opacity-60"
              onClick={handleClear}
            >
              Clear {copy.chipLabel.toLowerCase()} (unassigned)
            </button>
          ) : null}

          <div className="max-h-[240px] overflow-y-auto rounded-[8px] border border-line-soft">
            {sorted.length === 0 ? (
              <p className="m-0 px-3 py-4 text-center text-[13px] text-ink-muted">
                No interviewers found.
              </p>
            ) : (
              sorted.map((candidate) => {
                const isCurrent = candidate.id === currentId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    disabled={isPending}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 border-b border-line-soft px-3 py-2.5 text-left last:border-b-0 hover:bg-brand-50/80 disabled:cursor-not-allowed disabled:opacity-60",
                      isCurrent && "bg-brand-50/50"
                    )}
                    onClick={() => handlePick(candidate.id)}
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-800">
                      {(candidate.name ?? candidate.email)[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {candidate.name ?? candidate.email}
                      </span>
                      {isCurrent ? (
                        <span className="mt-0.5 block text-[11px] font-medium text-brand-700">
                          Assigned · tap to clear
                        </span>
                      ) : candidate.chapterMatch ? (
                        <StatusBadge tone="info" className="mt-1">
                          Same chapter
                        </StatusBadge>
                      ) : null}
                    </span>
                    <ActiveLoadBadge
                      activeCount={candidate.interviewerActiveLoad}
                      lastAssignedAt={candidate.interviewerLastAssignedAt}
                      label="interviews"
                    />
                  </button>
                );
              })
            )}
          </div>

          {error ? (
            <p className="m-0 mt-2 text-[12.5px] text-danger-700">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer InterviewerAssignDropdown with role="LEAD". */
export function LeadInterviewerAssignDropdown(
  props: Omit<Parameters<typeof InterviewerAssignDropdown>[0], "role">
) {
  return <InterviewerAssignDropdown {...props} role="LEAD" />;
}

function InterviewerReadOnlyChip({
  role,
  name,
}: {
  role: InterviewerAssignmentRole;
  name: string | null | undefined;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {ROLE_COPY[role].chipLabel}
      </span>
      <span className="truncate text-[13px] font-semibold text-ink">{name ?? "Unassigned"}</span>
    </div>
  );
}

export function InterviewerHeaderControl({
  role,
  canChange,
  applicationId,
  currentAssignment,
  candidates,
  disabledReason,
}: {
  role: InterviewerAssignmentRole;
  canChange: boolean;
  applicationId: string;
  currentAssignment: {
    id: string;
    interviewer: { id: string; name: string | null };
  } | null;
  candidates: LeadInterviewerCandidate[];
  disabledReason?: string | null;
}) {
  if (canChange) {
    return (
      <InterviewerAssignDropdown
        role={role}
        applicationId={applicationId}
        currentAssignment={currentAssignment}
        candidates={candidates}
        label={ROLE_COPY[role].assignLabel}
        disabledReason={disabledReason}
      />
    );
  }
  return <InterviewerReadOnlyChip role={role} name={currentAssignment?.interviewer.name} />;
}

export function LeadInterviewerHeaderControl(
  props: Omit<Parameters<typeof InterviewerHeaderControl>[0], "role">
) {
  return <InterviewerHeaderControl {...props} role="LEAD" />;
}
