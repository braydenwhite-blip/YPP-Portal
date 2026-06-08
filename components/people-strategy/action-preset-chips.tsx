import Link from "next/link";

import type { ActionPreset } from "@/lib/people-strategy/action-filters";

export type ActionPresetChip = {
  value: ActionPreset;
  label: string;
  description: string;
  href: string;
  active?: boolean;
  count?: number;
};

/**
 * People Strategy — strategic view-preset chips for the Action Tracker.
 *
 * Presentational server component: each chip is a pre-built link that re-applies
 * one strategic lens (Unassigned / Due soon / High priority / Blocked / Waiting)
 * over the existing filter pipeline. The caller decides whether a chip toggles
 * on top of the current filters (Action Tracker) or jumps to a clean view
 * (Command Center), and whether to show live counts — this component only
 * renders what it is handed, so it stays trivially reusable + testable.
 */
export function ActionPresetChips({
  chips,
  label = "Strategic views",
}: {
  chips: ActionPresetChip[];
  label?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        marginTop: 12,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}:</span>
      {chips.map((chip) => (
        <Link
          key={chip.value}
          href={chip.href}
          title={chip.description}
          aria-label={`${chip.label} — ${chip.description}`}
          aria-current={chip.active ? "true" : undefined}
          className={`button outline small${chip.active ? " primary" : ""}`}
          style={{ fontSize: 12 }}
        >
          {chip.label}
          {chip.count != null ? (
            <span
              style={{ marginLeft: 6, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}
            >
              {chip.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export default ActionPresetChips;
