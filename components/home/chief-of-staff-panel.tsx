import { ButtonLink, StatusBadge, cn } from "@/components/ui-v2";
import type { CoSInsight, CoSTone } from "@/lib/help-agent/types";

/**
 * Leadership Home — the Chief of Staff proactive panel.
 *
 * Surfaces the highest-signal facts the Help Agent's engine derives (meetings
 * needing follow-through, decisions without owners, partners to follow up,
 * completed work for reviews) — worst first, each linking to where to act. No
 * dashboards, no scores; every line is a real, explainable signal.
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

export function ChiefOfStaffPanel({ insights }: { insights: CoSInsight[] }) {
  return (
    <div className="rounded-[12px] border border-brand-200 bg-gradient-to-br from-brand-50/70 to-surface p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
          <span aria-hidden>✦</span> Chief of Staff
        </p>
        <ButtonLink href="/help-agent" variant="ghost" size="sm">
          Ask anything →
        </ButtonLink>
      </div>

      {insights.length === 0 ? (
        <p className="m-0 text-[13.5px] text-ink-muted">
          Nothing is slipping right now — no unconverted follow-ups, ownerless decisions, or
          partners waiting. Ask the Chief of Staff anytime.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {insights.map((insight, idx) => (
            <li
              key={`${insight.href}-${idx}`}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft border-l-[3px] bg-surface px-3.5 py-2.5",
                ACCENT[insight.tone]
              )}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-[13.5px] text-ink">
                {insight.signal ? (
                  <StatusBadge tone={TONE_TO_BADGE[insight.tone]}>{insight.signal}</StatusBadge>
                ) : null}
                <span className="min-w-0">{insight.text}</span>
              </span>
              <a
                href={insight.href}
                className="shrink-0 text-[12.5px] font-semibold text-brand-700 hover:underline"
              >
                {insight.ctaLabel ?? "Open"} →
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
