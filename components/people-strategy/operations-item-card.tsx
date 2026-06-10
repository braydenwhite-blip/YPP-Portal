import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  OPERATIONS_KIND_LABELS,
  type OperationsItem,
  type OperationsItemTone,
  type OperationsTimelineItem,
} from "@/lib/people-strategy/operations-summary";
import { Pill, type PillTone } from "./pills";

/**
 * The ONE operations card. Every operations surface — Command Center, Weekly
 * Execution, Initiatives, loose ends, communications, recently decided — renders
 * items through this component so an action, a meeting, a decision, a loose end,
 * a communication, and an initiative all read in the same visual language.
 *
 * Pure server components; nothing here touches the client. The item shape comes
 * from `lib/people-strategy/operations-summary.ts` (one brain, many views).
 */

const KIND_TONE: Record<OperationsItem["kind"], PillTone> = {
  action: "info",
  meeting: "neutral",
  decision: "purple",
  loose_end: "warning",
  communication: "purple",
  initiative: "purple",
};

const STATUS_TONE: Record<OperationsItemTone, PillTone> = {
  danger: "overdue",
  warning: "warning",
  info: "info",
  success: "success",
  neutral: "neutral",
};

const EDGE_COLOR: Record<OperationsItemTone, string> = {
  danger: "#991b1b",
  warning: "#854d0e",
  info: "#1d4ed8",
  success: "#166534",
  neutral: "var(--border, #d1d5db)",
};

function fmt(iso: string | null): string | null {
  return iso ? formatMonthDay(new Date(iso)) : null;
}

export function OperationsItemCard({ item }: { item: OperationsItem }) {
  const due = fmt(item.dueISO);
  return (
    <Link
      href={item.href}
      className="card ps-action-card cc-focusable ops-item-card"
      data-kind={item.kind}
      style={{
        display: "grid",
        gap: 7,
        padding: "12px 14px",
        color: "inherit",
        textDecoration: "none",
        borderLeft: `3px solid ${EDGE_COLOR[item.tone]}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13.5, minWidth: 0 }}>{item.title}</strong>
        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
          <Pill tone={KIND_TONE[item.kind]}>{OPERATIONS_KIND_LABELS[item.kind]}</Pill>
          {item.status ? <Pill tone={STATUS_TONE[item.tone]}>{item.status}</Pill> : null}
        </span>
      </div>
      {item.why ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
          {item.why}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
        <span>Owner: {item.owner ?? "TBD"}</span>
        {due ? <span>Due {due}</span> : null}
        {item.meetingTitle && item.kind !== "meeting" ? <span>From: {item.meetingTitle}</span> : null}
        {item.initiativeTitle && item.kind !== "initiative" ? (
          <span>Initiative: {item.initiativeTitle}</span>
        ) : null}
        {item.relatedLabel ? <span>{item.relatedLabel}</span> : null}
      </div>
      {item.nextStep ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
          <strong style={{ color: "var(--ypp-ink)" }}>Next: </strong>
          {item.nextStep}
        </p>
      ) : null}
    </Link>
  );
}

/**
 * Empty states should teach the system, not just say "nothing here". Pass the
 * canonical copy for the section (see docs/operations-os-simplification.md).
 */
export function OperationsEmptyState({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "grid", gap: 4 }}>
      {title ? <strong style={{ fontSize: 13 }}>{title}</strong> : null}
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

export function OperationsItemList({
  items,
  limit,
  empty,
  columns = false,
}: {
  items: OperationsItem[];
  limit?: number;
  empty: React.ReactNode;
  columns?: boolean;
}) {
  const visible = limit ? items.slice(0, limit) : items;
  if (visible.length === 0) return <>{empty}</>;
  return (
    <div
      style={
        columns
          ? { display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }
          : { display: "grid", gap: 8 }
      }
    >
      {visible.map((item) => (
        <OperationsItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}

const TIMELINE_LABEL: Record<OperationsTimelineItem["kind"], string> = {
  action_created: "Action created",
  action_completed: "Action completed",
  meeting: "Meeting",
  decision: "Decision",
  initiative: "Initiative",
};

const TIMELINE_PILL: Record<OperationsTimelineItem["kind"], PillTone> = {
  action_created: "info",
  action_completed: "success",
  meeting: "neutral",
  decision: "purple",
  initiative: "purple",
};

export function OperationsTimelineList({
  items,
  empty,
}: {
  items: OperationsTimelineItem[];
  empty: React.ReactNode;
}) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
      {items.map((event) => {
        const body = (
          <>
            <span style={{ display: "inline-flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <Pill tone={TIMELINE_PILL[event.kind]}>{TIMELINE_LABEL[event.kind]}</Pill>
              <strong style={{ fontSize: 12.5 }}>{event.title}</strong>
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                {formatMonthDay(new Date(event.occurredAtISO))}
              </span>
            </span>
            {event.detail ? (
              <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {event.detail}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={event.id} style={{ padding: "7px 10px", borderLeft: "2px solid var(--border, #d1d5db)" }}>
            {event.href ? (
              <Link href={event.href} style={{ color: "inherit", textDecoration: "none" }}>
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
