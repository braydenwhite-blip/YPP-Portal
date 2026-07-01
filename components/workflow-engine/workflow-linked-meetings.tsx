import Link from "next/link";

import { CardV2 } from "@/components/ui-v2/card";
import { SectionHeaderV2 } from "@/components/ui-v2/section-header";
import { StatusBadge, type StatusTone } from "@/components/ui-v2/status-badge";
import { MEETING_TYPE_LABELS, type MeetingType } from "@/lib/weekly-meetings/meeting-types";

/**
 * Compact list of the Meetings a workflow instance created (via
 * `WorkflowStepExecution.linkedMeetingId`), for embedding on an entity detail
 * page or instance runner. Presentational only — the caller loads the data
 * with `getWorkflowLinkedMeetingsData` and passes it in.
 */

// No existing meeting-status-tone mapping to copy from; SCHEDULED/IN_PROGRESS
// read as active work (brand), COMPLETED as done (success), CANCELLED as
// inert (neutral) — kept internally consistent with StatusBadge's vocabulary.
const MEETING_STATUS_BADGE_TONE: Record<string, StatusTone> = {
  SCHEDULED: "brand",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

const MEETING_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function WorkflowLinkedMeetings({
  meetings,
}: {
  meetings: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: string;
    type: string;
  }>;
}): JSX.Element | null {
  if (meetings.length === 0) return null;

  return (
    <CardV2 padding="lg">
      <SectionHeaderV2
        title="Linked meetings"
        description="Meetings this workflow scheduled."
      />
      <ul className="mt-3 flex flex-col divide-y divide-line-soft">
        {meetings.map((meeting) => (
          <li key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <Link
                href={`/meetings/${meeting.id}`}
                className="truncate text-[13.5px] font-medium text-ink no-underline hover:text-brand-700"
              >
                {meeting.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-muted">
                <span>{new Date(meeting.scheduledAt).toLocaleString()}</span>
                <span aria-hidden>·</span>
                <span>{MEETING_TYPE_LABELS[meeting.type as MeetingType] ?? meeting.type}</span>
              </div>
            </div>
            <StatusBadge tone={MEETING_STATUS_BADGE_TONE[meeting.status] ?? "neutral"}>
              {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </CardV2>
  );
}
