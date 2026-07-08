// Chapter GROWTH read model — "Is the chapter becoming stronger?" Compares this
// week's KPI snapshot to the prior week and to the Chapter President 10-week
// playbook's targets, then states a plain, evidence-backed trend label. No
// invented "performance scores" — every signal is a real delta or a real target
// gap.
//
// Pure + deterministic so it is fully unit testable: no Prisma, no `server-only`.
// The DB loader in `lib/chapters/chapter-os.ts` builds the current and prior
// snapshots from real data (reconstructing the prior week from timestamps) and
// hands them to these functions.

// ---------------------------------------------------------------------------
// KPI snapshot
// ---------------------------------------------------------------------------

/** The KPIs that define chapter strength, in display order. */
export const KPI_KEYS = [
  "partnersContacted",
  "partnerMeetingsScheduled",
  "confirmedPartners",
  "instructorApplicants",
  "interviewsCompleted",
  "instructorsHired",
  "curriculaSubmitted",
  "curriculaApproved",
  "classesCreated",
  "classesReady",
  "studentsEnrolled",
  "attendancePercent",
  "retentionPercent",
  "feedbackCollected",
  "unresolvedBlockers",
] as const;
export type KpiKey = (typeof KPI_KEYS)[number];

export const KPI_LABELS: Record<KpiKey, string> = {
  partnersContacted: "Partners contacted",
  partnerMeetingsScheduled: "Partner meetings",
  confirmedPartners: "Confirmed partners",
  instructorApplicants: "Instructor applicants",
  interviewsCompleted: "Interviews completed",
  instructorsHired: "Instructors hired",
  curriculaSubmitted: "Curricula submitted",
  curriculaApproved: "Curricula approved",
  classesCreated: "Classes created",
  classesReady: "Classes ready",
  studentsEnrolled: "Students enrolled",
  attendancePercent: "Attendance %",
  retentionPercent: "Retention %",
  feedbackCollected: "Feedback collected",
  unresolvedBlockers: "Unresolved blockers",
};

/** Metrics where a lower number is the healthier direction. */
const LOWER_IS_BETTER: ReadonlySet<KpiKey> = new Set<KpiKey>(["unresolvedBlockers"]);

export type KpiSnapshot = {
  weekStartISO: string;
  weekNumber: number;
  values: Record<KpiKey, number>;
};

/** Forgiving input — any missing KPI defaults to 0. */
export type KpiSnapshotInput = {
  weekStartISO: string;
  weekNumber: number;
  values: Partial<Record<KpiKey, number>>;
};

/** Build a normalized KPI snapshot (missing metrics → 0). */
export function buildChapterKpiSnapshot(input: KpiSnapshotInput): KpiSnapshot {
  const values = {} as Record<KpiKey, number>;
  for (const k of KPI_KEYS) values[k] = input.values[k] ?? 0;
  return { weekStartISO: input.weekStartISO, weekNumber: input.weekNumber, values };
}

// ---------------------------------------------------------------------------
// Persistence mapping (ChapterWeeklyKpiSnapshot) — pure, so the row shape is
// unit-testable without a Prisma client. The DB column for feedback is
// `feedbackCount`; the KPI key is `feedbackCollected` — mapped here.
// ---------------------------------------------------------------------------

/** The numeric columns of a persisted ChapterWeeklyKpiSnapshot row. */
export type WeeklyKpiRow = {
  partnersContacted: number;
  partnerMeetingsScheduled: number;
  confirmedPartners: number;
  instructorApplicants: number;
  interviewsCompleted: number;
  instructorsHired: number;
  curriculaSubmitted: number;
  curriculaApproved: number;
  classesCreated: number;
  classesReady: number;
  studentsEnrolled: number;
  attendancePercent: number;
  retentionPercent: number;
  feedbackCount: number;
  unresolvedBlockers: number;
};

