// EscalationPanel — the leadership-facing view: chapter conditions that should
// rise to global leadership, with why, evidence, and the recommended action.
// Read-only server component (embeddable in the leadership dashboard).

import Link from "next/link";

import { CardV2, StatusBadge, EmptyStateV2 } from "@/components/ui-v2";
import type { ChapterEscalation } from "@/lib/automation/escalation";
import { severityTone, SEVERITY_LABEL } from "./severity";

export function EscalationPanel({
  escalations,
  title = "Needs global leadership",
  showChapter = false,
}: {
  escalations: ChapterEscalation[];
  title?: string;
  /** Show the chapter name on each row (for cross-chapter rollups). */
  showChapter?: boolean;
}) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
        {escalations.length > 0 && <StatusBadge tone="danger">{escalations.length}</StatusBadge>}
      </div>

      {escalations.length === 0 ? (
        <EmptyStateV2 title="No escalations" body="No chapter conditions currently need global leadership." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {escalations.map((e) => (
            <li key={e.id} className="rounded-[12px] border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={severityTone(e.severity)}>{SEVERITY_LABEL[e.severity]}</StatusBadge>
                {showChapter && (
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
                    {e.chapterName}
                  </span>
                )}
                <Link href={e.sourceHref} className="text-[13.5px] font-bold text-ink hover:underline">
                  {e.title}
                </Link>
              </div>
              <p className="m-0 mt-1 text-[12.5px] leading-snug text-ink">{e.why}</p>
              <p className="m-0 mt-0.5 text-[12px] text-ink-muted">Evidence: {e.evidence}</p>
              <p className="m-0 mt-1 text-[12.5px] font-semibold text-brand-800">
                → {e.recommendedLeadershipAction}
              </p>
            </li>
          ))}
        </ul>
      )}
    </CardV2>
  );
}
