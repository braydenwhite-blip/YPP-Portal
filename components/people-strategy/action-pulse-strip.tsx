import Link from "next/link";

import {
  buildActionPulseStrip,
  type ActionPulseStat,
} from "@/lib/people-strategy/action-operating-board";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

/**
 * The compact factual strip at the top of the Action Tracker: overdue, due this
 * week, blocked, unassigned, completed this week. Five honest counts — no
 * scores, no health meters, no dashboard language. Actionable slices link to
 * their preset; "completed this week" is informational only.
 */

function StatChip({ stat }: { stat: ActionPulseStat }) {
  const danger = (stat.key === "overdue" || stat.key === "blocked") && stat.count > 0;
  const body = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontSize: 13,
      }}
    >
      <strong style={{ fontSize: 15, color: danger ? "var(--error-color)" : "inherit" }}>
        {stat.count}
      </strong>
      <span style={{ color: "var(--text-secondary, #64748b)" }}>{stat.label}</span>
    </span>
  );

  if (stat.href && stat.count > 0) {
    return (
      <Link href={stat.href} style={{ textDecoration: "none", color: "inherit" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function ActionPulseStrip({
  items,
  now,
}: {
  items: ActionItemWithRelations[];
  now: Date;
}) {
  const stats = buildActionPulseStrip(items, now);
  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 18,
        rowGap: 8,
        padding: "10px 14px",
        alignItems: "center",
      }}
    >
      {stats.map((stat) => (
        <StatChip key={stat.key} stat={stat} />
      ))}
    </div>
  );
}