/** Map a KPI snapshot → the persisted row's numeric columns (for upsert). */
export function kpiSnapshotToRow(snapshot: KpiSnapshot): WeeklyKpiRow {
  const v = snapshot.values;
  return {
    partnersContacted: v.partnersContacted,
    partnerMeetingsScheduled: v.partnerMeetingsScheduled,
    confirmedPartners: v.confirmedPartners,
    instructorApplicants: v.instructorApplicants,
    interviewsCompleted: v.interviewsCompleted,
    instructorsHired: v.instructorsHired,
    curriculaSubmitted: v.curriculaSubmitted,
    curriculaApproved: v.curriculaApproved,
    classesCreated: v.classesCreated,
    classesReady: v.classesReady,
    studentsEnrolled: v.studentsEnrolled,
    attendancePercent: v.attendancePercent,
    retentionPercent: v.retentionPercent,
    feedbackCount: v.feedbackCollected,
    unresolvedBlockers: v.unresolvedBlockers,
  };
}

/** Map a persisted row → a KPI snapshot input (for use as a prior-week baseline). */
export function rowToKpiSnapshotInput(
  row: WeeklyKpiRow,
  meta: { weekStartISO: string; weekNumber: number }
): KpiSnapshotInput {
  return {
    weekStartISO: meta.weekStartISO,
    weekNumber: meta.weekNumber,
    values: {
      partnersContacted: row.partnersContacted,
      partnerMeetingsScheduled: row.partnerMeetingsScheduled,
      confirmedPartners: row.confirmedPartners,
      instructorApplicants: row.instructorApplicants,
      interviewsCompleted: row.interviewsCompleted,
      instructorsHired: row.instructorsHired,
      curriculaSubmitted: row.curriculaSubmitted,
      curriculaApproved: row.curriculaApproved,
      classesCreated: row.classesCreated,
      classesReady: row.classesReady,
      studentsEnrolled: row.studentsEnrolled,
      attendancePercent: row.attendancePercent,
      retentionPercent: row.retentionPercent,
      feedbackCollected: row.feedbackCount,
      unresolvedBlockers: row.unresolvedBlockers,
    },
  };
}

export type PreviousSnapshotSource = "persisted" | "reconstructed" | "none";

/**
 * Choose the prior-week baseline: prefer a real persisted snapshot, fall back to
 * timestamp reconstruction, else none. Honest provenance so the UI can say
 * whether the trend is measured or estimated.
 */
export function pickPreviousSnapshot(
  persisted: KpiSnapshotInput | null,
  reconstructed: KpiSnapshotInput | null
): { previous: KpiSnapshotInput | null; source: PreviousSnapshotSource } {
  if (persisted) return { previous: persisted, source: "persisted" };
  if (reconstructed) return { previous: reconstructed, source: "reconstructed" };
  return { previous: null, source: "none" };
}

// ---------------------------------------------------------------------------
// Week-over-week comparison
// ---------------------------------------------------------------------------

export type KpiTrend = "up" | "down" | "flat" | "new";

export type KpiChange = {
  key: KpiKey;
  label: string;
  current: number;
  previous: number | null;
  delta: number | null;
  trend: KpiTrend;
  lowerIsBetter: boolean;
  /** Interpreted health of the movement. */
  direction: "good" | "bad" | "neutral";
};

/**
 * Per-KPI week-over-week change. With no prior snapshot every metric is "new"
 * (no baseline) — never a false regression.
 */
export function compareKpiSnapshots(current: KpiSnapshot, previous: KpiSnapshot | null): KpiChange[] {
  return KPI_KEYS.map((key) => {
    const cur = current.values[key] ?? 0;
    const lowerIsBetter = LOWER_IS_BETTER.has(key);
    const label = KPI_LABELS[key];
    if (!previous) {
      return { key, label, current: cur, previous: null, delta: null, trend: "new" as const, lowerIsBetter, direction: "neutral" as const };
    }
    const prev = previous.values[key] ?? 0;
    const delta = cur - prev;
    const trend: KpiTrend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    let direction: KpiChange["direction"] = "neutral";
    if (delta !== 0) {
      const improved = lowerIsBetter ? delta < 0 : delta > 0;
      direction = improved ? "good" : "bad";
    }
    return { key, label, current: cur, previous: prev, delta, trend, lowerIsBetter, direction };
  });
}

