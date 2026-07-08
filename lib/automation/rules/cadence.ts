// Net-new automation rules the existing engine does NOT already produce:
// the live-operations CADENCE (weekly partner/instructor check-ins, class
// observations), Session-2 work, a conservative advertising heuristic, and the
// chapter-level "behind the playbook" item. These are week-gated so they only
// appear in the right phase — no early-cycle noise. Pure (pass `now`).
//
// NOTE on advertising: the portal has NO advertising/marketing schema anchor
// (confirmed in the audit). ADVERTISING items are therefore a deliberate
// heuristic (public class + near launch + zero enrollment), not a data read.

import type { AutomationItem, ChapterFacts } from "@/lib/automation/types";
import type { PlaybookInterpretation } from "@/lib/automation/playbook";
import { makeAutomationItem } from "@/lib/automation/build-item";
import { automationItemId } from "@/lib/automation/item-identity";

/** Live-operations cadence + Session-2 + advertising heuristic items. */
export function buildCadenceItems(facts: ChapterFacts, now: Date): AutomationItem[] {
  const items: AutomationItem[] = [];
  const week = facts.weekNumber;
  const live = facts.classesRunning + facts.classesLaunched > 0;

  // --- Weekly partner check-in (live operations) ---------------------------
  if (week >= 9 && facts.partnersConfirmed >= 1) {
    items.push(
      makeAutomationItem({
        type: "PARTNER_WEEKLY_CHECKIN_DUE",
        chapterId: facts.chapterId,
        now,
        title: "Weekly partner check-in",
        description: "Check in with each active partner this week.",
        why: `You have ${facts.partnersConfirmed} active partner(s) and classes are running (Week ${week}). The guide expects a brief weekly partner check-in during live operations.`,
        resolvesWhen: "Log a partner touchpoint this week.",
        primaryActionLabel: "Open partners",
        primaryActionHref: "/partners",
        playbookWeekRelevance: week,
        currentWeek: week,
        idParts: { entityId: null, window: `wk${week}` },
      })
    );
  }

  // --- Weekly instructor check-in + class observation ----------------------
  if (week >= 9 && live) {
    items.push(
      makeAutomationItem({
        type: "INSTRUCTOR_WEEKLY_CHECKIN_DUE",
        chapterId: facts.chapterId,
        now,
        title: "Weekly instructor check-in",
        description: "Check in with instructors running classes.",
        why: `${facts.classesRunning} class(es) are running (Week ${week}). A weekly instructor check-in catches problems before they grow.`,
        resolvesWhen: "Log an instructor check-in this week.",
        primaryActionLabel: "Open classes",
        primaryActionHref: "/admin/classes",
        playbookWeekRelevance: week,
        currentWeek: week,
        idParts: { entityId: null, window: `wk${week}` },
      })
    );
    items.push(
      makeAutomationItem({
        type: "CLASS_OBSERVATION_DUE",
        chapterId: facts.chapterId,
        now,
        title: "Observe a live class this week",
        description: "Sit in on a running class and log an observation.",
        why: `Classes are live (Week ${week}). The guide expects regular observations to support instruction quality.`,
        resolvesWhen: "Log a class observation this week.",
        primaryActionLabel: "Open classes",
        primaryActionHref: "/admin/classes",
        playbookWeekRelevance: week,
        currentWeek: week,
        idParts: { entityId: null, window: `wk${week}` },
      })
    );
  }

  // --- Session 2 recruiting (Weeks 9–10) -----------------------------------
  if (week >= 9 && live) {
    items.push(
      makeAutomationItem({
        type: "SESSION_2_RECRUITING_DUE",
        chapterId: facts.chapterId,
        now,
        title: "Start Session 2 recruiting",
        description: "Recruit returning and new students while momentum is high.",
        why: `Classes are running (Week ${week}). The guide starts Session 2 recruiting in Weeks 9–10 to keep enrollment strong.`,
        resolvesWhen: "Begin Session 2 student recruiting.",
        primaryActionLabel: "Open students",
        primaryActionHref: "/chapter/students",
        playbookWeekRelevance: 9,
        currentWeek: week,
      })
    );
  }

  // --- Session review + returning-instructor decisions (Weeks 11–12) -------
  if (week >= 11 && facts.classesLaunched >= 1) {
    items.push(
      makeAutomationItem({
        type: "SESSION_REVIEW_DUE",
        chapterId: facts.chapterId,
        now,
        title: "Run the session review",
        description: "Capture positives, negatives, and the next-session plan.",
        why: `Week ${week} — the session is wrapping up. The guide expects a structured review (what worked, what didn't, next-session plan).`,
        resolvesWhen: "Complete and log the session review.",
        primaryActionLabel: "Open impact prep",
        primaryActionHref: "/my-weekly-impact",
        playbookWeekRelevance: 11,
        currentWeek: week,
      })
    );
  }
  if (week >= 11 && facts.instructorsHired >= 1) {
    items.push(
      makeAutomationItem({
        type: "SESSION_2_RETURNING_INSTRUCTOR_RESPONSE_DUE",
        chapterId: facts.chapterId,
        now,
        title: "Confirm returning instructors for Session 2",
        description: "Ask each instructor whether they're returning.",
        why: `Week ${week} — confirm which of your ${facts.instructorsHired} instructor(s) will return so you know how much to recruit for Session 2.`,
        resolvesWhen: "Collect returning-instructor responses.",
        primaryActionLabel: "Open instructors",
        primaryActionHref: "/chapter/recruiting",
        playbookWeekRelevance: 11,
        currentWeek: week,
      })
    );
  }

  // --- Advertising heuristic (no schema anchor — see file header) ----------
  if (week >= 7 && facts.classesPublic >= 1 && facts.enrollmentTotal === 0) {
    items.push(
      makeAutomationItem({
        type: "ADVERTISING_NOT_STARTED",
        chapterId: facts.chapterId,
        now,
        title: "No enrollment yet — start advertising",
        description: "Post to parent groups, ask partners to share flyers, and message families.",
        why: `${facts.classesPublic} class(es) are public (Week ${week}) but no students have enrolled. Begin advertising through every channel.`,
        resolvesWhen: "Drive first enrollments / log advertising activity.",
        primaryActionLabel: "Open marketing",
        primaryActionHref: "/chapter/marketing",
        playbookWeekRelevance: 7,
        currentWeek: week,
        idParts: { entityId: null, window: `wk${week}` },
      })
    );
  }

  return items;
}

