"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalV2, ModalFooterV2, cn } from "@/components/ui-v2";
import { recordCheckIn } from "@/lib/mentorship/check-in-actions";
import type { RecordCheckInInput } from "@/lib/mentorship/check-in-schema";

type Participant = { id: string; name: string };

const KINDS: Array<{ value: "CHECK_IN" | "MEETING" | "CONVERSATION"; label: string }> = [
  { value: "CHECK_IN", label: "Check-in" },
  { value: "MEETING", label: "Meeting" },
  { value: "CONVERSATION", label: "Conversation" },
];

const fieldLabel = "text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted";
const fieldInput =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/** Today as a UTC yyyy-mm-dd, matching how the server coerces date-only inputs. */
function todayValue(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Log a conversation record inside the Mentorship workspace — the single entry
 * point for a check-in / meeting / conversation. Captures the structured record
 * (wins, challenges, discussion, decisions, commitments, follow-up) and hands it
 * to the `recordCheckIn` server action, which saves it and folds it into the
 * timeline. A follow-up date keeps the next step on the radar.
 */
export function CheckInComposer({
  subjectId,
  mentorshipId,
  selfReflectionId,
  cycleLabel,
  participantOptions,
  personName,
}: {
  subjectId: string;
  mentorshipId: string;
  selfReflectionId?: string | null;
  cycleLabel?: string | null;
  participantOptions: Participant[];
  personName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCycleCheckIn = Boolean(selfReflectionId);
  const [kind, setKind] = useState<"CHECK_IN" | "MEETING" | "CONVERSATION">("CHECK_IN");
  const [occurredAt, setOccurredAt] = useState(todayValue);
  const [participants, setParticipants] = useState<string[]>(
    participantOptions.map((p) => p.id)
  );
  const [wins, setWins] = useState("");
  const [challenges, setChallenges] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [decisions, setDecisions] = useState("");
  const [commitments, setCommitments] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [rating, setRating] = useState("");

  function reset() {
    setKind("CHECK_IN");
    setOccurredAt(todayValue());
    setParticipants(participantOptions.map((p) => p.id));
    setWins("");
    setChallenges("");
    setDiscussion("");
    setDecisions("");
    setCommitments("");
    setFollowUpDate("");
    setRating("");
    setError(null);
  }

  function toggleParticipant(id: string) {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function submit() {
    setError(null);
    const hasContent = [wins, challenges, discussion, decisions, commitments].some(
      (v) => v.trim().length > 0
    );
    if (!hasContent) {
      setError("Add at least one note — wins, challenges, discussion, decisions, or commitments.");
      return;
    }
    const input: RecordCheckInInput = {
      subjectId,
      mentorshipId,
      selfReflectionId: selfReflectionId ?? undefined,
      kind: isCycleCheckIn ? "CHECK_IN" : kind,
      occurredAt: occurredAt || undefined,
      participantIds: participants,
      wins,
      challenges,
      discussion,
      decisions,
      commitments,
      followUpDate: followUpDate || undefined,
      rating: rating ? Number(rating) : undefined,
    };
    startTransition(async () => {
      try {
        await recordCheckIn(input);
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the check-in.");
      }
    });
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {isCycleCheckIn ? "Record Mentor Check-in" : "Log check-in"}
      </Button>

      <ModalV2
        open={open}
        onClose={() => setOpen(false)}
        locked={pending}
        accent="brand"
        labelledBy="checkin-composer-title"
      >
        <div>
          <h2
            id="checkin-composer-title"
            className="m-0 text-[16px] font-bold text-ink"
          >
            {isCycleCheckIn ? "Record Mentor Check-in" : `Log a check-in with ${personName}`}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {isCycleCheckIn
              ? `Discuss ${personName}'s ${cycleLabel ?? "current"} reflection, capture the conversation, and agree on the next step before writing the Monthly Progress Update.`
              : "One record for the whole conversation — it joins the timeline. Set a follow-up date to keep the next step on the radar."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Type</span>
            <select
              className={fieldInput}
              value={isCycleCheckIn ? "CHECK_IN" : kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              disabled={isCycleCheckIn}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Date</span>
            <input
              type="date"
              className={fieldInput}
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </label>
        </div>

        {participantOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Participants</span>
            <div className="flex flex-wrap gap-2">
              {participantOptions.map((p) => {
                const active = participants.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleParticipant(p.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-brand-400 bg-brand-50 text-brand-800"
                        : "border-line bg-surface text-ink-muted hover:border-brand-300"
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <ComposerField label="Wins" value={wins} onChange={setWins} placeholder="What went well since last time?" />
        <ComposerField label="Challenges" value={challenges} onChange={setChallenges} placeholder="What's getting in the way?" />
        <ComposerField label="Discussion" value={discussion} onChange={setDiscussion} placeholder="What did you talk through?" rows={3} />
        <ComposerField label="Decisions" value={decisions} onChange={setDecisions} placeholder="What did you decide?" />
        <ComposerField
          label="Commitments"
          value={commitments}
          onChange={setCommitments}
          placeholder="One per line — e.g. 'Avery will shadow a class by next Friday'"
          rows={3}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Follow-up date</span>
            <input
              type="date"
              className={fieldInput}
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>Rating (optional)</span>
            <select
              className={fieldInput}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
        ) : null}

        <ModalFooterV2>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} loading={pending}>
            {isCycleCheckIn ? "Complete Mentor Check-in" : "Save check-in"}
          </Button>
        </ModalFooterV2>
      </ModalV2>
    </>
  );
}

function ComposerField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={fieldLabel}>{label}</span>
      <textarea
        className={cn(fieldInput, "resize-y leading-relaxed")}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
