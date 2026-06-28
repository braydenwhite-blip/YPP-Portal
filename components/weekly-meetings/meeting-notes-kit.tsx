"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, CardV2 } from "@/components/ui-v2";
import type { MeetingDetail } from "@/lib/weekly-meetings/meetings";
import { updateMeeting } from "@/lib/weekly-meetings/meeting-actions";

const inputCls =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

function NoteField({
  meetingId,
  field,
  label,
  placeholder,
  rows,
  initial,
  pending,
  onSave,
}: {
  meetingId: string;
  field: "agenda" | "notes" | "outcome" | "proposal" | "nextSteps";
  label: string;
  placeholder: string;
  rows: number;
  initial: string | null;
  pending: boolean;
  onSave: (fn: () => Promise<unknown>) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");

  function save() {
    if (value === saved) return;
    onSave(async () => {
      await updateMeeting({ meetingId, [field]: value.trim() || null });
      setSaved(value);
    });
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold text-ink">{label}</label>
      <textarea
        className={`${inputCls} resize-y`}
        style={{ minHeight: rows * 22 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
      />
      {value !== saved ? (
        <Button variant="ghost" size="sm" loading={pending} onClick={save}>
          Save
        </Button>
      ) : null}
    </div>
  );
}

/** One card — agenda, notes, outcome. Extras collapsed below. */
export function MeetingNotesKit({
  meeting,
  pending,
  onSave,
}: {
  meeting: MeetingDetail;
  pending: boolean;
  onSave: (fn: () => Promise<unknown>) => void;
}) {
  const [showExtras, setShowExtras] = useState(
    Boolean(meeting.proposal?.trim() || meeting.nextSteps?.trim()),
  );

  return (
    <CardV2 padding="md">
      <h2 className="m-0 text-[15px] font-bold text-ink">Meeting notes</h2>
      <p className="m-0 mt-0.5 mb-4 text-[12.5px] text-ink-muted">Agenda, live notes, and outcome — saves when you click away.</p>
      <div className="flex flex-col gap-4">
        <NoteField
          meetingId={meeting.id}
          field="agenda"
          label="Agenda"
          placeholder="What are we covering?"
          rows={3}
          initial={meeting.agenda}
          pending={pending}
          onSave={onSave}
        />
        <NoteField
          meetingId={meeting.id}
          field="notes"
          label="Notes"
          placeholder="Capture the conversation…"
          rows={5}
          initial={meeting.notes}
          pending={pending}
          onSave={onSave}
        />
        <NoteField
          meetingId={meeting.id}
          field="outcome"
          label="Outcome"
          placeholder="What was decided or achieved?"
          rows={3}
          initial={meeting.outcome}
          pending={pending}
          onSave={onSave}
        />
      </div>
      <button
        type="button"
        className="mt-4 text-[13px] font-semibold text-brand-700 hover:underline"
        onClick={() => setShowExtras((v) => !v)}
      >
        {showExtras ? "Hide extras" : "Proposal & next steps"}
      </button>
      {showExtras ? (
        <div className="mt-3 flex flex-col gap-4 border-t border-line-soft pt-4">
          <NoteField
            meetingId={meeting.id}
            field="proposal"
            label="Proposal"
            placeholder="Pre-read material…"
            rows={3}
            initial={meeting.proposal}
            pending={pending}
            onSave={onSave}
          />
          <NoteField
            meetingId={meeting.id}
            field="nextSteps"
            label="Next steps"
            placeholder="Summary after the meeting…"
            rows={3}
            initial={meeting.nextSteps}
            pending={pending}
            onSave={onSave}
          />
        </div>
      ) : null}
    </CardV2>
  );
}
