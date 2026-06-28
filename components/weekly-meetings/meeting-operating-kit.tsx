"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, CardV2 } from "@/components/ui-v2";
import type { AssignableUser } from "@/lib/weekly-meetings/teams";
import type { MeetingDetail } from "@/lib/weekly-meetings/meetings";
import { updateMeeting } from "@/lib/weekly-meetings/meeting-actions";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

type PartnerOption = { id: string; name: string };

type TextField = "agenda" | "proposal" | "notes" | "nextSteps" | "outcome";

const TEXT_BLOCKS: Array<{
  field: TextField;
  title: string;
  hint: string;
  placeholder: string;
  rows: number;
}> = [
  {
    field: "agenda",
    title: "Agenda",
    hint: "Outline what you plan to cover — add structured items below too.",
    placeholder: "1. Welcome\n2. Updates\n3. Decisions needed…",
    rows: 5,
  },
  {
    field: "proposal",
    title: "Proposal",
    hint: "Pre-read or proposal material shared before the meeting.",
    placeholder: "What are we proposing or reviewing?",
    rows: 4,
  },
  {
    field: "notes",
    title: "Meeting notes",
    hint: "Capture discussion, context, and key points during the meeting.",
    placeholder: "Notes from the session…",
    rows: 6,
  },
  {
    field: "nextSteps",
    title: "Next steps",
    hint: "Meeting-level summary of what happens next (separate from follow-up tasks).",
    placeholder: "What should happen after this meeting?",
    rows: 4,
  },
  {
    field: "outcome",
    title: "Meeting outcome",
    hint: "What was decided or achieved — the honest result of the session.",
    placeholder: "Outcome, decision summary, or result…",
    rows: 4,
  },
];

function TextBlock({
  meetingId,
  field,
  title,
  hint,
  placeholder,
  rows,
  initial,
  pending,
  onSave,
}: {
  meetingId: string;
  field: TextField;
  title: string;
  hint: string;
  placeholder: string;
  rows: number;
  initial: string | null;
  pending: boolean;
  onSave: (fn: () => Promise<unknown>) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");

  return (
    <CardV2 padding="md">
      <div className="mb-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">{hint}</p>
      </div>
      <textarea
        className={`${inputCls} resize-y`}
        style={{ minHeight: rows * 24 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value === saved) return;
          onSave(async () => {
            await updateMeeting({ meetingId, [field]: value.trim() || null });
            setSaved(value);
          });
        }}
      />
      {value !== saved && (
        <div className="mt-2 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              onSave(async () => {
                await updateMeeting({ meetingId, [field]: value.trim() || null });
                setSaved(value);
              })
            }
          >
            Save {title.toLowerCase()}
          </Button>
        </div>
      )}
    </CardV2>
  );
}

export function MeetingOperatingKit({
  meeting,
  people,
  partners,
  pending,
  onSave,
}: {
  meeting: MeetingDetail;
  people: AssignableUser[];
  partners: PartnerOption[];
  pending: boolean;
  onSave: (fn: () => Promise<unknown>) => void;
}) {
  const [ownerId, setOwnerId] = useState(meeting.facilitator?.id ?? "");
  const [partnerId, setPartnerId] = useState(meeting.partner?.id ?? "");

  return (
    <div className="flex flex-col gap-5">
      {TEXT_BLOCKS.slice(0, 3).map((block) => (
        <TextBlock
          key={block.field}
          meetingId={meeting.id}
          field={block.field}
          title={block.title}
          hint={block.hint}
          placeholder={block.placeholder}
          rows={block.rows}
          initial={meeting[block.field]}
          pending={pending}
          onSave={onSave}
        />
      ))}

      <CardV2 padding="md">
        <h2 className="m-0 mb-3 text-[15px] font-bold text-ink">Ownership & links</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Assigned owner
            </label>
            <select
              className={inputCls}
              value={ownerId}
              onChange={(e) => {
                const next = e.target.value;
                setOwnerId(next);
                onSave(() => updateMeeting({ meetingId: meeting.id, facilitatorId: next || null }));
              }}
            >
              <option value="">Unassigned</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Linked partner
            </label>
            <select
              className={inputCls}
              value={partnerId}
              onChange={(e) => {
                const next = e.target.value;
                setPartnerId(next);
                onSave(() => updateMeeting({ meetingId: meeting.id, partnerId: next || null }));
              }}
            >
              <option value="">No partner linked</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {partnerId ? (
              <p className="m-0 mt-1.5 text-[12px]">
                <Link href={`/partners/${partnerId}`} className="font-medium text-brand-700 hover:underline">
                  Open partner record →
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </CardV2>
    </div>
  );
}

/** Next steps + outcome — shown after follow-up tasks on the runner. */
export function MeetingWrapUpKit({
  meeting,
  pending,
  onSave,
}: {
  meeting: MeetingDetail;
  pending: boolean;
  onSave: (fn: () => Promise<unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {TEXT_BLOCKS.slice(3).map((block) => (
        <TextBlock
          key={block.field}
          meetingId={meeting.id}
          field={block.field}
          title={block.title}
          hint={block.hint}
          placeholder={block.placeholder}
          rows={block.rows}
          initial={meeting[block.field]}
          pending={pending}
          onSave={onSave}
        />
      ))}
    </div>
  );
}
