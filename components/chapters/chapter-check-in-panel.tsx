"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui-v2";
import { submitChapterCheckIn } from "@/lib/chapters/actions";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Leave status unchanged" },
  { value: "ACTIVE", label: "Active" },
  { value: "NEEDS_SUPPORT", label: "Needs support" },
  { value: "AT_RISK", label: "At risk" },
  { value: "PAUSED", label: "Paused" },
];

/**
 * Lightweight chapter check-in. Captures what happened / what's next / what's
 * blocked / who needs help, optionally moves the lifecycle (leadership), and
 * turns blockers + asks into real chapter actions. It writes to the existing
 * notes timeline, lifecycle, and Action Tracker — not a parallel record.
 */
export function ChapterCheckInPanel({
  chapterId,
  isLeadership,
}: {
  chapterId: string;
  isLeadership: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState("");
  const [planned, setPlanned] = useState("");
  const [blocked, setBlocked] = useState("");
  const [needsHelp, setNeedsHelp] = useState("");
  const [status, setStatus] = useState("");
  const [createActions, setCreateActions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function reset() {
    setSince("");
    setPlanned("");
    setBlocked("");
    setNeedsHelp("");
    setStatus("");
    setCreateActions(true);
  }

  function submit() {
    setError(null);
    setSavedMsg(null);
    startTransition(async () => {
      try {
        const res = await submitChapterCheckIn({
          chapterId,
          since: since || undefined,
          planned: planned || undefined,
          blocked: blocked || undefined,
          needsHelp: needsHelp || undefined,
          status: status ? (status as "ACTIVE" | "NEEDS_SUPPORT" | "AT_RISK" | "PAUSED") : undefined,
          createActions,
        });
        reset();
        setOpen(false);
        const n = res.createdActionIds.length;
        setSavedMsg(n > 0 ? `Check-in saved · ${n} action${n === 1 ? "" : "s"} created` : "Check-in saved");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the check-in.");
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          New check-in
        </Button>
        {savedMsg && <span className="text-[12.5px] font-medium text-success-700">{savedMsg}</span>}
        <span className="text-[12.5px] text-ink-muted">
          Capture progress &amp; blockers — blockers become tracked actions.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <textarea className={`${inputCls} min-h-[48px]`} placeholder="What happened since the last check-in?" value={since} onChange={(e) => setSince(e.target.value)} />
      <textarea className={`${inputCls} min-h-[48px]`} placeholder="What's planned next?" value={planned} onChange={(e) => setPlanned(e.target.value)} />
      <textarea className={`${inputCls} min-h-[48px]`} placeholder="What's blocked? (becomes a tracked action)" value={blocked} onChange={(e) => setBlocked(e.target.value)} />
      <textarea className={`${inputCls} min-h-[48px]`} placeholder="Who needs help / what do you need from leadership?" value={needsHelp} onChange={(e) => setNeedsHelp(e.target.value)} />

      <div className="flex flex-wrap items-center gap-3">
        {isLeadership ? (
          <select className={`${inputCls} w-52`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink">
          <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={createActions} onChange={(e) => setCreateActions(e.target.checked)} />
          Create actions for blockers &amp; asks
        </label>
      </div>

      {error && <p className="m-0 text-[12.5px] text-danger-700">{error}</p>}

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" loading={pending} onClick={submit}>
          Save check-in
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setOpen(false); reset(); setError(null); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
