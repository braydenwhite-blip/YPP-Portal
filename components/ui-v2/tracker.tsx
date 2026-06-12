import type { ReactNode } from "react";

import { CardV2 } from "./card";
import { cn } from "./cn";

type TrackerFact = {
  label: string;
  value: string | number;
  href?: string;
  tone?: "default" | "attention" | "danger";
};

/**
 * Calm tracker entry card: one recommended next move, one primary action, and
 * a tiny concrete summary. Use this before lists that can otherwise feel like a
 * database dump.
 */
export function TrackerStartCard({
  label = "Start here",
  title,
  description,
  action,
  secondaryAction,
  facts = [],
}: {
  label?: string;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  facts?: TrackerFact[];
}) {
  return (
    <CardV2 padding="md" className="border-brand-200 bg-brand-50/55">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-brand-700">
            {label}
          </p>
          <h2 className="m-0 mt-1 text-[18px] font-bold leading-tight text-ink">
            {title}
          </h2>
          <p className="m-0 mt-1.5 max-w-2xl text-[13.5px] leading-5 text-ink-muted">
            {description}
          </p>
        </div>
        {action || secondaryAction ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>

      {facts.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {facts.map((fact) => {
            const body = (
              <>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    fact.tone === "danger"
                      ? "text-danger-700"
                      : fact.tone === "attention"
                        ? "text-brand-700"
                        : "text-ink"
                  )}
                >
                  {fact.value}
                </span>
                <span className="text-ink-muted">{fact.label}</span>
              </>
            );
            const className = cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-1",
              "text-[12px] font-semibold shadow-[0_1px_1px_rgba(26,5,51,0.04)]",
              fact.tone === "danger" ? "border-red-200" : "border-line-soft",
              fact.href ? "transition-colors hover:border-brand-400 hover:bg-surface-soft" : ""
            );
            return fact.href ? (
              <a key={`${fact.label}-${fact.href}`} href={fact.href} className={className}>
                {body}
              </a>
            ) : (
              <span key={fact.label} className={className}>
                {body}
              </span>
            );
          })}
        </div>
      ) : null}
    </CardV2>
  );
}
