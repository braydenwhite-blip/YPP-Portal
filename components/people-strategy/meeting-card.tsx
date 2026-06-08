"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import { meetingCategoryTone } from "@/lib/people-strategy/meeting-categories";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import {
  Avatar,
  CategoryBadge,
  MeetingStatusBadge,
  Pill,
  PriorityBadge,
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
    <Link
      href={`/actions/meetings/${m.id}`}
      className="mtg-card-link"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
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
            <CategoryBadge category={m.category} />
            <MeetingStatusBadge status={m.effectiveStatus} />
            {(m.priority === "HIGH" || m.priority === "URGENT") && <PriorityBadge priority={m.priority} />}
            <span style={{ flex: 1 }} />
            {m.overdueFollowUps > 0 && (
              <Pill tone="danger" style={{ fontWeight: 700 }}>
                <MeetingIcon name="alert" size={12} />
                {m.overdueFollowUps} overdue
              </Pill>
            )}
          </div>
          {/* title */}
          <h3
            style={{
              margin: 0,
              fontSize: 16.5,
              fontWeight: 800,
              color: "var(--ypp-ink)",
              letterSpacing: "-.01em",
              lineHeight: 1.25,
            }}
          >
            {m.title}
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
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ypp-ink)", whiteSpace: "nowrap" }}>
                    {m.facilitator.name.split(" ")[0]}
                  </span>
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
            <StatChip icon="user" value={m.attendeeCount} label="" />
            <StatChip icon="list" value={`${m.agendaDoneCount}/${m.agendaCount}`} label="" />
            <StatChip icon="bolt" value={m.openLinkedActions} label="" />
            <StatChip icon="flag" value={m.openFollowUps} label="" danger={m.overdueFollowUps > 0} />
          </div>
        </div>
      </div>
    </Link>
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
