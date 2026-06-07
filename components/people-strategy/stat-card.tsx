import Link from "next/link";

/**
 * Shared metric tile for the Action Tracker overview strips (My Actions, All
 * Actions). One source of truth so the summary stats look identical everywhere
 * and gain polish (tone-driven accent, optional click-through filter) in one
 * place instead of being re-implemented per page.
 *
 * `tone` colors the left rail + value; `href` turns the tile into a filter
 * link with a hover lift so leadership can jump straight from "4 overdue" to
 * the filtered list.
 */

export type StatTone = "default" | "danger" | "warning" | "success" | "accent";

const TONE_ACCENT: Record<StatTone, string | undefined> = {
  default: undefined,
  danger: "var(--error-color)",
  warning: "var(--warning-color)",
  success: "var(--success-color)",
  accent: "var(--ps-accent)",
};

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  href,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  /** Optional sublabel under the value (e.g. "soonest deadline"). */
  hint?: string;
  /** When set, the tile becomes a click-through filter link. */
  href?: string;
}) {
  const accent = TONE_ACCENT[tone];

  const body = (
    <div
      className="card ps-stat-card"
      style={{
        padding: "14px 16px",
        height: "100%",
        borderLeft: accent ? `3px solid ${accent}` : "3px solid transparent",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.1,
          color: accent ?? "inherit",
        }}
      >
        {value}
      </p>
      {hint ? (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>{hint}</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="ps-stat-link"
        style={{ flex: "1 1 150px", minWidth: 140, textDecoration: "none", color: "inherit" }}
      >
        {body}
      </Link>
    );
  }

  return (
    <div style={{ flex: "1 1 150px", minWidth: 140 }}>{body}</div>
  );
}
