/**
 * Compact pipeline snapshot for the filtered board. Concrete numbers only — no
 * composite scores (§19). `FunnelCounts` stays here for optional status drill-down.
 */
export type FunnelCounts = Partial<Record<string, number>>;

export interface ApplicantPipelineFilteredCounts {
  newApplications: number;
  needsReview: number;
  interviewStage: number;
  postInterview: number;
}

interface ApplicantPipelineOverviewProps {
  filteredCounts: ApplicantPipelineFilteredCounts;
  funnelCounts?: FunnelCounts;
}

const STAGES: Array<{
  key: keyof ApplicantPipelineFilteredCounts;
  label: string;
  dotClass: string;
}> = [
  { key: "newApplications", label: "New", dotClass: "bg-brand-600" },
  { key: "needsReview", label: "Needs review", dotClass: "bg-blue-600" },
  { key: "interviewStage", label: "Interview", dotClass: "bg-emerald-600" },
  { key: "postInterview", label: "Post-interview", dotClass: "bg-indigo-600" },
];

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  INFO_REQUESTED: "Info requested",
  PRE_APPROVED: "Pre-approved",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEW_COMPLETED: "Interview completed",
  CHAIR_REVIEW: "Chair review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On hold",
  WITHDRAWN: "Withdrawn",
  WAITLISTED: "Waitlisted",
};

function StageCount({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  const muted = value === 0;
  return (
    <div
      className={`flex min-w-[88px] flex-1 flex-col gap-0.5 rounded-[10px] border px-3 py-2 ${
        muted
          ? "border-line-soft bg-surface-soft/60"
          : "border-line-soft bg-surface"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span
        className={`text-[20px] font-bold tabular-nums leading-none ${
          muted ? "text-ink-subtle" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function ApplicantPipelineOverview({
  filteredCounts,
  funnelCounts = {},
}: ApplicantPipelineOverviewProps) {
  const total =
    filteredCounts.newApplications +
    filteredCounts.needsReview +
    filteredCounts.interviewStage +
    filteredCounts.postInterview;

  const statusRows = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({
      label,
      value: funnelCounts[key] ?? 0,
    }))
    .filter((row) => row.value > 0);

  return (
    <section
      className="mb-3 rounded-[12px] border border-line-soft bg-surface-soft/40 p-3"
      aria-label="Pipeline snapshot for current filters"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[13px] font-semibold text-ink">
          {total === 1 ? "1 applicant" : `${total} applicants`} on the board
        </p>
        <p className="m-0 text-[12px] text-ink-muted">Counts match your filters below</p>
      </div>

      <div className="flex flex-wrap gap-2" role="list" aria-label="Applicants by stage">
        {STAGES.map((stage) => (
          <div key={stage.key} role="listitem" className="min-w-[88px] flex-1">
            <StageCount
              label={stage.label}
              value={filteredCounts[stage.key]}
              dotClass={stage.dotClass}
            />
          </div>
        ))}
      </div>

      {statusRows.length > 0 ? (
        <details className="mt-2.5 group">
          <summary className="cursor-pointer list-none text-[12px] font-medium text-ink-muted marker:content-none hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block text-[10px] transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              All status counts (network-wide, unfiltered)
            </span>
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
            {statusRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2 text-[12px]">
                <dt className="truncate text-ink-muted">{row.label}</dt>
                <dd className="shrink-0 font-bold tabular-nums text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
