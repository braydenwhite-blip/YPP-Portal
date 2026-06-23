"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import {
  assignActionItemToMeeting,
  listMeetingsForActionAssignmentPicker,
} from "@/lib/people-strategy/officer-meetings-actions";
import type { MeetingPickerOption } from "@/lib/people-strategy/officer-meetings-queries";
import { cn } from "@/components/ui-v2";

function meetingWhenLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ActionAssignMeetingButton({
  actionItemId,
  className,
}: {
  actionItemId: string;
  className?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [meetings, setMeetings] = useState<MeetingPickerOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setMeetings(null);
    setLoading(true);
    setError(null);

    void listMeetingsForActionAssignmentPicker()
      .then((rows) => {
        if (!cancelled) setMeetings(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load meetings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  function toggleOpen(event: React.MouseEvent) {
    event.stopPropagation();
    setOpen((value) => !value);
  }

  function assign(meetingId: string, event: React.MouseEvent) {
    event.stopPropagation();
    setError(null);
    startTransition(async () => {
      try {
        await assignActionItemToMeeting({ meetingId, actionItemId });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not link to that meeting.");
      }
    });
  }

  return (
    <div ref={rootRef} className={cn("relative", className)} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={toggleOpen}
        disabled={pending}
        className="inline-flex items-center rounded-md border border-dashed border-line-soft px-2 py-1 text-[11px] font-semibold text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
      >
        + Add to meeting
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a meeting"
          className="absolute left-0 top-[calc(100%+6px)] z-20 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-line-card bg-surface shadow-card"
        >
          <div className="border-b border-line-soft bg-[#fafafc] px-3 py-2">
            <p className="m-0 text-[12px] font-semibold text-ink">Link to a meeting</p>
            <p className="m-0 mt-0.5 text-[11px] text-ink-muted">
              The action will show on that meeting&apos;s agenda tray.
            </p>
          </div>

          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {loading ? (
              <p className="m-0 px-2 py-3 text-[12px] text-ink-muted">Loading meetings…</p>
            ) : null}
            {!loading && meetings?.length === 0 ? (
              <p className="m-0 px-2 py-3 text-[12px] text-ink-muted">
                No upcoming meetings in range. Schedule one first.
              </p>
            ) : null}
            {!loading
              ? meetings?.map((meeting) => (
                  <button
                    key={meeting.id}
                    type="button"
                    disabled={pending}
                    onClick={(event) => assign(meeting.id, event)}
                    className="flex w-full flex-col items-start rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-surface-soft disabled:opacity-60"
                  >
                    <span className="text-[13px] font-semibold text-ink">{meeting.title}</span>
                    <span className="mt-0.5 text-[11.5px] text-ink-muted">
                      {meeting.kindLabel} · {meetingWhenLabel(meeting.dateISO)}
                    </span>
                  </button>
                ))
              : null}
          </div>

          <div className="border-t border-line-soft px-3 py-2">
            <Link
              href="/meetings"
              onClick={(event) => event.stopPropagation()}
              className="text-[11.5px] font-semibold text-brand-700 no-underline hover:underline"
            >
              Browse all meetings →
            </Link>
          </div>

          {error ? (
            <p role="alert" className="m-0 border-t border-line-soft px-3 py-2 text-[11.5px] text-blocked-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ActionMeetingLink({
  meetingId,
  meetingTitle,
  meetingDate,
  meetingHref,
}: {
  meetingId: string;
  meetingTitle?: string | null;
  meetingDate: Date;
  meetingHref?: string;
}) {
  return (
    <Link
      href={meetingHref ?? `/meetings/${meetingId}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center rounded-md bg-[#fdf8ec] px-2 py-1 text-[11px] font-semibold text-[#7a5d00] no-underline hover:bg-[#f8efd6]"
    >
      Meeting: {meetingTitle?.trim() || formatMonthDay(meetingDate)}
    </Link>
  );
}
