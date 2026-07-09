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

export function LeadInterviewerAssignDropdown({
  applicationId,
  currentAssignment,
  candidates,
  label = "Assign lead interviewer",
}: {
  applicationId: string;
  currentAssignment: {
    id: string;
    interviewer: { id: string; name: string | null };
  } | null;
  candidates: LeadInterviewerCandidate[];
  label?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayLabel =
    currentAssignment?.interviewer.name ?? label;

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

  function handleAssign(interviewerId: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (
          currentAssignment &&
          currentAssignment.interviewer.id !== interviewerId
        ) {
          const removeFd = new FormData();
          removeFd.set("assignmentId", currentAssignment.id);
          const removed = await removeInterviewer(removeFd);
          if (!removed.success) {
            setError(removed.error ?? "Failed to replace lead interviewer.");
            return;
          }
        } else if (
          currentAssignment?.interviewer.id === interviewerId
        ) {
          setOpen(false);
          return;
        }

        const assignFd = new FormData();
        assignFd.set("applicationId", applicationId);
        assignFd.set("interviewerId", interviewerId);
        assignFd.set("role", "LEAD");
        const result = await assignInterviewer(assignFd);
        if (!result.success) {
          setError(result.error ?? "Failed to assign lead interviewer.");
          return;
        }
        setOpen(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign lead interviewer.");
      }
    });
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="primary"
        size="md"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={isPending || candidates.length === 0}
        loading={isPending}
        onClick={() => setOpen((value) => !value)}
      >
        {displayLabel}
        <span aria-hidden="true" className="ml-0.5 text-[11px] opacity-80">
          {open ? "▴" : "▾"}
        </span>
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 z-30 mt-2 w-[min(100vw-2rem,22rem)] rounded-[12px] border border-line-soft bg-surface p-3 shadow-card"
          )}
          role="listbox"
          aria-label="Lead interviewer candidates"
        >
          <input
            className="input mb-2 w-full"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />

          <div className="max-h-[240px] overflow-y-auto rounded-[8px] border border-line-soft">
            {filtered.length === 0 ? (
              <p className="m-0 px-3 py-4 text-center text-[13px] text-ink-muted">
                No interviewers found.
              </p>
            ) : (
              filtered.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  disabled={isPending}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-b border-line-soft px-3 py-2.5 text-left last:border-b-0 hover:bg-brand-50/80 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleAssign(candidate.id)}
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-800">
                    {(candidate.name ?? candidate.email)[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {candidate.name ?? candidate.email}
                    </span>
                    {candidate.chapterMatch ? (
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
              ))
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

function LeadInterviewerReadOnlyChip({ name }: { name: string | null | undefined }) {
  return (
    <div className="inline-flex shrink-0 flex-col items-end gap-0.5 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2 text-right">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        Lead interviewer
      </span>
      <span className="text-[13px] font-semibold text-ink">{name ?? "Unassigned"}</span>
    </div>
  );
}

export function LeadInterviewerHeaderControl({
  canChange,
  applicationId,
  currentAssignment,
  candidates,
}: {
  canChange: boolean;
  applicationId: string;
  currentAssignment: {
    id: string;
    interviewer: { id: string; name: string | null };
  } | null;
  candidates: LeadInterviewerCandidate[];
}) {
  if (canChange) {
    return (
      <LeadInterviewerAssignDropdown
        applicationId={applicationId}
        currentAssignment={currentAssignment}
        candidates={candidates}
        label="Assign lead interviewer"
      />
    );
  }
  return <LeadInterviewerReadOnlyChip name={currentAssignment?.interviewer.name} />;
}
