"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui-v2";
import { updatePerformanceReviewDocumentMeta } from "@/lib/mentorship/review-document-actions";

export type ReviewCopyOption = {
  id: string;
  title: string;
  statusLabel: string;
  href: string;
};

const fieldClass =
  "mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/**
 * Switch between review document copies + edit title / month on the open one.
 */
export function ReviewCopySwitcher({
  copies,
  activeId,
  canEditMeta,
  initialTitle,
  initialMonthKey,
}: {
  copies: ReviewCopyOption[];
  activeId: string | null;
  canEditMeta: boolean;
  initialTitle: string;
  initialMonthKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function saveMeta() {
    if (!activeId) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updatePerformanceReviewDocumentMeta({
          reviewId: activeId,
          title: title.trim(),
          monthKey,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  if (copies.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#e8e4f0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 mr-1 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
          Copies
        </p>
        {copies.map((copy) => {
          const active = copy.id === activeId;
          return (
            <Link
              key={copy.id}
              href={copy.href}
              className={
                active
                  ? "rounded-full bg-brand-600 px-3 py-1 text-[12.5px] font-semibold text-white no-underline"
                  : "rounded-full bg-[#f3f0f8] px-3 py-1 text-[12.5px] font-medium text-ink no-underline hover:bg-brand-50"
              }
            >
              {copy.title}
              <span className="ml-1.5 opacity-70">{copy.statusLabel}</span>
            </Link>
          );
        })}
      </div>

      {canEditMeta && activeId ? (
        <div className="grid gap-3 border-t border-[#e8e4f0] pt-3 sm:grid-cols-[1.4fr_0.8fr_auto] sm:items-end">
          <label className="block min-w-0">
            <span className="text-[11.5px] font-semibold text-ink-muted">
              Document title
            </span>
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
              disabled={pending}
              maxLength={120}
            />
          </label>
          <label className="block min-w-0">
            <span className="text-[11.5px] font-semibold text-ink-muted">
              Month
            </span>
            <input
              type="month"
              className={fieldClass}
              value={monthKey}
              onChange={(e) => {
                setMonthKey(e.target.value);
                setSaved(false);
              }}
              disabled={pending}
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={saveMeta}
            className="sm:mb-0.5"
          >
            Save details
          </Button>
          {error ? (
            <p className="m-0 text-[12.5px] font-medium text-danger-700 sm:col-span-3">
              {error}
            </p>
          ) : null}
          {saved && !error ? (
            <p className="m-0 text-[12.5px] font-medium text-complete-800 sm:col-span-3">
              Saved — title and month updated.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
