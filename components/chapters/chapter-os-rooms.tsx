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

import { CardV2, StatusBadge, ButtonLink, Button, EmptyStateV2, cn, type StatusTone } from "@/components/ui-v2";
import { trackChapterBlocker } from "@/lib/chapters/operating-actions";
import { saveChapterKpiSnapshot, logPartnerFollowUp } from "@/lib/chapters/room-action-server";
import { relativeAgo } from "@/lib/chapters/format";
import type { RoomActivityItem } from "@/lib/chapters/room-activity";
import {
  cpApproveCurriculum,
  sendCurriculumToGlobalReview,
  globalApproveCurriculum,
  globalRequestCurriculumRevision,
  type CurriculumReviewResult,
} from "@/lib/chapters/curriculum-review-server";
import type { ChapterOSModel } from "@/lib/chapters/chapter-os";
import type { ChapterRoom, RoomAccent, RoomNeedsItem, RoomTone, RoomStat, RoomKey } from "@/lib/chapters/rooms";
import type { ChapterRoomWithActions, ChapterRoomAction } from "@/lib/chapters/room-actions";

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
      <RecentActivity items={model.recentActivity} nowISO={model.nowISO} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent activity — a unified, real feed across all six rooms
// ---------------------------------------------------------------------------

const ROOM_SHORT: Record<RoomKey, string> = {
  partner_network: "Partner Network",
  teaching_org: "Teaching Org",
  learning_program: "Learning Program",
  live_classes: "Live Classes",
  student_community: "Student Community",
  chapter_growth: "Chapter Growth",
};

const ROOM_DOT: Record<RoomKey, string> = {
  partner_network: "bg-brand-500",
  teaching_org: "bg-info-700",
  learning_program: "bg-progress-700",
  live_classes: "bg-teal-700",
  student_community: "bg-success-700",
  chapter_growth: "bg-brand-700",
};

function RecentActivity({ items, nowISO }: { items: RoomActivityItem[]; nowISO: string }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const now = new Date(nowISO);
  const shown = expanded ? items : items.slice(0, 6);

  return (
    <CardV2 padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line-card px-6 py-4">
        <div>
          <h3 className="m-0 text-[15px] font-bold text-ink">Recent activity</h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">The latest real events across your six rooms.</p>
        </div>
        <StatusBadge tone="neutral">{items.length}</StatusBadge>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 border-b border-line-card px-6 py-3 last:border-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", ROOM_DOT[item.roomKey])} />
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                  {ROOM_SHORT[item.roomKey]}
                </span>
              </div>
              <a
                href={item.href}
                className="mt-0.5 block truncate text-[13.5px] font-semibold text-ink hover:text-brand-700"
              >
                {item.title}
              </a>
              {item.description && <p className="m-0 truncate text-[12px] text-ink-muted">{item.description}</p>}
            </div>
            <span className="shrink-0 text-[12px] text-ink-muted">{relativeAgo(new Date(item.occurredAt), now)}</span>
          </li>
        ))}
      </ul>
      {items.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-line-card px-6 py-2.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          {expanded ? "Show less" : `Show ${items.length - 6} more`}
        </button>
      )}
    </CardV2>
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

function RoomPanel({ chapterId, room }: { chapterId: string; room: ChapterRoomWithActions }) {
  const [open, setOpen] = useState(false);
  const accent = ACCENT[room.accent];
  const topNeeds = room.needs.slice(0, open ? room.needs.length : 2);
  const primary = room.actions.find((a) => a.primary) ?? room.actions[0] ?? null;
  const secondary = room.actions.filter((a) => a !== primary);

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

        {/* Primary action + recommendation */}
        <div className="rounded-[10px] border border-brand-100 bg-brand-50/60 px-3.5 py-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-700">Recommended next</p>
          <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">{room.nextAction.text}</p>
          {primary && (
            <div className="mt-2.5">
              <ActionControl chapterId={chapterId} action={primary} prominent />
            </div>
          )}
        </div>

        {/* Secondary room actions */}
        {secondary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {secondary.map((a) => (
              <ActionControl key={a.roomActionId} chapterId={chapterId} action={a} />
            ))}
          </div>
        )}

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
                <NeedLine key={n.key} need={n} />
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

// ---------------------------------------------------------------------------
// Room actions (link · track · mutate) — small, Action-Tracker-style chips with
// inline success/error/disabled state. No modals; the one text-entry action
// (log follow-up) expands a compact inline composer.
// ---------------------------------------------------------------------------

