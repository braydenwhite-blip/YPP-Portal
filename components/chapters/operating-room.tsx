"use client";

// A single operating "room" — not a dashboard, a place you enter. It answers one
// question with: an evidence-backed health read, the 3–5 things that need you
// (Action-Tracker style, one-click to track), recent activity, a compact
// evidence table whose rows open the right Entity 360, derived insights, and a
// sticky "next recommended action". Inherits the Action Tracker's design
// language (left-rail cards, quiet section headers, calm spacing, badges).

import { useState, useTransition } from "react";
import Link from "next/link";

import { CardV2, StatusBadge, ButtonLink, EmptyStateV2, cn, type StatusTone } from "@/components/ui-v2";
import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import { RoomEvidence } from "@/components/chapters/operating-evidence";
import { trackChapterBlocker } from "@/lib/chapters/operating-actions";
import {
  ROOM_HEALTH_TONE,
  ROOM_HEALTH_LABEL,
  type ActivityEvent,
  type ActivityTone,
  type NeedsYouItem,
  type NeedsYouSeverity,
  type OperatingDomainSlug,
  type OperatingRoom,
  type RoomHealth,
  type RoomHealthStatus,
  type RoomInsight,
  type RoomMetric,
  type RoomSummary,
} from "@/lib/chapters/operating-rooms";

const HEALTH_DOT: Record<RoomHealthStatus, string> = {
  strong: "bg-complete-500",
  needs_attention: "bg-progress-500",
  critical: "bg-blocked-500",
};

export const HEALTH_PRESENTATION: Record<RoomHealthStatus, { tone: StatusTone; label: string; dot: string }> = {
  strong: { tone: ROOM_HEALTH_TONE.strong, label: ROOM_HEALTH_LABEL.strong, dot: HEALTH_DOT.strong },
  needs_attention: { tone: ROOM_HEALTH_TONE.needs_attention, label: ROOM_HEALTH_LABEL.needs_attention, dot: HEALTH_DOT.needs_attention },
  critical: { tone: ROOM_HEALTH_TONE.critical, label: ROOM_HEALTH_LABEL.critical, dot: HEALTH_DOT.critical },
};

const SEVERITY: Record<NeedsYouSeverity, { tone: StatusTone; label: string; rail: string }> = {
  critical: { tone: "danger", label: "Critical", rail: "border-l-blocked-700" },
  warning: { tone: "warning", label: "Needs attention", rail: "border-l-progress-600" },
  info: { tone: "neutral", label: "Heads up", rail: "border-l-transparent" },
};

const TONE_DOT: Record<ActivityTone, string> = {
  good: "bg-complete-500",
  warn: "bg-progress-500",
  neutral: "bg-idle-300",
};
const INSIGHT_DOT: Record<RoomInsight["tone"], string> = {
  good: "bg-complete-500",
  neutral: "bg-idle-300",
  warn: "bg-progress-500",
  danger: "bg-blocked-500",
};

// ---------------------------------------------------------------------------
// Room navigation — the six rooms with live health dots
// ---------------------------------------------------------------------------

