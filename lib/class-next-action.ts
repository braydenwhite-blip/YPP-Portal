/**
 * Class Next Action — the single helper that decides the ONE primary action a
 * class needs next, chosen from concrete missing or urgent data (never a fake
 * "health score").
 *
 * This is the key simplification of the Classes command center: the system, not
 * the officer, decides what to do next. The SAME helper feeds three surfaces so
 * they can never disagree:
 *   - the class row action on the main Classes page,
 *   - the "Needs action" queue at the top of that page,
 *   - the Class 360 drawer hero CTA.
 *
 * Every function here is PURE (no DB, no session; callers inject `now`) and
 * unit-tested, mirroring the convention in lib/operations/signals.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Window in which an upcoming session counts as "soon" / actionable. */
export const NEXT_SESSION_SOON_DAYS = 7;

/** How recently a class must have ended to read as "recently completed". */
export const RECENTLY_COMPLETED_DAYS = 30;

export type ClassNextActionKind =
  | "assign_instructor"
  | "add_session"
  | "add_roster"
  | "confirm_partner"
  | "review_actions"
  | "view_session_plan"
  | "add_notes"
  | "request_feedback"
  | "view_class";

export type ClassSignalTone = "danger" | "warning" | "info" | "neutral" | "success";

/**
 * The concrete facts about a class the helpers reason over. Every field is a
 * plain value the caller resolves from the data model — keeping the decision
 * logic pure and exhaustively testable.
 */
export type ClassSignals = {
  /** ClassOfferingStatus string (DRAFT | PUBLISHED | IN_PROGRESS | COMPLETED | CANCELLED). */
  status: string;
  startDate: Date;
  endDate: Date;
  /** Always true today (instructorId is non-nullable) — modelled for robustness. */
  hasLeadInstructor: boolean;
  /** Count of scheduled ClassSession rows. */
  sessionCount: number;
  /** Earliest upcoming (non-cancelled) session, or null. */
  nextSessionAt: Date | null;
  /** Confirmed (ENROLLED) student count. */
  enrolledCount: number;
  /** A Partner is linked to the class. */
  partnerLinked: boolean;
  /** The linked partner still needs confirmation (requires a schema flag — see note). */
  partnerConfirmationNeeded: boolean;
  /** Open (not complete/dropped) linked actions. */
  openActionCount: number;
  /** Overdue linked actions. */
  overdueActionCount: number;
  /** Instructor post-class reflection has been recorded. */
  hasReflection: boolean;
  /** Number of student feedback responses collected. */
  feedbackCount: number;
};

export type ClassNextAction = {
  kind: ClassNextActionKind;
  /** Imperative button text, plain English. */
  label: string;
  /** The exact issue in one short phrase. Empty for the "all current" case. */
  reason: string;
  tone: ClassSignalTone;
  /** Rank 1 (most urgent) … 9 (all current). Lower sorts first. */
  priority: number;
  /** True when the action belongs in the "Needs action" queue (priority 1–5). */
  urgent: boolean;
};

const ACTION_META: Record<
  ClassNextActionKind,
  { label: string; tone: ClassSignalTone; priority: number; urgent: boolean }
> = {
  assign_instructor: { label: "Assign instructor", tone: "danger", priority: 1, urgent: true },
  add_session: { label: "Add session", tone: "danger", priority: 2, urgent: true },
  add_roster: { label: "Add roster", tone: "warning", priority: 3, urgent: true },
  confirm_partner: { label: "Confirm partner", tone: "warning", priority: 4, urgent: true },
  review_actions: { label: "Review actions", tone: "warning", priority: 5, urgent: true },
  view_session_plan: { label: "View session plan", tone: "info", priority: 6, urgent: false },
  add_notes: { label: "Add notes", tone: "info", priority: 7, urgent: false },
  request_feedback: { label: "Request feedback", tone: "info", priority: 8, urgent: false },
  view_class: { label: "View class", tone: "neutral", priority: 9, urgent: false },
};

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pluralActions(n: number): string {
  return `${n} ${n === 1 ? "action" : "actions"}`;
}

