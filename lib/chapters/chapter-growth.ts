// Chapter Growth read model — "is the chapter becoming stronger?"
//
// Pure + deterministic (pass `now`). The DB loader gathers ChapterGoals,
// ChapterMilestones, week-over-week KPI snapshot diffs, and the chapter-health
// signals; this module shapes the goal/trend evidence rows and derives the
// room's needs-you / insights / next action. Trends come from real
// ChapterKpiSnapshot history (the only true time-series we have); goals carry
// progress, not invented history. A null trend means "no prior week to compare".

import type {
  ActivityTone,
  NeedsYouItem,
  RoomHealth,
  RoomHealthStatus,
  RoomInsight,
  RoomMetric,
  RoomNextAction,
} from "@/lib/chapters/operating-rooms";

/** Days since the last impact meeting before it's "too long". */
export const MEETING_STALE_DAYS = 14;

export type GoalRecord = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  status: string; // ACTIVE | COMPLETED | PAUSED | CANCELLED
  deadline: Date | null;
};

/** A week-over-week metric from ChapterKpiSnapshot history. */
export type TrendRecord = {
  key: string;
  label: string;
  current: number;
  /** Last week's value; null when there's no prior snapshot. */
  previous: number | null;
  /** Display unit suffix, e.g. "%" or "". */
  unit: string;
};

export type GrowthSignals = {
  weekNumber: number;
  focus: string;
  impactSubmittedThisWeek: boolean;
  hasUpcomingMeeting: boolean;
  lastMeetingDaysAgo: number | null;
  launchTargetPassed: boolean;
  launched: boolean;
};

export type GrowthRowStatus = "done" | "on_track" | "behind" | "upcoming";

export type GrowthEvidenceRow = {
  id: string;
  label: string;
  current: string;
  target: string;
  /** "▲ +3" / "▼ -2" / "Steady" / progress "%". */
  trend: string;
  trendTone: ActivityTone;
  status: GrowthRowStatus;
};

// --- Goals -----------------------------------------------------------------

export function goalRowStatus(g: GoalRecord, now: Date): GrowthRowStatus {
  if (g.status === "COMPLETED" || (g.targetValue > 0 && g.currentValue >= g.targetValue)) return "done";
  if (g.currentValue <= 0) return "upcoming";
  if (g.deadline && g.deadline.getTime() < now.getTime() && g.currentValue < g.targetValue) return "behind";
  return "on_track";
}

export function goalEvidenceRow(g: GoalRecord, now: Date): GrowthEvidenceRow {
  const status = goalRowStatus(g, now);
  const pct = g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0;
  return {
    id: g.id,
    label: g.title,
    current: `${g.currentValue} ${g.unit}`.trim(),
    target: `${g.targetValue} ${g.unit}`.trim(),
    trend: `${Math.min(pct, 999)}% of target`,
    trendTone: status === "done" ? "good" : status === "behind" ? "warn" : "neutral",
    status,
  };
}

// --- KPI trends ------------------------------------------------------------

