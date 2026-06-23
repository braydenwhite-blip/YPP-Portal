import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import type { EffectiveMeetingStatus } from "@/lib/people-strategy/meetings-status";

import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import {
  meetingCategoryIdentity,
  meetingCategoryTone,
} from "@/lib/people-strategy/meeting-categories";
import { Pill, type PillTone } from "./pills";

/**
 * Cross-portal "meetings related to this surface" list — the meeting twin of
 * LinkedActionsPanel. A pure presentational server component over already-loaded
 * MeetingCardDTOs, so each calling page owns the data load + feature gate. Brings
 * its own card so it drops cleanly into any layout.
 */

const STATUS_META: Record<EffectiveMeetingStatus, { label: string; tone: PillTone }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  today: { label: "Today", tone: "purple" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  needs_follow_up: { label: "Needs follow-up", tone: "warning" },
  canceled: { label: "Cancelled", tone: "neutral" },
};

/** One meeting row, reused by the standalone list and the context panel. */
export function MeetingLine({ meeting }: { meeting: MeetingCardDTO }) {
  const tone = meetingCategoryTone(meeting.category);
  const icon = meetingCategoryIdentity(meeting.category).icon as MeetingIconName;
  const status = STATUS_META[meeting.effectiveStatus];
  const followUpHint =
    meeting.overdueFollowUps > 0
      ? `${meeting.overdueFollowUps} overdue follow-up${meeting.overdueFollowUps === 1 ? "" : "s"}`
      : meeting.openFollowUps > 0
        ? `${meeting.openFollowUps} open follow-up${meeting.openFollowUps === 1 ? "" : "s"}`
        : meeting.decisionCount > 0
          ? `${meeting.decisionCount} decision${meeting.decisionCount === 1 ? "" : "s"}`
          : null;

  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          flex: "0 0 auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          color: tone.fg,
          marginTop: 1,
        }}
      >
        <MeetingIcon name={icon} size={14} stroke={2} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <Link
            href={`/meetings/${meeting.id}`}
            style={{ fontSize: 13, fontWeight: 600, color: "inherit", textDecoration: "none", minWidth: 0 }}
          >
            {meeting.title}
          </Link>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {formatMonthDay(new Date(meeting.startISO))}
          {meeting.facilitator ? ` · ${meeting.facilitator.name}` : ""}
          {followUpHint ? ` · ${followUpHint}` : ""}
        </div>
      </div>
    </li>
  );
}

export function RelatedMeetingsList({
  meetings,
  heading = "Related meetings",
  emptyHint = "This area has not been discussed in a tracked meeting yet.",
  createHref = null,
  createLabel = "Schedule a meeting",
  canCreate = false,
  limit = 6,
}: {
  meetings: MeetingCardDTO[];
  heading?: string;
  emptyHint?: string;
  createHref?: string | null;
  createLabel?: string;
  canCreate?: boolean;
  limit?: number;
}) {
  const shown = meetings.slice(0, limit);
  const remaining = meetings.length - shown.length;
  const needsFollowUp = meetings.filter((m) => m.effectiveStatus === "needs_follow_up").length;

  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h2 className="section-title" style={{ margin: 0 }}>
          {heading}
        </h2>
        {meetings.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {meetings.length} total
            {needsFollowUp > 0 ? ` · ${needsFollowUp} need follow-up` : ""}
          </span>
        ) : null}
      </div>

      {meetings.length === 0 ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
          {emptyHint}
        </p>
      ) : (
        <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {shown.map((m) => (
            <MeetingLine key={m.id} meeting={m} />
          ))}
          {remaining > 0 ? (
            <li style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 36 }}>
              + {remaining} more
            </li>
          ) : null}
        </ul>
      )}

      {canCreate && createHref ? (
        <p style={{ margin: "12px 0 0" }}>
          <Link href={createHref} className="button" style={{ fontSize: 13 }}>
            {createLabel}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export default RelatedMeetingsList;
