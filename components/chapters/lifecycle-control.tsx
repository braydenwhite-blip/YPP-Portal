"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setChapterLifecycleStatus } from "@/lib/chapters/actions";

const STATUSES = [
  ["PROSPECT", "Prospect"],
  ["APPROVED", "Approved"],
  ["LAUNCHING", "Launching"],
  ["ACTIVE", "Active"],
  ["NEEDS_SUPPORT", "Needs Support"],
  ["AT_RISK", "At Risk"],
  ["PAUSED", "Paused"],
  ["ALUMNI", "Alumni / Closed"],
] as const;

const inputCls = "rounded-lg border border-line px-3 py-2 text-[14px]";

export function LifecycleControl({
  chapterId,
  status,
  note,
}: {
  chapterId: string;
  status: string;
  note: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(status);
  const [noteValue, setNoteValue] = useState(note);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setChapterLifecycleStatus({ chapterId, status: value, note: noteValue });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update status.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={inputCls}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
        >
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Update stage"}
        </button>
        {saved && <span className="text-[12.5px] text-complete-700">Updated.</span>}
      </div>
      <textarea
        className={inputCls}
        rows={2}
        placeholder="Leadership note on this stage (optional)"
        value={noteValue}
        onChange={(e) => setNoteValue(e.target.value)}
      />
      {error && <p className="text-[12.5px] text-blocked-700">{error}</p>}
    </div>
  );
}
