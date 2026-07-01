// Student Advising — the deterministic cockpit selector.
//
// Turns loaded advising data into a guided, lane-based cockpit: briefing chips
// + operating lanes of spotlight cards. Pure and explainable; every card knows
// who/what it's about, why it appears, and the single next action. Each
// assignment resolves to exactly one lifecycle lane (de-duplicated).

import { STRONG_SUGGESTION_SCORE } from "./suggestions";
import { deriveAdvisingLifecycle, isRecentlyCheckedIn } from "./relationship";
import type {
  AdvisingBriefingChip,
  AdvisingCard,
  AdvisingCockpit,
  AdvisingCockpitInput,
  AdvisingLane,
  AdvisingLaneView,
  AdvisingTone,
} from "./types";

const LANE_META: Record<
  AdvisingLane,
  { label: string; blurb: string; emptyTitle: string; emptyBody: string }
> = {
  needs_advisor: {
    label: "Needs advisor",
    blurb: "Students with no active advisor.",
    emptyTitle: "Every student has an advisor",
    emptyBody: "No unassigned students right now. New students will appear here automatically.",
  },
  suggested_matches: {
    label: "Suggested advisor matches",
    blurb: "Unassigned students with a strong advisor match ready.",
    emptyTitle: "No matches waiting",
    emptyBody:
      "Add subject interests to students and advisors to surface suggested matches, or assign manually from Needs advisor.",
  },
  kickoff_needed: {
    label: "Kickoff needed",
    blurb: "Advisor assigned, but the first check-in hasn't happened.",
    emptyTitle: "All kickoffs are underway",
    emptyBody: "Every new pairing has had its first check-in. Newly assigned students will show up here.",
  },
  follow_up_due: {
    label: "Follow-up due",
    blurb: "Check-in overdue, flagged, or gone quiet.",
    emptyTitle: "Everyone is on cadence",
    emptyBody: "No advising relationships are overdue for a check-in. Nicely kept up.",
  },
  needs_reassignment: {
    label: "Needs reassignment",
    blurb: "Stale relationships where the advisor can't keep up.",
    emptyTitle: "No reassignments needed",
    emptyBody: "No students are stuck with an overloaded or inactive advisor.",
  },
  advisor_overloaded: {
    label: "Advisors at capacity",
    blurb: "Advisors carrying a heavy caseload — consider redistributing.",
    emptyTitle: "Caseloads are balanced",
    emptyBody: "No advisor is over capacity. Caseload bands update as you assign students.",
  },
  recommendations_ready: {
    label: "Recommendations ready",
    blurb: "Next-step recommendations waiting on action.",
    emptyTitle: "No recommendations waiting",
    emptyBody: "When advisors recommend a class, project, mentor, or pathway, it'll surface here for review.",
  },
  recently_checked_in: {
    label: "Recently checked in",
    blurb: "Healthy relationships with a recent touchpoint.",
    emptyTitle: "No recent check-ins yet",
    emptyBody: "Logged check-ins from the last few weeks will appear here as a pulse of what's going well.",
  },
};

const LANE_ORDER: AdvisingLane[] = [
  "needs_advisor",
  "suggested_matches",
  "kickoff_needed",
  "follow_up_due",
  "needs_reassignment",
  "advisor_overloaded",
  "recommendations_ready",
  "recently_checked_in",
];

/** Every valid advising lane id (for deep-link `?lane=` validation). Pure. */
export const ADVISING_LANES: readonly AdvisingLane[] = LANE_ORDER;

/**
 * Coerce a raw `?lane=` query value to a real AdvisingLane, or null. Keeps the
 * deep-link contract (Data 360 / Needs Attention / Chapter Impact Meeting →
 * `/operations/advising?lane=<lane>`) honest: an unknown value focuses nothing
 * rather than throwing or half-matching.
 */
