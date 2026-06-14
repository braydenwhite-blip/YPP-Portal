import { ButtonLink, EntityChip, RecordSection, StatusBadge, cn } from "@/components/ui-v2";
import type {
  CoSAnswer,
  CoSAnswerBlock,
  CoSAnswerItem,
  CoSTone,
} from "@/lib/help-agent/types";
import type { Entity360Type } from "@/lib/operations/entity-360";

/**
 * Renders a Chief of Staff answer — the structured answer blocks the Help Agent
 * returns. Presentational only (no fetching), so it is reused by the /help-agent
 * Ask surface, the ⌘K palette, and the Leadership Home panel. Every line shows
 * its concrete operational signal and links back to the record it is about.
 */

const TONE_TO_BADGE: Record<CoSTone, "neutral" | "success" | "warning" | "danger" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  success: "success",
  neutral: "neutral",
};

const ACCENT: Record<CoSTone, string> = {
  danger: "border-l-danger-400",
  warning: "border-l-warning-400",
  info: "border-l-info-400",
  success: "border-l-success-400",
  neutral: "border-l-line",
};

export function ChiefOfStaffAnswerView({
  answer,
  className,
}: {
  answer: CoSAnswer;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[15px] font-semibold leading-snug text-ink">{answer.headline}</p>
        {answer.narrative ? (
          <div className="rounded-[10px] border border-brand-200 bg-brand-50/60 p-3.5">
            <p className="m-0 mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-700">
              <span aria-hidden>✦</span> Chief of Staff · AI summary
            </p>
            <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
              {answer.narrative}
            </p>
          </div>
        ) : null}
      </div>

      {answer.blocks.map((block) => (
        <AnswerBlock key={block.kind + block.title} block={block} />
      ))}
    </div>
  );
}

function AnswerBlock({ block }: { block: CoSAnswerBlock }) {
  return (
    <RecordSection
      title={block.title}
      description={block.subtitle ?? undefined}
      action={
        block.moreHref ? (
          <ButtonLink href={block.moreHref} variant="ghost" size="sm">
            {block.moreLabel ?? "View"} →
          </ButtonLink>
        ) : undefined
      }
      className="p-4"
    >
      {block.items.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">
          {block.emptyState ?? "Nothing here right now."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {block.items.map((item, idx) => (
            <AnswerItem key={`${item.label}-${idx}`} item={item} />
          ))}
        </ul>
      )}
    </RecordSection>
  );
}

function AnswerItem({ item }: { item: CoSAnswerItem }) {
  const tone = item.tone ?? "neutral";
  return (
    <li className={cn("rounded-[8px] border border-line-soft border-l-[3px] px-3.5 py-2.5", ACCENT[tone])}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
          {item.entityType && item.entityId ? (
            <EntityChip
              type={item.entityType as Entity360Type}
              id={item.entityId}
              label={item.label}
              href={item.href ?? undefined}
            />
          ) : (
            <span className="min-w-0">{item.label}</span>
          )}
          {item.signal ? (
            <StatusBadge tone={TONE_TO_BADGE[tone]}>{item.signal}</StatusBadge>
          ) : null}
        </p>
        {item.href && !(item.entityType && item.entityId) ? (
          <a
            href={item.href}
            className="shrink-0 text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            Open →
          </a>
        ) : null}
      </div>
      {item.detail ? (
        <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-muted">{item.detail}</p>
      ) : null}
      {item.source ? (
        <p className="m-0 mt-1 text-[11.5px] font-medium uppercase tracking-[0.04em] text-ink-muted/80">
          {item.source}
        </p>
      ) : null}
    </li>
  );
}