// ---------------------------------------------------------------------------
// Playbook targets (the 10-week Chapter President playbook)
// ---------------------------------------------------------------------------

export type PlaybookTarget = {
  key: KpiKey;
  label: string;
  target: number;
  note: string;
};

// First week each target becomes active, with its threshold. Later weeks inherit
// the latest applicable threshold for a key (cumulative expectations).
const WEEK_TARGETS: { week: number; key: KpiKey; target: number; note: string }[] = [
  { week: 1, key: "partnersContacted", target: 5, note: "Week 1: outreach to schools & centers started" },
  { week: 2, key: "instructorApplicants", target: 5, note: "Week 2: 5–8 instructor applications" },
  { week: 3, key: "partnerMeetingsScheduled", target: 1, note: "Week 3: partner meetings underway" },
  { week: 4, key: "confirmedPartners", target: 1, note: "Week 4: at least one confirmed partner" },
  { week: 4, key: "instructorApplicants", target: 25, note: "Week 4: 25 applicants" },
  { week: 4, key: "instructorsHired", target: 3, note: "Week 4: 3 instructors hired" },
  { week: 6, key: "curriculaApproved", target: 1, note: "Week 6: curriculum approved" },
  { week: 6, key: "classesCreated", target: 1, note: "Week 6: classes built, logistics confirmed" },
  { week: 7, key: "classesReady", target: 1, note: "Week 7/8: launch dates confirmed" },
  { week: 7, key: "studentsEnrolled", target: 5, note: "Week 7/8: enrollment ≥5 per class" },
  { week: 9, key: "attendancePercent", target: 80, note: "Week 9: attendance ≥80%" },
  { week: 9, key: "feedbackCollected", target: 1, note: "Week 9/10: collect feedback & observations" },
  { week: 10, key: "studentsEnrolled", target: 10, note: "Launch: 10+ students per class" },
  { week: 10, key: "retentionPercent", target: 80, note: "Week 10: retention strong, plan Session 2" },
];

/**
 * The cumulative playbook targets that apply at a given operating week. For each
 * KPI, returns the latest applicable threshold (week ≤ the given week).
 */
export function getPlaybookTargetsForWeek(week: number): PlaybookTarget[] {
  const w = Math.max(1, week);
  const latest = new Map<KpiKey, { week: number; target: number; note: string }>();
  for (const t of WEEK_TARGETS) {
    if (t.week > w) continue;
    const existing = latest.get(t.key);
    if (!existing || t.week > existing.week) latest.set(t.key, { week: t.week, target: t.target, note: t.note });
  }
  return [...latest.entries()]
    .sort((a, b) => a[1].week - b[1].week || KPI_KEYS.indexOf(a[0]) - KPI_KEYS.indexOf(b[0]))
    .map(([key, v]) => ({ key, label: KPI_LABELS[key], target: v.target, note: v.note }));
}

// ---------------------------------------------------------------------------
// Status, signals, next action
// ---------------------------------------------------------------------------

export const CHAPTER_GROWTH_STATUSES = [
  "Strong",
  "Improving",
  "Flat",
  "Slipping",
  "Critical",
  "No Baseline Yet",
] as const;
export type ChapterGrowthStatus = (typeof CHAPTER_GROWTH_STATUSES)[number];

