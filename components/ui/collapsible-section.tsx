import type { ReactNode } from "react";

/**
 * A generic, collapsed-by-default disclosure section built on native
 * `<details>` (no client JS, works in server components). Generalizes the
 * applicant-only `CollapsibleAssignmentPanel` so review/profile surfaces can tame
 * their long scroll (comment #15): top-level sections collapse, with an optional
 * one-line summary visible while collapsed.
 *
 * Defaults to collapsed; pass `defaultOpen` for the first/most-important section.
 */
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  /** Optional one-liner shown on the right of the header while collapsed. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={`collapsible-section${className ? ` ${className}` : ""}`}
      open={defaultOpen}
    >
      <summary className="collapsible-section-summary">
        <span className="collapsible-section-title">{title}</span>
        {summary ? <span className="collapsible-section-meta">{summary}</span> : null}
        <span className="collapsible-section-caret" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="collapsible-section-body">{children}</div>
    </details>
  );
}
