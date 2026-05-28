import Link from "next/link";

/**
 * Standardized top-of-page header for mentorship + pathway surfaces, so every
 * page answers the same questions in the first screenful WITHOUT a giant
 * intro section:
 *   1. What is this page?      → badge + title
 *   2. What's its purpose?     → purpose (one sentence)
 *   3. What's my status?       → status chip
 *   4. What's my next action?  → primary action button
 *   5. Anything secondary?     → secondary action button
 *   6. How does it connect?    → "connects" line (the growth model)
 *
 * Renders inside the existing `.topbar` / `.page-title` system (no new design
 * system) and emits a real <h1> so existing heading-based tests/landmarks
 * keep working.
 */

export type HeaderStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "pending"
  | "warning";

const TONE_STYLE: Record<HeaderStatusTone, { color: string; background: string }> = {
  neutral: { color: "#475569", background: "#f1f5f9" },
  info: { color: "#1e40af", background: "#dbeafe" },
  success: { color: "#166534", background: "#dcfce7" },
  pending: { color: "#b45309", background: "#fef3c7" },
  warning: { color: "#991b1b", background: "#fee2e2" },
};

export interface HeaderAction {
  label: string;
  href: string;
}

export interface HeaderStatus {
  label: string;
  tone?: HeaderStatusTone;
}

interface ActionSummaryHeaderProps {
  badge?: string;
  title: string;
  /** One-sentence description of what this page is for. */
  purpose?: string;
  /** The user's current status at a glance. */
  status?: HeaderStatus;
  /** The single most important thing to do next. */
  nextAction?: HeaderAction;
  /** An optional supporting action (e.g. a cross-link). */
  secondaryAction?: HeaderAction;
  /** One short line on how this page connects to the broader growth journey. */
  connects?: string;
}

export function ActionSummaryHeader({
  badge,
  title,
  purpose,
  status,
  nextAction,
  secondaryAction,
  connects,
}: ActionSummaryHeaderProps) {
  const toneStyle = status ? TONE_STYLE[status.tone ?? "neutral"] : null;

  return (
    <header style={{ marginBottom: 16 }}>
      <div className="topbar">
        <div>
          {badge ? <p className="badge">{badge}</p> : null}
          <h1 className="page-title">{title}</h1>
          {purpose ? <p className="page-subtitle">{purpose}</p> : null}
          {status && toneStyle ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                background: toneStyle.background,
                color: toneStyle.color,
                borderRadius: 999,
                padding: "0.2rem 0.65rem",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              <span
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: "50%", background: toneStyle.color }}
              />
              {status.label}
            </span>
          ) : null}
        </div>
        {nextAction || secondaryAction ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            {nextAction ? (
              <Link href={nextAction.href} className="button small">
                {nextAction.label}
              </Link>
            ) : null}
            {secondaryAction ? (
              <Link href={secondaryAction.href} className="button secondary small">
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {connects ? (
        <p
          className="muted"
          style={{ margin: "8px 2px 0", fontSize: "0.8rem", lineHeight: 1.5, maxWidth: "70ch" }}
        >
          {connects}
        </p>
      ) : null}
    </header>
  );
}

export default ActionSummaryHeader;