export function trendEvidenceRow(t: TrendRecord): GrowthEvidenceRow {
  const delta = t.previous == null ? null : t.current - t.previous;
  let trend: string;
  let trendTone: ActivityTone;
  let status: GrowthRowStatus;
  if (delta == null) {
    trend = "New this week";
    trendTone = "neutral";
    status = "upcoming";
  } else if (delta > 0) {
    trend = `▲ +${round1(delta)}${t.unit}`;
    trendTone = "good";
    status = "on_track";
  } else if (delta < 0) {
    trend = `▼ ${round1(delta)}${t.unit}`;
    trendTone = "warn";
    status = "behind";
  } else {
    trend = "Steady";
    trendTone = "neutral";
    status = "on_track";
  }
  return {
    id: `kpi:${t.key}`,
    label: t.label,
    current: `${round1(t.current)}${t.unit}`,
    target: "—",
    trend,
    trendTone,
    status,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Build the growth evidence rows: explicit goals first (they carry intent),
 * then KPI trend rows to fill out the picture. Capped by the caller.
 */
export function growthEvidenceRows(goals: GoalRecord[], trends: TrendRecord[], now: Date): GrowthEvidenceRow[] {
  const goalRows = goals
    .filter((g) => g.status !== "CANCELLED")
    .map((g) => goalEvidenceRow(g, now));
  const trendRows = trends.map(trendEvidenceRow);
  return [...goalRows, ...trendRows];
}

// --- Summary / health / needs-you ------------------------------------------

export type GrowthSummary = {
  weekNumber: number;
  focus: string;
  goalsTotal: number;
  goalsOnTrack: number;
  goalsBehind: number;
  goalsDone: number;
};

export function summarizeGrowth(goals: GoalRecord[], signals: GrowthSignals, now: Date): GrowthSummary {
  const active = goals.filter((g) => g.status !== "CANCELLED");
  const statuses = active.map((g) => goalRowStatus(g, now));
  return {
    weekNumber: signals.weekNumber,
    focus: signals.focus,
    goalsTotal: active.length,
    goalsOnTrack: statuses.filter((s) => s === "on_track").length,
    goalsBehind: statuses.filter((s) => s === "behind").length,
    goalsDone: statuses.filter((s) => s === "done").length,
  };
}

const CHAPTER_HEALTH_TO_ROOM: Record<string, RoomHealthStatus> = {
  ON_TRACK: "strong",
  NEEDS_SUPPORT: "needs_attention",
  AT_RISK: "critical",
  PAUSED: "needs_attention",
};

/** Map the chapter-level health (computeChapterHealth) onto the room read. */
export function growthHealth(label: string, reasons: string[]): RoomHealth {
  const status = CHAPTER_HEALTH_TO_ROOM[label] ?? "needs_attention";
  const headline =
    status === "strong"
      ? "The chapter is on track"
      : status === "critical"
        ? "The chapter is at risk"
        : "The chapter needs support";
  return { status, headline, reasons: reasons.slice(0, 3) };
}

/** Growth-specific "Needs You": meeting cadence, impact submission, goals, launch. */
export function growthNeedsYou(goals: GoalRecord[], signals: GrowthSignals, now: Date): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];

  if (signals.launchTargetPassed && !signals.launched) {
    out.push({
      key: "growth-launch-overdue",
      severity: "critical",
      title: "Your launch target date has passed",
      detail: "Update the plan or set a new target so the chapter keeps moving.",
      href: "/chapter",
      entityType: null,
      entityId: null,
      suggestedAction: "Revisit the chapter launch plan",
    });
  }

  if (!signals.hasUpcomingMeeting) {
    out.push({
      key: "growth-no-meeting",
      severity: "warning",
      title: "No upcoming impact meeting is scheduled",
      detail: "Schedule your weekly meeting to keep the team aligned.",
      href: "/meetings",
      entityType: null,
      entityId: null,
      suggestedAction: "Schedule the next impact meeting",
    });
  } else if (signals.lastMeetingDaysAgo != null && signals.lastMeetingDaysAgo >= MEETING_STALE_DAYS) {
    out.push({
      key: "growth-meeting-stale",
      severity: "warning",
      title: `It's been ${signals.lastMeetingDaysAgo} days since your last meeting`,
      detail: "Run your weekly impact meeting to keep momentum.",
      href: "/meetings",
      entityType: null,
      entityId: null,
      suggestedAction: "Hold this week's impact meeting",
    });
  }

  if (!signals.impactSubmittedThisWeek) {
    out.push({
      key: "growth-impact-missing",
      severity: "info",
      title: "This week's impact isn't submitted yet",
      detail: "Record this week's numbers and narrative before your meeting.",
      href: "/my-weekly-impact",
      entityType: null,
      entityId: null,
      suggestedAction: "Submit this week's impact",
    });
  }

  for (const g of goals.filter((g) => g.status !== "CANCELLED")) {
    if (goalRowStatus(g, now) === "behind") {
      out.push({
        key: `growth-goal-behind:${g.id}`,
        severity: "warning",
        title: `Goal "${g.title}" is behind (${g.currentValue}/${g.targetValue} ${g.unit})`.trim(),
        detail: "Its deadline has passed without hitting the target.",
        href: "/chapter",
        entityType: null,
        entityId: null,
        suggestedAction: `Push on the "${g.title}" goal`,
      });
    }
  }

  return out;
}

