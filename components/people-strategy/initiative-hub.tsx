import Link from "next/link";

import { EmptyStateV2 } from "@/components/ui-v2";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  deriveInitiativeAttention,
  lastMeetingEvent,
  nextMeetingEvent,
  nextOpenMilestone,
  primaryNextStep,
  type AttentionReason,
} from "@/lib/people-strategy/strategic-initiative-attention";
import type { InitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";

import { Pill } from "./pills";
import { ProgressBar } from "./strategic-initiatives";

/**
 * YPP Execution OS — Initiatives HUB cards (list / hub view).
 *
 * The scannable rebuild of the initiatives index: every card answers the six
 * questions an officer has at a glance — what it is, who owns it, where it
 * stands, the next milestone + due date, the open actions driving it, the last /
 * next meeting that discussed it, the one clear next step, and (loudly) whether
 * it needs attention right now. Pure presentational server components built on
 * the shared Pill / ProgressBar primitives so the hub looks native. The page
 * owns the feature gate + officer guard + derivation.
 */

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

/** Left-rail accent: red when blocked/overdue, amber for any other attention. */
function cardAccent(reasons: AttentionReason[], summary: InitiativeSummary): string {
  if (reasons.some((r) => r.tone === "overdue")) return "var(--error-color, #991b1b)";
  if (reasons.length > 0) return "var(--warning-color, #854d0e)";
  if (summary.status === "completed") return "var(--success-color, #16a34a)";
  if (summary.status === "archived") return "var(--border, #9ca3af)";
  return "var(--success-color, #16a34a)";
}

const ATTENTION_TONE_TO_PILL = {
  overdue: "overdue",
  warning: "warning",
  info: "info",
  neutral: "neutral",
} as const;

export function AttentionChips({
  reasons,
  max = 4,
}: {
  reasons: AttentionReason[];
  max?: number;
}) {
  if (reasons.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {reasons.slice(0, max).map((r) => (
        <Pill key={r.key} tone={ATTENTION_TONE_TO_PILL[r.tone]}>
          {r.label}
        </Pill>
      ))}
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" | "default" }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 12.5,
          fontWeight: 600,
          color: tone === "danger" ? "var(--error-color, #991b1b)" : "var(--text-primary, inherit)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function InitiativeHubCard({
  initiative,
  now,
}: {
  initiative: InitiativeSummary;
  now: Date;
}) {
  const i = initiative;
  const reasons = deriveInitiativeAttention(i, now);
  const next = nextOpenMilestone(i);
  const lastMeeting = lastMeetingEvent(i);
  const nextMeeting = nextMeetingEvent(i);
  const nextStep = primaryNextStep(i);
  const accent = cardAccent(reasons, i);

  const meetingFact = nextMeeting
    ? `Next · ${nextMeeting.title} (${fmt(nextMeeting.occurredAtISO)})`
    : lastMeeting
      ? `Last · ${lastMeeting.title} (${fmt(lastMeeting.occurredAtISO)})`
      : "No related meetings";

  return (
    <Link
      href={i.href}
      className="card ps-action-card cc-focusable"
      style={{
        display: "block",
        padding: 16,
        textDecoration: "none",
        color: "inherit",
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15, minWidth: 0 }}>{i.title}</strong>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Pill tone="neutral">{i.statusLabel}</Pill>
          {i.priority === "flagship" || i.priority === "high" ? (
            <Pill tone="purple">{i.priorityLabel}</Pill>
          ) : null}
        </span>
      </div>

      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {i.description}
      </p>

      {reasons.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <AttentionChips reasons={reasons} />
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <ProgressBar percent={i.progress.percent} tone={accent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {i.progress.percent}%
        </span>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        }}
      >
        <Fact label="Owner" value={i.owner ?? "Unassigned"} tone={i.owner ? "default" : "danger"} />
        <Fact
          label="Next milestone"
          value={
            next ? (
              <>
                {next.title}
                {next.targetDateISO ? (
                  <span style={{ color: next.behindSchedule ? "var(--error-color, #991b1b)" : "var(--muted)", fontWeight: 500 }}>
                    {" "}· {next.behindSchedule ? "overdue " : "due "}
                    {fmt(next.targetDateISO)}
                  </span>
                ) : null}
              </>
            ) : (
              "All milestones complete"
            )
          }
        />
        <Fact
          label="Open actions"
          value={
            <>
              {i.counts.openActions}
              {i.counts.overdueActions > 0 ? (
                <span style={{ color: "var(--error-color, #991b1b)", fontWeight: 500 }}> · {i.counts.overdueActions} overdue</span>
              ) : null}
            </>
          }
        />
        <Fact label="Meeting" value={meetingFact} />
      </div>

      <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-secondary)", borderTop: "1px solid var(--border, #eee)", paddingTop: 8 }}>
        <span style={{ fontWeight: 700, color: "var(--ypp-purple, #6b21c8)" }}>Next step: </span>
        {nextStep}
      </div>
    </Link>
  );
}

export function InitiativeHubList({
  initiatives,
  now,
  empty,
}: {
  initiatives: InitiativeSummary[];
  now: Date;
  empty: { title: string; body: string; action?: React.ReactNode };
}) {
  if (initiatives.length === 0) {
    return <EmptyStateV2 title={empty.title} body={empty.body} action={empty.action} />;
  }
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
      {initiatives.map((i) => (
        <InitiativeHubCard key={i.id} initiative={i} now={now} />
      ))}
    </div>
  );
}

/** "By owner" grouping — one section per owner, unassigned last. */
export function InitiativeHubByOwner({
  initiatives,
  now,
}: {
  initiatives: InitiativeSummary[];
  now: Date;
}) {
  if (initiatives.length === 0) {
    return (
      <EmptyStateV2
        title="No initiatives yet"
        body="Once initiatives are configured they'll be grouped by their owner here."
      />
    );
  }

  const groups = new Map<string, InitiativeSummary[]>();
  for (const i of initiatives) {
    const key = i.owner ?? "Unassigned";
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === "Unassigned") return 1;
    if (b[0] === "Unassigned") return -1;
    return a[0].localeCompare(b[0]);
  });

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {ordered.map(([owner, list]) => (
        <section key={owner} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>{owner}</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {list.length} initiative{list.length === 1 ? "" : "s"}
            </span>
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {list.map((i) => (
              <InitiativeHubCard key={i.id} initiative={i} now={now} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
