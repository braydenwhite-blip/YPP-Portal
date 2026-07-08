// The one card shape every lane record renders through: name + owner +
// concrete status + next step + related-record chips. This is the "no
// dead-end lists" enforcement point for the five-lane rebuild — every record
// a Chapter President sees always shows who owns it, what's true about it
// right now, and the single next move, with links out to whatever else it
// connects to (never just a name with nowhere to go).

import Link from "next/link";

import { CardV2 } from "@/components/ui-v2";
import { LaneStatusBadge } from "@/components/chapters/lane-status-badge";
import type { LaneRecord } from "@/lib/chapters/lanes";

export function LaneRecordCard({ record, action }: { record: LaneRecord; action?: React.ReactNode }) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={record.href} className="text-[13.5px] font-semibold text-brand-700 hover:underline">
            {record.name}
          </Link>
          {record.subtitle && <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{record.subtitle}</p>}
        </div>
        <LaneStatusBadge status={record.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
        <span>
          <span className="font-semibold text-ink">Owner:</span> {record.owner?.name ?? "Unassigned"}
        </span>
        <span>
          <span className="font-semibold text-ink">Next:</span> {record.nextStep}
        </span>
      </div>

      {record.related.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {record.related.map((ref) => (
            <Link
              key={`${ref.kind}:${ref.id}:${ref.label}`}
              href={ref.href}
              className="rounded-[7px] border border-line-card bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              {ref.label} →
            </Link>
          ))}
        </div>
      )}

      {action && <div className="pt-1">{action}</div>}
    </CardV2>
  );
}