function action(kind: ClassNextActionKind, reason: string): ClassNextAction {
  return { kind, reason, ...ACTION_META[kind] };
}

function isCompleted(signals: ClassSignals, now: Date): boolean {
  return signals.status === "COMPLETED" || signals.endDate.getTime() < now.getTime();
}

/**
 * The ONE primary action a class needs next, in strict priority order:
 *   1. Missing lead instructor → Assign instructor
 *   2. No schedule / no sessions → Add session
 *   3. Missing roster → Add roster
 *   4. Partner not confirmed → Confirm partner
 *   5. Overdue class action → Review actions
 *   6. Upcoming session soon → View session plan
 *   7. Missing post-class reflection → Add notes
 *   8. Missing feedback → Request feedback
 *   9. Everything current → View class
 *
 * Steps 1–4 and 6 only apply while a class is still being delivered; 7–8 only
 * apply once it has finished. Overdue actions (5) matter at every stage.
 */
export function deriveClassNextAction(
  signals: ClassSignals,
  now: Date = new Date()
): ClassNextAction {
  if (signals.status === "CANCELLED") return action("view_class", "");

  const completed = isCompleted(signals, now);

  if (!completed) {
    if (!signals.hasLeadInstructor) {
      return action("assign_instructor", "No lead instructor assigned");
    }
    if (signals.sessionCount === 0) {
      return action("add_session", "No sessions scheduled");
    }
    if (signals.enrolledCount === 0) {
      return action("add_roster", "Student roster is empty");
    }
    if (signals.partnerConfirmationNeeded) {
      return action("confirm_partner", "Partner not confirmed");
    }
  }

  if (signals.overdueActionCount > 0) {
    return action("review_actions", `${pluralActions(signals.overdueActionCount)} overdue`);
  }

  if (!completed && signals.nextSessionAt) {
    const at = signals.nextSessionAt.getTime();
    const soon = at <= now.getTime() + NEXT_SESSION_SOON_DAYS * DAY_MS;
    const notLongPast = at >= now.getTime() - DAY_MS;
    if (soon && notLongPast) {
      return action("view_session_plan", `Next session ${shortDate(signals.nextSessionAt)}`);
    }
  }

  if (completed) {
    if (!signals.hasReflection) {
      return action("add_notes", "Missing post-class reflection");
    }
    if (signals.feedbackCount === 0) {
      return action("request_feedback", "No feedback collected yet");
    }
  }

  return action("view_class", "");
}

/** Where each primary action lands. All routes already exist under /admin/classes. */
export function classNextActionHref(kind: ClassNextActionKind, offeringId: string): string {
  const base = `/admin/classes/${offeringId}`;
  switch (kind) {
    case "assign_instructor":
    case "confirm_partner":
      return `${base}/settings`;
    case "add_roster":
      return `${base}/roster`;
    case "add_notes":
    case "request_feedback":
      return `${base}/feedback`;
    case "add_session":
    case "review_actions":
    case "view_session_plan":
    case "view_class":
    default:
      return base;
  }
}

// --- plain-English status language --------------------------------------------------

export type ClassStatusLabel = { label: string; tone: ClassSignalTone };

/**
 * A short, plain-English workflow status backed by exact visible facts — never
 * an abstract score. Reads the same signals as {@link deriveClassNextAction} so
 * the row's status and its action always tell a consistent story.
 */
