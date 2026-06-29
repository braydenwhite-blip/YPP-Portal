/**
 * Data 360 — shared types for the read layer.
 *
 * Data 360 is YPP's organizational-intelligence surface: quantitative,
 * traceable, drill-down-first. NOTHING here is a synthetic score — every value
 * is a direct count, sum, average, or date from a real record. See
 * `docs/DATA_360_ROADMAP.md` §0 for the binding constraints.
 */

/** The historical comparison windows the proposal pins. */
export const DATE_RANGE_KEYS = [
  "today",
  "week",
  "month",
  "quarter",
  "year",
  "all",
] as const;
export type DateRangeKey = (typeof DATE_RANGE_KEYS)[number];

/** A resolved date window plus the equally-sized window immediately before it. */
export type ResolvedRange = {
  key: DateRangeKey;
  label: string;
  /** Short noun for deltas, e.g. "this month". */
  sinceLabel: string;
  /** null start = all time (no lower bound). */
  start: Date | null;
  end: Date;
  prevStart: Date | null;
  prevEnd: Date | null;
};

/** Presentation tone only — NOT a severity/quality score. */
export type MetricTone =
  | "default"
  | "accent"
  | "positive"
  | "warning"
  | "danger"
  | "muted";

export type KpiGroupKey =
  | "people"
  | "programs"
  | "chapters"
  | "pipeline"
  | "work"
  | "partners"
  | "fundraising";

export const KPI_GROUP_LABELS: Record<KpiGroupKey, string> = {
  people: "People",
  programs: "Programs & classes",
  chapters: "Chapters",
  pipeline: "Hiring pipeline",
  work: "Work & meetings",
  partners: "Partners",
  fundraising: "Fundraising",
};

export type KpiUnit = "count" | "currency" | "percent" | "hours";

/** One headline number. `value: null` ⇒ no data source ⇒ shown as unavailable. */
export type Kpi = {
  key: string;
  label: string;
  value: number | null;
  /** Pre-formatted display string ("1,284", "Unavailable"). */
  display: string;
  unit: KpiUnit;
  group: KpiGroupKey;
  tone: MetricTone;
  href: string | null;
  /** Records created within the active range, when `createdAt` supports it. */
  delta: { value: number; label: string } | null;
  hint: string | null;
  available: boolean;
  unavailableReason: string | null;
};

export type TimeSeriesPoint = { t: string; label: string; value: number };

export type TimeSeries = {
  key: string;
  label: string;
  points: TimeSeriesPoint[];
  /** Cumulative total at the end of the series. */
  total: number;
  /** Records added across the whole series window. */
  added: number;
  href: string | null;
};

export type CategoryDatum = {
  key: string;
  label: string;
  value: number;
  href: string | null;
};

export type CategoryBreakdown = {
  key: string;
  label: string;
  data: CategoryDatum[];
  total: number;
};

/**
 * The plain, score-free labels the Needs Attention panel uses. There is no
 * severity number — order is a real quantity (days overdue, headcount short).
 */
export const ATTENTION_LABELS = [
  "Overdue",
  "Awaiting review",
  "No active classes",
  "Low enrollment",
  "No recent activity",
  "Gone quiet",
  "No follow-up",
  "Missing owner",
] as const;
export type AttentionLabel = (typeof ATTENTION_LABELS)[number];

export type AttentionFact = {
  id: string;
  /** Entity kind, e.g. "chapter" | "class" | "action" | "partner". */
  kind: string;
  label: AttentionLabel;
  /** The entity or the fact, e.g. "Beth El chapter". */
  title: string;
  /** One factual sentence — no score, no adjective grading. */
  detail: string;
  href: string;
  /** Sort key: a real number (days overdue, count). NOT a synthetic score. */
  order: number;
};

export type AttentionGroup = {
  label: AttentionLabel;
  hint: string;
  facts: AttentionFact[];
};

export type RecentActivityItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  atISO: string;
  href: string;
};

/** A row in the client-side quick-find index. */
export type SearchEntry = {
  id: string;
  label: string;
  sub: string;
  kind: string;
  href: string;
};

export type Data360Overview = {
  generatedAtISO: string;
  range: ResolvedRange;
  kpis: Kpi[];
  series: TimeSeries[];
  breakdowns: CategoryBreakdown[];
  recent: RecentActivityItem[];
  search: SearchEntry[];
};
