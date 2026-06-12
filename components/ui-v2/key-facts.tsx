import Link from "next/link";

import { cn } from "./cn";

export type KeyFact = {
  label: string;
  /** Concrete value ("3 current classes", "Jun 2 · overdue") — never a score. */
  value: React.ReactNode;
  /** Optional context line under the value. */
  detail?: string;
  /** Optional click-through to the surface that explains the fact. */
  href?: string;
  tone?: "default" | "attention";
};

/**
 * The key-facts strip on record pages: a calm grid of label/value tiles
 * directly under the ProfileHeader. Facts with no value should be omitted by
 * the caller, not rendered as "—" rows (vague-metric rule, master plan §19:
 * every tile is a concrete fact or it doesn't ship).
 */
export function KeyFactsGrid({
  facts,
  className,
}: {
  facts: KeyFact[];
  className?: string;
}) {
  if (facts.length === 0) return null;
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
        className
      )}
    >
      {facts.map((fact) => {
        const body = (
          <>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              {fact.label}
            </span>
            <span
              className={cn(
                "text-[14px] font-semibold leading-snug",
                fact.tone === "attention" ? "text-danger-700" : "text-ink"
              )}
            >
              {fact.value}
            </span>
            {fact.detail ? (
              <span
                className={cn(
                  "text-[11.5px]",
                  fact.tone === "attention"
                    ? "font-medium text-danger-700"
                    : "text-ink-muted"
                )}
              >
                {fact.detail}
              </span>
            ) : null}
          </>
        );
        const tileClass = cn(
          "flex min-w-0 flex-col gap-0.5 rounded-[12px] border bg-surface p-3.5 shadow-card",
          fact.tone === "attention" ? "border-danger-700/20" : "border-line-soft",
          fact.href &&
            "transition-colors duration-150 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        );
        return fact.href ? (
          <Link key={fact.label} href={fact.href} className={tileClass}>
            {body}
          </Link>
        ) : (
          <div key={fact.label} className={tileClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
