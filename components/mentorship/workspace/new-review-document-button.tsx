"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalFooterV2, ModalV2 } from "@/components/ui-v2";
import { createPerformanceReviewDocument } from "@/lib/mentorship/review-document-actions";

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function defaultTitleFromMonthKey(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "Performance Review";
  const q = Math.floor((m - 1) / 3) + 1;
  return `Q${q} ${y} Performance Review`;
}

const fieldClass =
  "mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/**
 * Home table CTA — creates a blank performance review document, then opens it
 * on the Review tab.
 */
export function NewReviewDocumentButton({
  mentorshipId,
  menteeId,
  basePath,
}: {
  mentorshipId: string;
  menteeId: string;
  /** e.g. /mentorship/people/:id */
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [title, setTitle] = useState(() =>
    defaultTitleFromMonthKey(currentMonthKey()),
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewTitle = useMemo(
    () => (titleTouched ? title : defaultTitleFromMonthKey(monthKey)),
    [title, titleTouched, monthKey],
  );

  function openModal() {
    const key = currentMonthKey();
    setMonthKey(key);
    setTitle(defaultTitleFromMonthKey(key));
    setTitleTouched(false);
    setError(null);
    setOpen(true);
  }

  function onMonthChange(next: string) {
    setMonthKey(next);
    if (!titleTouched) setTitle(defaultTitleFromMonthKey(next));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createPerformanceReviewDocument({
          mentorshipId,
          menteeId,
          title: previewTitle.trim() || defaultTitleFromMonthKey(monthKey),
          monthKey,
        });
        setOpen(false);
        router.push(
          `${basePath}?section=progress&reviewId=${encodeURIComponent(res.reviewId)}`,
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create review.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openModal}>
        + New Review / Document
      </Button>
      <ModalV2
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        locked={pending}
        labelledBy="new-review-title"
        size="sm"
      >
        <div>
          <h2
            id="new-review-title"
            className="m-0 text-[18px] font-bold tracking-[-0.02em] text-ink"
          >
            New performance review
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Creates a blank copy you can edit. It will show up in Reviews &amp;
            Documents.
          </p>
        </div>

        <label className="block">
          <span className="text-[12px] font-semibold text-ink">Title</span>
          <input
            className={fieldClass}
            value={previewTitle}
            onChange={(e) => {
              setTitleTouched(true);
              setTitle(e.target.value);
            }}
            disabled={pending}
            maxLength={120}
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-ink">
            Review month
          </span>
          <input
            type="month"
            className={fieldClass}
            value={monthKey}
            onChange={(e) => onMonthChange(e.target.value)}
            disabled={pending}
          />
        </label>

        {error ? (
          <p className="m-0 text-[13px] font-medium text-danger-700">{error}</p>
        ) : null}

        <ModalFooterV2>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={submit}
          >
            Create &amp; open
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}