/** A compact in-room need line (no Track here — Track lives in the action bar). */
function NeedLine({ need }: { need: RoomNeedsItem }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-[9px] border border-line-card bg-surface-soft px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge tone={SEVERITY_TONE[need.severity]} withDot>
            {SEVERITY_LABEL[need.severity]}
          </StatusBadge>
          <span className="truncate text-[13px] font-semibold text-ink">{need.title}</span>
        </div>
        {need.detail && <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{need.detail}</p>}
      </div>
      <a href={need.href} className="shrink-0 text-[12.5px] font-semibold text-brand-700 hover:underline">
        Resolve →
      </a>
    </li>
  );
}

function ActionControl({
  chapterId,
  action,
  prominent,
}: {
  chapterId: string;
  action: ChapterRoomAction;
  prominent?: boolean;
}) {
  if (action.disabledReason) return <DisabledChip action={action} />;
  if (action.kind === "link") return <LinkChip action={action} prominent={prominent} />;
  if (action.kind === "track") return <TrackChip chapterId={chapterId} action={action} />;
  if (action.mutation?.handler === "saveKpiSnapshot")
    return <SaveSnapshotChip chapterId={chapterId} action={action} prominent={prominent} />;
  if (action.mutation?.handler === "logPartnerFollowUp")
    return <LogFollowUpControl chapterId={chapterId} action={action} prominent={prominent} />;
  if (action.mutation?.handler === "globalRequestCurriculumRevision")
    return <CurriculumRevisionControl chapterId={chapterId} action={action} prominent={prominent} />;
  if (
    action.mutation?.handler === "cpApproveCurriculum" ||
    action.mutation?.handler === "sendCurriculumToGlobalReview" ||
    action.mutation?.handler === "globalApproveCurriculum"
  )
    return <CurriculumOneClickControl chapterId={chapterId} action={action} prominent={prominent} />;
  return <LinkChip action={action} prominent={prominent} />;
}

const CHIP =
  "inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors";

function LinkChip({ action, prominent }: { action: ChapterRoomAction; prominent?: boolean }) {
  if (prominent) {
    return (
      <ButtonLink href={action.href} variant="primary" size="sm">
        {action.label}
      </ButtonLink>
    );
  }
  return (
    <a
      href={action.href}
      title={action.description}
      className={cn(CHIP, "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700")}
    >
      {action.label} →
    </a>
  );
}

function DisabledChip({ action }: { action: ChapterRoomAction }) {
  return (
    <span
      title={action.disabledReason}
      className={cn(CHIP, "cursor-not-allowed border-dashed border-line-card bg-surface-soft text-ink-faint")}
    >
      {action.label}
      <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-faint">Soon</span>
    </span>
  );
}

function TrackChip({ chapterId, action }: { chapterId: string; action: ChapterRoomAction }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  if (!action.track) return null;
  if (state === "done") return <span className="text-[12px] font-semibold text-complete-700">Tracked ✓</span>;
  const t = action.track;
  return (
    <button
      type="button"
      disabled={pending}
      title={action.description}
      onClick={() =>
        startTransition(async () => {
          const res = await trackChapterBlocker({
            chapterId,
            blockerKey: t.blockerKey,
            title: t.title,
            detail: t.detail,
            severity: t.severity,
            entityType: t.entityType,
            entityId: t.entityId,
          });
          setState(res.ok ? "done" : "error");
        })
      }
      className={cn(CHIP, "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700 disabled:opacity-50")}
    >
      {pending ? "…" : state === "error" ? "Retry Track" : "Track"}
    </button>
  );
}

function SaveSnapshotChip({
  chapterId,
  action,
  prominent,
}: {
  chapterId: string;
  action: ChapterRoomAction;
  prominent?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });

  function run() {
    startTransition(async () => {
      const res = await saveChapterKpiSnapshot({ chapterId });
      if (res.ok) setState({ kind: "done", msg: `Saved ✓ (week of ${res.weekStartISO})` });
      else setState({ kind: "error", msg: res.error });
    });
  }

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">{state.msg}</span>;

  return (
    <div className="flex items-center gap-2">
      {prominent ? (
        <Button variant="primary" size="sm" onClick={run} loading={pending} disabled={pending}>
          {action.label}
        </Button>
      ) : (
        <button
          type="button"
          disabled={pending}
          title={action.description}
          onClick={run}
          className={cn(CHIP, "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700 disabled:opacity-50")}
        >
          {pending ? "Saving…" : action.label}
        </button>
      )}
      {state.kind === "error" && <span className="text-[12px] font-semibold text-blocked-700">{state.msg}</span>}
    </div>
  );
}

