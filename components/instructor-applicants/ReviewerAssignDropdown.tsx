"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import ActiveLoadBadge from "@/components/instructor-applicants/ActiveLoadBadge";
import { assignReviewer, reassignReviewer } from "@/lib/instructor-application-actions";
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

  function handleAssign(reviewerId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = currentReviewerId
          ? await reassignReviewer(applicationId, reviewerId)
          : await assignReviewer(applicationId, reviewerId);
        if (!result.success) {
          setError(result.error ?? "Failed to assign reviewer.");
          return;
        }
        setOpen(false);
        setSearch("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign reviewer.");
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
        {label}
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
          aria-label="Reviewer candidates"
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
                No reviewers found.
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
                    activeCount={candidate.reviewerActiveLoad}
                    lastAssignedAt={candidate.reviewerLastAssignedAt}
                    label="cases"
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
