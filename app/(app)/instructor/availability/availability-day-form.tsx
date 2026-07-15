"use client";

import { useState, useTransition } from "react";
import { Button, StatusBadge } from "@/components/ui-v2";
import { minutesToClock } from "@/lib/session8/instructor-development-shared";
import { saveInstructorAvailability } from "@/lib/session8/instructor-development-actions";

function clockToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}
function minutesToInputValue(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function AvailabilityDayForm({
  weekday,
  label,
  row,
}: {
  weekday: number;
  label: string;
  row: { available: boolean; startMinute: number; endMinute: number; note: string | null } | null;
}) {
  const [available, setAvailable] = useState(row?.available ?? true);
  const [start, setStart] = useState(minutesToInputValue(row?.startMinute ?? 9 * 60));
  const [end, setEnd] = useState(minutesToInputValue(row?.endMinute ?? 17 * 60));
  const [note, setNote] = useState(row?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="space-y-3"
      action={(formData: FormData) => {
        setSaved(false);
        startTransition(async () => {
          await saveInstructorAvailability(formData);
          setSaved(true);
        });
      }}
    >
      <input type="hidden" name="weekday" value={weekday} />
      <input type="hidden" name="startMinute" value={clockToMinutes(start)} />
      <input type="hidden" name="endMinute" value={clockToMinutes(end)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{label}</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            name="available"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            className="h-4 w-4 rounded border-line"
          />
          Available
        </label>
      </div>
      {available ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-muted">Start time</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-[9px] border border-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-muted">End time</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-[9px] border border-line px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}
      {row ? (
        <p className="text-xs text-ink-muted">
          Currently saved:{" "}
          {row.available ? `${minutesToClock(row.startMinute)} – ${minutesToClock(row.endMinute)}` : "Unavailable"}
        </p>
      ) : (
        <StatusBadge tone="neutral">Not set</StatusBadge>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-muted">Note (optional)</span>
        <input
          type="text"
          name="note"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Only available for virtual classes this day"
          className="w-full rounded-[9px] border border-line px-3 py-2 text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Save {label}
        </Button>
        {saved ? <span className="text-xs font-medium text-complete-700">Saved</span> : null}
      </div>
    </form>
  );
}