/** Derive the plain trend label from real deltas + target gaps. */
export function getChapterGrowthStatus(
  changes: KpiChange[],
  targets: PlaybookTarget[],
  current: KpiSnapshot
): ChapterGrowthStatus {
  const withBase = changes.filter((c) => c.previous != null);
  if (withBase.length === 0) return "No Baseline Yet";
  const good = withBase.filter((c) => c.direction === "good").length;
  const bad = withBase.filter((c) => c.direction === "bad").length;
  const targetsMissed = targets.filter((t) => (current.values[t.key] ?? 0) < t.target).length;

  if (bad >= 3 && bad > good) return "Critical";
  if (bad > good) return "Slipping";
  if (good > bad && targetsMissed === 0) return "Strong";
  if (good > bad) return "Improving";
  return "Flat";
}

/** Human growth (good) and regression (bad) signals from the week's changes. */
export function getChapterGrowthSignals(changes: KpiChange[]): { growth: string[]; regression: string[] } {
  const growth: string[] = [];
  const regression: string[] = [];
  for (const c of changes) {
    if (c.previous == null || c.delta == null || c.delta === 0) continue;
    const mag = Math.abs(c.delta);
    const phrase = `${c.label} ${c.delta > 0 ? "up" : "down"} ${mag} (${c.previous} → ${c.current})`;
    if (c.direction === "good") growth.push(phrase);
    else if (c.direction === "bad") regression.push(phrase);
  }
  return { growth, regression };
}

/** The single recommended next action for the growth room. */
export function getChapterGrowthNextAction(input: {
  status: ChapterGrowthStatus;
  changes: KpiChange[];
  targets: PlaybookTarget[];
  current: KpiSnapshot;
  weekNumber: number;
}): string {
  const { status, changes, targets, current, weekNumber } = input;
  if (status === "No Baseline Yet")
    return "Keep logging activity — next week the Growth room will show week-over-week trends.";

  // Biggest regression first when slipping.
  if (status === "Slipping" || status === "Critical") {
    const worst = changes
      .filter((c) => c.direction === "bad" && c.delta != null)
      .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0];
    if (worst) return `Reverse the slide in ${worst.label.toLowerCase()} (${worst.previous} → ${worst.current}) this week.`;
  }

  // Otherwise close the nearest missed target.
  const missed = targets
    .filter((t) => (current.values[t.key] ?? 0) < t.target)
    .sort((a, b) => a.target - (current.values[a.key] ?? 0) - (b.target - (current.values[b.key] ?? 0)))[0];
  if (missed) {
    const have = current.values[missed.key] ?? 0;
    return `Push ${missed.label.toLowerCase()} from ${have} toward ${missed.target} — ${missed.note}.`;
  }

  if (weekNumber >= 10)
    return "Targets met — start Session 2 planning and lock in retention.";
  return `Chapter is strengthening — carry the momentum into Week ${weekNumber + 1}.`;
}

// ---------------------------------------------------------------------------
// Milestones, evidence, needs, full summary
// ---------------------------------------------------------------------------

export type GrowthMilestone = { label: string; achieved: boolean };

/** Headline milestones, from absolute thresholds in the current snapshot. */
export function getChapterGrowthMilestones(current: KpiSnapshot): GrowthMilestone[] {
  const v = current.values;
  return [
    { label: "First partner confirmed", achieved: v.confirmedPartners >= 1 },
    { label: "3+ instructors hired", achieved: v.instructorsHired >= 3 },
    { label: "Curriculum approved", achieved: v.curriculaApproved >= 1 },
    { label: "First class created", achieved: v.classesCreated >= 1 },
    { label: "Students enrolled", achieved: v.studentsEnrolled >= 1 },
    { label: "Feedback collected", achieved: v.feedbackCollected >= 1 },
  ];
}

export type GrowthEvidenceStatus = "met" | "close" | "behind";
export type GrowthEvidenceRow = {
  id: string;
  goal: string;
  current: number;
  target: number;
  trend: KpiTrend;
  trendLabel: string;
  status: GrowthEvidenceStatus;
};

function trendLabel(c: KpiChange | undefined): string {
  if (!c || c.previous == null || c.delta == null) return "new";
  if (c.delta === 0) return "—";
  return `${c.delta > 0 ? "+" : ""}${c.delta}`;
}

