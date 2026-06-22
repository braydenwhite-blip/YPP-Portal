import Link from "next/link";

import { Button, ButtonLink, cn, StatusBadge, type StatusTone } from "@/components/ui-v2";
import type { QueueItem, QueueSeverity, QueueTone } from "@/lib/queue/types";

import { ArrowRightIcon, SparkleIcon, typeGlyph } from "./icons";
import { ResolutionDock, type ResolutionHandler } from "./resolution-dock";

/**
 * QueueCard — one open loop, rendered two ways. Compact (default) is the
 * scannable list card with a single dominant action; featured is the focused
 * cockpit/runner card with the "recommended next move" callout and the full
 * Resolve / Delegate / Discuss / Defer dock. Both lead with the move, never a
 * pile of metadata.
 */

const SEVERITY_TO_BADGE: Record<QueueSeverity, StatusTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

const TONE_ACCENT: Record<QueueTone, string> = {
  danger: "border-l-danger-700",
  warning: "border-l-warning-700",
  info: "border-l-info-700",
  brand: "border-l-brand-600",
  success: "border-l-success-700",
  neutral: "border-l-line",
};

function ContextChips({ item }: { item: QueueItem }) {
  const chips: React.ReactNode[] = [];
  if (item.ownerName) {
    chips.push(
      <span key="owner" className="text-ink-muted">
        Owner <span className="font-semibold text-ink">{item.ownerName}</span>
      </span>
    );
  }
  if (item.relatedMeeting) {
    chips.push(
      <Link
        key="meeting"
        href={`/meetings/${item.relatedMeeting.id}`}
        className="text-brand-700 hover:underline"
      >
        {item.relatedMeeting.title}
      </Link>
    );
  }
  if (item.relatedInitiative) {
    chips.push(
      <Link
        key="initiative"
        href={`/operations/initiatives/${item.relatedInitiative.id}`}
        className="text-brand-700 hover:underline"
      >
        {item.relatedInitiative.title}
      </Link>
    );
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
      {chips.map((chip, i) => (
        <span key={i} className="inline-flex items-center gap-3">
          {i > 0 ? <span className="text-line" aria-hidden>·</span> : null}
          {chip}
        </span>
      ))}
    </div>
  );
}

export function QueueCard({
  item,
  featured = false,
  onAction,
  onOpenDrawer,
  className,
}: {
  item: QueueItem;
  featured?: boolean;
  /** Session handler (client). When absent, actions navigate. */
  onAction?: ResolutionHandler;
  /** Open the connected-object drawer (client cockpit/runner only). */
  onOpenDrawer?: (item: QueueItem) => void;
  className?: string;
}) {
  const badgeTone = SEVERITY_TO_BADGE[item.severity];

  const TypeChip = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-brand-700">
      <span aria-hidden className="text-[13px] leading-none">
        {typeGlyph(item.type)}
      </span>
      {item.typeLabel}
    </span>
  );

  if (!featured) {
    return (
      <article
        className={cn(
          "group flex items-start gap-3 rounded-[12px] border border-l-[3px] border-line-soft bg-surface p-4 shadow-card transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-overlay motion-reduce:hover:translate-y-0",
          TONE_ACCENT[item.tone],
          className
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {TypeChip}
            <StatusBadge tone={badgeTone} title={item.reason}>
              {item.statusLabel}
            </StatusBadge>
          </div>
          <h3 className="m-0 truncate text-[15px] font-bold text-ink">{item.title}</h3>
          <p className="m-0 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{item.why}</p>
          <ContextChips item={item} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {onAction ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAction(item.primaryAction.resolution === "open" ? "resolve" : item.primaryAction.resolution, item)}
            >
              {item.primaryAction.label}
            </Button>
          ) : (
            <ButtonLink href={item.primaryAction.href} variant="primary" size="sm">
              {item.primaryAction.label}
            </ButtonLink>
          )}
          {onOpenDrawer ? (
            <button
              type="button"
              onClick={() => onOpenDrawer(item)}
              className="text-[12px] font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              Details
            </button>
          ) : (
            <Link
              href={item.href}
              className="text-[12px] font-semibold text-brand-700 hover:underline"
            >
              Open →
            </Link>
          )}
        </div>
      </article>
    );
  }

  // Featured — the focused cockpit / runner card.
  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-[16px] border border-line-soft bg-surface p-6 shadow-card",
        className
      )}
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {TypeChip}
            <StatusBadge tone={badgeTone} title={item.reason}>
              {item.statusLabel}
            </StatusBadge>
            {item.ageLabel && item.ageLabel !== item.statusLabel ? (
              <span className="text-[12px] text-ink-muted">{item.ageLabel}</span>
            ) : null}
          </div>
          {onOpenDrawer ? (
            <button
              type="button"
              onClick={() => onOpenDrawer(item)}
              className="rounded-full border border-line-soft px-3 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              Connected details
            </button>
          ) : (
            <Link
              href={item.href}
              className="rounded-full border border-line-soft px-3 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Open record →
            </Link>
          )}
        </div>
        <h2 className="m-0 text-[24px] font-bold leading-tight text-ink">{item.title}</h2>
      </header>

      <div className="grid gap-1.5">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
          Why it matters
        </p>
        <p className="m-0 text-[14px] leading-relaxed text-ink">{item.why}</p>
      </div>

      <ContextChips item={item} />

      {item.recommendedMove ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[12px] border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <SparkleIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">
                Recommended next move
              </p>
              <p className="m-0 mt-0.5 text-[13.5px] leading-snug text-ink">
                {item.recommendedMove}
              </p>
            </div>
          </div>
          {onAction ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAction(item.primaryAction.resolution === "open" ? "resolve" : item.primaryAction.resolution, item)}
              className="shrink-0"
            >
              {item.primaryAction.label}
              <ArrowRightIcon className="size-4" />
            </Button>
          ) : (
            <ButtonLink href={item.primaryAction.href} variant="primary" size="sm" className="shrink-0">
              {item.primaryAction.label}
              <ArrowRightIcon className="size-4" />
            </ButtonLink>
          )}
        </div>
      ) : null}

      <div className="border-t border-line-soft pt-4">
        <ResolutionDock item={item} onAction={onAction} />
      </div>
    </article>
  );
}
