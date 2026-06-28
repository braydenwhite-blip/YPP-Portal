"use client";

// The six-room Chapter Operating System surface. NOT a dashboard of equal metric
// cards — a permanent set of operating rooms (Partner Network · Teaching
// Organization · Learning Program · Live Classes · Student Community · Chapter
// Growth), each with the same premium structure: mission, key question,
// evidence-backed status, Needs You, a compact evidence table, one recommended
// next action, and deep links into the real records. A shared "Needs You" brief
// sits on top. Read-only and fed entirely by `loadChapterOS`; any blocker can be
// one-click tracked as a real ActionItem (no parallel task system).

import { useState, useTransition } from "react";

import { CardV2, StatusBadge, ButtonLink, EmptyStateV2, cn, type StatusTone } from "@/components/ui-v2";
import { trackChapterBlocker } from "@/lib/chapters/operating-actions";
import type { ChapterOSModel } from "@/lib/chapters/chapter-os";
import type { ChapterRoom, RoomAccent, RoomNeedsItem, RoomTone, RoomStat } from "@/lib/chapters/rooms";

// Decorative per-room identity, mapped to the frozen design-system palette
// (a small dot + a faint header wash). Tone-neutral — status is carried by the
// StatusBadge, never the accent.
const ACCENT: Record<RoomAccent, { dot: string; bar: string }> = {
  violet: { dot: "bg-brand-500", bar: "from-brand-50" },
  sky: { dot: "bg-info-700", bar: "from-info-100" },
  amber: { dot: "bg-progress-700", bar: "from-progress-50" },
  emerald: { dot: "bg-teal-700", bar: "from-teal-50" },
  rose: { dot: "bg-success-700", bar: "from-success-100" },
  indigo: { dot: "bg-brand-700", bar: "from-brand-50" },
};

const STAT_TEXT: Record<RoomTone, string> = {
  neutral: "text-ink",
  success: "text-complete-700",
  warning: "text-progress-700",
  danger: "text-blocked-700",
  info: "text-info-700",
  brand: "text-brand-700",
};

const SEVERITY_TONE: Record<"critical" | "warning" | "info", StatusTone> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};
const SEVERITY_LABEL: Record<"critical" | "warning" | "info", string> = {
  critical: "Critical",
  warning: "Needs attention",
  info: "Heads up",
};

