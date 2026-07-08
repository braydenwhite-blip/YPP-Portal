"use client";

// The interactive mutation controls shared across lane panels: Track-as-Action
// (every lane's needs list), Save KPI snapshot (the Growth strip), Log partner
// follow-up (Partners lane), and the two-stage curriculum one-click / revision
// controls (Instructors lane's Curriculum section). Extracted from the
// six-room surface so the five lanes reuse the exact same, already-working
// mutations rather than re-implementing them.

import { useState, useTransition } from "react";

import { Button, cn } from "@/components/ui-v2";
import { trackChapterBlocker } from "@/lib/chapters/operating-actions";
import { saveChapterKpiSnapshot, logPartnerFollowUp } from "@/lib/chapters/room-action-server";
import {
  cpApproveCurriculum,
  sendCurriculumToGlobalReview,
  globalApproveCurriculum,
  globalRequestCurriculumRevision,
  type CurriculumReviewResult,
} from "@/lib/chapters/curriculum-review-server";
import type { RoomNeedsItem } from "@/lib/chapters/rooms";

const CHIP =
  "inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors";
const CHIP_IDLE = "border-line-card bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700 disabled:opacity-50";

export function TrackButton({ chapterId, need }: { chapterId: string; need: RoomNeedsItem }) {
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
      className={cn(CHIP, CHIP_IDLE)}
      title="Add this to your Action Tracker"
    >
      {pending ? "…" : state === "error" ? "Retry" : "Track"}
    </button>
  );
}

export function SaveSnapshotButton({ chapterId }: { chapterId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">{state.msg}</span>;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await saveChapterKpiSnapshot({ chapterId });
            if (res.ok) setState({ kind: "done", msg: `Saved ✓ (week of ${res.weekStartISO})` });
            else setState({ kind: "error", msg: res.error });
          })
        }
      >
        Save this week&apos;s snapshot
      </Button>
      {state.kind === "error" && <span className="text-[12px] font-semibold text-blocked-700">{state.msg}</span>}
    </div>
  );
}

export function LogFollowUpControl({ chapterId, partnerId }: { chapterId: string; partnerId: string }) {
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">Logged ✓</span>;

  if (!composing) {
    return (
      <button type="button" onClick={() => setComposing(true)} className={cn(CHIP, CHIP_IDLE)}>
        Log follow-up
      </button>
    );
  }

  function submit() {
    if (!note.trim()) return;
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
          <button type="button" onClick={() => setComposing(false)} className="text-[12px] font-semibold text-ink-muted hover:text-ink">
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

const CURRICULUM_ONE_CLICK = {
  cp_approve: { fn: cpApproveCurriculum, doing: "Approving…", label: "CP approve", done: "CP approved ✓" },
  send_to_global: { fn: sendCurriculumToGlobalReview, doing: "Sending…", label: "Send to global review", done: "Sent to global ✓" },
  global_approve: { fn: globalApproveCurriculum, doing: "Approving…", label: "Global approve", done: "Fully approved ✓" },
} satisfies Record<string, { fn: (input: { chapterId: string; classTemplateId: string }) => Promise<CurriculumReviewResult>; doing: string; label: string; done: string }>;

export function CurriculumOneClickControl({
  chapterId,
  classTemplateId,
  step,
}: {
  chapterId: string;
  classTemplateId: string;
  step: keyof typeof CURRICULUM_ONE_CLICK;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const cfg = CURRICULUM_ONE_CLICK[step];

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">{state.msg}</span>;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await cfg.fn({ chapterId, classTemplateId });
            if (res.ok) setState({ kind: "done", msg: cfg.done });
            else setState({ kind: "error", msg: res.error });
          })
        }
        className={cn(CHIP, CHIP_IDLE)}
      >
        {pending ? cfg.doing : cfg.label}
      </button>
      {state.kind === "error" && <span className="text-[12px] font-semibold text-blocked-700">{state.msg}</span>}
    </div>
  );
}

export function CurriculumRevisionControl({ chapterId, classTemplateId }: { chapterId: string; classTemplateId: string }) {
  const [composing, setComposing] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });

  if (state.kind === "done") return <span className="text-[12.5px] font-semibold text-complete-700">Sent back ✓</span>;

  if (!composing) {
    return (
      <button type="button" onClick={() => setComposing(true)} className={cn(CHIP, CHIP_IDLE)}>
        Send back for revision
      </button>
    );
  }

  function submit() {
    if (!notes.trim()) return;
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
        <button type="button" onClick={() => setComposing(false)} className="text-[12px] font-semibold text-ink-muted hover:text-ink">
          Cancel
        </button>
        <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending || !notes.trim()}>
          Send back
        </Button>
      </div>
    </div>
  );
}