export function parseAdvisingLane(value: unknown): AdvisingLane | null {
  return typeof value === "string" && (LANE_ORDER as string[]).includes(value)
    ? (value as AdvisingLane)
    : null;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function interestContext(interests: string[]): string | null {
  const cleaned = interests.map((i) => i.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const shown = cleaned.slice(0, 3).join(", ");
  return cleaned.length > 3 ? `Interests: ${shown} +${cleaned.length - 3}` : `Interests: ${shown}`;
}

export function buildStudentAdvisingCockpit(
  input: AdvisingCockpitInput,
  now: Date = new Date(),
): AdvisingCockpit {
  const buckets: Record<AdvisingLane, AdvisingCard[]> = {
    needs_advisor: [],
    suggested_matches: [],
    kickoff_needed: [],
    follow_up_due: [],
    needs_reassignment: [],
    advisor_overloaded: [],
    recommendations_ready: [],
    recently_checked_in: [],
  };
  const seen = new Set<string>();
  const push = (card: AdvisingCard) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    buckets[card.lane].push(card);
  };

  // ── Unassigned students → Needs advisor / Suggested matches ──────────────
  for (const student of input.unadvisedStudents) {
    const suggestions = input.suggestionsByStudent[student.id] ?? [];
    const top = suggestions[0];
    const hasStrong = !!top && top.score >= STRONG_SUGGESTION_SCORE;
    const context = interestContext(student.interests);
    const where = student.chapterName ? ` · ${student.chapterName}` : "";

    if (hasStrong) {
      push({
        id: `need:${student.id}`,
        lane: "suggested_matches",
        studentId: student.id,
        studentName: student.name,
        advisorId: null,
        advisorName: null,
        assignmentId: null,
        recommendationId: null,
        statusLabel: "Match ready",
        statusTone: "info",
        accentTone: "brand",
        title: student.name,
        subtitle: `Unassigned${where}`,
        why: `No advisor yet — ${top.advisorName} looks like a strong match.`,
        context,
        metaLine: top.reasons.slice(0, 2).join(" · "),
        nextAction: `Review the match and assign ${top.advisorName}.`,
        primaryAction: { kind: "review_suggestion", label: "Review match" },
        secondaryActions: [
          { kind: "assign_advisor", label: "Assign someone else" },
          { kind: "open_student_360", label: "Open student" },
        ],
        suggestion: top,
      });
    } else {
      push({
        id: `need:${student.id}`,
        lane: "needs_advisor",
        studentId: student.id,
        studentName: student.name,
        advisorId: null,
        advisorName: null,
        assignmentId: null,
        recommendationId: null,
        statusLabel: "Needs advisor",
        statusTone: "danger",
        accentTone: "danger",
        title: student.name,
        subtitle: `Unassigned${where}`,
        why: "No advisor assigned yet.",
        context,
        metaLine: null,
        nextAction: "Assign an advisor to this student.",
        primaryAction: { kind: "assign_advisor", label: "Assign advisor" },
        secondaryActions: [
          { kind: "open_student_360", label: "Open student" },
          { kind: "create_advising_action", label: "Create follow-up" },
        ],
        suggestion: top ?? null,
      });
    }
  }

  // ── Active / recently-ended assignments → lifecycle lanes ────────────────
  const advisorById = new Map(input.advisors.map((a) => [a.id, a]));

  for (const a of input.assignments) {
    if (!a.isActive) continue; // ended relationships live in Browse all
    const life = deriveAdvisingLifecycle(a, now);
    const advisor = advisorById.get(a.advisorId);
    const advisorStretched =
      !!advisor && (advisor.band === "HIGH" || advisor.health === "INACTIVE");
    const subtitle = `Advisor: ${a.advisorName} · since ${fmtDate(a.startDate)}`;
    const context = interestContext(a.studentInterests);
    const lastLine =
      life.daysSinceCheckIn === null
        ? "No check-in logged yet."
        : a.lastCheckInAt
          ? `Last check-in ${fmtDate(a.lastCheckInAt)} (${life.daysSinceCheckIn}d ago)`
          : null;

    const base = {
      studentId: a.studentId,
      studentName: a.studentName,
      advisorId: a.advisorId,
      advisorName: a.advisorName,
      assignmentId: a.assignmentId,
      recommendationId: null,
      title: a.studentName,
      subtitle,
      context,
      metaLine: lastLine,
      suggestion: null,
    };

    if (life.lifecycle === "KICKOFF_NEEDED") {
      push({
        ...base,
        id: `asgn:${a.assignmentId}`,
        lane: "kickoff_needed",
        statusLabel: life.label,
        statusTone: life.tone,
        accentTone: life.tone,
        why: life.reason,
        nextAction: life.nextAction,
        primaryAction: { kind: "schedule_kickoff", label: "Schedule kickoff" },
        secondaryActions: [
          { kind: "add_checkin", label: "Log first check-in" },
          { kind: "open_student_360", label: "Student" },
          { kind: "open_advisor_360", label: "Advisor" },
        ],
      });
    } else if (life.lifecycle === "STALE" && advisorStretched) {
      push({
        ...base,
        id: `asgn:${a.assignmentId}`,
        lane: "needs_reassignment",
        statusLabel: "Needs reassignment",
        statusTone: "danger",
        accentTone: "danger",
        why: `${life.reason} Advisor is ${advisor?.band === "HIGH" ? "over capacity" : "inactive"}.`,
        nextAction: "Reassign to an advisor with capacity.",
        primaryAction: { kind: "reassign_advisor", label: "Reassign advisor" },
        secondaryActions: [
          { kind: "add_checkin", label: "Add check-in" },
          { kind: "open_student_360", label: "Student" },
        ],
      });
    } else if (life.lifecycle === "FOLLOW_UP_DUE" || life.lifecycle === "STALE") {
      push({
        ...base,
        id: `asgn:${a.assignmentId}`,
        lane: "follow_up_due",
        statusLabel: life.label,
        statusTone: life.tone,
        accentTone: life.tone,
        why: life.reason,
        nextAction: life.nextAction,
        primaryAction: { kind: "add_checkin", label: "Add check-in" },
        secondaryActions: [
          { kind: "create_followup", label: "Create follow-up" },
          { kind: "reassign_advisor", label: "Reassign" },
          { kind: "open_student_360", label: "Student" },
        ],
      });
    } else if (life.lifecycle === "READY_FOR_NEXT") {
      push({
        ...base,
        id: `asgn:${a.assignmentId}`,
        lane: "recommendations_ready",
        statusLabel: "Ready for next",
        statusTone: "info",
        accentTone: "info",
        why: life.reason,
        nextAction: life.nextAction,
        primaryAction: { kind: "review_recommendation", label: "Recommend next step" },
        secondaryActions: [
          { kind: "open_student_360", label: "Student" },
          { kind: "add_checkin", label: "Add check-in" },
        ],
      });
    } else if (life.lifecycle === "ACTIVE" && isRecentlyCheckedIn(life.daysSinceCheckIn)) {
      push({
        ...base,
        id: `asgn:${a.assignmentId}`,
        lane: "recently_checked_in",
        statusLabel: "On track",
        statusTone: "success",
        accentTone: "success",
        why: life.reason,
        nextAction: life.nextAction,
        primaryAction: { kind: "open_student_360", label: "Open student" },
        secondaryActions: [{ kind: "add_checkin", label: "Log check-in" }],
      });
    }
    // ACTIVE but not recently checked in → Browse all only (keeps lanes calm).
  }

  // ── Overloaded advisors ──────────────────────────────────────────────────
  for (const advisor of input.advisors) {
    if (advisor.band !== "HIGH") continue;
    push({
      id: `adv:${advisor.id}`,
      lane: "advisor_overloaded",
      studentId: null,
      studentName: null,
      advisorId: advisor.id,
      advisorName: advisor.name,
      assignmentId: null,
      recommendationId: null,
      statusLabel: "At capacity",
      statusTone: "warning",
      accentTone: "warning",
      title: advisor.name,
      subtitle: `${advisor.activeCount} active students`,
      why: `${advisor.name} has ${advisor.activeCount} active students; consider redistributing.`,
      context: advisor.chapterName,
      metaLine:
        advisor.needsFollowUpCount > 0
          ? `${advisor.needsFollowUpCount} need follow-up`
          : "Caseload is full but current",
      nextAction: "Review the caseload and reassign a few students.",
      primaryAction: { kind: "open_advisor_360", label: "Review caseload" },
      secondaryActions: [{ kind: "create_advising_action", label: "Create action" }],
      suggestion: null,
    });
  }

  // ── Pending recommendations waiting on action ────────────────────────────
  for (const a of input.assignments) {
    for (const rec of a.pendingRecommendations) {
      push({
        id: `rec:${rec.id}`,
        lane: "recommendations_ready",
        studentId: rec.studentId,
        studentName: rec.studentName,
        advisorId: rec.advisorId,
        advisorName: rec.advisorName,
        assignmentId: rec.assignmentId,
        recommendationId: rec.id,
        statusLabel: "Recommendation",
        statusTone: "info",
        accentTone: "brand",
        title: rec.title,
        subtitle: `${rec.kind.toLowerCase()} for ${rec.studentName} · from ${rec.advisorName}`,
        why: "A next-step recommendation was added but hasn't been acted on.",
        context: rec.detail,
        metaLine: `Added ${fmtDate(rec.createdAt)}`,
        nextAction: "Review and mark it in progress or done.",
        primaryAction: { kind: "review_recommendation", label: "Review recommendation" },
        secondaryActions: [{ kind: "open_student_360", label: "Student" }],
        suggestion: null,
      });
    }
  }

  const lanes: AdvisingLaneView[] = LANE_ORDER.map((lane) => ({
    lane,
    label: LANE_META[lane].label,
    blurb: LANE_META[lane].blurb,
    cards: buckets[lane],
    total: buckets[lane].length,
    emptyTitle: LANE_META[lane].emptyTitle,
    emptyBody: LANE_META[lane].emptyBody,
  }));

  const count = (lane: AdvisingLane) => buckets[lane].length;
  const chip = (
    key: string,
    label: string,
    n: number,
    tone: AdvisingTone,
    lane: AdvisingLane | null,
  ): AdvisingBriefingChip => ({ key, label, count: n, tone, lane });

  const needsAdvisorTotal = count("needs_advisor") + count("suggested_matches");
  const briefing: AdvisingBriefingChip[] = [
    chip("needs_advisor", "Students needing advisor", needsAdvisorTotal, needsAdvisorTotal > 0 ? "danger" : "success", "needs_advisor"),
    chip("kickoff", "Kickoffs not scheduled", count("kickoff_needed"), count("kickoff_needed") > 0 ? "warning" : "success", "kickoff_needed"),
    chip("follow_up", "Follow-ups due", count("follow_up_due"), count("follow_up_due") > 0 ? "warning" : "success", "follow_up_due"),
    chip("capacity", "Advisors at capacity", count("advisor_overloaded"), count("advisor_overloaded") > 0 ? "warning" : "success", "advisor_overloaded"),
    chip("recs", "Recommendations waiting", count("recommendations_ready"), count("recommendations_ready") > 0 ? "info" : "neutral", "recommendations_ready"),
    chip("recent", "Recent check-ins", count("recently_checked_in"), "success", "recently_checked_in"),
  ];

  const totalSituations =
    needsAdvisorTotal +
    count("kickoff_needed") +
    count("follow_up_due") +
    count("needs_reassignment") +
    count("advisor_overloaded") +
    count("recommendations_ready");

  return {
    briefing,
    lanes,
    totalSituations,
    generatedAtISO: now.toISOString(),
  };
}
