import Link from "next/link";

import { EmptyStateV2 } from "@/components/ui-v2";
import { MeetingHubCard } from "@/components/weekly-meetings/meeting-hub-card";
import {
  MeetingsHubAnalytics,
  MEETING_TYPE_COLORS,
} from "@/components/weekly-meetings/meetings-hub-analytics";
import { MeetingsHubTabs, type MeetingsHubView } from "@/components/weekly-meetings/meetings-hub-tabs";
import type { MeetingListItem } from "@/lib/weekly-meetings/meeting-types";
import {
  groupMeetingsByType,
  summarizeMeetingStatuses,
  summarizeMeetingTypes,
} from "@/lib/weekly-meetings/meeting-analytics";

const EMPTY_COPY: Record<MeetingsHubView, { title: string; body: string }> = {
  upcoming: {
    title: "No upcoming meetings",
    body: "Schedule an officer, weekly impact, chapter, or general meeting to get started.",
  },
  past: {
    title: "Nothing in the archive yet",
    body: "Completed and cancelled meetings will collect here.",
  },
  all: {
    title: "No meetings yet",
    body: "Create your first meeting to start running your weekly cadence.",
  },
};

/**
 * The meetings hub body: a tabs row with the New-meeting CTA, the status/type
 * snapshot card, and meetings grouped under colored type headers. Mirrors the
 * Action Tracker hub composition (components/people-strategy/actions-hub.tsx).
 */
export function MeetingsHub({
  meetings,
  view,
}: {
  meetings: MeetingListItem[];
  view: MeetingsHubView;
}) {
  const breakdown = summarizeMeetingStatuses(meetings);
  const bars = summarizeMeetingTypes(meetings);
  const groups = groupMeetingsByType(meetings);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <MeetingsHubTabs active={view} />
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Link
            href="/meetings/new"
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-brand-600 bg-brand-600 px-4 text-[13px] font-semibold text-white no-underline shadow-sm hover:bg-brand-700"
          >
            ＋ New meeting
          </Link>
        </div>
      </div>

      <MeetingsHubAnalytics breakdown={breakdown} bars={bars} />

      {groups.length === 0 ? (
        <EmptyStateV2 icon="📅" title={EMPTY_COPY[view].title} body={EMPTY_COPY[view].body} />
      ) : (
        <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
          {groups.map((group, groupIndex) => (
            <div key={group.type}>
              <header className="flex items-center justify-between gap-3 border-b border-line-soft bg-[#fafafc] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: MEETING_TYPE_COLORS[group.type] }}
                  />
                  <h2
                    className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
                    style={{ color: MEETING_TYPE_COLORS[group.type] }}
                  >
                    {group.label}
                  </h2>
                </div>
                <span className="text-[12px] text-ink-muted">
                  {group.meetings.length} meeting{group.meetings.length === 1 ? "" : "s"}
                </span>
              </header>

              {group.meetings.map((meeting, meetingIndex) => {
                const isLast =
                  groupIndex === groups.length - 1 &&
                  meetingIndex === group.meetings.length - 1;
                return <MeetingHubCard key={meeting.id} meeting={meeting} isLast={isLast} />;
              })}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
