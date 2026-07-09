import { CardV2, EmptyStateV2 } from "@/components/ui-v2";
import type { ReviewHistory } from "@/lib/gr-actions";

/**
 * Progression over time, not just a document list: is this person trending
 * up or down? Collapsed by default — the real history-answering question is
 * "improving or not," not a pile of past documents to click through.
 */
export function ReviewHistoryPanel({ history, personName }: { history: ReviewHistory; personName: string }) {
  if (history.entries.length === 0) {
    return (
      <details className="group overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white">
        <summary className="cursor-pointer list-none px-5 py-3 text-[13.5px] font-semibold text-[#1c1a2e] marker:content-none [&::-webkit-details-marker]:hidden">
          Review history
        </summary>
        <div className="border-t border-[#f1f1f6] px-5 py-4">
          <EmptyStateV2 title={`No released reviews for ${personName} yet.`} />
        </div>
      </details>
    );
  }

  return (
    <details className="group overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-[13.5px] font-semibold text-[#1c1a2e]">Review history</span>
        <span className="text-[12px] text-[#9a9ab0]">
          {history.entries.length} released review{history.entries.length === 1 ? "" : "s"}
          <span className="ml-2 transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-[#f1f1f6] p-4">
        <div>
          <h3 className="m-0 text-[13px] font-semibold text-[#1c1a2e]">Overall rating trend</h3>
          <ol className="m-0 mt-1.5 flex flex-col gap-1 pl-4 text-[13px] text-[#4a4a5e]">
            {history.entries.map((e) => (
              <li key={e.reviewId}>
                {e.cycleLabel}: <span style={{ color: e.overallRatingColor }}>{e.overallRatingLabel}</span>
              </li>
            ))}
          </ol>
        </div>
        {history.competencyTrends.length > 0 ? (
          <div>
            <h3 className="m-0 text-[13px] font-semibold text-[#1c1a2e]">Competency movement</h3>
            <div className="mt-1.5 flex flex-col gap-2">
              {history.competencyTrends.map((t) => (
                <div key={t.competencyId} className="text-[13px] text-[#4a4a5e]">
                  <span className="font-medium text-[#1c1a2e]">{t.title}:</span>{" "}
                  {t.series.map((s, i) => (
                    <span key={i}>
                      {i > 0 ? " → " : ""}
                      <span style={{ color: s.ratingColor }}>{s.ratingLabel}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
