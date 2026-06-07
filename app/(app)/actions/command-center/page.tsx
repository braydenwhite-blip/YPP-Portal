import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { loadCommandCenter } from "@/lib/people-strategy/command-center";
import { buildLeadershipBriefing } from "@/lib/people-strategy/leadership-briefing";
import { getPriorPulseSnapshot } from "@/lib/people-strategy/pulse-snapshot";
import { buildPulseTrend, type PulseTrend } from "@/lib/people-strategy/pulse-trend";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import { MOMENTUM_META } from "@/lib/people-strategy/momentum";
import { COMMAND_CENTER_EVENTS } from "@/lib/people-strategy/command-center-events";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { Pill, PriorityPill } from "@/components/people-strategy/pills";
import {
  FollowUpGenerator,
  type FollowUpCandidate,
} from "@/components/people-strategy/follow-up-generator";
import { LeadershipBriefingCard } from "@/components/people-strategy/leadership-briefing-card";
import { TelemetryLink } from "@/components/people-strategy/telemetry-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command Center · People Strategy" };

const SEVERITY_TONE = { high: "overdue", medium: "warning", low: "info" } as const;
const SEVERITY_BORDER = {
  high: "var(--error-color)",
  medium: "var(--warning-color)",
  low: "var(--border)",
} as const;

/** How a metric's rise/fall should be read: completions up = good, risk down = good. */
type DeltaTone = "goodUp" | "goodDown" | "neutral";

function TrendChip({
  label,
  delta,
  tone,
}: {
  label: string;
  delta: number;
  tone: DeltaTone;
}) {
  if (delta === 0) return null;
  const up = delta > 0;
  const arrow = up ? "↑" : "↓";
  const good = tone === "neutral" ? false : up === (tone === "goodUp");
  const bad = tone === "neutral" ? false : !good;
  const color = good
    ? "var(--success-color, #16a34a)"
    : bad
      ? "var(--error-color)"
      : "var(--muted)";
  return (
    <span
      style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color }}
      aria-label={`${label} ${up ? "up" : "down"} ${Math.abs(delta)} versus last week`}
    >
      <span aria-hidden="true">
        {arrow}
        {Math.abs(delta)}
      </span>
    </span>
  );
}

function PulseStat({
  label,
  value,
  accent,
  href,
  delta,
  deltaTone = "neutral",
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  href?: string;
  delta?: number;
  deltaTone?: DeltaTone;
}) {
  const body = (
    <div
      className={`card${href ? " ps-action-card" : ""}`}
      style={{
        padding: "14px 16px",
        flex: "1 1 130px",
        minWidth: 120,
        borderLeft: accent ? "3px solid var(--error-color)" : "3px solid transparent",
        height: "100%",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: accent ? "var(--error-color)" : "inherit", display: "flex", alignItems: "baseline" }}>
        {value}
        {delta != null ? <TrendChip label={label} delta={delta} tone={deltaTone} /> : null}
      </p>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="cc-focusable"
      style={{ textDecoration: "none", color: "inherit", flex: "1 1 130px", minWidth: 120 }}
    >
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>{title}</h2>
      {hint ? <span style={{ fontSize: 12, color: "var(--muted)" }}>{hint}</span> : null}
    </div>
  );
}

