"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn, EmptyStateV2 } from "@/components/ui-v2";
import {
  activeIndex,
  loopResolved,
  nextIdAfterSkip,
  visibleLoops,
} from "@/lib/queue/runner-logic";
import type { QueueItem } from "@/lib/queue/types";

import { ArrowRightIcon, CheckCircleIcon, CloseIcon, SparkleIcon, typeGlyph } from "./icons";
import { QueueInlineWork } from "./queue-inline-panels";

/**
 * QueueRunner — My Queue as a work surface, not an inbox.
 *
 * One loop at a time: what it is, WHY it matters, WHAT needs to happen, and the
 * real controls to do it. Finishing the actual work (completing the action,
 * converting the decision, handling the follow-up) is what closes the loop — the
 * server then recomputes the queue from source truth, so an item leaves ONLY
 * because its underlying condition is gone. Partial progress (e.g. marking an
 * action blocked) keeps the item, and the runner says what still remains. Skip
 * moves past a loop for now without changing anything; reopen the queue and it's
 * still there.
 */

const toneAccent: Record<QueueItem["tone"], string> = {
  danger: "text-danger-700",
  warning: "text-warning-700",
  info: "text-info-700",
  brand: "text-brand-700",
  neutral: "text-ink-muted",
  success: "text-success-700",
};

function relatedHref(item: QueueItem): { label: string; href: string } | null {
  if (item.relatedMeeting) {
    return { label: item.relatedMeeting.title, href: `/meetings/${item.relatedMeeting.id}` };
  }
  if (item.relatedInitiative) {
    return {
      label: item.relatedInitiative.title,
      href: `/operations/initiatives/${item.relatedInitiative.id}`,
    };
  }
  return null;
}

