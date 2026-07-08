"use client";

// The Meetings lane: upcoming, current, and recent meetings for this chapter,
// each showing its decisions, follow-ups (owner + status + due date), and
// attendees — the first place a Chapter President can see this without
// opening every meeting individually.

import { useState, useTransition } from "react";

import { CardV2, StatusBadge, ButtonLink, EmptyStateV2 } from "@/components/ui-v2";
import { trackMeetingFollowUpAsAction } from "@/lib/chapters/meetings-lane-server";
import type { MeetingsLaneView, MeetingLaneItem } from "@/lib/chapters/meetings-lane";

const FOLLOW_UP_TONE: Record<MeetingLaneItem["followUps"][number]["status"], "success" | "warning" | "neutral"> = {
  COMPLETED: "success",
  IN_PROGRESS: "neutral",
  OPEN: "warning",
};

function TrackFollowUpButton({ chapterId, meetingId, followUpId }: { chapterId: string; meetingId: string; followUpId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  if (state === "done") return <span className="text-[11.5px] font-semibold text-complete-700">Tracked ✓</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await trackMeetingFollowUpAsAction({ chapterId, meetingId, followUpId });
          setState(res.ok ? "done" : "error");
        })
      }
      className="text-[11.5px] font-semibold text-brand-700 hover:underline disabled:opacity-50"
    >
      {pending ? "…" : state === "error" ? "Retry" : "Track as action"}
    </button>
  );
}

function MeetingCard({ chapterId, meeting }: { chapterId: string; meeting: MeetingLaneItem }) {
  const when = new Date(meeting.scheduledAtISO).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <a href={meeting.href} className="text-[13.5px] font-semibold text-brand-700 hover:underline">
            {meeting.title}
          </a>
          <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
            {when}
            {meeting.facilitatorName ? ` · Facilitated by ${meeting.facilitatorName}` : ""}
            {meeting.partner ? ` · ${meeting.partner.name}` : ""}
          </p>
        </div>
        <StatusBadge tone={meeting.status === "IN_PROGRESS" ? "brand" : meeting.status === "COMPLETED" ? "success" : "neutral"}>
          {meeting.status.replace(/_/g, " ")}
        </StatusBadge>
      </div>

      {meeting.decisions.length > 0 && (
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">Decisions</p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {meeting.decisions.map((d) => (
              <li key={d.id} className="text-[12.5px] text-ink">
                {d.decision} {d.decidedByName && <span className="text-ink-muted">— {d.decidedByName}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {meeting.followUps.length > 0 && (
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">Follow-ups</p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
            {meeting.followUps.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-card bg-surface-soft px-2.5 py-1.5">
                <div className="min-w-0">
                  <span className="text-[12.5px] font-medium text-ink">{f.title}</span>
                  <span className="ml-2 text-[11.5px] text-ink-muted">
                    {f.ownerName ?? "Unassigned"}
                    {f.dueDateISO ? ` · due ${new Date(f.dueDateISO).toLocaleDateString()}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge tone={FOLLOW_UP_TONE[f.status]}>{f.status.replace(/_/g, " ")}</StatusBadge>
                  {f.status !== "COMPLETED" && <TrackFollowUpButton chapterId={chapterId} meetingId={meeting.id} followUpId={f.id} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meeting.attendees.length > 0 && (
        <p className="m-0 text-[11.5px] text-ink-muted">
          Attendees: {meeting.attendees.map((a) => a.name).join(", ")}
        </p>
      )}

      {meeting.type === "CHAPTER_IMPACT" && (
        <a href="/chapter/impact" className="text-[12px] font-semibold text-brand-700 hover:underline">
          Prep impact brief →
        </a>
      )}
    </CardV2>
  );
}

function Section({ title, meetings, chapterId, emptyMessage }: { title: string; meetings: MeetingLaneItem[]; chapterId: string; emptyMessage: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">{title}</h3>
        <StatusBadge tone="neutral">{meetings.length}</StatusBadge>
      </div>
      {meetings.length === 0 ? (
        <p className="m-0 text-[12.5px] text-ink-muted">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {meetings.map((m) => (
            <MeetingCard key={m.id} chapterId={chapterId} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LaneMeetings({ chapterId, view }: { chapterId: string; view: MeetingsLaneView }) {
  const isEmpty = view.current.length === 0 && view.upcoming.length === 0 && view.recent.length === 0;

  if (isEmpty) {
    return (
      <CardV2 padding="lg">
        <EmptyStateV2
          title="No meetings yet"
          body="Meetings scheduled for this chapter — officer syncs, partner meetings, the weekly Impact Meeting — show up here with their decisions and follow-ups."
          action={<ButtonLink href="/chapter/calendar">Open calendar</ButtonLink>}
        />
      </CardV2>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] font-semibold text-ink">{view.headline}</p>
        <ButtonLink href="/chapter/calendar" variant="secondary" size="sm">
          Open calendar
        </ButtonLink>
      </div>
      <Section title="Current" meetings={view.current} chapterId={chapterId} emptyMessage="Nothing happening right now." />
      <Section title="Upcoming" meetings={view.upcoming} chapterId={chapterId} emptyMessage="Nothing scheduled yet." />
      <Section title="Recent" meetings={view.recent} chapterId={chapterId} emptyMessage="No past meetings yet." />
    </div>
  );
}
