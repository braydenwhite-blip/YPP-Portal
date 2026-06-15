import { ButtonLink, cn, EmptyStateV2 } from "@/components/ui-v2";
import type { QueueItem, QueueKey, QueueTone } from "@/lib/queue/types";

import { QueueCard } from "./queue-card";

/**
 * QueueStrip — a labeled band of loops for embedding the Queue Engine into any
 * surface (Meetings, Initiatives, person/record pages). Leads with the move:
 * a one-line tagline, a "Run one-by-one" entry into the runner, then scannable
 * loop cards. Never a table.
 */

const ACCENT_BAR: Record<QueueTone, string> = {
  danger: "before:bg-danger-700",
  warning: "before:bg-warning-700",
  info: "before:bg-info-700",
  brand: "before:bg-brand-600",
  success: "before:bg-success-700",
  neutral: "before:bg-line",
};

export function QueueStrip({
  title,
  tagline,
  items,
  queueKey,
  runHref,
  max = 6,
  emptyText = "Nothing open here right now.",
  accent = "brand",
  className,
}: {
  title: string;
  tagline?: string;
  items: QueueItem[];
  queueKey?: QueueKey;
  runHref?: string;
  max?: number;
  emptyText?: string;
  accent?: QueueTone;
  className?: string;
}) {
  const href = runHref ?? (queueKey ? `/work/queue?queue=${queueKey}` : undefined);
  const shown = items.slice(0, max);
  const overflow = items.length - shown.length;

  return (
    <section
      className={cn(
        "relative rounded-[16px] border border-line-soft bg-surface/80 p-5 shadow-card backdrop-blur",
        "before:absolute before:left-0 before:top-5 before:h-8 before:w-1 before:rounded-r-full",
        ACCENT_BAR[accent],
        className
      )}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2 pl-3">
        <div className="min-w-0">
          <h2 className="m-0 flex items-center gap-2 text-[17px] font-bold text-ink">
            {title}
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-bold text-brand-700">
              {items.length}
            </span>
          </h2>
          {tagline ? <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">{tagline}</p> : null}
        </div>
        {href && items.length > 0 ? (
          <ButtonLink href={href} variant="secondary" size="sm">
            Run one-by-one →
          </ButtonLink>
        ) : null}
      </header>

      {shown.length === 0 ? (
        <EmptyStateV2 title="All clear" body={emptyText} />
      ) : (
        <div className="grid gap-2.5 pl-3 md:grid-cols-2">
          {shown.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {overflow > 0 && href ? (
        <div className="mt-3 pl-3">
          <ButtonLink href={href} variant="ghost" size="sm">
            +{overflow} more — run the full queue →
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}
