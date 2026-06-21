"use client";

import Link from "next/link";

import { relatedEntityTypeLabel } from "@/lib/people-strategy/constants";
import {
  PRIMARY_MEETING_MODE_META,
  computeWrapUpState,
  meetingNextAction,
  selectPrimaryMeeting,
} from "@/lib/people-strategy/meeting-command-center";
import { meetingOperatingModel } from "@/lib/people-strategy/meeting-operating-model";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import { MeetingIcon } from "./meeting-icons";
import { Card, MeetingButton, Pill, fmtDate, fmtTime } from "./meeting-ui";

/**
 * The Meetings page's primary card — it answers "what meeting matters right
 * now?" before anything else on the page. Picks one meeting via
 * {@link selectPrimaryMeeting} (live → next → needs-wrap-up) and shows just the
 * context leadership needs plus the single most useful action. Computed entirely
 * from the cards already on the page, so it adds no extra query.
 */
export function MeetingNowNextCard({
  meetings,
  nowISO,
}: {
  meetings: MeetingCardDTO[];
  nowISO: string;
}) {
  const now = new Date(nowISO);
  const selection = selectPrimaryMeeting(
    meetings.map((m) => ({ ...m, hasRelatedEntity: !!m.relatedEntityType && !!m.relatedEntityId })),
    now
  );

  if (!selection) {
    return (
      <Card style={{ padding: "18px 20px" }}>
        <span style={EYEBROW_STYLE}>What matters now</span>
        <h2 style={{ margin: "6px 0 0", fontSize: 18, color: "var(--ypp-ink)" }}>
          No meeting needs you right now.
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.45 }}>
          Nothing is live, nothing is coming up this week, and every finished meeting is wrapped up.
        </p>
      </Card>
    );
  }

  const { meeting: m, mode } = selection;
  const model = meetingOperatingModel(m.meetingType);
  const meta = PRIMARY_MEETING_MODE_META[mode];
  const next = meetingNextAction({
    ...m,
    hasRelatedEntity: !!m.relatedEntityType && !!m.relatedEntityId,
  });
  const wrapUp = mode === "wrap_up" ? computeWrapUpState(m) : null;

  const accent =
    meta.tone === "warning"
      ? "var(--warn-fg, #a45a09)"
      : meta.tone === "info"
        ? "var(--info-fg, #2a5bb8)"
        : "var(--ypp-purple-600)";

  return (
    <Card
      style={{
        padding: "18px 20px",
        borderColor: mode === "wrap_up" ? "var(--warn-border, #f6dfb4)" : "var(--border)",
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <span style={{ ...EYEBROW_STYLE, color: accent }}>
            {mode === "current" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={LIVE_DOT} />
                {meta.eyebrow}
              </span>
            ) : (
              meta.eyebrow
            )}
          </span>
          <h2 style={{ margin: "7px 0 0", fontSize: 21, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: "-.01em" }}>
            <Link href={`/actions/meetings/${m.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {m.title}
            </Link>
          </h2>

          {/* When / who */}
          <div style={META_ROW_STYLE}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <MeetingIcon name="clock" size={14} />
              {mode === "current"
                ? "Happening now"
                : `${fmtDate(m.startISO)} · ${fmtTime(m.startISO)}`}
            </span>
            {m.facilitator ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MeetingIcon name="user" size={14} />
                {m.facilitator.name}
              </span>
            ) : null}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <MeetingIcon name="user" size={14} />
              {m.attendeeCount} {m.attendeeCount === 1 ? "attendee" : "attendees"}
            </span>
            {m.relatedEntityType ? (
              <Pill tone="purple" style={{ fontWeight: 700 }}>
                {relatedEntityTypeLabel(m.relatedEntityType)}
              </Pill>
            ) : null}
            <Pill tone="purple" style={{ fontWeight: 700 }}>
              {model.shortLabel}
            </Pill>
            {m.categoryLabel ? <span>{m.categoryLabel}</span> : null}
          </div>

          {m.purpose ? (
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.45, maxWidth: 620 }}>
              {m.purpose}
            </p>
          ) : null}

          {/* Status chips: agenda / notes / decisions / open actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
            <StatusChip
              label="Agenda"
              value={m.agendaCount === 0 ? "Not set" : `${m.agendaDoneCount}/${m.agendaCount}`}
              warn={m.agendaCount === 0}
            />
            <StatusChip label="Notes" value={m.hasNotes ? "Added" : "Missing"} warn={!m.hasNotes && mode !== "next"} />
            <StatusChip
              label="Attendance"
              value={`${m.attendanceRecordedCount ?? 0}/${m.requiredAttendeeCount ?? m.attendeeCount ?? 0}`}
              warn={(m.attendanceConcernCount ?? 0) > 0}
            />
            <StatusChip label="Decisions" value={String(m.decisionCount)} />
            <StatusChip label="Open actions" value={String(m.openLinkedActions)} />
            {m.overdueFollowUps > 0 ? (
              <StatusChip label="Overdue" value={String(m.overdueFollowUps)} warn />
            ) : null}
          </div>

          {/* Wrap-up readout — never hides what's missing. */}
          {wrapUp ? (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 7 }}>
              {wrapUp.items.map((item) => (
                <span
                  key={item.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: item.ok ? "var(--text-secondary)" : "var(--warn-fg, #a45a09)",
                  }}
                >
                  <MeetingIcon name={item.ok ? "check" : "alert"} size={13} />
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch", flex: "0 0 auto" }}>
          <Link href={next.href} style={{ textDecoration: "none" }}>
            <MeetingButton icon="arrowR">{next.label}</MeetingButton>
          </Link>
          {next.reason ? (
            <span style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.35, maxWidth: 220 }}>
              {next.reason}
            </span>
          ) : null}
          <Link href={`/actions/meetings/${m.id}`} style={{ textDecoration: "none" }}>
            <MeetingButton variant="outline" icon="calendar">
              Open workspace
            </MeetingButton>
          </Link>
        </div>
      </div>
    </Card>
  );
}

const EYEBROW_STYLE: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ypp-purple-600)",
};

const META_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 9,
  fontSize: 12.5,
  color: "var(--muted)",
};

const LIVE_DOT: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "var(--info-fg, #2a5bb8)",
  display: "inline-block",
};

function StatusChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid var(--border)",
        borderRadius: 999,
        background: "var(--surface)",
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: warn ? "var(--warn-fg, #a45a09)" : "var(--text-secondary)",
      }}
    >
      {label}
      <strong style={{ color: warn ? "var(--warn-fg, #a45a09)" : "var(--ypp-ink)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
    </span>
  );
}