export function QueueRunner({
  queueLabel,
  items,
  backHref = "/work",
  backLabel = "Mission Control",
}: {
  queueLabel: string;
  items: QueueItem[];
  backHref?: string;
  backLabel?: string;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [flash, setFlash] = useState<{ tone: "success" | "info"; text: string } | null>(null);
  // The loop we just acted on, awaiting the refreshed queue to confirm it left.
  const pendingRef = useRef<{ id: string; title: string } | null>(null);

  const queue = useMemo(() => visibleLoops(items, skipped), [items, skipped]);

  const currentIndex = useMemo(() => activeIndex(queue, activeId), [queue, activeId]);

  const current = queue[currentIndex] ?? queue[0] ?? null;

  // Reconcile after a mutation refresh: did the acted loop actually leave?
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (!loopResolved(items, pending.id)) {
      // Not resolved — e.g. blocked is still open work. Keep it, explain.
      setFlash({
        tone: "info",
        text: "Saved. This one stays in your queue until it's fully cleared — skip it if you're done for now.",
      });
    } else {
      setResolvedCount((c) => c + 1);
      setFlash({ tone: "success", text: `Done — "${pending.title}" cleared.` });
      // Advance: fall back to the worst-first remaining loop.
      setActiveId(null);
    }
  }, [items]);

  const onResolved = useCallback((item: QueueItem) => {
    pendingRef.current = { id: item.id, title: item.title };
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const next = queue[index];
      if (next) {
        setActiveId(next.id);
        setFlash(null);
      }
    },
    [queue]
  );

  const skip = useCallback(() => {
    if (!current) return;
    const nextId = nextIdAfterSkip(queue, currentIndex);
    setSkipped((prev) => new Set(prev).add(current.id));
    setActiveId(nextId);
    setFlash(null);
  }, [current, queue, currentIndex]);

  const reviewSkipped = useCallback(() => {
    setSkipped(new Set());
    setActiveId(null);
    setFlash(null);
  }, []);

  // ── Empty / done states ────────────────────────────────────────────────
  if (queue.length === 0) {
    const skippedCount = skipped.size;
    return (
      <div className="mx-auto w-full max-w-2xl py-16">
        <EmptyStateV2
          title={resolvedCount > 0 ? "Queue cleared 🎉" : "You're clear for now 🎉"}
          body={
            resolvedCount > 0
              ? `You handled ${resolvedCount} ${resolvedCount === 1 ? "item" : "items"}.${
                  skippedCount > 0 ? ` You skipped ${skippedCount} for later.` : ""
                }`
              : skippedCount > 0
                ? `Nothing left to do right now. You skipped ${skippedCount} for later.`
                : `No open loops in ${queueLabel}. Nothing needs you here.`
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              {skippedCount > 0 ? (
                <button
                  type="button"
                  onClick={reviewSkipped}
                  className="rounded-full bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
                >
                  Review skipped ({skippedCount})
                </button>
              ) : null}
              <Link
                href={backHref}
                className="text-[13px] font-semibold text-brand-700 hover:underline"
              >
                Back to {backLabel} →
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const related = relatedHref(current);
  const total = queue.length;
  const position = currentIndex + 1;
  const progress = Math.round((resolvedCount / (resolvedCount + total)) * 100);

  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* Calm top chrome: where you are, how much is left. */}
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line-soft bg-surface-soft/90 px-1 py-3 backdrop-blur">
        <Link
          href={backHref}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          aria-label={`Exit to ${backLabel}`}
        >
          <CloseIcon className="size-4" /> Exit
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 text-[12.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
            {queueLabel}
          </span>
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-100"
            role="progressbar"
            aria-label={`${queueLabel} progress`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${resolvedCount} resolved, ${total} left`}
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[12.5px] font-semibold text-ink-muted">
            {total} left
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center py-8">
        <div className="w-full max-w-2xl">
          {flash ? (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "mb-4 flex items-center gap-2 rounded-[12px] border px-3.5 py-2.5 text-[13px] font-semibold",
                flash.tone === "success"
                  ? "border-success-700/20 bg-success-100/60 text-success-700"
                  : "border-info-700/20 bg-info-100/60 text-info-700"
              )}
            >
              {flash.tone === "success" ? (
                <CheckCircleIcon className="size-4 shrink-0" />
              ) : (
                <SparkleIcon className="size-4 shrink-0" />
              )}
              <span>{flash.text}</span>
            </div>
          ) : null}

          {/* The one focused loop. */}
          <article
            key={current.id}
            className="rounded-[18px] border border-line-soft bg-surface p-6 shadow-card sm:p-7"
          >
            {/* Type + status */}
            <div className="flex items-center justify-between gap-3">
              <span className={cn("flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.06em]", toneAccent[current.tone])}>
                <span aria-hidden className="text-[15px] leading-none">
                  {typeGlyph(current.type)}
                </span>
                {current.typeLabel}
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold text-ink-muted">
                {current.statusLabel}
              </span>
            </div>

            {/* Title */}
            <h1 className="mt-3 text-[22px] font-bold leading-tight text-ink sm:text-[24px]">
              {current.title}
            </h1>

            {/* Owner / due / related */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
              {current.ownerName ? <span>Owner: <span className="font-semibold text-ink">{current.ownerName}</span></span> : null}
              {related ? (
                <Link href={related.href} className="font-semibold text-brand-700 hover:underline">
                  {related.label} ↗
                </Link>
              ) : null}
            </div>

            {/* Why it matters */}
            <div className="mt-5">
              <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                Why this matters
              </p>
              <p className="mt-1 text-[14px] leading-snug text-ink">{current.why}</p>
            </div>

            {/* What needs to happen */}
            {current.recommendedMove ? (
              <div className="mt-4">
                <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  What needs to happen
                </p>
                <p className="mt-1 text-[14px] leading-snug text-ink">{current.recommendedMove}</p>
              </div>
            ) : null}

            {/* The real work */}
            <div className="mt-5">
              {current.inline ? (
                <>
                  <QueueInlineWork item={current} onResolved={() => onResolved(current)} />
                  <Link
                    href={current.href}
                    className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline"
                  >
                    Open the full record <ArrowRightIcon className="size-3.5" />
                  </Link>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href={current.primaryAction.href}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
                  >
                    {current.primaryAction.label}
                    <ArrowRightIcon className="size-4" />
                  </Link>
                  <p className="m-0 text-[12px] text-ink-muted">
                    {current.primaryAction.hint ??
                      "Opens the full record where you can finish this — then come back to your queue."}
                  </p>
                </div>
              )}
            </div>
          </article>

          {/* Move through the queue — simple, three controls. */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="rounded-lg border border-line-soft bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-soft disabled:opacity-40 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={skip}
              className="rounded-lg border border-line-soft bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-soft transition-colors"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex >= total - 1}
              className="rounded-lg border border-line-soft bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-soft disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>

          <p className="mt-5 text-center text-[12px] text-ink-muted">
            Item {position} of {total} · Skipping never changes anything — it just moves you on.
          </p>
        </div>
      </div>
    </div>
  );
}
