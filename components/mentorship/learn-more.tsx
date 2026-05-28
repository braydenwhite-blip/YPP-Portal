/**
 * Lightweight progressive-disclosure wrapper for secondary explanations,
 * mechanics, history, and edge-case detail — so pages can stay short and
 * action-oriented while keeping the "where do I learn more?" answer one click
 * away. Built on native <details>/<summary> for zero-JS accessibility.
 *
 * Use this for things like "What do these colors mean?", "How points work",
 * "Privacy & visibility", or "View point history" — never for a page's
 * primary action.
 */
import type { ReactNode } from "react";

interface LearnMoreProps {
  /** The clickable summary line, e.g. "What do these status colors mean?". */
  summary: string;
  children: ReactNode;
  /** Open on first render (rare — default is collapsed to keep pages short). */
  defaultOpen?: boolean;
  /** Optional small muted hint shown next to the summary text. */
  hint?: string;
}

export function LearnMore({ summary, children, defaultOpen, hint }: LearnMoreProps) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface, #fff)",
        padding: "0.4rem 0.8rem",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 600,
          padding: "0.45rem 0",
          listStyle: "revert",
        }}
      >
        {summary}
        {hint ? (
          <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: "0.78rem" }}>
            {hint}
          </span>
        ) : null}
      </summary>
      <div style={{ paddingTop: 8, paddingBottom: 6 }}>{children}</div>
    </details>
  );
}

export default LearnMore;
