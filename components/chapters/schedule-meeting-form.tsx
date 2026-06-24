"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleChapterMeeting } from "@/lib/chapters/actions";

const inputCls = "rounded-lg border border-line px-3 py-2 text-[14px]";

export function ScheduleMeetingForm({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim() || !scheduledAt) {
      setError("Add a title and a date/time.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = (await scheduleChapterMeeting({
          chapterId,
          title,
          scheduledAt: new Date(scheduledAt).toISOString(),
          purpose,
        })) as { ok?: boolean; id?: string };
        if (res?.id) router.push(`/meetings/${res.id}`);
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not schedule the meeting.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-800 hover:bg-brand-100"
      >
        + Schedule a chapter meeting
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-soft p-3">
      <input className={inputCls} placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input
        type="datetime-local"
        className={inputCls}
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
      />
      <textarea
        className={inputCls}
        rows={2}
        placeholder="Agenda / purpose (optional)"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
      />
      {error && <p className="text-[12.5px] text-blocked-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create & open"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
