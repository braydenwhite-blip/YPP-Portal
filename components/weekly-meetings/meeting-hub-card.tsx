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

/** One meeting row — title, when, type, status. */
export function MeetingHubCard({
  meeting,
  isLast = false,
}: {
  meeting: MeetingListItem;
  isLast?: boolean;
}) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      aria-label={`Open meeting: ${meeting.title}`}
      className={cn(
        "block cursor-pointer px-4 py-3.5 no-underline transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-400",
        !isLast && "border-b border-line-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-bold leading-snug text-ink">{meeting.title}</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">{fmtDateTime(meeting.scheduledISO)}</p>
        </div>
        <StatusBadge tone={STATUS_TONE[meeting.status]}>
          {meeting.status.replace("_", " ")}
        </StatusBadge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-muted">
          {meeting.typeLabel}
        </span>
        {meeting.scopeLabel ? (
          <span className="text-[12px] text-ink-muted">{meeting.scopeLabel}</span>
        ) : null}
        {meeting.facilitator ? (
          <span className="text-[12px] text-ink-muted">{meeting.facilitator.name}</span>
        ) : null}
        {meeting.counts.attendees > 0 ? (
          <span className="text-[12px] text-ink-muted">{meeting.counts.attendees} invited</span>
        ) : null}
      </div>
    </Link>
  );
}
