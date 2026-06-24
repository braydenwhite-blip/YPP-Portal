import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import { cn } from "@/components/ui-v2/cn";
import type { MeetingListItem, MeetingStatus } from "@/lib/weekly-meetings/meeting-types";

const STATUS_TONE: Record<MeetingStatus, StatusTone> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One meeting row inside a type group. The whole row links into the runner. */
export function MeetingHubCard({
  meeting,
  isLast = false,
}: {
  meeting: MeetingListItem;
  isLast?: boolean;
}) {
  const { counts } = meeting;
  const metaChips: Array<{ key: string; icon: string; label: string }> = [];
  if (counts.attendees > 0)
    metaChips.push({ key: "attendees", icon: "👥", label: `${counts.attendees}` });
  if (counts.topics > 0)
    metaChips.push({ key: "topics", icon: "🗂", label: `${counts.topics}` });
  if (counts.decisions > 0)
    metaChips.push({ key: "decisions", icon: "✅", label: `${counts.decisions}` });
  if (counts.followUps > 0)
    metaChips.push({ key: "followUps", icon: "↪", label: `${counts.followUps}` });

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      aria-label={`Open meeting: ${meeting.title}`}
      className={cn(
        "block cursor-pointer px-4 py-3.5 no-underline transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-400",
        !isLast && "border-b border-line-soft"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[14px] font-bold leading-snug text-ink">
          {meeting.title}
        </span>
        <StatusBadge tone={STATUS_TONE[meeting.status]}>
          {meeting.status.replace("_", " ")}
        </StatusBadge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span aria-hidden className="text-[11px]">
            🕑
          </span>
          {fmtDateTime(meeting.scheduledISO)}
        </span>
        {meeting.scopeLabel ? <span>{meeting.scopeLabel}</span> : null}
        {meeting.facilitator ? (
          <span>
            Owner: <span className="font-medium text-ink">{meeting.facilitator.name}</span>
          </span>
        ) : null}
      </div>

      {metaChips.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#b4b4c6]">
          {metaChips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1">
              <span aria-hidden>{chip.icon}</span>
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
