import { CardV2, EmptyStateV2, StatusBadge } from "@/components/ui-v2";
import type { CurrentGRSummary } from "@/lib/gr-actions";

/**
 * The living plan between reviews — not just a summary of the last review.
 * Goal detail (why it exists, evidence, who's helping) is progressive
 * disclosure territory (the full G&R document below), so this stays lean:
 * competency ratings, this month's goals, resources, and next review period.
 */
export function CurrentGRCard({ summary, personName }: { summary: CurrentGRSummary; personName: string }) {
  if (!summary.hasDocument) {
    return (
      <CardV2>
        <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#9a9ab0]">
          Current G&amp;R
        </p>
        <div className="mt-3">
          <EmptyStateV2 title={`${personName} doesn't have a G&R document yet.`} />
        </div>
      </CardV2>
    );
  }

  return (
    <CardV2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#9a9ab0]">
          Current G&amp;R
        </p>
        {summary.overallRatingLabel ? (
          <StatusBadge tone="brand">Overall: {summary.overallRatingLabel}</StatusBadge>
        ) : null}
      </div>

      {summary.competencies.length > 0 ? (
        <div className="mt-3">
          <h3 className="m-0 text-[13px] font-semibold text-[#1c1a2e]">Competencies</h3>
          <ul className="m-0 mt-1.5 flex flex-col gap-1 pl-0">
            {summary.competencies.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-[13px] text-[#4a4a5e]">
                <span>{c.title}</span>
                <span className="font-medium" style={{ color: c.latestRatingColor ?? undefined }}>
                  {c.latestRatingLabel ?? "Not yet rated"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.monthlyGoals.length > 0 ? (
        <div className="mt-3">
          <h3 className="m-0 text-[13px] font-semibold text-[#1c1a2e]">Goals this month</h3>
          <ol className="m-0 mt-1.5 flex flex-col gap-1 pl-4 text-[13px] text-[#4a4a5e]">
            {summary.monthlyGoals.map((g) => (
              <li key={g.id}>
                {g.title}
                {g.dueDateLabel ? <span className="text-[#9a9ab0]"> · due {g.dueDateLabel}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {summary.resources.length > 0 ? (
        <div className="mt-3">
          <h3 className="m-0 text-[13px] font-semibold text-[#1c1a2e]">Resources &amp; support</h3>
          <ul className="m-0 mt-1.5 flex flex-col gap-1 pl-4 text-[13px] text-[#4a4a5e]">
            {summary.resources.map((r) => (
              <li key={r.id}>
                <a href={r.url} className="text-[#6b21c8] hover:underline" target="_blank" rel="noreferrer">
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.nextReviewLabel ? (
        <p className="m-0 mt-3 text-[12.5px] text-[#717189]">
          Next review: <strong className="font-semibold text-[#1c1a2e]">{summary.nextReviewLabel}</strong>
        </p>
      ) : null}
    </CardV2>
  );
}