export type ChapterGrowthNeed = {
  key: string;
  title: string;
  detail?: string;
  severity: "critical" | "warning" | "info";
  href: string;
};

export type ChapterGrowthSummary = {
  weekNumber: number;
  current: KpiSnapshot;
  previous: KpiSnapshot | null;
  changes: KpiChange[];
  targets: PlaybookTarget[];
  status: ChapterGrowthStatus;
  signals: { growth: string[]; regression: string[] };
  milestones: GrowthMilestone[];
  needsAttention: ChapterGrowthNeed[];
  nextAction: string;
  evidence: GrowthEvidenceRow[];
};

const GROWTH_STATUS_ORDER: Record<GrowthEvidenceStatus, number> = { behind: 0, close: 1, met: 2 };

export type ChapterGrowthInput = {
  weekNumber: number;
  current: KpiSnapshotInput;
  previous: KpiSnapshotInput | null;
};

/** Assemble the full Chapter Growth summary from current + prior snapshots. */
export function summarizeChapterGrowth(input: ChapterGrowthInput): ChapterGrowthSummary {
  const current = buildChapterKpiSnapshot(input.current);
  const previous = input.previous ? buildChapterKpiSnapshot(input.previous) : null;
  const changes = compareKpiSnapshots(current, previous);
  const targets = getPlaybookTargetsForWeek(input.weekNumber);
  const status = getChapterGrowthStatus(changes, targets, current);
  const signals = getChapterGrowthSignals(changes);
  const milestones = getChapterGrowthMilestones(current);
  const nextAction = getChapterGrowthNextAction({ status, changes, targets, current, weekNumber: input.weekNumber });

  const changeByKey = new Map(changes.map((c) => [c.key, c]));
  const evidence: GrowthEvidenceRow[] = targets.map((t) => {
    const have = current.values[t.key] ?? 0;
    const c = changeByKey.get(t.key);
    const st: GrowthEvidenceStatus = have >= t.target ? "met" : have >= t.target * 0.6 ? "close" : "behind";
    return {
      id: t.key,
      goal: t.label,
      current: have,
      target: t.target,
      trend: c?.trend ?? "new",
      trendLabel: trendLabel(c),
      status: st,
    };
  });
  evidence.sort((a, b) => GROWTH_STATUS_ORDER[a.status] - GROWTH_STATUS_ORDER[b.status]);

  // --- Needs You ----------------------------------------------------------
  const needs: ChapterGrowthNeed[] = [];
  for (const c of changes) {
    if (c.direction === "bad" && c.delta != null) {
      needs.push({
        key: `growth-regression:${c.key}`,
        title: `${c.label} fell ${Math.abs(c.delta)} this week`,
        detail: `${c.previous} → ${c.current}. Address it before the next impact meeting.`,
        severity: Math.abs(c.delta) >= 3 ? "warning" : "info",
        href: "/my-weekly-impact",
      });
    }
  }
  for (const t of targets) {
    const have = current.values[t.key] ?? 0;
    if (have < t.target) {
      needs.push({
        key: `growth-target:${t.key}`,
        title: `${t.label} behind playbook target (${have}/${t.target})`,
        detail: t.note,
        severity: have < t.target * 0.5 ? "warning" : "info",
        href: "/chapter?lane=meetings",
      });
    }
  }
  if (input.weekNumber >= 10 && current.values.retentionPercent < 80) {
    needs.push({
      key: "growth-session2",
      title: "No strong Session 2 retention yet by Week 10",
      detail: "Start Session 2 planning and re-enrollment outreach now.",
      severity: "warning",
      href: "/my-weekly-impact",
    });
  }
  const SEV_RANK = { critical: 0, warning: 1, info: 2 } as const;
  needs.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  return {
    weekNumber: input.weekNumber,
    current,
    previous,
    changes,
    targets,
    status,
    signals,
    milestones,
    needsAttention: needs,
    nextAction,
    evidence,
  };
}
