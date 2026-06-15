"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ButtonLink, cn, StatusBadge } from "@/components/ui-v2";
import type { QueueItem } from "@/lib/queue/types";

import { CloseIcon, typeGlyph } from "./icons";
import { ResolutionDock, type ResolutionHandler } from "./resolution-dock";

/**
 * QueueDrawer — the connected-object drawer (Queue Engine §E). Clicking any loop
 * opens it in place: summary, why, recommended move, the connected meeting /
 * initiative / person / source, a compact activity read, the resolution dock,
 * and a link to the full record. Escape and the backdrop close it; focus moves
 * to the panel on open.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-2">
      <dt className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </dt>
      <dd className="m-0 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export function QueueDrawer({
  item,
  onClose,
  onAction,
}: {
  item: QueueItem | null;
  onClose: () => void;
  onAction?: ResolutionHandler;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={item.title}>
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line-soft bg-surface shadow-overlay outline-none",
          "motion-safe:transition-transform"
        )}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line-soft bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-brand-700">
              <span aria-hidden>{typeGlyph(item.type)}</span>
              {item.typeLabel}
            </span>
            <h2 className="m-0 text-[17px] font-bold leading-tight text-ink">{item.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-brand-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 px-5 py-5">
          <section className="grid gap-1.5">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              Why it matters
            </p>
            <p className="m-0 text-[13.5px] leading-relaxed text-ink">{item.why}</p>
          </section>

          {item.recommendedMove ? (
            <section className="rounded-[12px] border border-brand-200 bg-brand-50/60 p-3.5">
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
                Next step
              </p>
              <p className="m-0 mt-0.5 text-[13px] text-ink">{item.recommendedMove}</p>
            </section>
          ) : null}

          <section>
            <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              Connections
            </p>
            <dl className="m-0 divide-y divide-line-soft">
              <Row label="Status">
                <StatusBadge
                  tone={
                    item.severity === "critical"
                      ? "danger"
                      : item.severity === "high"
                        ? "warning"
                        : item.severity === "medium"
                          ? "info"
                          : "neutral"
                  }
                >
                  {item.statusLabel}
                </StatusBadge>
              </Row>
              <Row label="Owner">{item.ownerName ?? <span className="text-ink-muted">Unassigned</span>}</Row>
              {item.relatedMeeting ? (
                <Row label="Meeting">
                  <Link href={`/actions/meetings/${item.relatedMeeting.id}`} className="text-brand-700 hover:underline">
                    {item.relatedMeeting.title}
                  </Link>
                </Row>
              ) : null}
              {item.relatedInitiative ? (
                <Row label="Initiative">
                  <Link
                    href={`/operations/initiatives/${item.relatedInitiative.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {item.relatedInitiative.title}
                  </Link>
                </Row>
              ) : null}
              {item.relatedPerson ? <Row label="Person">{item.relatedPerson.label}</Row> : null}
              {item.dueISO ? (
                <Row label="Due">
                  {new Date(item.dueISO).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Row>
              ) : null}
              <Row label="Reason">
                <code className="rounded bg-surface-soft px-1.5 py-0.5 text-[11.5px] text-ink-muted">
                  {item.reason}
                </code>
              </Row>
            </dl>
          </section>

          <section className="border-t border-line-soft pt-4">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              Resolve this loop
            </p>
            <ResolutionDock item={item} onAction={onAction} size="sm" />
          </section>
        </div>

        <footer className="sticky bottom-0 border-t border-line-soft bg-surface/95 px-5 py-3 backdrop-blur">
          <ButtonLink href={item.href} variant="secondary" size="sm" className="w-full">
            Open full record →
          </ButtonLink>
        </footer>
      </div>
    </div>
  );
}
