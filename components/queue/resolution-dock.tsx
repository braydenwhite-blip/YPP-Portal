"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/components/ui-v2";
import {
  type QueueAction,
  type QueueDeferReason,
  type QueueItem,
  type QueueResolution,
  QUEUE_DEFER_REASON_LABELS,
  QUEUE_DEFER_REASONS,
  QUEUE_RESOLUTION_HINTS,
  QUEUE_RESOLUTION_LABELS,
} from "@/lib/queue/types";

import { RESOLUTION_ICON, RESOLUTION_STYLE } from "./icons";

/**
 * The Resolve / Delegate / Discuss / Defer dock — the one decision surface for
 * every loop. Resolve / Delegate / Discuss route into the workflow that owns the
 * mutation (no re-implementation); Defer is captured in place with a required
 * reason. When a session handler is supplied (runner / cockpit) the dock reports
 * the choice back so the loop leaves the active session; otherwise it navigates.
 */

export type ResolutionHandler = (
  resolution: QueueResolution,
  item: QueueItem,
  reason?: QueueDeferReason
) => void;

export function ResolutionDock({
  item,
  onAction,
  size = "md",
  className,
}: {
  item: QueueItem;
  onAction?: ResolutionHandler;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [deferOpen, setDeferOpen] = useState(false);

  const actionFor = (res: QueueResolution): QueueAction | undefined =>
    item.primaryAction.resolution === res
      ? item.primaryAction
      : item.secondaryActions.find((a) => a.resolution === res);

  function handle(res: QueueResolution, reason?: QueueDeferReason) {
    if (res === "defer" && !reason) {
      setDeferOpen((open) => !open);
      return;
    }
    if (onAction) {
      onAction(res, item, reason);
    } else if (res !== "defer") {
      const action = actionFor(res);
      if (action) router.push(action.href);
    } else {
      // No session: send the leader to the record to set a follow-up date.
      router.push(item.href);
    }
    setDeferOpen(false);
  }

  const pad = size === "sm" ? "px-2.5 py-2" : "px-3 py-2.5";
  const labelSize = size === "sm" ? "text-[12px]" : "text-[12.5px]";

  return (
    <div className={cn("relative", className)}>
      <div
        role="group"
        aria-label="Resolution options"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {item.resolutions.map((res) => {
          const Icon = RESOLUTION_ICON[res];
          const style = RESOLUTION_STYLE[res];
          return (
            <button
              key={res}
              type="button"
              onClick={() => handle(res)}
              aria-expanded={res === "defer" ? deferOpen : undefined}
              className={cn(
                "group flex flex-col items-start gap-1 rounded-[10px] border text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
                pad,
                style.tile
              )}
            >
              <span className={cn("flex items-center gap-1.5 font-bold", labelSize, style.label)}>
                <Icon className={cn("size-4 shrink-0", style.icon)} />
                {QUEUE_RESOLUTION_LABELS[res]}
              </span>
              <span className="text-[11px] leading-tight text-ink-muted">
                {actionFor(res)?.hint ?? QUEUE_RESOLUTION_HINTS[res]}
              </span>
            </button>
          );
        })}
      </div>

      {deferOpen ? (
        <>
          <button
            type="button"
            aria-label="Close defer menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setDeferOpen(false)}
          />
          <div
            role="menu"
            aria-label="Defer reason"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-overlay"
          >
            <p className="m-0 border-b border-line-soft px-3.5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Defer — pick a reason
            </p>
            <ul className="m-0 flex list-none flex-col p-1">
              {QUEUE_DEFER_REASONS.map((reason: QueueDeferReason) => (
                <li key={reason}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handle("defer", reason)}
                    className="w-full rounded-[8px] px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none"
                  >
                    {QUEUE_DEFER_REASON_LABELS[reason]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