export function deriveClassStatusLabel(
  signals: ClassSignals,
  now: Date = new Date()
): ClassStatusLabel {
  if (signals.status === "CANCELLED") return { label: "Cancelled", tone: "neutral" };

  const completed = isCompleted(signals, now);
  if (completed) {
    if (!signals.hasReflection) return { label: "Needs reflection", tone: "info" };
    return { label: "Completed", tone: "neutral" };
  }

  if (!signals.hasLeadInstructor) return { label: "Missing instructor", tone: "danger" };
  if (signals.sessionCount === 0) return { label: "No schedule", tone: "danger" };
  if (signals.enrolledCount === 0) return { label: "Roster missing", tone: "warning" };
  if (signals.partnerConfirmationNeeded) {
    return { label: "Partner confirmation needed", tone: "warning" };
  }
  if (signals.overdueActionCount > 0) {
    return { label: `${pluralActions(signals.overdueActionCount)} overdue`, tone: "warning" };
  }
  if (signals.nextSessionAt) {
    const at = signals.nextSessionAt.getTime();
    if (at <= now.getTime() + NEXT_SESSION_SOON_DAYS * DAY_MS && at >= now.getTime() - DAY_MS) {
      return { label: `Next session ${shortDate(signals.nextSessionAt)}`, tone: "success" };
    }
  }
  if (signals.openActionCount > 0) {
    return { label: `${pluralActions(signals.openActionCount)} open`, tone: "info" };
  }
  return { label: "Ready for next session", tone: "success" };
}

// --- "This term" strip aggregation --------------------------------------------------

export type ThisTermCounts = {
  active: number;
  upcoming: number;
  missingInstructor: number;
  missingSchedule: number;
  openActions: number;
  partnerConnected: number;
  recentlyCompleted: number;
};

function isTerminal(status: string): boolean {
  return status === "CANCELLED" || status === "COMPLETED";
}

/** Factual counts across a set of classes — no scores, no vague labels. */
export function deriveThisTermCounts(
  rows: ClassSignals[],
  now: Date = new Date()
): ThisTermCounts {
  const counts: ThisTermCounts = {
    active: 0,
    upcoming: 0,
    missingInstructor: 0,
    missingSchedule: 0,
    openActions: 0,
    partnerConnected: 0,
    recentlyCompleted: 0,
  };

  for (const row of rows) {
    const completed = isCompleted(row, now);
    const terminal = isTerminal(row.status);

    if (
      (row.status === "PUBLISHED" || row.status === "IN_PROGRESS") &&
      !completed
    ) {
      counts.active += 1;
    }
    if (!terminal && row.startDate.getTime() > now.getTime()) {
      counts.upcoming += 1;
    }
    if (!completed && !terminal && !row.hasLeadInstructor) {
      counts.missingInstructor += 1;
    }
    if (!completed && !terminal && row.sessionCount === 0) {
      counts.missingSchedule += 1;
    }
    if (row.openActionCount > 0) {
      counts.openActions += 1;
    }
    if (row.partnerLinked) {
      counts.partnerConnected += 1;
    }
    if (
      row.status === "COMPLETED" &&
      row.endDate.getTime() >= now.getTime() - RECENTLY_COMPLETED_DAYS * DAY_MS
    ) {
      counts.recentlyCompleted += 1;
    }
  }

  return counts;
}

// --- "Needs action" queue -----------------------------------------------------------

export type NeedsActionItem = {
  id: string;
  title: string;
  /** The exact issue, e.g. "No sessions scheduled". */
  reason: string;
  /** Connected partner/program, surfaced when relevant. */
  context: string | null;
  action: ClassNextAction;
  href: string;
};

/**
 * The short list of the most important class issues to act on now. Only urgent
 * actions (priority 1–5) qualify, sorted worst-first, capped so the section
 * stays scannable.
 */
export function buildNeedsAction(
  rows: Array<ClassSignals & { id: string; title: string; partnerName: string | null }>,
  now: Date = new Date(),
  limit = 6
): NeedsActionItem[] {
  const items: NeedsActionItem[] = [];
  for (const row of rows) {
    const next = deriveClassNextAction(row, now);
    if (!next.urgent) continue;
    items.push({
      id: row.id,
      title: row.title,
      reason: next.reason,
      context: row.partnerName,
      action: next,
      href: classNextActionHref(next.kind, row.id),
    });
  }
  items.sort((a, b) => a.action.priority - b.action.priority);
  return items.slice(0, limit);
}
