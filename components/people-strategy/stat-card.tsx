import type { ReactNode } from "react";
import Link from "next/link";

import { PsIcon, type PsIconName } from "@/components/people-strategy/ps-icons";

/**
 * Shared metric tile for the Action Tracker overview strips (My Actions, All
 * Actions, Command Center pulse). One source of truth so the summary stats look
 * identical everywhere: a tone-keyed gradient strip, a tinted icon chip, a big
 * number, and an optional hint or trend.
 *
 * `tone` drives the color language; `icon` adds a tinted glyph chip; `href`
 * turns the tile into a click-through filter with a hover lift; `trend` renders
 * an inline delta next to the value (used by the Command Center pulse).
 */

export type StatTone = "default" | "danger" | "warning" | "success" | "accent";

export function StatCard({
  label,
  value,
  tone = "default",
  icon,
  hint,
  href,
  trend,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  icon?: PsIconName;
  /** Optional sublabel under the value (e.g. "soonest deadline"). */
  hint?: string;
  /** When set, the tile becomes a click-through filter link. */
  href?: string;
  /** Optional inline delta/trend node rendered next to the value. */
  trend?: ReactNode;
}) {
  const body = (
    <div className={`ps-stat-card ps-stat-${tone}`}>
      <div className="ps-stat-head">
        <span className="ps-stat-label">{label}</span>
        {icon ? (
          <span className="ps-stat-icon">
            <PsIcon name={icon} />
          </span>
        ) : null}
      </div>
      <div className="ps-stat-value">
        {value}
        {trend ?? null}
      </div>
      {hint ? <p className="ps-stat-hint">{hint}</p> : null}
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

  return <div style={{ flex: "1 1 150px", minWidth: 140 }}>{body}</div>;
}
