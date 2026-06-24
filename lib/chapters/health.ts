// Chapter health: a transparent label derived from CONCRETE signals, not a vague
// black-box score. The reasons array always explains exactly which signals drove
// the label so leadership can act on it. Pure + deterministic (pass `now`) so it
// is fully unit testable.

import { isLaunchingStatus } from "@/lib/chapters/lifecycle";

export type ChapterHealthLabel = "ON_TRACK" | "NEEDS_SUPPORT" | "AT_RISK" | "PAUSED";

export const CHAPTER_HEALTH_LABELS: Record<ChapterHealthLabel, string> = {
  ON_TRACK: "On Track",
  NEEDS_SUPPORT: "Needs Support",
  AT_RISK: "At Risk",
  PAUSED: "Paused",
};

export type ChapterHealthTone = "success" | "warning" | "danger" | "neutral";

export const CHAPTER_HEALTH_TONE: Record<ChapterHealthLabel, ChapterHealthTone> = {
  ON_TRACK: "success",
  NEEDS_SUPPORT: "warning",
  AT_RISK: "danger",
  PAUSED: "neutral",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChapterHealthSignals = {
  lifecycleStatus: string;
  memberCount: number;
  lastMeetingAt: Date | null;
  nextMeetingAt: Date | null;
  openActions: number;
  overdueActions: number;
  programsCompleted: number;
  openSupportRequests: number;
  launchChecklistTotal: number;
  launchChecklistDone: number;
  launchTargetDate: Date | null;
  // Days since the Chapter President last did anything in the portal (proxy for
  // responsiveness). null = unknown / no president yet.
  daysSinceCpActivity: number | null;
  now: Date;
};

export type ChapterHealth = {
  label: ChapterHealthLabel;
  tone: ChapterHealthTone;
  // 0–100, monotonic with the risk points, shown only for transparency.
  score: number;
  reasons: string[];
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

/**
 * Compute a chapter's health label from concrete operating signals.
 *
 * The rubric is intentionally simple and explainable:
 *  - PAUSED chapters are always PAUSED (no risk math).
 *  - We add "risk points" for each bad signal and map the total to a label.
 *  - Launching vs. operating chapters weigh different signals (a launching
 *    chapter with no meetings yet is normal; an active one is not).
 */
export function computeChapterHealth(signals: ChapterHealthSignals): ChapterHealth {
  if (signals.lifecycleStatus === "PAUSED") {
    return { label: "PAUSED", tone: CHAPTER_HEALTH_TONE.PAUSED, score: 0, reasons: ["Chapter is paused"] };
  }

  const reasons: string[] = [];
  let points = 0;

  const launching = isLaunchingStatus(signals.lifecycleStatus);

  if (launching) {
    // Launch-progress lens.
    const { launchChecklistDone: done, launchChecklistTotal: total } = signals;
    const ratio = total > 0 ? done / total : 0;
    if (signals.launchTargetDate && signals.launchTargetDate.getTime() < signals.now.getTime()) {
      if (ratio < 1) {
        points += 3;
        reasons.push("Launch target date has passed with the checklist unfinished");
      }
    } else if (total > 0 && ratio < 0.5) {
      points += 1;
      reasons.push(`Launch checklist only ${done}/${total} done`);
    }
    if (signals.overdueActions > 0) {
      points += 2;
      reasons.push(`${signals.overdueActions} overdue launch action${signals.overdueActions === 1 ? "" : "s"}`);
    }
    if (signals.daysSinceCpActivity != null && signals.daysSinceCpActivity > 14) {
      points += 2;
      reasons.push(`Chapter President inactive for ${signals.daysSinceCpActivity} days`);
    }
  } else {
    // Operating lens (ACTIVE / NEEDS_SUPPORT / AT_RISK).
    const lastMeetingDays =
      signals.lastMeetingAt != null ? daysBetween(signals.now, signals.lastMeetingAt) : null;
    if (lastMeetingDays == null) {
      points += 2;
      reasons.push("No meeting has been held yet");
    } else if (lastMeetingDays > 45) {
      points += 3;
      reasons.push(`Last meeting was ${lastMeetingDays} days ago`);
    } else if (lastMeetingDays > 21) {
      points += 1;
      reasons.push(`Last meeting was ${lastMeetingDays} days ago`);
    }

    if (signals.nextMeetingAt == null || signals.nextMeetingAt.getTime() < signals.now.getTime()) {
      points += 1;
      reasons.push("No upcoming meeting scheduled");
    }

    if (signals.memberCount < 3) {
      points += 2;
      reasons.push(`Only ${signals.memberCount} member${signals.memberCount === 1 ? "" : "s"}`);
    } else if (signals.memberCount < 5) {
      points += 1;
      reasons.push(`Small chapter (${signals.memberCount} members)`);
    }

    if (signals.overdueActions > 2) {
      points += 2;
      reasons.push(`${signals.overdueActions} overdue actions`);
    } else if (signals.overdueActions > 0) {
      points += 1;
      reasons.push(`${signals.overdueActions} overdue action${signals.overdueActions === 1 ? "" : "s"}`);
    }

    if (signals.daysSinceCpActivity != null && signals.daysSinceCpActivity > 21) {
      points += 1;
      reasons.push(`Chapter President inactive for ${signals.daysSinceCpActivity} days`);
    }
  }

  // Open support requests are a signal of an unmet need regardless of stage.
  if (signals.openSupportRequests > 0) {
    points += 1;
    reasons.push(
      `${signals.openSupportRequests} open support request${signals.openSupportRequests === 1 ? "" : "s"}`
    );
  }

  let label: ChapterHealthLabel;
  if (points >= 4) label = "AT_RISK";
  else if (points >= 2) label = "NEEDS_SUPPORT";
  else label = "ON_TRACK";

  if (reasons.length === 0) reasons.push("All core signals look healthy");

  // Map risk points to a 0–100 score (higher = healthier) for display only.
  const score = Math.max(0, Math.min(100, 100 - points * 15));

  return { label, tone: CHAPTER_HEALTH_TONE[label], score, reasons };
}
