"use client";

import { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JourneyStep {
  id: string;
  title: string;
  type: "class" | "lab" | "standalone";
  prerequisites: string[]; // IDs
}

export interface StudentProgress {
  stepId: string;
  completed: boolean;
  unlockedAt?: string | null;
}

interface SequenceStudentViewProps {
  steps: JourneyStep[];
  studentProgress: StudentProgress[];
  onStartStep?: (stepId: string) => void;
}

// ─── Layout algorithm ─────────────────────────────────────────────────────────

/**
 * Topological sort and assign rows based on longest path from any root.
 * Steps at the same depth are shown side-by-side.
 */
function computeLayout(steps: JourneyStep[]): Map<string, { row: number; col: number }> {
  const stepMap = new Map<string, JourneyStep>();
  for (const s of steps) stepMap.set(s.id, s);

  // Compute longest path from root for each node (depth)
  const depth = new Map<string, number>();

  function getDepth(id: string): number {
    if (depth.has(id)) return depth.get(id)!;

    const step = stepMap.get(id);
    if (!step || step.prerequisites.length === 0) {
      depth.set(id, 0);
      return 0;
    }

    let maxPrereqDepth = 0;
    for (const prereqId of step.prerequisites) {
      if (stepMap.has(prereqId)) {
        maxPrereqDepth = Math.max(maxPrereqDepth, getDepth(prereqId) + 1);
      }
    }
    depth.set(id, maxPrereqDepth);
    return maxPrereqDepth;
  }

  // Calculate depth for all steps
  for (const s of steps) getDepth(s.id);

  // Group by row (depth), assign column within each row
  const rowGroups = new Map<number, string[]>();
  for (const s of steps) {
    const d = depth.get(s.id) ?? 0;
    if (!rowGroups.has(d)) rowGroups.set(d, []);
    rowGroups.get(d)!.push(s.id);
  }

  const layout = new Map<string, { row: number; col: number }>();
  for (const [row, ids] of rowGroups) {
    ids.forEach((id, col) => layout.set(id, { row, col }));
  }

  return layout;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_WIDTH = 220;
const CARD_HEIGHT = 90;
const ROW_GAP = 60;
const COL_GAP = 24;
const CONNECTOR_COLOR = "var(--border, #d1d5db)";

const TYPE_ICONS: Record<string, string> = {
  class: "\u{1F4DA}",
  lab: "\u{1F52C}",
  standalone: "\u{1F4DD}",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SequenceStudentView({
  steps,
  studentProgress,
  onStartStep,
}: SequenceStudentViewProps) {
  const progressMap = useMemo(() => {
    const m = new Map<string, StudentProgress>();
    for (const p of studentProgress) m.set(p.stepId, p);
    return m;
  }, [studentProgress]);

  const layout = useMemo(() => computeLayout(steps), [steps]);

  const stepMap = useMemo(() => {
    const m = new Map<string, JourneyStep>();
    for (const s of steps) m.set(s.id, s);
    return m;
  }, [steps]);

  // Determine step status
  function getStatus(stepId: string): "completed" | "unlocked" | "locked" {
    const p = progressMap.get(stepId);
    if (p?.completed) return "completed";

    const step = stepMap.get(stepId);
    if (!step) return "locked";

    // A step is unlocked if all prerequisites are completed
    const allPrereqsDone = step.prerequisites.every((pid) => {
      const pp = progressMap.get(pid);
      return pp?.completed;
    });

    if (step.prerequisites.length === 0) return p ? "unlocked" : "unlocked"; // entry points are always unlocked
    if (allPrereqsDone) return "unlocked";
    return "locked";
  }

  // Get names of incomplete prerequisites
  function getBlockingPrereqs(stepId: string): string[] {
    const step = stepMap.get(stepId);
    if (!step) return [];
    return step.prerequisites
      .filter((pid) => !progressMap.get(pid)?.completed)
      .map((pid) => stepMap.get(pid)?.title ?? "Unknown")
      .filter(Boolean);
  }

  // Calculate total rows and max columns
  const maxRow = Math.max(0, ...Array.from(layout.values()).map((l) => l.row));
  const rowCounts = new Map<number, number>();
  for (const l of layout.values()) {
    rowCounts.set(l.row, Math.max(rowCounts.get(l.row) ?? 0, l.col + 1));
  }
  const maxCols = Math.max(1, ...Array.from(rowCounts.values()));

  const totalWidth = maxCols * (CARD_WIDTH + COL_GAP) - COL_GAP + 40;
  const totalHeight = (maxRow + 1) * (CARD_HEIGHT + ROW_GAP) - ROW_GAP + 40;

  // Build connection lines
  const connections: { fromX: number; fromY: number; toX: number; toY: number }[] = [];
  for (const step of steps) {
    const toLoc = layout.get(step.id);
    if (!toLoc) continue;
    const colsInToRow = rowCounts.get(toLoc.row) ?? 1;
    const toRowOffset = (maxCols - colsInToRow) * (CARD_WIDTH + COL_GAP) / 2;
    const toX = toRowOffset + toLoc.col * (CARD_WIDTH + COL_GAP) + CARD_WIDTH / 2 + 20;
    const toY = toLoc.row * (CARD_HEIGHT + ROW_GAP) + 20;

    for (const prereqId of step.prerequisites) {
      const fromLoc = layout.get(prereqId);
      if (!fromLoc) continue;
      const colsInFromRow = rowCounts.get(fromLoc.row) ?? 1;
      const fromRowOffset = (maxCols - colsInFromRow) * (CARD_WIDTH + COL_GAP) / 2;
      const fromX = fromRowOffset + fromLoc.col * (CARD_WIDTH + COL_GAP) + CARD_WIDTH / 2 + 20;
      const fromY = fromLoc.row * (CARD_HEIGHT + ROW_GAP) + CARD_HEIGHT + 20;
      connections.push({ fromX, fromY, toX, toY });
    }
  }

  if (steps.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--muted, #6b7280)",
          fontSize: 14,
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 16 }}>No steps in this pathway yet.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        padding: "20px 0",
      }}
    >
      <div
        style={{
          position: "relative",
          width: totalWidth,
          height: totalHeight,
          margin: "0 auto",
          minWidth: "fit-content",
        }}
      >
        {/* SVG connections */}
        <svg
          width={totalWidth}
          height={totalHeight}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          <defs>
            <marker
              id="student-view-arrow"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 8 3, 0 6" fill={CONNECTOR_COLOR} />
            </marker>
          </defs>
          {connections.map((c, i) => (
            <line
              key={i}
              x1={c.fromX}
              y1={c.fromY}
              x2={c.toX}
              y2={c.toY}
              stroke={CONNECTOR_COLOR}
              strokeWidth={2}
              markerEnd="url(#student-view-arrow)"
            />
          ))}
        </svg>

        {/* Step cards */}
        {steps.map((step) => {
          const loc = layout.get(step.id);
          if (!loc) return null;

          const status = getStatus(step.id);
          const colsInRow = rowCounts.get(loc.row) ?? 1;
          const rowOffset = (maxCols - colsInRow) * (CARD_WIDTH + COL_GAP) / 2;
          const x = rowOffset + loc.col * (CARD_WIDTH + COL_GAP) + 20;
          const y = loc.row * (CARD_HEIGHT + ROW_GAP) + 20;

          let background = "#fff";
          let borderColor = "var(--border, #e5e7eb)";
          let opacity = 1;

          if (status === "completed") {
            background = "#f0fdf4";
            borderColor = "#22c55e";
          } else if (status === "unlocked") {
            background = "#fff";
            borderColor = "var(--ypp-purple, #6b21c8)";
          } else {
            background = "#f9fafb";
            borderColor = "var(--border, #e5e7eb)";
            opacity = 0.7;
          }

          const blockingPrereqs = status === "locked" ? getBlockingPrereqs(step.id) : [];

          return (
            <div
              key={step.id}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                background,
                border: `2px solid ${borderColor}`,
                borderRadius: "var(--radius-md, 8px)",
                padding: "10px 12px",
                boxSizing: "border-box",
                opacity,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: status === "unlocked" ? `0 0 0 2px ${borderColor}30` : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {/* Top: icon + title */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {status === "completed" ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : status === "locked" ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted, #9ca3af)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {TYPE_ICONS[step.type] ?? ""}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: status === "locked" ? "var(--muted, #9ca3af)" : "var(--foreground, #111)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.title || "Untitled Step"}
                </span>
              </div>

              {/* Bottom: action or lock message */}
              <div>
                {status === "completed" && (
                  <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
                    Completed
                  </span>
                )}
                {status === "unlocked" && onStartStep && (
                  <button
                    onClick={() => onStartStep(step.id)}
                    style={{
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "var(--ypp-purple, #6b21c8)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {progressMap.get(step.id) ? "Continue" : "Start"}
                  </button>
                )}
                {status === "locked" && blockingPrereqs.length > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--muted, #9ca3af)",
                      lineHeight: 1.3,
                      display: "block",
                    }}
                  >
                    Complete {blockingPrereqs.slice(0, 2).join(", ")}
                    {blockingPrereqs.length > 2
                      ? ` +${blockingPrereqs.length - 2} more`
                      : ""}{" "}
                    first
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
