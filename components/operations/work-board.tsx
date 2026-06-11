"use client";

import Link from "next/link";

import {
  WORK_LANES,
  WORK_LANE_HINTS,
  WORK_LANE_LABELS,
  type WorkBoard,
  type WorkItem,
  type WorkLane,
} from "@/lib/operations/work-items";
import { Pill, type PillTone } from "@/components/people-strategy/pills";

import { RELATED_TO_ENTITY_360 } from "@/lib/operations/entity-360";

import { EntityLink } from "./entity-link";

/**
 * Data 360 — the unified work board. One board for every piece of work,
 * regardless of which tracker it came from: actions and meeting follow-ups
 * share the same card, the same lanes, and the same meaning of "overdue".
 * Follow-ups not yet in the tracker carry a one-click "Track as action" CTA.
 */

const WORK_TONE: Record<WorkItem["tone"], PillTone> = {
  danger: "overdue",
  warning: "warning",
  info: "info",
  success: "success",
  neutral: "neutral",
};

const LANE_EDGE: Record<WorkLane, string> = {
  overdue: "var(--error-color, #991b1b)",
  blocked: "var(--warning-color, #b45309)",
  needs_owner: "var(--warning-color, #b45309)",
  due_soon: "var(--ypp-purple-500, #8b3fe8)",
  in_progress: "var(--info-border, #1d4ed8)",
  not_started: "var(--border, #d1d5db)",
  done_recently: "var(--success-color, #15803d)",
};

const LANE_PREVIEW = 5;

function WorkItemCard({ item }: { item: WorkItem }) {
  const relatedDrawerType = item.relatedType
    ? RELATED_TO_ENTITY_360[item.relatedType]
    : undefined;
  return (
    <div
      className="card ps-action-card"
      style={{ padding: "10px 12px", display: "grid", gap: 5 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <Link
          href={item.href}
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.35,
            minWidth: 0,
            color: "inherit",
            textDecoration: "none",
            overflowWrap: "anywhere",
          }}
        >
          {item.title}
        </Link>
        <Pill tone={WORK_TONE[item.tone]}>{item.status}</Pill>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 11.5,
          color: "var(--text-secondary)",
          alignItems: "baseline",
        }}
      >
        <span>{item.ownerName ?? "No owner"}</span>
        {item.relatedLabel && relatedDrawerType && item.relatedId ? (
          <EntityLink
            type={relatedDrawerType}
            id={item.relatedId}
            style={{ color: "var(--ypp-purple-600, #6b21c8)", fontWeight: 600 }}
          >
            {item.relatedLabel}
          </EntityLink>
        ) : item.relatedLabel ? (
          <span>{item.relatedLabel}</span>
        ) : null}
        {item.meetingTitle ? <span>from {item.meetingTitle}</span> : null}
        <Pill tone={item.kind === "follow_up" ? "purple" : "neutral"}>
          {item.sourceLabel}
        </Pill>
      </div>
      {item.nextStep ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.nextStep}
        </p>
      ) : null}
      {item.convertHref ? (
        <div>
          <Link href={item.convertHref} className="button primary small">
            Track as action
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Lane({ lane, items }: { lane: WorkLane; items: WorkItem[] }) {
  const overflow = items.length - LANE_PREVIEW;
  return (
    <section
      style={{
        minWidth: 0,
        border: "1px solid var(--border-light, rgba(107,33,200,0.08))",
        borderTop: `3px solid ${LANE_EDGE[lane]}`,
        borderRadius: 12,
        padding: 12,
        background: "var(--bg-2, #faf7ff)",
        display: "grid",
        gap: 8,
        alignContent: "start",
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13.5 }}>{WORK_LANE_LABELS[lane]}</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
            {items.length}
          </span>
        </div>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
          {WORK_LANE_HINTS[lane]}
        </p>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", padding: "6px 2px" }}>
          Nothing here — good.
        </p>
      ) : (
        items.slice(0, LANE_PREVIEW).map((item) => <WorkItemCard key={item.id} item={item} />)
      )}
      {overflow > 0 ? (
        <Link
          href="/actions/all"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--ypp-purple-600, #6b21c8)", textDecoration: "none" }}
        >
          +{overflow} more in All Actions →
        </Link>
      ) : null}
    </section>
  );
}

export function UnifiedWorkBoard({ board }: { board: WorkBoard }) {
  // Empty "calm" lanes (nothing overdue/blocked/ownerless) are dropped rather
  // than rendered as seven empty columns; active lanes keep triage order.
  const lanes = WORK_LANES.filter(
    (lane) =>
      board[lane].length > 0 ||
      lane === "due_soon" ||
      lane === "in_progress"
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      {lanes.map((lane) => (
        <Lane key={lane} lane={lane} items={board[lane]} />
      ))}
    </div>
  );
}
