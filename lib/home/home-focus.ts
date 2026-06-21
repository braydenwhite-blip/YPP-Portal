import type { LeadershipHomeData } from "./leadership-home";

/**
 * The single most important thing on the calm Home — "what matters most right
 * now". Deterministic: the same data always yields the same focus, chosen from
 * data already loaded for the page (no extra query). Priority, worst first:
 *
 *   1. a meeting happening today (prep it)            → "Meeting today"
 *   2. the worst cross-domain attention loop          → its own reason
 *   3. the most overdue action                        → "Overdue action"
 *   4. the next upcoming meeting                       → "Next meeting"
 *   5. an applicant waiting on a decision             → "Decision needed"
 *
 * Returns null only when nothing needs attention — Home then says "You're clear."
 */

export type HomeFocusTone = "danger" | "warning" | "info" | "brand";

export type HomeFocus = {
  /** Plain category label, e.g. "Overdue action". */
  category: string;
  tone: HomeFocusTone;
  title: string;
  /** One sentence: why this matters. */
  why: string;
  /** Owner / due / time, when known. */
  meta: string | null;
  /** The one obvious next move. */
  primaryLabel: string;
  primaryHref: string;
  /** A stable id so the queue preview can avoid repeating the focus. */
  sourceId: string | null;
};

function sameCalendarDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const ATTENTION_CATEGORY: Record<string, { label: string; tone: HomeFocusTone }> = {
  urgent: { label: "Needs you now", tone: "danger" },
  missing_owner: { label: "Needs an owner", tone: "warning" },
  missing_next_step: { label: "Needs a next step", tone: "warning" },
  stalled: { label: "Stalled", tone: "info" },
  upcoming_risk: { label: "Coming up", tone: "warning" },
  data_incomplete: { label: "Needs detail", tone: "info" },
};

function attentionPrimaryLabel(kind: string): string {
  switch (kind) {
    case "decision":
      return "Review & decide";
    case "meeting":
      return "Open meeting";
    case "action":
      return "Open action";
    case "applicant":
    case "instructor":
      return "Open application";
    default:
      return "Open record";
  }
}

export function buildHomeFocus(data: LeadershipHomeData, now: Date): HomeFocus | null {
  // 1. A meeting happening today — prep beats everything else on the day.
  const meetingToday = data.upcomingMeetings.find((m) => sameCalendarDay(m.startISO, now));
  if (meetingToday) {
    return {
      category: "Meeting today",
      tone: "brand",
      title: meetingToday.title,
      why: "It's on the calendar today — review the agenda and prep before it starts.",
      meta: `${timeLabel(meetingToday.startISO)} · ${meetingToday.categoryLabel}${
        meetingToday.facilitatorName ? ` · ${meetingToday.facilitatorName}` : ""
      }`,
      primaryLabel: "Open meeting prep",
      primaryHref: `/meetings/${meetingToday.id}`,
      sourceId: `meeting:${meetingToday.id}`,
    };
  }

  // 2. The worst cross-domain attention loop (already ranked worst-first).
  const top = data.attention[0];
  if (top) {
    const cat = ATTENTION_CATEGORY[top.category] ?? { label: "Needs attention", tone: "warning" as const };
    return {
      category: cat.label,
      tone: cat.tone,
      title: top.relatedLabel ?? top.title,
      why: top.suggestedStep ? `${top.why} ${top.suggestedStep}` : top.why,
      meta: top.ageLabel ?? null,
      primaryLabel: attentionPrimaryLabel(top.kind),
      primaryHref: top.href,
      sourceId: top.id,
    };
  }

  // 3. The most overdue action.
  const overdue = data.overdueActions[0];
  if (overdue) {
    return {
      category: "Overdue action",
      tone: "danger",
      title: overdue.title,
      why: `It's ${overdue.daysOverdue} day${overdue.daysOverdue === 1 ? "" : "s"} past due${
        overdue.ownerName ? `, owned by ${overdue.ownerName}` : " and unowned"
      }.`,
      meta: overdue.ownerName ?? "Unowned",
      primaryLabel: "Open action",
      primaryHref: overdue.href,
      sourceId: `action:${overdue.id}`,
    };
  }

  // 4. The next upcoming meeting.
  const nextMeeting = data.upcomingMeetings[0];
  if (nextMeeting) {
    return {
      category: "Next meeting",
      tone: "info",
      title: nextMeeting.title,
      why: "Your next meeting — glance at the agenda so nothing surprises you.",
      meta: nextMeeting.categoryLabel,
      primaryLabel: "Open meeting",
      primaryHref: `/meetings/${nextMeeting.id}`,
      sourceId: `meeting:${nextMeeting.id}`,
    };
  }

  // 5. An applicant waiting on a decision.
  const applicant = data.decisionQueue[0];
  if (applicant) {
    return {
      category: "Decision needed",
      tone: "warning",
      title: applicant.displayName,
      why: `Waiting on your decision${
        applicant.daysInQueue != null
          ? ` for ${applicant.daysInQueue} day${applicant.daysInQueue === 1 ? "" : "s"}`
          : ""
      }.`,
      meta: applicant.chapterName,
      primaryLabel: "Open application",
      primaryHref: `/admin/instructor-applicants/${applicant.id}`,
      sourceId: `applicant:${applicant.id}`,
    };
  }

  return null;
}

/** A small "your queue" preview — count + the next loop that ISN'T the focus. */
export type HomeQueuePreview = {
  count: number;
  next: { title: string; why: string; href: string } | null;
};

export function buildHomeQueuePreview(
  data: LeadershipHomeData,
  focus: HomeFocus | null
): HomeQueuePreview {
  const items = data.attention;
  const next = items.find((item) => item.id !== focus?.sourceId) ?? null;
  return {
    count: items.length,
    next: next
      ? { title: next.relatedLabel ?? next.title, why: next.why, href: next.href }
      : null,
  };
}
