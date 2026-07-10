"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import ActiveLoadBadge from "@/components/instructor-applicants/ActiveLoadBadge";
import {
  assignReviewer,
  reassignReviewer,
  unassignReviewer,
} from "@/lib/instructor-application-actions";
import { Button, StatusBadge, cn } from "@/components/ui-v2";

export type ReviewerCandidate = {
  id: string;
  name: string | null;
  email: string;
  chapterId: string | null;
  chapterMatch: boolean;
  reviewerActiveLoad: number;
  reviewerLastAssignedAt: Date | string | null;
};

export function ReviewerAssignDropdown({
  applicationId,
  currentReviewerId,
  candidates,
  label = "Assign reviewer",
}: {
  applicationId: string;
  currentReviewerId?: string | null;
  candidates: ReviewerCandidate[];
  label?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    if (a.id === currentReviewerId) return -1;
    if (b.id === currentReviewerId) return 1;
    return 0;
  });

  function handlePick(reviewerId: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (currentReviewerId && reviewerId === currentReviewerId) {
          const result = await unassignReviewer(applicationId);
          if (!result.success) {
            setError(result.error ?? "Failed to clear reviewer.");
            return;
          }
        } else {
          const result = currentReviewerId
            ? await reassignReviewer(applicationId, reviewerId)
            : await assignReviewer(applicationId, reviewerId);
          if (!result.success) {
            setError(result.error ?? "Failed to assign reviewer.");
            return;
          }
        }
        setOpen(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update reviewer.");
      }
    });
  }

  function handleClear() {
    if (!currentReviewerId) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await unassignReviewer(applicationId);
        if (!result.success) {
          setError(result.error ?? "Failed to clear reviewer.");
          return;
        }
        setOpen(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear reviewer.");
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
        title={label}
        disabled={isPending || (candidates.length === 0 && !currentReviewerId)}
        loading={isPending}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">{label}</span>
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
          aria-label="Reviewer candidates"
        >
          <input
            className="input mb-2 w-full"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />

          {currentReviewerId ? (
            <button
              type="button"
              disabled={isPending}
              className="mb-2 flex w-full cursor-pointer items-center justify-center rounded-[8px] border border-dashed border-line-soft px-3 py-2 text-[12.5px] font-semibold text-ink-muted hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800 disabled:opacity-60"
              onClick={handleClear}
            >
              Clear reviewer (unassigned)
            </button>
          ) : null}

          <div className="max-h-[240px] overflow-y-auto rounded-[8px] border border-line-soft">
            {sorted.length === 0 ? (
              <p className="m-0 px-3 py-4 text-center text-[13px] text-ink-muted">
                No reviewers found.
              </p>
            ) : (
              sorted.map((candidate) => {
                const isCurrent = candidate.id === currentReviewerId;
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
                      activeCount={candidate.reviewerActiveLoad}
                      lastAssignedAt={candidate.reviewerLastAssignedAt}
                      label="cases"
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
