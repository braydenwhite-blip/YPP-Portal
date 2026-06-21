"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import { meetingCategoryTone } from "@/lib/people-strategy/meeting-categories";
import { meetingNextAction } from "@/lib/people-strategy/meeting-command-center";
import { meetingOperatingModel } from "@/lib/people-strategy/meeting-operating-model";
import { relatedEntityTypeLabel } from "@/lib/people-strategy/constants";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import {
  Avatar,
  CategoryBadge,
  MeetingStatusBadge,
  Pill,
} from "./meeting-ui";

/** A small icon + value + label stat used in the meeting card footer. */
function StatChip({
  icon,
  value,
  label,
  danger,
}: {
  icon: MeetingIconName;
  value: string | number;
  label?: string;
  danger?: boolean;
}) {
  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12.5,
        fontWeight: 600,
        color: danger ? "var(--danger-fg)" : "var(--text-secondary)",
      }}
    >
      <MeetingIcon name={icon} size={14} style={{ color: danger ? "var(--danger-fg)" : "var(--muted)" }} />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {label ? <span style={{ color: "var(--muted)", fontWeight: 500 }}>{label}</span> : null}
    </span>
  );
}

function timeString(m: MeetingCardDTO): string {
  if (m.effectiveStatus === "in_progress") return "In progress";
  const d = new Date(m.startISO);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}

export function MeetingCard({ meeting: m }: { meeting: MeetingCardDTO }) {
  const c = meetingCategoryTone(m.category);
  const model = meetingOperatingModel(m.meetingType);
  // The one primary action for this meeting, chosen by the command-center
  // priority ladder (Open / Add agenda / Add notes / Create actions / …).
  const next = meetingNextAction({
    ...m,
    hasRelatedEntity: !!m.relatedEntityType && !!m.relatedEntityId,
  });
  const accentTime: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontWeight: 600,
    color:
      m.effectiveStatus === "today" || m.effectiveStatus === "in_progress"
        ? "var(--ypp-purple-700)"
        : "var(--text-secondary)",
  };

  return (
    <div
      className="mtg-card-link"
      style={{ color: "inherit", display: "block" }}
    >
      <div
        className="mtg-card"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderLeft: `3px solid ${c.dot}`,
          borderRadius: 16,
          boxShadow: "0 1px 2px rgba(28,20,60,.04), 0 6px 16px -8px rgba(28,20,60,.10)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "15px 16px 13px", display: "flex", flexDirection: "column", gap: 11 }}>
          {/* badge row */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <Pill tone="purple" style={{ fontWeight: 800 }}>
              {model.shortLabel}
            </Pill>
            <CategoryBadge category={m.category} />
            <MeetingStatusBadge status={m.effectiveStatus} />
            {m.relatedEntityType ? (
              <Pill tone="purple" style={{ fontWeight: 700 }}>
                {relatedEntityTypeLabel(m.relatedEntityType)}
              </Pill>
            ) : null}
            {m.relatedTeam ? <Pill tone="info">{m.relatedTeam}</Pill> : null}
            {m.relatedChapter ? <Pill tone="info">{m.relatedChapter}</Pill> : null}
            <span style={{ flex: 1 }} />
            {m.overdueFollowUps > 0 && (
              <Pill tone="danger" style={{ fontWeight: 700 }}>
                <MeetingIcon name="alert" size={12} />
                {m.overdueFollowUps} overdue
              </Pill>
            )}
          </div>
          {/* title — opens the Meeting 360 panel in place; modifier clicks
              still navigate to the full meeting workspace. */}
          <h3
            style={{
              margin: 0,
              fontSize: 16.5,
              fontWeight: 800,
              letterSpacing: "-.01em",
              lineHeight: 1.25,
            }}
          >
            <EntityLink type="meeting" id={m.id} style={{ color: "var(--ypp-ink)" }}>
              {m.title}
            </EntityLink>
          </h3>
          {/* time meta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 12.5,
              color: "var(--muted)",
              flexWrap: "wrap",
            }}
          >
            <span style={accentTime}>
              <MeetingIcon name="clock" size={14} />
              {timeString(m)}
            </span>
            {m.durationLabel && <span>{m.durationLabel}</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <MeetingIcon name="people" size={13} />
              {m.requiredAttendeeCount ?? m.attendeeCount} required
            </span>
            {m.recurrence && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MeetingIcon name="repeat" size={13} />
                {recurrenceLabel(m.recurrence)}
              </span>
            )}
          </div>
        </div>
        {/* footer */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "11px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: "var(--rail)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {m.facilitator ? (
              <>
                <Avatar name={m.facilitator.name} size={26} />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <PersonLink
                    id={m.facilitator.id}
                    style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ypp-ink)", whiteSpace: "nowrap" }}
                  >
                    {m.facilitator.name.split(" ")[0]}
                  </PersonLink>
                  <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>Facilitator</span>
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MeetingIcon name="alert" size={13} style={{ color: "var(--warn-fg)" }} />
                No facilitator
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatChip
              icon="user"
              value={`${m.attendanceRecordedCount ?? 0}/${m.requiredAttendeeCount ?? m.attendeeCount ?? 0}`}
              label="attendance"
              danger={(m.attendanceConcernCount ?? 0) > 0}
            />
            <StatChip icon="list" value={`${m.agendaDoneCount}/${m.agendaCount}`} label="" />
            <StatChip icon="bolt" value={m.openLinkedActions} label="" />
            <StatChip icon="flag" value={m.openFollowUps} label="" danger={m.overdueFollowUps > 0} />
            <Link
              href={next.href}
              title={next.reason}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--ypp-purple-600, #6b21c8)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {next.label} →
            </Link>
            <Link
              href={`/actions/meetings/${m.id}#attendance`}
              title="Mark attendance"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text-secondary)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Attendance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function recurrenceLabel(r: string): string {
  const map: Record<string, string> = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Bi-weekly",
    MONTHLY: "Monthly",
    NONE: "One-time",
  };
  return map[r] ?? r;
}