export function RoomNav({ nav, active }: { nav: RoomSummary[]; active: OperatingDomainSlug }) {
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Operating rooms">
      {nav.map((r) => {
        const isActive = r.slug === active;
        return (
          <Link
            key={r.slug}
            href={`/chapter/operating/${r.slug}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-[9px] border px-3 py-1.5 text-[13px] font-semibold transition-colors",
              isActive
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-line-soft bg-surface text-ink-muted hover:border-brand-200 hover:text-ink"
            )}
            title={`${r.title} · ${HEALTH_PRESENTATION[r.health.status].label}`}
          >
            <span aria-hidden>{r.icon}</span>
            <span>{r.short}</span>
            <span aria-hidden className={cn("size-1.5 rounded-full", HEALTH_PRESENTATION[r.health.status].dot)} />
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------

export function OperatingRoomView({
  room,
  nav,
  chapterId,
}: {
  room: OperatingRoom;
  nav: RoomSummary[];
  chapterId: string;
}) {
  return (
    <div className="flex flex-col gap-6 pb-4">
      <RoomNav nav={nav} active={room.slug} />

      <MetricsStrip metrics={room.metrics} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <NeedsYouSection chapterId={chapterId} items={room.needsYou} />
          <RoomEvidence evidence={room.evidence} title="Evidence" />
        </div>
        <aside className="flex flex-col gap-6">
          <HealthCard health={room.health} question={room.question} />
          <RecentActivityCard events={room.recentActivity} />
          <InsightsCard insights={room.insights} />
        </aside>
      </div>

      {room.nextAction ? <StickyNextAction action={room.nextAction} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function MetricsStrip({ metrics }: { metrics: RoomMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-[12px] border border-line-soft bg-surface px-5 py-4 shadow-card">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col">
          <span className="text-[22px] font-bold leading-none text-ink">{m.value}</span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">{m.label}</span>
          {m.hint ? <span className="text-[11.5px] text-ink-muted">{m.hint}</span> : null}
        </div>
      ))}
    </div>
  );
}

function HealthCard({ health, question }: { health: RoomHealth; question: string }) {
  const p = HEALTH_PRESENTATION[health.status];
  return (
    <CardV2 className="flex flex-col gap-3">
      <p className="m-0 text-[12.5px] font-medium text-ink-muted">{question}</p>
      <div className="flex items-center gap-2">
        <StatusBadge tone={p.tone} withDot>
          {p.label}
        </StatusBadge>
        <span className="text-[13px] font-semibold text-ink">{health.headline}</span>
      </div>
      {health.reasons.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {health.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12.5px] text-ink-muted">
              <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", p.dot)} />
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[12.5px] text-ink-muted">No open issues — keep the momentum.</p>
      )}
    </CardV2>
  );
}

function NeedsYouSection({ chapterId, items }: { chapterId: string; items: NeedsYouItem[] }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="m-0 text-[15px] font-bold tracking-[0.01em] text-ink">Needs you</h2>
        <span className="text-[12px] text-ink-muted">{items.length === 0 ? "all clear" : items.length}</span>
      </div>
      {items.length === 0 ? (
        <CardV2>
          <EmptyStateV2 title="Nothing needs you here" body="No open follow-ups, reviews, or risks in this room right now." />
        </CardV2>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.slice(0, 5).map((item) => (
            <NeedsYouCard key={item.key} chapterId={chapterId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NeedsYouCard({ chapterId, item }: { chapterId: string; item: NeedsYouItem }) {
  const sev = SEVERITY[item.severity];
  return (
    <li className={cn("rounded-[10px] border border-line-soft border-l-[3px] bg-surface px-3.5 py-3 shadow-card", sev.rail)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <StatusBadge tone={sev.tone} withDot>
            {sev.label}
          </StatusBadge>
          <p className="m-0 mt-1.5 text-[13.5px] font-semibold text-ink">{item.title}</p>
          {item.detail ? <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">{item.detail}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <ResolveLink item={item} />
          <TrackButton chapterId={chapterId} item={item} />
        </div>
      </div>
    </li>
  );
}

function ResolveLink({ item }: { item: NeedsYouItem }) {
  const cls = "whitespace-nowrap text-[12.5px] font-semibold text-brand-700 hover:underline";
  if (item.entityId) {
    if (item.entityType === "PARTNER")
      return (
        <EntityLink type="partner" id={item.entityId} className={cls}>
          Open →
        </EntityLink>
      );
    if (item.entityType === "INSTRUCTOR_APPLICATION")
      return (
        <EntityLink type="applicant" id={item.entityId} className={cls}>
          Open →
        </EntityLink>
      );
    if (item.entityType === "CLASS_OFFERING")
      return (
        <EntityLink type="class" id={item.entityId} className={cls}>
          Open →
        </EntityLink>
      );
    if (item.entityType === "STUDENT")
      return (
        <PersonLink id={item.entityId} className={cls}>
          Open →
        </PersonLink>
      );
  }
  if (item.href)
    return (
      <a href={item.href} className={cls}>
        Resolve →
      </a>
    );
  return null;
}

function TrackButton({ chapterId, item }: { chapterId: string; item: NeedsYouItem }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  if (state === "done") {
    return <span className="text-[12px] font-semibold text-complete-700">Tracked ✓</span>;
  }

  const supported =
    item.entityType === "PARTNER" || item.entityType === "INSTRUCTOR_APPLICATION" || item.entityType === "CLASS_OFFERING";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await trackChapterBlocker({
            chapterId,
            blockerKey: item.key,
            title: item.suggestedAction,
            detail: item.detail ?? undefined,
            severity: item.severity,
            entityType: supported ? item.entityType : undefined,
            entityId: supported ? item.entityId ?? undefined : undefined,
          });
          setState(res.ok ? "done" : "error");
        })
      }
      className={cn(
        "rounded-[7px] border border-line-card bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-muted",
        "transition-colors hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
      )}
      title="Add this to your Action Tracker"
    >
      {pending ? "…" : state === "error" ? "Retry" : "Track"}
    </button>
  );
}

function RecentActivityCard({ events }: { events: ActivityEvent[] }) {
  return (
    <CardV2 className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[13px] font-bold text-ink">Recent activity</h3>
      {events.length === 0 ? (
        <p className="m-0 text-[12.5px] text-ink-muted">No recent activity yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {events.map((e) => (
            <li key={e.key} className="flex items-baseline gap-2 py-1">
              <span aria-hidden className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", TONE_DOT[e.tone])} />
              <span className="text-[12.5px] font-medium text-ink">{e.label}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">· {e.detail}</span>
              <span className="shrink-0 text-[11px] text-ink-muted">{e.when}</span>
            </li>
          ))}
        </ul>
      )}
    </CardV2>
  );
}

function InsightsCard({ insights }: { insights: RoomInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <CardV2 className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[13px] font-bold text-ink">Insights</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {insights.map((i) => (
          <li key={i.key} className="flex items-start gap-2 text-[12.5px] text-ink">
            <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", INSIGHT_DOT[i.tone])} />
            {i.text}
          </li>
        ))}
      </ul>
    </CardV2>
  );
}

function StickyNextAction({ action }: { action: NonNullable<OperatingRoom["nextAction"]> }) {
  return (
    <div className="sticky bottom-4 z-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] border border-brand-200 bg-gradient-to-r from-brand-50 to-surface px-4 py-3 shadow-card">
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-700">
            <span aria-hidden>⚡</span> Next recommended action
          </p>
          <p className="m-0 mt-0.5 text-[14px] font-medium text-brand-900">{action.text}</p>
        </div>
        <ButtonLink href={action.href} variant="primary" size="sm">
          {action.cta}
        </ButtonLink>
      </div>
    </div>
  );
}