export default async function CommandCenterPage() {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const data = await loadCommandCenter(viewer, now);
  const leadershipOrBoard = isLeadershipOrBoard(viewer);
  const showPeople = isPeopleDashboardEnabled() && leadershipOrBoard;

  // Phase 7 — week-over-week movement on the Weekly Pulse. Only for Leadership /
  // Board, whose on-screen view is leadership-wide (matching the cron's snapshot);
  // a scoped officer sees a partial item set, so a delta vs the org-wide snapshot
  // would mislead. Gracefully absent until the weekly cron has logged a prior week.
  const priorPulse = leadershipOrBoard ? await getPriorPulseSnapshot(data.weekStart) : null;
  const trend: PulseTrend | null = priorPulse ? buildPulseTrend(data.pulse, priorPulse) : null;

  const briefing = buildLeadershipBriefing({
    weekStart: data.weekStart,
    pulse: data.pulse,
    attention: data.attention,
    needsSupport: data.needsSupport,
    wins: data.wins,
    consideredCount: data.consideredCount,
    trend,
  });

  const topAttention = data.attention.slice(0, 8);
  const followUpCandidates: FollowUpCandidate[] = data.attention
    .filter((a) => a.severity !== "low")
    .slice(0, 25)
    .map((a) => ({
      id: a.id,
      title: a.title,
      ownerName: a.ownerName,
      dueLabel: a.dueLabel,
      daysOverdue: a.daysOverdue,
    }));

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <ActionCommandBar
        eyebrow="People Strategy · Leadership"
        title="Command Center"
        subtitle="What matters this week — who owns what, what's slipping, and who needs support."
        meta={`Week of ${formatMonthDay(data.weekStart)} · based on ${data.consideredCount} ${
          data.consideredCount === 1 ? "action" : "actions"
        } you can see`}
        actions={
          <Link href="/actions/new" className="button small">
            + New Action
          </Link>
        }
      />

      <ActionTrackerTabs active="command" showPeople={showPeople} />

      {/* Weekly Leadership Pulse */}
      <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionHeader
          title="Weekly Pulse"
          hint={
            trend
              ? `A quick executive read — arrows compare to week of ${formatMonthDay(trend.priorWeekStart)}`
              : "A quick executive read on the week"
          }
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <PulseStat label="Open" value={data.pulse.openTotal} href="/actions/all" delta={trend?.deltas.openTotal} deltaTone="neutral" />
          <PulseStat
            label="Overdue"
            value={data.pulse.overdue}
            accent={data.pulse.overdue > 0}
            href="/actions/all?status=OVERDUE"
            delta={trend?.deltas.overdue}
            deltaTone="goodDown"
          />
          <PulseStat label="Due this week" value={data.pulse.dueThisWeek} delta={trend?.deltas.dueThisWeek} deltaTone="neutral" />
          <PulseStat label="Blocked" value={data.pulse.blocked} href="/actions/all?status=BLOCKED" delta={trend?.deltas.blocked} deltaTone="goodDown" />
          <PulseStat label="Flagged" value={data.pulse.flagged} delta={trend?.deltas.flagged} deltaTone="goodDown" />
          <PulseStat label="No executor" value={data.pulse.unowned} delta={trend?.deltas.unowned} deltaTone="goodDown" />
          <PulseStat label="Completed this wk" value={data.pulse.completedThisWeek} delta={trend?.deltas.completedThisWeek} deltaTone="goodUp" />
        </div>
      </section>

      <div
        className="command-center-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: 20,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* Leadership Attention Queue */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader
              title="Leadership Attention Queue"
              hint={`${data.attention.length} ${data.attention.length === 1 ? "item" : "items"} need a look`}
            />
            {topAttention.length === 0 ? (
              <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
                Nothing is flagged for attention. Everything visible is on track. 🎉
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topAttention.map((entry) => (
                  <TelemetryLink
                    key={entry.id}
                    href={`/actions/${entry.id}`}
                    event={COMMAND_CENTER_EVENTS.attentionItemOpened}
                    eventData={{ actionItemId: entry.id, reason: entry.reason, severity: entry.severity }}
                    className="card ps-action-card cc-focusable"
                    style={{
                      display: "block",
                      padding: "12px 14px",
                      textDecoration: "none",
                      color: "inherit",
                      borderLeft: `3px solid ${SEVERITY_BORDER[entry.severity]}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <strong style={{ fontSize: 14 }}>{entry.title}</strong>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <PriorityPill priority={entry.priority} hideLow />
                        <Pill tone={SEVERITY_TONE[entry.severity]}>{entry.reason}</Pill>
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                      {entry.ownerName}
                      {entry.departmentName ? ` · ${entry.departmentName}` : ""} · Due {entry.dueLabel}
                    </div>
                  </TelemetryLink>
                ))}
                {data.attention.length > topAttention.length ? (
                  <Link href="/actions/all?sort=deadline_asc" className="button outline small" style={{ alignSelf: "flex-start" }}>
                    View all {data.attention.length} in Action Tracker →
                  </Link>
                ) : null}
              </div>
            )}
          </section>

          {/* People Momentum */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader title="People Momentum" hint="Most in need of support first" />
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              A supportive read on follow-through: completions lift momentum; overdue and
              flagged items lower it. It&apos;s a prompt to check in — not a grade.
            </p>
            {data.people.length === 0 ? (
              <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
                No owners yet — assign leads and executors to see momentum here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.people.slice(0, 10).map((person) => {
                  const meta = MOMENTUM_META[person.momentum.label];
                  const f = person.momentum.factors;
                  return (
                    <div key={person.id} className="card" style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 14 }}>{person.name}</strong>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {person.overloaded ? <Pill tone="warning">Heavy load</Pill> : null}
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                        {f.openCount} open · {f.completedRecent} done (14d) · {f.overdue} overdue
                        {f.flagged > 0 ? ` · ${f.flagged} flagged` : ""}
                        {!f.hasRecentActivity ? " · no recent activity" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* Weekly Leadership Briefing */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader title="Weekly Briefing" hint="Copy & share" />
            <LeadershipBriefingCard briefing={briefing} />
          </section>

          {/* Follow-Up Generator */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader title="Follow-Up Generator" hint="Draft a nudge" />
            <FollowUpGenerator candidates={followUpCandidates} />
          </section>

          {/* Highest-risk teams */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader title="Team Risk Radar" />
            {data.teams.length === 0 ? (
              <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
                No team activity yet.
              </div>
            ) : (
              <div className="card" style={{ padding: "8px 0" }}>
                {data.teams.slice(0, 6).map((team) => (
                  <div
                    key={team.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 14px",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{team.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {team.open} open
                      {team.overdue > 0 ? (
                        <span style={{ color: "var(--error-color)" }}> · {team.overdue} overdue</span>
                      ) : null}
                      {team.flagged > 0 ? ` · ${team.flagged} flagged` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top contributors */}
          {data.contributors.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionHeader title="Top Contributors" hint="Last 14 days" />
              <div className="card" style={{ padding: "8px 0" }}>
                {data.contributors.map((c) => (
                  <div
                    key={c.id}
                    style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13 }}
                  >
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: "var(--muted)" }}>
                      {c.completedRecent} completed
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Win Log */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader title="Win Log" hint="Completed this week" />
            {data.wins.length === 0 ? (
              <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
                No wins logged yet this week — they&apos;ll appear here as items are completed.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.wins.slice(0, 8).map((win) => (
                  <Link
                    key={win.id}
                    href={`/actions/${win.id}`}
                    className="card ps-action-card cc-focusable"
                    style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "inherit", borderLeft: "3px solid var(--success-color, #16a34a)" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>✓ {win.title}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                      {win.ownerName}
                      {win.departmentName ? ` · ${win.departmentName}` : ""} · {win.completedLabel}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