function LogFollowUpControl({
  chapterId,
  action,
  prominent,
}: {
  chapterId: string;
  action: ChapterRoomAction;
  prominent?: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const partnerId = action.mutation?.entityId;

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">Logged ✓</span>;

  if (!composing) {
    return prominent ? (
      <Button variant="primary" size="sm" onClick={() => setComposing(true)}>
        {action.label}
      </Button>
    ) : (
      <button
        type="button"
        title={action.description}
        onClick={() => setComposing(true)}
        className={cn(CHIP, "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700")}
      >
        {action.label}
      </button>
    );
  }

  function submit() {
    if (!partnerId || !note.trim()) return;
    startTransition(async () => {
      const res = await logPartnerFollowUp({
        chapterId,
        partnerId,
        note: note.trim(),
        nextFollowUpAt: date ? new Date(date).toISOString() : undefined,
      });
      if (res.ok) setState({ kind: "done" });
      else setState({ kind: "error", msg: res.error });
    });
  }

  return (
    <div className="w-full rounded-[10px] border border-line-card bg-surface-soft p-3">
      <p className="m-0 mb-1.5 text-[12px] font-bold text-ink">Log follow-up</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="What happened? (logs a touchpoint and stamps last contact)"
        className="w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand-400"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          Next follow-up
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[7px] border border-line-card bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-brand-400"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          {state.kind === "error" && <span className="text-[12px] font-semibold text-blocked-700">{state.msg}</span>}
          <button
            type="button"
            onClick={() => setComposing(false)}
            className="text-[12px] font-semibold text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending || !note.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Two-stage curriculum review controls ----------------------------------

const CURRICULUM_ONE_CLICK: Record<
  string,
  {
    fn: (input: { chapterId: string; classTemplateId: string }) => Promise<CurriculumReviewResult>;
    doing: string;
    done: string;
  }
> = {
  cpApproveCurriculum: { fn: cpApproveCurriculum, doing: "Approving…", done: "CP approved ✓" },
  sendCurriculumToGlobalReview: { fn: sendCurriculumToGlobalReview, doing: "Sending…", done: "Sent to global ✓" },
  globalApproveCurriculum: { fn: globalApproveCurriculum, doing: "Approving…", done: "Fully approved ✓" },
};

/** One-click curriculum stage advance (CP approve · send to global · global approve). */
function CurriculumOneClickControl({
  chapterId,
  action,
  prominent,
}: {
  chapterId: string;
  action: ChapterRoomAction;
  prominent?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const classTemplateId = action.mutation?.entityId;
  const cfg = action.mutation ? CURRICULUM_ONE_CLICK[action.mutation.handler] : undefined;

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">{state.msg}</span>;
  if (!cfg || !classTemplateId) return <LinkChip action={action} prominent={prominent} />;

  function run() {
    if (!cfg || !classTemplateId) return;
    startTransition(async () => {
      const res = await cfg.fn({ chapterId, classTemplateId });
      if (res.ok) setState({ kind: "done", msg: cfg.done });
      else setState({ kind: "error", msg: res.error });
    });
  }

  return (
    <div className="flex items-center gap-2">
      {prominent ? (
        <Button variant="primary" size="sm" onClick={run} loading={pending} disabled={pending}>
          {action.label}
        </Button>
      ) : (
        <button
          type="button"
          disabled={pending}
          title={action.description}
          onClick={run}
          className={cn(CHIP, "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700 disabled:opacity-50")}
        >
          {pending ? cfg.doing : action.label}
        </button>
      )}
      {state.kind === "error" && <span className="text-[12px] font-semibold text-blocked-700">{state.msg}</span>}
    </div>
  );
}

/** Global "send back for revision" — a compact composer that requires notes. */
function CurriculumRevisionControl({
  chapterId,
  action,
  prominent,
}: {
  chapterId: string;
  action: ChapterRoomAction;
  prominent?: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const classTemplateId = action.mutation?.entityId;

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">Sent back ✓</span>;

  if (!composing) {
    return prominent ? (
      <Button variant="secondary" size="sm" onClick={() => setComposing(true)}>
        {action.label}
      </Button>
    ) : (
      <button
        type="button"
        title={action.description}
        onClick={() => setComposing(true)}
        className={cn(CHIP, "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700")}
      >
        {action.label}
      </button>
    );
  }

  function submit() {
    if (!classTemplateId || !notes.trim()) return;
    startTransition(async () => {
      const res = await globalRequestCurriculumRevision({ chapterId, classTemplateId, notes: notes.trim() });
      if (res.ok) setState({ kind: "done" });
      else setState({ kind: "error", msg: res.error });
    });
  }

  return (
    <div className="w-full rounded-[10px] border border-line-card bg-surface-soft p-3">
      <p className="m-0 mb-1.5 text-[12px] font-bold text-ink">Send back for revision</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="What needs to change before global approval?"
        className="w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand-400"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {state.kind === "error" && <span className="text-[12px] font-semibold text-blocked-700">{state.msg}</span>}
        <button
          type="button"
          onClick={() => setComposing(false)}
          className="text-[12px] font-semibold text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
        <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending || !notes.trim()}>
          Send back
        </Button>
      </div>
    </div>
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