export function growthMetrics(summary: GrowthSummary, trends: TrendRecord[]): RoomMetric[] {
  const students = trends.find((t) => t.key === "students");
  const instructors = trends.find((t) => t.key === "instructors");
  return [
    { label: "Week", value: String(summary.weekNumber), hint: summary.focus },
    {
      label: "Goals on track",
      value: summary.goalsTotal === 0 ? "—" : `${summary.goalsOnTrack + summary.goalsDone}/${summary.goalsTotal}`,
      hint: summary.goalsBehind > 0 ? `${summary.goalsBehind} behind` : "On pace",
    },
    students
      ? { label: "Active students", value: String(students.current), hint: deltaHint(students) }
      : { label: "Goals met", value: String(summary.goalsDone), hint: "Completed" },
    instructors
      ? { label: "Active instructors", value: String(instructors.current), hint: deltaHint(instructors) }
      : { label: "Focus", value: `Week ${summary.weekNumber}`, hint: summary.focus },
  ];
}

function deltaHint(t: TrendRecord): string {
  if (t.previous == null) return "New";
  const d = round1(t.current - t.previous);
  if (d > 0) return `+${d} vs last week`;
  if (d < 0) return `${d} vs last week`;
  return "Steady";
}

export function growthInsights(summary: GrowthSummary, trends: TrendRecord[]): RoomInsight[] {
  const out: RoomInsight[] = [];
  out.push({
    key: "week",
    text: `You're in Week ${summary.weekNumber} — focus: ${summary.focus}.`,
    tone: "neutral",
  });
  for (const t of trends.filter((t) => t.previous != null)) {
    const d = round1(t.current - t.previous!);
    if (d === 0) continue;
    out.push({
      key: `trend:${t.key}`,
      text: `${t.label} ${d > 0 ? "up" : "down"} ${Math.abs(d)}${t.unit} week over week.`,
      tone: d > 0 ? "good" : "warn",
    });
  }
  if (summary.goalsTotal > 0) {
    out.push({
      key: "goals",
      text: `${summary.goalsOnTrack + summary.goalsDone} of ${summary.goalsTotal} goals on track.`,
      tone: summary.goalsBehind > 0 ? "warn" : "good",
    });
  }
  return out;
}

export function growthNextAction(signals: GrowthSignals, summary: GrowthSummary): RoomNextAction {
  if (signals.launchTargetPassed && !signals.launched) {
    return { text: "Update your launch plan — the target date has passed.", cta: "Open Chapter Home", href: "/chapter" };
  }
  if (!signals.impactSubmittedThisWeek) {
    return { text: "Submit this week's impact before your meeting.", cta: "Write Impact", href: "/my-weekly-impact" };
  }
  if (!signals.hasUpcomingMeeting) {
    return { text: "Schedule your next weekly impact meeting.", cta: "Open Meetings", href: "/meetings" };
  }
  if (summary.goalsBehind > 0) {
    return {
      text: `Push on ${summary.goalsBehind} ${summary.goalsBehind === 1 ? "goal" : "goals"} that ${
        summary.goalsBehind === 1 ? "is" : "are"
      } behind.`,
      cta: "Open Chapter Home",
      href: "/chapter",
    };
  }
  if (summary.goalsTotal === 0) {
    return { text: "Set a goal to give the chapter something to grow toward.", cta: "Open Chapter Home", href: "/chapter" };
  }
  return { text: "Bring this week's wins to your impact meeting.", cta: "Open Meetings", href: "/meetings" };
}
