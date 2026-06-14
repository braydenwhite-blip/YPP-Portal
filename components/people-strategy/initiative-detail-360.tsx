import Link from "next/link";

import { EmptyStateV2, KeyFactsGrid, RecordSection, type KeyFact } from "@/components/ui-v2";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  deriveInitiativeAttention,
  lastMeetingEvent,
  nextMeetingEvent,
  nextOpenMilestone,
  primaryNextStep,
} from "@/lib/people-strategy/strategic-initiative-attention";
import type { InitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";

import { AttentionChips } from "./initiative-hub";
import { Pill } from "./pills";
import { ProgressBar } from "./strategic-initiatives";

/**
 * YPP Execution OS — Initiative 360 detail building blocks.
 *
 * The connective-tissue sections of the initiative detail surface: a plain-spoken
 * "needs attention" banner, the summary head (objective / owner / status /
 * timeline / next step), and the Meetings & decisions section that links an
 * initiative to where it was discussed. Composed with the existing milestone /
 * timeline / ownership / risk components. Pure presentational server components.
 */

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

/** Loud-but-calm banner: exactly why this initiative needs attention, in words. */
export function InitiativeAttentionBanner({
  initiative,
  now,
}: {
  initiative: InitiativeSummary;
  now: Date;
}) {
  const reasons = deriveInitiativeAttention(initiative, now);
  if (reasons.length === 0) return null;
  const critical = reasons.some((r) => r.tone === "overdue");
  const accent = critical ? "var(--error-color, #991b1b)" : "var(--warning-color, #854d0e)";

  return (
    <section
      className="card"
      style={{ padding: 16, borderLeft: `4px solid ${accent}` }}
      aria-label="Needs attention"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Needs attention</strong>
        <AttentionChips reasons={reasons} max={6} />
      </div>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 4, fontSize: 12.5, color: "var(--text-secondary)" }}>
        {reasons.map((r) => (
          <li key={r.key}>{r.detail}</li>
        ))}
      </ul>
    </section>
  );
}

/** Summary head: objective, owner, status, timeline, next step, progress. */
export function InitiativeSummaryHead({
  initiative,
}: {
  initiative: InitiativeSummary;
}) {
  const i = initiative;
  const next = nextOpenMilestone(i);
  const nextStep = primaryNextStep(i);

  const timeline =
    i.startDateISO && i.targetDateISO
      ? `${fmt(i.startDateISO)} → ${fmt(i.targetDateISO)}`
      : i.targetDateISO
        ? `Target ${fmt(i.targetDateISO)}`
        : i.startDateISO
          ? `Started ${fmt(i.startDateISO)}`
          : "No dates set";

  const facts: KeyFact[] = [
    { label: "Status", value: i.statusLabel },
    { label: "Owner", value: i.owner ?? "Unassigned", tone: i.owner ? "default" : "attention" },
    {
      label: "Timeline",
      value: timeline,
      tone: i.pastTargetDate ? "attention" : "default",
    },
    {
      label: "Next milestone",
      value: next ? next.title : "All complete",
      detail: next?.targetDateISO ? `${next.behindSchedule ? "overdue " : "due "}${fmt(next.targetDateISO)}` : undefined,
      tone: next?.behindSchedule ? "attention" : "default",
    },
  ];

  return (
    <RecordSection id="summary" title="Summary" description={i.description}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <Pill tone="purple">{i.priorityLabel}</Pill>
        <Pill tone="neutral">{i.areaLabel}</Pill>
      </div>

      <KeyFactsGrid facts={facts} className="grid-cols-2 sm:grid-cols-4" />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <ProgressBar percent={i.progress.percent} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {i.progress.percent}%
        </span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
        {i.progress.completedActions}/{i.progress.totalTracked} actions complete ·{" "}
        {i.counts.milestonesComplete}/{i.counts.milestonesTotal} milestones
      </p>

      <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: "var(--ypp-purple, #6b21c8)" }}>Next step: </span>
        {nextStep}
      </p>
    </RecordSection>
  );
}

function MeetingRow({
  href,
  title,
  meta,
  tone = "neutral",
}: {
  href: string;
  title: string;
  meta: string;
  tone?: "neutral" | "watch";
}) {
  return (
    <li>
      <Link
        href={href}
        className="card cc-focusable"
        style={{
          display: "block",
          padding: "8px 12px",
          textDecoration: "none",
          color: "inherit",
          borderLeft: `3px solid ${tone === "watch" ? "var(--warning-color, #854d0e)" : "var(--border, #e5e7eb)"}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <strong style={{ fontSize: 13, minWidth: 0 }}>{title}</strong>
          <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{meta}</span>
        </div>
      </Link>
    </li>
  );
}

/**
 * Meetings & decisions — the meetings where this initiative was discussed, the
 * decisions recorded there, and a link to convert open follow-ups into action.
 */
export function InitiativeMeetingsSection({
  initiative,
}: {
  initiative: InitiativeSummary;
}) {
  const i = initiative;
  const upcoming = i.timeline.upcoming.filter((e) => e.type === "meeting");
  const recent = i.timeline.events.filter((e) => e.type === "meeting");
  const decisions = i.timeline.events.filter((e) => e.type === "decision");
  const hasAny = upcoming.length > 0 || recent.length > 0 || decisions.length > 0;

  const followUpHref = `/actions/meetings`;

  return (
    <RecordSection
      id="meetings"
      title="Meetings & decisions"
      description="Where this initiative was discussed, what was decided, and what still needs follow-up."
      action={
        <Link
          href={followUpHref}
          className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
        >
          Meetings →
        </Link>
      }
    >
      {!hasAny ? (
        <EmptyStateV2
          title="No related meetings yet"
          body="When a meeting discusses this initiative — or records a decision that matches it — it will show here. Log it from the Meetings tracker."
          className="py-8"
        />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {i.counts.openFollowUps > 0 || i.counts.decisionsWithoutAction > 0 ? (
            <p className="m-0 text-[12.5px] text-ink-muted">
              {i.counts.openFollowUps > 0 ? `${i.counts.openFollowUps} open follow-up${i.counts.openFollowUps === 1 ? "" : "s"}` : null}
              {i.counts.openFollowUps > 0 && i.counts.decisionsWithoutAction > 0 ? " · " : null}
              {i.counts.decisionsWithoutAction > 0 ? `${i.counts.decisionsWithoutAction} decision${i.counts.decisionsWithoutAction === 1 ? "" : "s"} to convert into action` : null}
            </p>
          ) : null}

          {upcoming.length > 0 ? (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)" }}>
                Upcoming
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {upcoming.slice(0, 5).map((e) => (
                  <MeetingRow key={e.id} href={e.href} title={e.title} meta={fmt(e.occurredAtISO)} />
                ))}
              </ul>
            </div>
          ) : null}

          {recent.length > 0 ? (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)" }}>
                Recent meetings
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {recent.slice(0, 6).map((e) => (
                  <MeetingRow
                    key={e.id}
                    href={e.href}
                    title={e.title}
                    meta={fmt(e.occurredAtISO)}
                    tone={e.severity === "watch" ? "watch" : "neutral"}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {decisions.length > 0 ? (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--muted)" }}>
                Decisions
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {decisions.slice(0, 6).map((e) => (
                  <MeetingRow key={e.id} href={e.href} title={e.title} meta={fmt(e.occurredAtISO)} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </RecordSection>
  );
}
