import type { ActionItemStatus } from "@prisma/client";

import type {
  ActionStatusBreakdown,
  DepartmentBar,
} from "@/lib/people-strategy/action-analytics";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";

/**
 * Action Tracker analytics cards — a status donut and per-department mini-bars.
 * Server components (no interactivity); inline SVG + CSS vars, matching the
 * existing dashboard chart convention (see components/chapter-dashboard/*).
 *
 * Both reflect the CURRENTLY FILTERED set of items passed in.
 */

const STATUS_ORDER: ActionItemStatus[] = [
  "COMPLETE",
  "IN_PROGRESS",
  "NOT_STARTED",
  "OVERDUE",
];

const STATUS_COLORS: Record<ActionItemStatus, string> = {
  COMPLETE: "#047857",
  IN_PROGRESS: "#1d4ed8",
  NOT_STARTED: "#94a3b8",
  OVERDUE: "#dc2626",
};

// r=34, stroke=8 — same geometry as the existing Member Pulse ring.
const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ActionStatusDonut({
  breakdown,
}: {
  breakdown: ActionStatusBreakdown;
}) {
  const { total, counts } = breakdown;

  // Build cumulative arc segments (clockwise from top).
  let offset = 0;
  const segments = STATUS_ORDER.map((status) => {
    const value = counts[status];
    const length = total > 0 ? (value / total) * CIRCUMFERENCE : 0;
    const segment = {
      status,
      value,
      length,
      dashOffset: -offset,
    };
    offset += length;
    return segment;
  });

  return (
    <div className="card" style={{ flex: "1 1 280px", minWidth: 260 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>By Status</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
        Reflects the current filters
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
        <div style={{ position: "relative", width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="8" />
            {total > 0 &&
              segments.map((seg) =>
                seg.value > 0 ? (
                  <circle
                    key={seg.status}
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke={STATUS_COLORS[seg.status]}
                    strokeWidth="8"
                    strokeDasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
                    strokeDashoffset={seg.dashOffset}
                    transform="rotate(-90 40 40)"
                  />
                ) : null
              )}
          </svg>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700 }}>{total}</span>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>actions</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: STATUS_COLORS[status],
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{ACTION_STATUS_LABELS[status]}</span>
              <strong>{counts[status]}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DepartmentBars({ bars }: { bars: DepartmentBar[] }) {
  const maxTotal = Math.max(...bars.map((b) => b.total), 1);

  return (
    <div className="card" style={{ flex: "1 1 280px", minWidth: 260 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>By Department</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
        Item count · overdue in red
      </p>

      {bars.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 16 }}>
          No actions match the current filters.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {bars.map((bar) => {
            const widthPct = (bar.total / maxTotal) * 100;
            const overduePct = bar.total > 0 ? (bar.overdue / bar.total) * 100 : 0;
            return (
              <div key={bar.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span>{bar.name}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {bar.total}
                    {bar.overdue > 0 ? (
                      <span style={{ color: "#dc2626", fontWeight: 600 }}>
                        {" "}
                        · {bar.overdue} overdue
                      </span>
                    ) : null}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "var(--ypp-purple)",
                      position: "relative",
                    }}
                  >
                    {/* Overdue portion overlaid at the start of the bar. */}
                    {overduePct > 0 ? (
                      <div
                        style={{
                          width: `${overduePct}%`,
                          height: "100%",
                          background: "#dc2626",
                          borderRadius: 999,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
