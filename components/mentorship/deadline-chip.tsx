/**
 * DeadlineChip — single source for soft-deadline color coding across all
 * mentorship cycle surfaces (Phase 0.95).
 *
 * Thresholds (days until deadline):
 *   > 3    → green
 *   0–3    → yellow
 *   < 0    → orange if within grace window, red if past grace
 *
 * When `completedAt` is set the chip renders neutral "Submitted" regardless.
 */
type Props = {
  softDeadline: Date;
  graceDeadline?: Date | null;
  completedAt?: Date | null;
  label?: string;
};

const GRACE_WINDOW_MS = 10 * 24 * 60 * 60 * 1000; // 10 days default

function formatRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days > 0) return `in ${days}d`;
  return `${-days}d overdue`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DeadlineChip({ softDeadline, graceDeadline, completedAt, label }: Props) {
  const now = new Date();
  let bg = "#dcfce7"; // green-100
  let color = "#166534"; // green-800
  let text = `Due ${formatRelative(softDeadline, now)}`;

  if (completedAt) {
    bg = "#f3f4f6";
    color = "#4b5563";
    text = `Submitted ${formatShortDate(completedAt)}`;
  } else {
    const diffMs = softDeadline.getTime() - now.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    const grace = graceDeadline ?? new Date(softDeadline.getTime() + GRACE_WINDOW_MS);
    if (days > 3) {
      bg = "#dcfce7";
      color = "#166534";
    } else if (days >= 0) {
      bg = "#fef9c3";
      color = "#854d0e";
    } else if (now <= grace) {
      bg = "#ffedd5";
      color = "#9a3412";
      text = "Overdue — grace period";
    } else {
      bg = "#fee2e2";
      color = "#991b1b";
      text = `Overdue`;
    }
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "0.15rem 0.55rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label ? `${label}: ` : ""}
      {text}
    </span>
  );
}
