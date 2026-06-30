// ============================================================================
// ESCALATION ENGINE (Phase 13)
// ============================================================================
//
// A pure read model that decides which chapter conditions should rise to GLOBAL
// LEADERSHIP, with the reason, the evidence, the recommended leadership action,
// and a link to the source. It does NOT send notifications — escalations surface
// in the leadership read model (and on automation items via the `escalation`
// field). Deterministic (pass `now`).

import type { ChapterFacts, AutomationSeverity, AutomationItemType } from "@/lib/automation/types";
import type { ChapterReadiness } from "@/lib/automation/readiness";
import type { PlaybookInterpretation } from "@/lib/automation/playbook";

export type ChapterEscalation = {
  id: string;
  chapterId: string;
  chapterName: string;
  type: AutomationItemType;
  severity: AutomationSeverity;
  /** Short headline, e.g. "No confirmed partner by Week 6". */
  title: string;
  /** Why this rose above the Chapter President. */
  why: string;
  /** Concrete evidence (numbers). */
  evidence: string;
  /** What global leadership should do. */
  recommendedLeadershipAction: string;
  /** Where to look. */
  sourceHref: string;
  /** The current owner (chapter president), when known. */
  ownerId: string | null;
};

/**
 * Derive global-leadership escalations for ONE chapter from its facts, readiness
 * and playbook interpretation. Each rule is a concrete, evidence-backed
 * condition from the CP guide — not a heuristic score.
 */
export function buildChapterEscalations(
  facts: ChapterFacts,
  readiness: ChapterReadiness,
  playbook: PlaybookInterpretation,
  now: Date
): ChapterEscalation[] {
  const out: ChapterEscalation[] = [];
  const href = `/admin/chapters/${facts.chapterId}`;
  const base = { chapterId: facts.chapterId, chapterName: facts.chapterName, sourceHref: href, ownerId: facts.presidentId };
  const week = facts.weekNumber;

  // 1) No confirmed partner by the expected deadline (guide: by Week 6).
  if (week >= 6 && facts.partnersConfirmed === 0) {
    out.push({
      ...base,
      id: `escalation:no-partner:${facts.chapterId}`,
      type: "PARTNER_LOGISTICS_INCOMPLETE",
      severity: "BLOCKING",
      title: "No confirmed partner by Week 6",
      why: `It is Week ${week} and the chapter still has no confirmed partner — it cannot launch without one.`,
      evidence: `${facts.partnersContacted} contacted, ${facts.partnersMeetingScheduled + facts.partnersMeetingsCompleted} meeting(s), 0 confirmed.`,
      recommendedLeadershipAction: "Join a partner conversation or open national connections to close a partner.",
    });
  }

  // 2) Curriculum review severely overdue.
  if (facts.curriculaCpReviewOverdue >= 2 || (facts.curriculaCpReviewOverdue >= 1 && week >= 6)) {
    out.push({
      ...base,
      id: `escalation:curriculum-overdue:${facts.chapterId}`,
      type: "CURRICULUM_REVISION_OVERDUE",
      severity: "URGENT",
      title: "Curriculum reviews severely overdue",
      why: `${facts.curriculaCpReviewOverdue} curriculum review(s) are past the 48-hour SLA, holding up launch readiness.`,
      evidence: `${facts.curriculaCpReviewOverdue} overdue · ${facts.curriculaApproved}/${facts.curriculaSubmitted} fully approved.`,
      recommendedLeadershipAction: "Reassign or assist the reviews so curriculum can clear before launch.",
    });
  }

  // 3) Under-enrolled classes near launch.
  if (facts.classesUnderEnrolled > 0 && readiness.daysUntilLaunch != null && readiness.daysUntilLaunch <= 14) {
    out.push({
      ...base,
      id: `escalation:under-enrolled:${facts.chapterId}`,
      type: "ENROLLMENT_LOW",
      severity: "URGENT",
      title: "Under-enrolled classes near launch",
      why: `${facts.classesUnderEnrolled} class(es) are under-enrolled with launch ${readiness.daysUntilLaunch <= 0 ? "here" : `in ${readiness.daysUntilLaunch} day(s)`}.`,
      evidence: `${facts.enrollmentTotal} enrolled across ${facts.classesTotal} class(es); ${facts.classesUnderEnrolled} below target.`,
      recommendedLeadershipAction: "Help amplify advertising or decide whether to combine/postpone classes.",
    });
  }

  // 4) Launch approaching with blocking readiness gaps.
  if (readiness.daysUntilLaunch != null && readiness.daysUntilLaunch <= 14 && readiness.blockingGaps.length > 0) {
    out.push({
      ...base,
      id: `escalation:launch-risk:${facts.chapterId}`,
      type: "CHAPTER_BEHIND_PLAYBOOK",
      severity: "URGENT",
      title: "Launch at risk — blocking readiness gaps",
      why: `Launch is ${readiness.daysUntilLaunch <= 0 ? "here" : `in ${readiness.daysUntilLaunch} day(s)`} with ${readiness.blockingGaps.length} blocking readiness gap(s).`,
      evidence: readiness.blockingGaps.slice(0, 3).join(" · "),
      recommendedLeadershipAction: "Review the launch checklist with the CP and unblock the critical gaps.",
    });
  }

  // 5) Persistent attendance decline.
  if (facts.decliningClasses > 0 && facts.classesRunning >= 1) {
    out.push({
      ...base,
      id: `escalation:attendance-decline:${facts.chapterId}`,
      type: "ATTENDANCE_DROP",
      severity: "ATTENTION",
      title: "Attendance declining in live classes",
      why: `${facts.decliningClasses} class(es) show week-over-week attendance decline.`,
      evidence: `Attendance ${facts.attendancePercent}% · ${facts.consecutiveAbsentees} student(s) on absence streaks.`,
      recommendedLeadershipAction: "Coach the CP on retention tactics and confirm instructor support.",
    });
  }

  // 6) Chapter is materially behind the playbook.
  if (playbook.paceLabel === "Behind") {
    out.push({
      ...base,
      id: `escalation:behind-playbook:${facts.chapterId}`,
      type: "CHAPTER_BEHIND_PLAYBOOK",
      severity: "ATTENTION",
      title: `Behind the playbook at Week ${week}`,
      why: `${playbook.overdue.length} foundational playbook step(s) are overdue.`,
      evidence: playbook.overdue.slice(0, 3).map((r) => r.label).join(" · ") || playbook.recommendedNextAction,
      recommendedLeadershipAction: "Check in with the Chapter President and remove blockers on the overdue work.",
    });
  }

  return out;
}