export function ChapterOSRooms({ model }: { model: ChapterOSModel }) {
  return (
    <div className="flex flex-col gap-8">
      <MissionBrief model={model} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {model.rooms.map((room) => (
          <RoomPanel key={room.key} chapterId={model.chapter.id} room={room} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mission Brief + shared Needs You
// ---------------------------------------------------------------------------

function MissionBrief({ model }: { model: ChapterOSModel }) {
  const needs = model.needsYou;
  const critical = needs.filter((n) => n.severity === "critical").length;
  const warning = needs.filter((n) => n.severity === "warning").length;
  const info = needs.filter((n) => n.severity === "info").length;

  return (
    <CardV2 padding="none" className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-50 to-transparent px-6 py-5">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">
          Week {model.weekNumber} · {model.focus}
        </p>
        <h2 className="m-0 mt-1 text-[20px] font-bold text-ink">Your chapter, in six rooms</h2>
        <p className="m-0 mt-1 max-w-2xl text-[13.5px] text-ink-muted">
          Each room answers one question with real evidence — what&rsquo;s happening, why it matters, and the single
          best next move. Everything below is computed from your live data.
        </p>
      </div>

      <div className="border-t border-line-card px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0 text-[15px] font-bold text-ink">What needs you</h3>
          <div className="flex flex-wrap gap-1.5">
            {critical > 0 && <StatusBadge tone="danger">{critical} critical</StatusBadge>}
            {warning > 0 && <StatusBadge tone="warning">{warning} to do</StatusBadge>}
            {info > 0 && <StatusBadge tone="neutral">{info} heads-up</StatusBadge>}
            {needs.length === 0 && <StatusBadge tone="success">All clear</StatusBadge>}
          </div>
        </div>

        {needs.length === 0 ? (
          <p className="m-0 mt-3 text-[13px] text-ink-muted">
            Nothing needs you across all six rooms right now. Keep the momentum going.
          </p>
        ) : (
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            {needs.slice(0, 6).map((n) => (
              <NeedRow key={`${n.roomKey}:${n.key}`} chapterId={model.chapter.id} need={n} showRoom />
            ))}
            {needs.length > 6 && (
              <li className="text-[12.5px] text-ink-muted">
                +{needs.length - 6} more across your rooms — handle the items above first.
              </li>
            )}
          </ul>
        )}
      </div>
    </CardV2>
  );
}

// ---------------------------------------------------------------------------
// Needs row (with Track-as-Action bridge)
// ---------------------------------------------------------------------------

function NeedRow({
  chapterId,
  need,
  showRoom,
}: {
  chapterId: string;
  need: RoomNeedsItem;
  showRoom?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-line-card bg-surface-soft px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={SEVERITY_TONE[need.severity]} withDot>
            {SEVERITY_LABEL[need.severity]}
          </StatusBadge>
          {showRoom && (
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{need.roomTitle}</span>
          )}
        </div>
        <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">{need.title}</p>
        {need.detail && <p className="m-0 text-[12.5px] text-ink-muted">{need.detail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href={need.href} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
          Resolve →
        </a>
        <TrackButton chapterId={chapterId} need={need} />
      </div>
    </li>
  );
}

function TrackButton({ chapterId, need }: { chapterId: string; need: RoomNeedsItem }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  if (state === "done") return <span className="text-[12px] font-semibold text-complete-700">Tracked ✓</span>;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await trackChapterBlocker({
            chapterId,
            blockerKey: need.key,
            title: need.title,
            detail: need.detail,
            severity: need.severity,
            entityType: need.entityType,
            entityId: need.entityId,
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

// ---------------------------------------------------------------------------
// Room panel
// ---------------------------------------------------------------------------

function RoomPanel({ chapterId, room }: { chapterId: string; room: ChapterRoom }) {
  const [open, setOpen] = useState(false);
  const accent = ACCENT[room.accent];
  const topNeeds = room.needs.slice(0, open ? room.needs.length : 2);

  return (
    <CardV2 as="section" padding="none" className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className={cn("bg-gradient-to-br to-transparent px-5 py-4", accent.bar)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", accent.dot)} />
              <h3 className="m-0 truncate text-[16px] font-bold text-ink">{room.title}</h3>
            </div>
            <p className="m-0 mt-1 text-[13px] font-semibold text-ink">{room.question}</p>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">{room.mission}</p>
          </div>
          <StatusBadge tone={room.status.tone} withDot>
            {room.status.label}
          </StatusBadge>
        </div>
        <p className="m-0 mt-2 text-[12px] font-medium text-ink-muted">{room.status.summary}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {/* Stats */}
        <RoomStats stats={room.stats} />

        {/* Recommended next action */}
        <div className="rounded-[10px] border border-brand-100 bg-brand-50/60 px-3.5 py-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-700">Recommended next</p>
          <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">{room.nextAction.text}</p>
          <div className="mt-2">
            <ButtonLink href={room.nextAction.href} variant="secondary" size="sm">
              {room.nextAction.cta}
            </ButtonLink>
          </div>
        </div>

        {/* Needs You (per room) */}
        {room.needs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="m-0 text-[12.5px] font-bold text-ink">Needs you</p>
              <StatusBadge tone={room.needs.some((n) => n.severity === "critical") ? "danger" : "warning"}>
                {room.needs.length}
              </StatusBadge>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {topNeeds.map((n) => (
                <NeedRow key={n.key} chapterId={chapterId} need={n} />
              ))}
            </ul>
          </div>
        )}

        {/* Evidence (collapsible) */}
        {open && <RoomEvidenceTable room={room} />}

        {/* Footer */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-card pt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            {open ? "Hide evidence" : `Show evidence (${room.evidence.totalRows})`}
          </button>
          <a href={room.href} className="text-[12.5px] font-semibold text-ink-muted hover:text-brand-700">
            Open records →
          </a>
        </div>
      </div>
    </CardV2>
  );
}

function RoomStats({ stats }: { stats: RoomStat[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col">
          <span className={cn("text-[19px] font-bold leading-none", STAT_TEXT[s.tone])}>{s.value}</span>
          <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function RoomEvidenceTable({ room }: { room: ChapterRoom }) {
  const { columns, rows, emptyMessage } = room.evidence;
  if (rows.length === 0) {
    return (
      <div className="rounded-[10px] border border-line-card bg-surface-soft px-3.5 py-4">
        <EmptyStateV2 title="Nothing to show yet" body={emptyMessage} />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-[10px] border border-line-card">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-line-card bg-surface-soft text-left">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold uppercase tracking-[0.04em] text-ink-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line-card last:border-0">
              {r.cells.map((cell, i) => (
                <td key={i} className={cn("px-3 py-2", cell.muted ? "text-ink-muted" : "font-medium text-ink")}>
                  {i === 0 && r.href ? (
                    <a href={r.href} className="font-semibold text-brand-700 hover:underline">
                      {cell.text}
                    </a>
                  ) : (
                    cell.text
                  )}
                </td>
              ))}
              <td className="px-3 py-2">
                <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
