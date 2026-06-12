/**
 * Pipeline summary strip (Tailwind / ui-v2 vocabulary): the filtered board's
 * stage counts plus the overall per-status counts. Concrete numbers only —
 * no composite scores (§19). `FunnelCounts` lives here since the old funnel
 * chart was retired (it was never rendered).
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
  funnelCounts: FunnelCounts;
}

const RIBBON_SEGMENTS: Array<{
  key: keyof ApplicantPipelineFilteredCounts;
  label: string;
  dotClass: string;
}> = [
  { key: "newApplications", label: "New", dotClass: "bg-brand-600" },
  { key: "needsReview", label: "Needs review", dotClass: "bg-blue-600" },
  { key: "interviewStage", label: "Interview", dotClass: "bg-emerald-600" },
  { key: "postInterview", label: "Post-interview", dotClass: "bg-indigo-600" },
];

function Pill({
  label,
  value,
  strong = false,
  dotClass,
}: {
  label: string;
  value?: number;
  strong?: boolean;
  dotClass?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${
        strong
          ? "border-brand-200 bg-brand-50 font-bold text-brand-700"
          : "border-line-soft bg-surface-soft text-ink-muted"
      }`}
    >
      {dotClass ? <span aria-hidden className={`size-2 rounded-full ${dotClass}`} /> : null}
      <span>{label}</span>
      {value !== undefined ? (
        <span className="font-bold text-ink">{value}</span>
      ) : null}
    </span>
  );
}

export default function ApplicantPipelineOverview({
  filteredCounts,
  funnelCounts,
}: ApplicantPipelineOverviewProps) {
  const total =
    filteredCounts.newApplications +
    filteredCounts.needsReview +
    filteredCounts.interviewStage +
    filteredCounts.postInterview;

  const overall = [
    { label: "Submitted", value: funnelCounts.SUBMITTED ?? 0 },
    { label: "Under review", value: funnelCounts.UNDER_REVIEW ?? 0 },
    {
      label: "Review complete",
      value: (funnelCounts.INFO_REQUESTED ?? 0) + (funnelCounts.PRE_APPROVED ?? 0),
    },
    { label: "Interview scheduled", value: funnelCounts.INTERVIEW_SCHEDULED ?? 0 },
    { label: "Interview completed", value: funnelCounts.INTERVIEW_COMPLETED ?? 0 },
    { label: "Chair review", value: funnelCounts.CHAIR_REVIEW ?? 0 },
    { label: "Approved", value: funnelCounts.APPROVED ?? 0 },
    { label: "Rejected", value: funnelCounts.REJECTED ?? 0 },
    { label: "On hold", value: funnelCounts.ON_HOLD ?? 0 },
    { label: "Withdrawn", value: funnelCounts.WITHDRAWN ?? 0 },
  ];

  return (
    <section
      className="mb-4 flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface p-4 shadow-card"
      aria-label="Applicant pipeline summary"
    >
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtered board counts">
        <Pill label="Filtered" value={total} strong />
        {RIBBON_SEGMENTS.map((seg) => (
          <Pill
            key={seg.key}
            label={seg.label}
            value={filteredCounts[seg.key]}
            dotClass={seg.dotClass}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Overall counts by status">
        <Pill label="Overall" strong />
        {overall.map((row) => (
          <Pill key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
}
