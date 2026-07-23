"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { scheduleHiringInterviewOnRecord } from "@/lib/application-actions";
import { Button, cn } from "@/components/ui-v2";

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const fieldClass =
  "w-full rounded-[10px] border border-line-soft bg-surface px-3 py-2.5 text-[14px] text-ink shadow-sm placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

const labelClass = "block text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted";

export function HiringApplicationInterviewSchedule({
  applicationId,
  scheduledAtISO,
  meetingLink = "",
  durationMinutes = 30,
  canSchedule,
}: {
  applicationId: string;
  scheduledAtISO: string | null;
  meetingLink?: string | null;
  durationMinutes?: number;
  canSchedule: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(!scheduledAtISO);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(scheduledAtISO));
  const [link, setLink] = useState(meetingLink ?? "");
  const [duration, setDuration] = useState(String(durationMinutes || 30));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!canSchedule) return null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await scheduleHiringInterviewOnRecord({
        applicationId,
        scheduledAt,
        meetingLink: link.trim() || null,
        durationMinutes: Number(duration) || 30,
      });
      if (!result.success) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({
        ok: true,
        text: scheduledAtISO ? "Updated. Applicant notified." : "Booked. Applicant notified.",
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setMessage(null);
            }}
            className="rounded-[9px] bg-brand-600 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-brand-700"
          >
            {scheduledAtISO ? "Change time" : "Set when"}
          </button>
          <Link
            href="/interviews/schedule"
            className="rounded-[9px] border border-line-soft px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted no-underline hover:border-brand-300 hover:text-brand-700"
          >
            Open full scheduler
          </Link>
        </div>
      ) : (
        <form onSubmit={save} className="grid max-w-lg gap-3">
          <p className="m-0 text-[13px] text-ink-muted">
            Pick a time — same as CP and instructor interviews. We&apos;ll email the applicant.
          </p>
          <label className="block space-y-1.5">
            <span className={labelClass}>When?</span>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Meeting link</span>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Zoom / Meet link (optional)"
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Duration (minutes)</span>
            <input
              type="number"
              min={15}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={fieldClass}
            />
          </label>

          {message ? (
            <p
              role="alert"
              className={cn(
                "m-0 rounded-[10px] px-3 py-2 text-[13px] font-medium",
                message.ok
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-[var(--error-bg)] text-[var(--error-text)]"
              )}
            >
              {message.text}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pending || !scheduledAt}
              loading={pending}
            >
              {scheduledAtISO ? "Save new time" : "Book it"}
            </Button>
            {scheduledAtISO ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  setMessage(null);
                }}
                className="rounded-[9px] border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
