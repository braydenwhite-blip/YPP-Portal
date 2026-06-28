import Link from "next/link";

import { EmptyStateV2, StatusBadge } from "@/components/ui-v2";
import { MeetingHubCard } from "@/components/weekly-meetings/meeting-hub-card";
import { MeetingsHubTabs, type MeetingsHubView } from "@/components/weekly-meetings/meetings-hub-tabs";
import type { MeetingListItem } from "@/lib/weekly-meetings/meeting-types";

const EMPTY_COPY: Record<MeetingsHubView, { title: string; body: string }> = {
  upcoming: {
    title: "No upcoming meetings",
    body: "Create one — officer, impact, chapter, or general.",
  },
  past: {
    title: "Nothing past yet",
    body: "Completed meetings show up here.",
  },
  all: {
    title: "No meetings yet",
    body: "Create your first meeting to get started.",
  },
};

/** Flat chronological list — no analytics, no type groups. */
export function MeetingsHub({
  meetings,
  view,
}: {
  meetings: MeetingListItem[];
  view: MeetingsHubView;
}) {
  const sorted = [...meetings].sort((a, b) => {
    const dir = view === "past" ? -1 : 1;
    return a.scheduledISO.localeCompare(b.scheduledISO) * dir;
  });

  return (
    <div className="flex flex-col gap-4">
      <MeetingsHubTabs active={view} count={sorted.length} />

      {sorted.length === 0 ? (
        <EmptyStateV2
          icon="📅"
          title={EMPTY_COPY[view].title}
          body={EMPTY_COPY[view].body}
          action={
            view !== "past" ? (
              <Link
                href="/meetings/new"
                className="inline-flex items-center rounded-full border border-brand-600 bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white no-underline shadow-sm hover:bg-brand-700"
              >
                New meeting
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="overflow-hidden rounded-[16px] border border-line-card bg-surface shadow-card">
          {sorted.map((meeting, index) => (
            <MeetingHubCard
              key={meeting.id}
              meeting={meeting}
              isLast={index === sorted.length - 1}
            />
          ))}
        </section>
      )}
    </div>
  );
}
