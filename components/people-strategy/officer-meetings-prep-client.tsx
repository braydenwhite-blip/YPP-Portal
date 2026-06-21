"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { cn } from "@/components/ui-v2";
import {
  addAgendaItem,
  addDecision,
  deleteAgendaItem,
  saveMeetingNotes,
  setAgendaItemStatus,
  setMeetingStatus,
} from "@/lib/people-strategy/meetings-actions";
import {
  inferDefaultPhase,
  phaseBadgeLabel,
  type OfficerMeetingCandidate,
  type OfficerMeetingPhase,
  type OfficerMeetingPrepData,
} from "@/lib/people-strategy/officer-meeting-prep";

const PHASE_TABS: Array<{ key: OfficerMeetingPhase; num: string; label: string; sub: string }> = [
  { key: "before", num: "1", label: "Before", sub: "Build agenda" },
  { key: "during", num: "2", label: "During", sub: "Run meeting" },
  { key: "after", num: "3", label: "After", sub: "Summary & follow-up" },
];

function SourceTag({
  label,
  color,
  bg,
  href,
}: {
  label: string;
  color: string;
  bg: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold no-underline"
      style={{ color, background: bg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </Link>
  );
}

function CandidateRow({
  candidate,
  pending,
  onToggle,
}: {
  candidate: OfficerMeetingCandidate;
  pending: boolean;
  onToggle: (candidate: OfficerMeetingCandidate) => void;
}) {
  const onAgenda = Boolean(candidate.agendaItemId);
  return (
    <div className="flex items-start gap-3 border-b border-[#f4f4f8] px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 mb-1 text-[13.5px] font-semibold leading-snug text-[#1c1a2e]">
          {candidate.title}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag
            label={candidate.sourceLabel}
            color={candidate.sourceColor}
            bg={candidate.sourceBg}
            href={candidate.sourceHref}
          />
          <span className="text-[11.5px] text-[#9a9ab0]">{candidate.ownerMeta}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onToggle(candidate)}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold",
          onAgenda
            ? "border border-[#cdebd9] bg-[#e7f6ee] text-[#0e7c52]"
            : "border border-[#dcd4f5] bg-white text-[#5a1da8] hover:bg-[#f5f0ff]"
        )}
      >
        {onAgenda ? "✓ Added" : "+ Agenda"}
      </button>
    </div>
  );
}

