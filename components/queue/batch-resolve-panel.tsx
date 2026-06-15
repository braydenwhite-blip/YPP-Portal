"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, cn } from "@/components/ui-v2";
import {
  type QueueDeferReason,
  type QueueItem,
  QUEUE_DEFER_REASON_LABELS,
  QUEUE_DEFER_REASONS,
} from "@/lib/queue/types";

import { CheckCircleIcon, DeferIcon } from "./icons";

/**
 * BatchResolvePanel — clear repeated problems in one pass (Queue Engine §B).
 * Select the loops that share a problem (missing owner, no next step, overdue),
 * then mark them reviewed or defer them together. The real edit still happens on
 * the record (each row links out) — this is the fast triage layer over it.
 */
export function BatchResolvePanel({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: QueueItem[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [deferOpen, setDeferOpen] = useState(false);

  const open = items.filter((i) => !cleared.has(i.id));
  const allSelected = open.length > 0 && open.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(open.map((i) => i.id)));
  }

  function clearSelected(_reason?: QueueDeferReason) {
    setCleared((prev) => {
      const next = new Set(prev);
      for (const id of selected) next.add(id);
      return next;
    });
    setSelected(new Set());
    setDeferOpen(false);
  }

  const clearedCount = cleared.size;

  return (
    <section className="rounded-[16px] border border-line-soft bg-surface/80 p-5 shadow-card backdrop-blur">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="m-0 text-[16px] font-bold text-ink">{title}</h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p>
        </div>
        {clearedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[12px] font-bold text-success-700">
            <CheckCircleIcon className="size-4" /> {clearedCount} cleared this pass
          </span>
        ) : null}
      </header>

      {open.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line bg-surface-soft px-4 py-8 text-center">
          <p className="m-0 text-[14px] font-bold text-ink">All cleared in this pass 🎉</p>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
            Nothing left in this batch. Reload to pull the next set.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-line-soft pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-ink">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 rounded border-line accent-brand-600"
              />
              Select all ({open.length})
            </label>
            <span className="text-[12px] text-ink-muted">{selected.size} selected</span>
          </div>

          <ul className="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0">
            {open.map((item) => {
              const checked = selected.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[8px] border px-3 py-2 transition-colors",
                    checked ? "border-brand-200 bg-brand-50" : "border-transparent hover:bg-surface-soft"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="size-4 rounded border-line accent-brand-600"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold text-ink">{item.title}</span>
                    <span className="truncate text-[11.5px] text-ink-muted">
                      {item.ownerName ?? "Unassigned"} · {item.statusLabel}
                    </span>
                  </span>
                  <Link
                    href={item.primaryAction.href}
                    className="shrink-0 text-[12px] font-semibold text-brand-700 hover:underline"
                  >
                    Open →
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="relative mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
            <Button
              variant="primary"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => clearSelected()}
            >
              <CheckCircleIcon className="size-4" /> Mark {selected.size || ""} reviewed
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setDeferOpen((o) => !o)}
            >
              <DeferIcon className="size-4" /> Defer selected
            </Button>
            {deferOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-overlay"
              >
                <p className="m-0 border-b border-line-soft px-3.5 py-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Defer reason
                </p>
                {QUEUE_DEFER_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    role="menuitem"
                    onClick={() => clearSelected(reason)}
                    className="block w-full px-3.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-brand-50"
                  >
                    {QUEUE_DEFER_REASON_LABELS[reason]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