/**
 * The single chapter-level "behind the playbook" item, emitted only when the
 * interpreter reports the chapter is off pace. Summarizes the overdue work with
 * real evidence (never a vague score).
 */
export function buildPlaybookPacingItem(
  facts: ChapterFacts,
  playbook: PlaybookInterpretation,
  now: Date
): AutomationItem | null {
  if (playbook.paceLabel === "On pace") return null;
  const behind = playbook.overdue.length > 0 ? playbook.overdue : playbook.missing;
  if (behind.length === 0) return null;

  const severity = playbook.paceLabel === "Behind" ? "URGENT" : "ATTENTION";
  const top = behind.slice(0, 3).map((r) => r.label);

  return makeAutomationItem({
    type: "CHAPTER_BEHIND_PLAYBOOK",
    chapterId: facts.chapterId,
    now,
    severity,
    title: `${playbook.paceLabel}: ${playbook.overdue.length} overdue playbook step(s)`,
    description: `Catch up on: ${top.join("; ")}.`,
    why: playbook.recommendedNextAction,
    resolvesWhen: "Complete the overdue playbook steps for your week.",
    primaryActionLabel: "Open operating system",
    primaryActionHref: "/chapter",
    playbookWeekRelevance: playbook.currentWindow.weeks[0],
    currentWeek: facts.weekNumber,
    sourceData: {
      paceLabel: playbook.paceLabel,
      overdue: playbook.overdue.map((r) => r.id),
      missing: playbook.missing.map((r) => r.id),
      week: facts.weekNumber,
    },
    id: automationItemId("CHAPTER_BEHIND_PLAYBOOK", facts.chapterId, { window: `wk${facts.weekNumber}` }),
    escalation:
      playbook.paceLabel === "Behind"
        ? {
            reason: `Chapter is behind the playbook at Week ${facts.weekNumber} with ${playbook.overdue.length} overdue step(s).`,
            recommendedLeadershipAction: "Check in with the Chapter President on the overdue foundational work.",
          }
        : null,
  });
}