export function OfficerMeetingsPrepClient({ data }: { data: OfficerMeetingPrepData }) {
  const router = useRouter();
  const [phase, setPhase] = useState<OfficerMeetingPhase>(() =>
    data.focus ? inferDefaultPhase(data.focus.storedStatus, data.focus.effectiveStatus) : "before"
  );
  const [notes, setNotes] = useState(data.focus?.notesText ?? "");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const meetingId = data.focus?.id ?? null;
  const agendaCountLabel = `${data.agenda.length} item${data.agenda.length === 1 ? "" : "s"}`;
  const canStart = data.agenda.length > 0;

  const liveAgenda = useMemo(
    () => data.agenda.filter((a) => a.status !== "CONVERTED"),
    [data.agenda]
  );

  function reload() {
    router.refresh();
  }

  function toggleCandidate(candidate: OfficerMeetingCandidate) {
    if (!meetingId) return;
    startTransition(async () => {
      if (candidate.agendaItemId) {
        await deleteAgendaItem(candidate.agendaItemId);
      } else {
        await addAgendaItem({ meetingId, title: candidate.title });
      }
      reload();
    });
  }

  function removeAgendaItem(id: string) {
    startTransition(async () => {
      await deleteAgendaItem(id);
      reload();
    });
  }

  function startMeeting() {
    if (!canStart) return;
    setPhase("during");
  }

  function endMeeting() {
    if (!meetingId) return;
    startTransition(async () => {
      if (notes.trim()) {
        await saveMeetingNotes({ meetingId, notes: notes });
      }
      await setMeetingStatus(meetingId, "COMPLETED");
      setPhase("after");
      reload();
    });
  }

  function toggleDiscussed(id: string, currentlyDiscussed: boolean) {
    startTransition(async () => {
      await setAgendaItemStatus({
        id,
        status: currentlyDiscussed ? "OPEN" : "DISCUSSED",
      });
      reload();
    });
  }

  function saveNotes() {
    if (!meetingId) return;
    startTransition(async () => {
      await saveMeetingNotes({ meetingId, notes: notes });
      reload();
    });
  }

  function captureDecision() {
    if (!meetingId) return;
    const text = window.prompt("Decision captured:");
    if (!text?.trim()) return;
    startTransition(async () => {
      await addDecision({ meetingId, decision: text.trim() });
      reload();
    });
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(data.summaryPlain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // textarea fallback not needed — user can select manually
    }
  }

  if (!data.focus) {
    return (
      <div className="rounded-[14px] border border-[#ebebf2] bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
        <p className="m-0 text-[15px] font-semibold text-[#1c1a2e]">No officer meeting scheduled</p>
        <p className="m-0 mt-2 text-[13px] text-[#717189]">
          Schedule the next leadership session to build an agenda from what needs attention.
        </p>
        <Link
          href="/actions/meetings/new"
          className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] px-4 text-[13px] font-semibold text-white no-underline"
        >
          + Schedule meeting
        </Link>
      </div>
    );
  }

  const focus = data.focus;

  return (
    <div className="flex flex-col gap-5">
      {/* Next meeting + phase rail */}
      <div className="rounded-2xl border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.04)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="w-[50px] shrink-0 text-center">
            <div className="text-[21px] font-extrabold leading-none text-[#5a1da8]">{focus.day}</div>
            <div className="text-[10px] font-bold tracking-wide text-[#a8a8bd]">{focus.mon}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold text-[#1c1a2e]">{focus.title}</div>
            <div className="text-[12.5px] text-[#9a9ab0]">{focus.meta}</div>
          </div>
          <span className="rounded-md bg-[#f0e6ff] px-2.5 py-1 text-[11.5px] font-semibold text-[#5a1da8]">
            {phaseBadgeLabel(phase)}
          </span>
        </div>
        <div className="flex gap-2">
          {PHASE_TABS.map((tab) => {
            const active = phase === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPhase(tab.key)}
                className={cn(
                  "flex flex-1 flex-col gap-0.5 rounded-[11px] border px-3.5 py-2.5 text-left transition-colors",
                  active
                    ? "border-[#dcd4f5] bg-[#f5f0ff]"
                    : "border-[#ebebf2] bg-[#fafafd] hover:border-[#dcd4f5]"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                      active ? "bg-[#5a1da8] text-white" : "bg-[#e8e8f0] text-[#9a9ab0]"
                    )}
                  >
                    {tab.num}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-bold",
                      active ? "text-[#5a1da8]" : "text-[#5c5c74]"
                    )}
                  >
                    {tab.label}
                  </span>
                </div>
                <span className="pl-[27px] text-[11px] text-[#9a9ab0]">{tab.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BEFORE */}
      {phase === "before" ? (
        <div className="grid items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[15px] font-bold text-[#1c1a2e]">
                Needs-attention items pulled for review
              </div>
              <p className="m-0 mt-0.5 text-[12px] text-[#9a9ab0]">
                Sourced from actions, partners, applicants, mentorship & people
              </p>
            </div>
            {data.candidateGroups.map((group) =>
              group.items.length === 0 ? null : (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white"
                >
                  <div className="flex items-center gap-2 border-b border-[#f1f1f6] px-4 py-3">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: group.color }}
                      aria-hidden
                    />
                    <div className="text-[12.5px] font-bold uppercase tracking-wide text-[#3a3a52]">
                      {group.label}
                    </div>
                    <div className="ml-auto text-[11.5px] text-[#9a9ab0]">{group.count}</div>
                  </div>
                  {group.items.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      pending={pending}
                      onToggle={toggleCandidate}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-[14px] border border-[#e4d8f7] bg-white">
              <div className="flex items-center gap-2 border-b border-[#ece2fb] bg-[#f7f2ff] px-4 py-3">
                <span className="text-[13px]" aria-hidden>
                  📋
                </span>
                <div className="text-[12.5px] font-bold uppercase tracking-wide text-[#5a1da8]">
                  Agenda · {focus.day} {focus.mon}
                </div>
                <div className="ml-auto text-[12px] font-bold text-[#5a1da8]">{agendaCountLabel}</div>
              </div>
              {data.agenda.length === 0 ? (
                <p className="m-0 px-4 py-5 text-center text-[12.5px] leading-relaxed text-[#9a9ab0]">
                  No items yet. Add needs-attention items from the left to build the agenda.
                </p>
              ) : (
                data.agenda.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 border-b border-[#f4f4f8] px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold"
                      style={{ color: item.color, background: `${item.color}1a` }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-[#3a3a52]">
                      {item.title}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title} from agenda`}
                      disabled={pending}
                      onClick={() => removeAgendaItem(item.id)}
                      className="shrink-0 text-[15px] text-[#c4c4d4] hover:text-[#9a9ab0]"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              <div className="p-3.5">
                <button
                  type="button"
                  disabled={!canStart || pending}
                  onClick={startMeeting}
                  className={cn(
                    "flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-[13px] font-bold",
                    canStart
                      ? "cursor-pointer bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] text-white hover:opacity-95"
                      : "cursor-not-allowed bg-[#e8e8f0] text-[#9a9ab0]"
                  )}
                >
                  ▶ Start meeting
                </button>
              </div>
            </div>

            {data.decisionsNeeded.length > 0 ? (
              <div className="rounded-[14px] border border-[#ebebf2] bg-white p-4">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                  Decisions needed
                </div>
                {data.decisionsNeeded.map((line) => (
                  <div key={line} className="mb-2.5 flex items-start gap-2 last:mb-0">
                    <span className="mt-0.5 shrink-0 text-[#b45309]" aria-hidden>
                      ◆
                    </span>
                    <p className="m-0 text-[12.5px] leading-relaxed text-[#5c5c74]">{line}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* DURING */}
      {phase === "during" ? (
        <div className="grid items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white">
            <div className="flex items-center gap-2 border-b border-[#f1f1f6] px-[18px] py-3.5">
              <span className="size-2 rounded-full bg-[#0e9f6e]" aria-hidden />
              <div className="text-[13px] font-bold text-[#1c1a2e]">Working the agenda</div>
              <div className="ml-auto text-[12px] text-[#9a9ab0]">
                {data.discussedCount} discussed
              </div>
            </div>
            {liveAgenda.map((item) => {
              const done = item.status === "DISCUSSED";
              return (
                <div key={item.id} className="border-b border-[#f4f4f8] px-[18px] py-3.5 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleDiscussed(item.id, done)}
                      className={cn(
                        "mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 text-[12px]",
                        done
                          ? "border-[#0e9f6e] bg-[#0e9f6e] text-white"
                          : "border-[#dcd4f5] bg-white text-transparent"
                      )}
                      aria-label={done ? "Mark as not discussed" : "Mark as discussed"}
                    >
                      ✓
                    </button>
                    <div>
                      <p
                        className={cn(
                          "m-0 text-[13.5px] font-semibold leading-snug",
                          done ? "text-[#9a9ab0] line-through" : "text-[#1c1a2e]"
                        )}
                      >
                        {item.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="bg-[#fafafd] px-[18px] py-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                Live notes
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Capture decisions, commitments, owner assignments…"
                rows={4}
                className="w-full resize-y rounded-[10px] border border-[#ececf3] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#1c1a2e] outline-none focus:border-[#dcd4f5]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={captureDecision}
                  disabled={pending}
                  className="inline-flex h-[34px] items-center gap-1 rounded-lg border border-[#f3e2c4] bg-[#fdf2e3] px-3 text-[12px] font-semibold text-[#b45309]"
                >
                  ◆ Capture decision
                </button>
                <Link
                  href={`/actions/meetings/${meetingId}`}
                  className="inline-flex h-[34px] items-center gap-1 rounded-lg border border-[#e4d8f7] bg-[#f3ecff] px-3 text-[12px] font-semibold text-[#5a1da8] no-underline"
                >
                  ↗ Full workspace
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-[#ebebf2] bg-white p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                Quick links
              </div>
              <Link
                href={`/actions/meetings/${meetingId}`}
                className="text-[12.5px] font-semibold text-[#5a1da8] no-underline hover:underline"
              >
                Open meeting workspace →
              </Link>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={endMeeting}
              className="flex h-[42px] items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] text-[13.5px] font-bold text-white hover:opacity-95"
            >
              End meeting & build summary →
            </button>
          </div>
        </div>
      ) : null}

      {/* AFTER */}
      {phase === "after" ? (
        <div className="grid items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white">
            <div className="flex items-center gap-2 border-b border-[#f1f1f6] px-[18px] py-3.5">
              <span aria-hidden>✓</span>
              <div className="text-[13px] font-bold text-[#1c1a2e]">
                Meeting summary · {focus.day} {focus.mon}
              </div>
              <button
                type="button"
                onClick={copySummary}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e4d8f7] bg-[#f3ecff] px-3 text-[12px] font-semibold text-[#5a1da8]"
              >
                {copied ? "Copied ✓" : "⎘ Copy"}
              </button>
            </div>
            <div className="p-[18px]">
              <p className="m-0 mb-4 text-[12px] leading-relaxed text-[#9a9ab0]">
                Generated from {data.discussedCount} discussed items and notes captured during the
                meeting. Review before sending.
              </p>
              {data.summarySections.map((section) => (
                <div key={section.title} className="mb-4 last:mb-0">
                  <div
                    className="mb-2 text-[12px] font-bold uppercase tracking-wide"
                    style={{ color: section.color }}
                  >
                    {section.title}
                  </div>
                  {section.lines.map((line) => (
                    <div key={line} className="mb-2 flex items-start gap-2">
                      <span className="mt-0.5 shrink-0" style={{ color: section.color }}>
                        {section.bullet}
                      </span>
                      <p className="m-0 text-[13px] leading-relaxed text-[#3a3a52]">{line}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-[#ebebf2] bg-white p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                Close out
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={copySummary}
                  className="flex h-10 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] text-[13px] font-bold text-white"
                >
                  Copy summary for officers
                </button>
                <Link
                  href={`/actions/meetings/${meetingId}`}
                  className="flex h-10 items-center justify-center rounded-[10px] border border-[#e4d8f7] text-[13px] font-semibold text-[#5a1da8] no-underline hover:bg-[#f5f0ff]"
                >
                  Convert commitments to actions →
                </Link>
              </div>
            </div>
            {data.unresolved.length > 0 ? (
              <div className="rounded-[14px] border border-[#ebebf2] bg-white p-4">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#a8a8bd]">
                  Unresolved — carries to next meeting
                </div>
                {data.unresolved.map((line) => (
                  <div key={line} className="mb-2 flex items-start gap-2 last:mb-0">
                    <span className="shrink-0 text-[#b45309]">↪</span>
                    <p className="m-0 text-[12.5px] leading-relaxed text-[#5c5c74]">{line}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Past meetings */}
      {data.pastMeetings.length > 0 ? (
        <div className="mt-2">
          <div className="mb-2.5 text-[12.5px] font-bold uppercase tracking-wide text-[#a8a8bd]">
            Past meetings
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white">
            {data.pastMeetings.map((m) => (
              <Link
                key={m.id}
                href={`/actions/meetings/${m.id}`}
                className="flex items-center gap-3 border-b border-[#f4f4f8] px-[18px] py-3 no-underline last:border-b-0 hover:bg-[#fafafd]"
              >
                <div className="w-10 text-center">
                  <div className="text-[16px] font-bold leading-none text-[#9a9ab0]">{m.day}</div>
                  <div className="text-[9.5px] font-bold text-[#c0c0d0]">{m.mon}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#3a3a52]">{m.title}</div>
                  <div className="text-[11.5px] text-[#9a9ab0]">{m.note}</div>
                </div>
                <span className="text-[12px] font-semibold text-[#5a1da8]">Summary →</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <Link
          href="/actions/meetings?view=week"
          className="inline-flex h-8 items-center rounded-lg border border-[#ebebf2] px-3 text-[12px] font-semibold text-[#5c5c74] no-underline hover:bg-[#fafafd]"
        >
          Browse week grid →
        </Link>
    </div>
  );
}
