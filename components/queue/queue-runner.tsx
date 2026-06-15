"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn, EmptyStateV2 } from "@/components/ui-v2";
import type { QueueDeferReason, QueueItem, QueueResolution } from "@/lib/queue/types";

import { ArrowRightIcon, CloseIcon } from "./icons";
import { QueueCard } from "./queue-card";
import { QueueDrawer } from "./queue-drawer";
import { QueueReceipt } from "./queue-receipt";
import type { SessionDecision } from "./session";

/**
 * QueueRunner — the one-card-at-a-time, full-screen triage runner (Queue Engine
 * §A). It hides page chrome and walks the leader through each loop: Why it
 * matters, the recommended move, and the Resolve / Delegate / Discuss / Defer
 * dock. Decide the move for each loop (open the record any time to act now);
 * finishing the pass produces a receipt. Fully keyboard-navigable:
 *   r resolve · g delegate · c discuss · f defer · s skip · ← back · o details
 */
export function QueueRunner({
  queueLabel,
  items,
  nextQueueHref,
  nextQueueLabel,
}: {
  queueLabel: string;
  items: QueueItem[];
  nextQueueHref?: string;
  nextQueueLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<SessionDecision[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const total = items.length;
  const done = index >= total;
  const current = done ? null : items[index];

  const decide = useCallback(
    (resolution: QueueResolution, item: QueueItem, reason?: QueueDeferReason) => {
      setDecisions((prev) => [
        ...prev.filter((d) => d.item.id !== item.id),
        { item, resolution, reason },
      ]);
      setDrawerOpen(false);
      setIndex((i) => i + 1);
    },
    []
  );

  const skip = useCallback(() => setIndex((i) => i + 1), []);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const restart = useCallback(() => {
    setIndex(0);
    setDecisions([]);
  }, []);

  useEffect(() => {
    if (done || !current) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || drawerOpen) return;
      const key = e.key.toLowerCase();
      if (key === "r" && current.resolutions.includes("resolve")) decide("resolve", current);
      else if (key === "g" && current.resolutions.includes("delegate")) decide("delegate", current);
      else if (key === "c" && current.resolutions.includes("discuss")) decide("discuss", current);
      else if (key === "f" && current.resolutions.includes("defer"))
        decide("defer", current, "needs_more_info");
      else if (key === "s") skip();
      else if (key === "arrowleft") back();
      else if (key === "o") setDrawerOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, done, drawerOpen, decide, skip, back]);

  if (total === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl py-16">
        <EmptyStateV2
          title="This queue is clear"
          body={`No open loops in the ${queueLabel} right now. Nothing to run.`}
          action={
            <Link href="/work" className="text-[13px] font-semibold text-brand-700 hover:underline">
              Back to Mission Control →
            </Link>
          }
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="py-10">
        <QueueReceipt
          queueLabel={queueLabel}
          decisions={decisions}
          remaining={total - decisions.filter((d) => d.resolution === "resolve").length}
          nextQueueHref={nextQueueHref}
          nextQueueLabel={nextQueueLabel}
          onRestart={restart}
        />
      </div>
    );
  }

  const progress = Math.round((index / total) * 100);

  return (
    <div className="flex min-h-[78vh] flex-col">
      {/* Progress / chrome */}
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line-soft bg-surface-soft/90 px-1 py-3 backdrop-blur">
        <Link
          href="/work"
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          aria-label="Exit runner"
        >
          <CloseIcon className="size-4" /> Exit
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 text-[12.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
            {queueLabel}
          </span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[12.5px] font-semibold text-ink-muted">
            Loop {Math.min(index + 1, total)} of {total}
          </span>
        </div>
      </header>

      {/* Focused card */}
      <div className="flex flex-1 items-start justify-center py-8">
        <div className="w-full max-w-3xl">
          <QueueCard
            key={current!.id}
            item={current!}
            featured
            onAction={decide}
            onOpenDrawer={() => setDrawerOpen(true)}
          />

          {/* Secondary controls */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-ink-muted">
            <button type="button" onClick={back} disabled={index === 0} className="font-semibold disabled:opacity-40 hover:text-ink">
              ← Back
            </button>
            <button type="button" onClick={skip} className="font-semibold hover:text-ink">
              Skip <kbd className="rounded bg-surface px-1 text-[10px]">S</kbd>
            </button>
            <button type="button" onClick={() => setDrawerOpen(true)} className="font-semibold hover:text-ink">
              Open details <kbd className="rounded bg-surface px-1 text-[10px]">O</kbd>
            </button>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <kbd className="rounded bg-surface px-1 text-[10px]">R</kbd>esolve
              <kbd className="ml-2 rounded bg-surface px-1 text-[10px]">G</kbd>delegate
              <kbd className="ml-2 rounded bg-surface px-1 text-[10px]">C</kbd>discuss
              <kbd className="ml-2 rounded bg-surface px-1 text-[10px]">F</kbd>defer
            </span>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-muted">
            <ArrowRightIcon className="size-3.5" />
            Decide the next move for each loop. Open the record any time to act now.
          </p>
        </div>
      </div>

      {drawerOpen ? (
        <QueueDrawer item={current} onClose={() => setDrawerOpen(false)} onAction={decide} />
      ) : null}
    </div>
  );
}
