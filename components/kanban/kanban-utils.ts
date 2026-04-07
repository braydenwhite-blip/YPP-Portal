/** Convert a STATUS_ENUM to a CSS class for the status pill */
export function statusPillClass(status: string): string {
  const slug = status.toLowerCase().replace(/_/g, "-");
  return `status-pill ${slug}`;
}

/** Format a STATUS_ENUM as a human-readable label */
export function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a date string for display */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** 5-point score bar component helper */
export function scoreBarFillClass(value: number | null, blockNum: number): string {
  if (value == null || blockNum > value) return "score-bar-block empty";
  if (value <= 2) return "score-bar-block filled-low";
  if (value <= 3) return "score-bar-block filled-mid";
  return "score-bar-block filled-high";
}

/** Compute composite score from an array of nullable scores */
export function compositeScore(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/** Format a deadline with urgency context */
export function formatDeadline(
  dueDate: string | null | undefined
): { text: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const dateStr = due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (diffDays < 0) {
    return {
      text: `Overdue by ${Math.abs(diffDays)}d`,
      className: "kanban-card-deadline overdue",
    };
  }
  if (diffDays <= 3) {
    return { text: `Due ${dateStr}`, className: "kanban-card-deadline upcoming" };
  }
  return { text: `Due ${dateStr}`, className: "kanban-card-deadline normal" };
}

/** Recommendation display info */
export function recommendationInfo(
  rec: string | null
): { label: string; className: string } | null {
  if (!rec) return null;
  switch (rec) {
    case "STRONG_YES":
      return { label: "Strong Yes", className: "kanban-card-recommendation strong-yes" };
    case "YES":
      return { label: "Yes", className: "kanban-card-recommendation yes" };
    case "MAYBE":
      return { label: "Maybe", className: "kanban-card-recommendation maybe" };
    case "NO":
      return { label: "No", className: "kanban-card-recommendation no" };
    default:
      return null;
  }
}
