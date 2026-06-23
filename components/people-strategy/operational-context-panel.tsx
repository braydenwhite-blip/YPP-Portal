import Link from "next/link";

import type { ActionItemStatus } from "@prisma/client";

import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";
import { effectiveDeadline } from "@/lib/people-strategy/my-actions-selectors";
import type { MeetingCardDTO } from "@/lib/people-strategy/meeting-card-types";
import type { OperationalHealth } from "@/lib/people-strategy/operational-context";
import type {
  DecisionContextDTO,
  FollowUpContextDTO,
} from "@/lib/people-strategy/operational-context-queries";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";

import { OperationalHealthBadge } from "./operational-badges";
import { Pill } from "./pills";

/**
 * The OperationalContextPanel — the cross-portal nervous system rendered as one
 * cohesive card. Given a surface's already-loaded meetings + actions + follow-ups
 * + decisions + a health read, it answers, in one place: what is happening here,
 * who owns it, what meeting produced it, what is overdue, and where to go next.
 *
 * Pure presentational server component (no "use client", no data loading), so
 * every calling page owns the feature gate + permission + data load. It composes
 * the shared badges so it never copy-pastes row UI, and ships
 * excellent empty states + create-from-context CTAs that reinforce the operating
 * rhythm.
 */

const STATUS_TONE: Record<ActionItemStatus, string> = {
  NOT_STARTED: "#6b7280",
  IN_PROGRESS: "#1d4ed8",
  BLOCKED: "#854d0e",
  COMPLETE: "#166534",
  OVERDUE: "#991b1b",
  DROPPED: "#6b7280",
};

const SETTLED: ReadonlySet<ActionItemStatus> = new Set<ActionItemStatus>([
  "COMPLETE",
  "DROPPED",
]);

function ActionLine({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const status = effectiveStatus(item, now);
  const leadName = item.lead?.name ?? item.lead?.email ?? "Unassigned";
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10,
        borderLeft: `3px solid ${STATUS_TONE[status]}`,
        paddingLeft: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Link href={`/actions/${item.id}`} style={{ fontSize: 13, fontWeight: 600, color: "inherit", textDecoration: "none" }}>
          {item.title}
        </Link>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
          <span>
            {leadName} · due {formatMonthDay(effectiveDeadline(item))}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_TONE[status], whiteSpace: "nowrap" }}>
        {ACTION_STATUS_LABELS[status]}
      </span>
    </li>
  );
}

function SubLabel({ children, hint }: { children: React.ReactNode; hint?: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "2px 0 8px" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--muted)" }}>
        {children}
      </span>
      {hint ? <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{hint}</span> : null}
    </div>
  );
}

export function OperationalContextPanel({
  title,
  subtitle,
  health,
  meetings,
  actions,
  openFollowUps = [],
  recentDecisions = [],
  now = new Date(),
  createActionHref = null,
  createMeetingHref = null,
  viewAllHref = null,
  canCreate = false,
  maxMeetings = 4,
  maxActions = 5,
  emptyActionsHint = "No open actions are connected here yet.",
  emptyMeetingsHint = "Not discussed in a tracked meeting yet.",
}: {
  title: string;
  subtitle?: React.ReactNode;
  health: OperationalHealth;
  meetings: MeetingCardDTO[];
  actions: ActionItemWithRelations[];
  openFollowUps?: FollowUpContextDTO[];
  recentDecisions?: DecisionContextDTO[];
  now?: Date;
  createActionHref?: string | null;
  createMeetingHref?: string | null;
  viewAllHref?: string | null;
  canCreate?: boolean;
  maxMeetings?: number;
  maxActions?: number;
  emptyActionsHint?: string;
  emptyMeetingsHint?: string;
}) {
  const openActions = actions.filter((a) => !SETTLED.has(effectiveStatus(a, now)));
  const overdueActions = actions.filter((a) => effectiveStatus(a, now) === "OVERDUE").length;
  const shownActions = openActions.slice(0, maxActions);
  const remainingActions = openActions.length - shownActions.length;
  const isEmpty = meetings.length === 0 && actions.length === 0;

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* header: title + health */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {title}
          </h2>
          {subtitle ? (
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>{subtitle}</p>
          ) : null}
        </div>
        <OperationalHealthBadge health={health} />
      </div>

      {/* stat strip */}
      {!isEmpty ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5 }}>
          <Stat label="Open" value={openActions.length} />
          <Stat label="Overdue" value={overdueActions} danger={overdueActions > 0} />
          <Stat label="Meetings" value={meetings.length} />
          <Stat label="Follow-ups" value={openFollowUps.length} />
        </div>
      ) : null}

      {isEmpty ? (
        <div style={{ padding: "6px 0" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Nothing is connected here yet — link a meeting or create an action to start the operating rhythm.
          </p>
        </div>
      ) : (
        <>
          {/* open actions */}
          <div>
            <SubLabel hint={openActions.length > 0 ? `${openActions.length} open${overdueActions > 0 ? ` · ${overdueActions} overdue` : ""}` : null}>
              Open actions
            </SubLabel>
            {openActions.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>{emptyActionsHint}</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {shownActions.map((item) => (
                  <ActionLine key={item.id} item={item} now={now} />
                ))}
                {remainingActions > 0 ? (
                  <li style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 13 }}>+ {remainingActions} more</li>
                ) : null}
              </ul>
            )}
          </div>

          {/* open follow-ups */}
          {openFollowUps.length > 0 ? (
            <div>
              <SubLabel>Open follow-ups</SubLabel>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {openFollowUps.map((f) => (
                  <li key={f.id} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      {f.effectiveStatus === "overdue" ? (
                        <span style={{ color: "var(--error-color)", fontWeight: 700, marginRight: 5 }}>Overdue</span>
                      ) : null}
                      {f.title}
                      <Link href={`/meetings/${f.meetingId}`} style={{ color: "var(--muted)", marginLeft: 6, fontSize: 11.5, textDecoration: "none" }}>
                        · {f.meetingTitle}
                      </Link>
                    </span>
                    <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {f.ownerName ?? "Unassigned"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* recent decisions */}
          {recentDecisions.length > 0 ? (
            <div>
              <SubLabel>Recent decisions</SubLabel>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {recentDecisions.map((d) => (
                  <li key={d.id} style={{ fontSize: 12.5 }}>
                    {d.decision}
                    <Link href={`/meetings/${d.meetingId}`} style={{ color: "var(--muted)", marginLeft: 6, fontSize: 11.5, textDecoration: "none" }}>
                      · {d.meetingTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {/* CTAs */}
      {canCreate && (createActionHref || createMeetingHref || viewAllHref) ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 2 }}>
          {createActionHref ? (
            <Link href={createActionHref} className="button primary" style={{ fontSize: 13 }}>
              Create action
            </Link>
          ) : null}
          {createMeetingHref ? (
            <Link href={createMeetingHref} className="button" style={{ fontSize: 13 }}>
              Schedule meeting
            </Link>
          ) : null}
          {viewAllHref ? (
            <Link href={viewAllHref} className="button outline" style={{ fontSize: 13 }}>
              View all related work
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
      <strong style={{ fontSize: 15, fontWeight: 800, color: danger ? "var(--error-color)" : "var(--ypp-ink)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
    </span>
  );
}

export default OperationalContextPanel;
