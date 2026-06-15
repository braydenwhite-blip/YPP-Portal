import Link from "next/link";

import type {
  AttentionCategory,
  AttentionItem,
  AttentionSeverity,
} from "@/lib/people-strategy/needs-attention";

/**
 * People Strategy — shared "Needs Attention" renderer.
 *
 * Presentational list for the unified `AttentionItem[]` produced by
 * `lib/people-strategy/needs-attention.ts`. Used by the Operations Command Center
 * (leadership-wide) and Person 360 (one person) so every surface renders the same
 * severity chip, category, plain-language reason, recommended next action, and a
 * link to the relevant page — no per-page urgency styling.
 */

const SEVERITY_STYLE: Record<AttentionSeverity, { label: string; bg: string; fg: string }> = {
  critical: { label: "Critical", bg: "#fee2e2", fg: "#b91c1c" },
  high: { label: "High", bg: "#ffedd5", fg: "#c2410c" },
  medium: { label: "Medium", bg: "#fef9c3", fg: "#a16207" },
  low: { label: "Low", bg: "#f1f5f9", fg: "#475569" },
};

const CATEGORY_LABEL: Record<AttentionCategory, string> = {
  ACTION_OVERDUE: "Overdue action",
  ACTION_DUE_SOON: "Due soon",
  ACTION_BLOCKED: "Blocked",
  ACTION_STALE: "Stale",
  ACTION_MISSING_OWNER: "No owner",
  ACTION_MISSING_DUE_DATE: "No due date",
  MEETING_MISSING_AGENDA: "Meeting agenda",
  MEETING_MISSING_NOTES: "Meeting notes",
  MEETING_DEFERRED_ITEM: "Deferred item",
  FEEDBACK_OVERDUE: "Feedback overdue",
  CHECK_IN_OVERDUE: "Check-in overdue",
  QUARTERLY_REVIEW_DUE: "Quarterly review",
  PROVISIONAL_DECISION_DUE: "Provisional decision",
  PROVISIONAL_DECISION_OVERDUE: "Provisional overdue",
  MISSING_MENTOR: "No mentor",
  MENTOR_KICKOFF_OVERDUE: "Kickoff overdue",
  PENDING_MENTOR_RECOMMENDATION: "Mentor recommendation",
  MENTOR_OVERLOAD: "Mentor overload",
  HIGH_WORKLOAD: "High workload",
  CLASS_MISSING_INSTRUCTOR: "Class staffing",
  CLASS_BLOCKER: "Class blocker",
  ESCALATION_AWAITING_REVIEW: "Escalation",
};

const CATEGORY_NEXT_ACTION: Record<AttentionCategory, string> = {
  ACTION_OVERDUE: "Update status or reassign",
  ACTION_DUE_SOON: "Confirm it's on track",
  ACTION_BLOCKED: "Clear the blocker",
  ACTION_STALE: "Post a status update",
  ACTION_MISSING_OWNER: "Assign an accountable lead",
  ACTION_MISSING_DUE_DATE: "Set a due date",
  MEETING_MISSING_AGENDA: "Build the agenda",
  MEETING_MISSING_NOTES: "Add meeting notes",
  MEETING_DEFERRED_ITEM: "Carry forward or close",
  FEEDBACK_OVERDUE: "Send a reminder",
  CHECK_IN_OVERDUE: "Start the monthly check-in",
  QUARTERLY_REVIEW_DUE: "Start the quarterly review",
  PROVISIONAL_DECISION_DUE: "Make the Month-3 decision",
  PROVISIONAL_DECISION_OVERDUE: "Confirm or change the role now",
  MISSING_MENTOR: "Assign a mentor",
  MENTOR_KICKOFF_OVERDUE: "Schedule the kickoff",
  PENDING_MENTOR_RECOMMENDATION: "Review the recommendation",
  MENTOR_OVERLOAD: "Rebalance mentee load",
  HIGH_WORKLOAD: "Rebalance their workload",
  CLASS_MISSING_INSTRUCTOR: "Assign an instructor",
  CLASS_BLOCKER: "Resolve the blocker",
  ESCALATION_AWAITING_REVIEW: "Review and resolve",
};

/** Where each attention item links — the page/drawer that resolves it. */
function hrefFor(item: AttentionItem): string {
  switch (item.subjectKind) {
    case "action":
      return `/actions/${item.subjectId}`;
    case "person":
      return `/people/${item.subjectId}`;
    case "meeting":
      return `/actions/meetings/${item.subjectId}`;
    case "class":
      return `/people/classes`;
    default:
      return "/operations/command-center";
  }
}

export function NeedsAttentionList({
  items,
  emptyHint,
  limit,
}: {
  items: AttentionItem[];
  emptyHint?: string;
  limit?: number;
}) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
        {emptyHint ?? "Nothing needs attention right now."}
      </p>
    );
  }

  const shown = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {shown.map((item, index) => {
        const sev = SEVERITY_STYLE[item.severity];
        return (
          <li key={`${item.category}-${item.subjectId}-${index}`}>
            <Link
              href={hrefFor(item)}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--ps-border, #e5e7eb)",
                background: "var(--ps-surface, #fff)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: sev.bg,
                  color: sev.fg,
                }}
              >
                {sev.label}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ps-text, #111827)",
                  }}
                >
                  {item.subjectLabel}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--muted, #6b7280)" }}>
                  <strong style={{ fontWeight: 600 }}>{CATEGORY_LABEL[item.category]}</strong>
                  {" · "}
                  {item.reason}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 12,
                    color: "var(--ypp-purple, #6b21c8)",
                    fontWeight: 600,
                  }}
                >
                  Next: {CATEGORY_NEXT_ACTION[item.category]} →
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
