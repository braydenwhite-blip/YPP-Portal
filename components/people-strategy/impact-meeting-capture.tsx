"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";
import { addDecision, saveAgendaItemNotes, setAgendaItemStatus } from "@/lib/people-strategy/meetings-actions";
import {
  carryImpactTeamToNextWeek,
  createImpactFollowUpAction,
  pullGlobalImpactUpdatesIntoAgenda,
} from "@/lib/people-strategy/impact-meeting-actions";
import type {
  ImpactMeetingAgenda,
  ImpactMeetingAgendaSection,
} from "@/lib/people-strategy/impact-meetings";

export type CaptureDecision = { id: string; decision: string; decidedByName: string | null };
export type CaptureFollowUp = { id: string; title: string; ownerName: string | null; dueISO: string | null; status: string };

type CaptureMode = "comment" | "decision" | "action" | "input";

const MODE_LABEL: Record<CaptureMode, string> = {
  comment: "Comment",
  decision: "Decision",
  action: "Next step → action",
  input: "Input request → action",
};

function statusTone(s: ImpactMeetingAgendaSection): StatusTone {
  if (s.agendaItemStatus === "DISCUSSED") return "success";
  if (s.agendaItemStatus === "DEFERRED") return "info";
  if (s.readiness === "missing") return "danger";
  return "neutral";
}

function statusText(s: ImpactMeetingAgendaSection): string {
  if (s.agendaItemStatus === "DISCUSSED") return "Discussed";
  if (s.agendaItemStatus === "DEFERRED") return "Carried";
  if (s.readiness === "missing") return "Not submitted";
  return "To discuss";
}

function plusDaysInput(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ImpactMeetingCapture({
  agenda,
  meetingId,
  people,
  decisions,
  followUps,
}: {
  agenda: ImpactMeetingAgenda;
  meetingId: string;
  people: PersonOption[];
  decisions: CaptureDecision[];
  followUps: CaptureFollowUp[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(agenda.sections[0]?.teamId ?? "");
  const active = agenda.sections.find((s) => s.teamId === activeId) ?? agenda.sections[0] ?? null;

  const [mode, setMode] = useState<CaptureMode>("comment");
  const [text, setText] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const dueDefault = useMemo(() => plusDaysInput(agenda.meetingDateISO, 7), [agenda.meetingDateISO]);
  const [due, setDue] = useState(dueDefault);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!active) {
    return <p className="text-[13px] text-ink-muted">No teams on this agenda yet.</p>;
  }

  const effectiveOwner = ownerId || active.presenterId || "";

  function refresh(msg: string) {
    setText("");
    setNote(msg);
    router.refresh();
  }

  function markDiscussed() {
    if (!active!.agendaItemId) return;
    startTransition(async () => {
      await setAgendaItemStatus({ id: active!.agendaItemId!, status: "DISCUSSED" });
      refresh(`Marked ${active!.teamName} discussed.`);
    });
  }
  function skip() {
    if (!active!.agendaItemId) return;
    startTransition(async () => {
      await setAgendaItemStatus({ id: active!.agendaItemId!, status: "DEFERRED" });
      refresh(`Skipped ${active!.teamName} for now.`);
    });
  }
  function carry() {
    startTransition(async () => {
      await carryImpactTeamToNextWeek({ meetingId, teamId: active!.teamId });
      refresh(`Carried ${active!.teamName} to next week.`);
    });
  }

  function capture() {
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      if (mode === "comment") {
        if (!active!.agendaItemId) {
          setNote("Pull updates into the agenda first, then comments save to this team.");
          return;
        }
        const prior = active!.agendaItemNotes?.trim();
        const combined = prior ? `${prior}\n${value}` : value;
        await saveAgendaItemNotes({ id: active!.agendaItemId, notes: combined });
        refresh("Comment captured.");
      } else if (mode === "decision") {
        await addDecision({ meetingId, decision: value });
        refresh("Decision recorded.");
      } else {
        // action / input request → a tracked follow-up action
        if (!effectiveOwner) {
          setNote("Pick an owner so this becomes a real tracked action.");
          return;
        }
        const title = mode === "input" ? `Input needed: ${value}` : value;
        await createImpactFollowUpAction({
          meetingId,
          teamId: active!.teamId,
          title: title.slice(0, 300),
          ownerId: effectiveOwner,
          dueDate: due || dueDefault,
          briefId: active!.briefId ?? undefined,
        });
        refresh(mode === "input" ? "Input request logged as a follow-up." : "Next step created as a tracked action.");
      }
    });
  }

  const needsOwnerDue = mode === "action" || mode === "input";

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Left rail: what we're discussing */}
      <aside className="flex flex-col gap-2">
        <p className="m-0 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">On the agenda</p>
        {agenda.sections.map((s) => {
          const isActive = s.teamId === active.teamId;
          return (
            <button
              key={s.teamId}
              type="button"
              onClick={() => setActiveId(s.teamId)}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left ${
                isActive ? "border-brand-400 bg-brand-50" : "border-line-soft bg-surface hover:border-brand-200"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold text-ink">{s.teamName}</span>
                <span className="block truncate text-[12px] text-ink-muted">{s.presenterName ?? "No presenter"}</span>
              </span>
              <StatusBadge tone={statusTone(s)}>{statusText(s)}</StatusBadge>
            </button>
          );
        })}
      </aside>

      {/* Main: capture for the selected team */}
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-line-card bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-[18px] font-bold text-ink">{active.teamName}</h3>
              <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-ink-muted">
                {active.presenterName ?? "No presenter"} · {active.estimatedMinutes} min · {statusText(active)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={markDiscussed} disabled={pending || !active.agendaItemId} className="rounded-lg bg-brand-700 px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50">
                ✓ Mark discussed
              </button>
              <button type="button" onClick={skip} disabled={pending || !active.agendaItemId} className="rounded-lg border border-line-soft bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink disabled:opacity-50">
                Skip for now
              </button>
              <button type="button" onClick={carry} disabled={pending} className="rounded-lg border border-line-soft bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink disabled:opacity-50">
                Carry forward
              </button>
            </div>
          </div>

          {/* Deliverable links — open externally, never previewed */}
          {active.deliverables.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {active.deliverables.map((d) => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="rounded-md border border-line-soft bg-surface-muted px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-700 no-underline">
                  Open {d.label} ↗
                </a>
              ))}
            </div>
          ) : null}

          {!active.agendaItemId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              Updates aren&apos;t on the agenda yet — comments &amp; discussed status need them.
              <form action={pullGlobalImpactUpdatesIntoAgenda.bind(null, { meetingId })}>
                <button className="rounded-md bg-brand-700 px-2.5 py-1 text-[12px] font-bold text-white">Pull updates</button>
              </form>
            </div>
          ) : active.agendaItemNotes ? (
            <div className="mt-3 rounded-lg border border-line-soft bg-surface-muted p-3 text-[13px] text-ink">
              <p className="m-0 text-[11px] font-bold uppercase text-ink-muted">Notes so far</p>
              <p className="m-0 mt-1 whitespace-pre-line">{active.agendaItemNotes}</p>
            </div>
          ) : null}

          {/* Capture box */}
          <div className="mt-4 rounded-xl border border-line-soft bg-surface-muted/50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MODE_LABEL) as CaptureMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${mode === m ? "bg-brand-700 text-white" : "bg-white text-ink-muted hover:text-ink"}`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={
                mode === "decision"
                  ? "Record the call leadership made…"
                  : mode === "action"
                    ? "What will happen next, concretely?"
                    : mode === "input"
                      ? "What input is needed, and on what?"
                      : `Capture a comment for ${active.teamName}…`
              }
              className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-400"
            />
            {needsOwnerDue ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select value={effectiveOwner} onChange={(e) => setOwnerId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-ink">
                  <option value="">Owner…</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-ink" />
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[12px] text-ink-muted">
                {mode === "action" || mode === "input" ? "Creates a tracked action in the action tracker." : mode === "decision" ? "Saved to this meeting's decisions." : "Appended to this team's notes."}
              </span>
              <button type="button" onClick={capture} disabled={pending || !text.trim()} className="rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
                {pending ? "Saving…" : `Add ${MODE_LABEL[mode].toLowerCase()}`}
              </button>
            </div>
          </div>
          {note ? <p className="m-0 mt-2 text-[13px] font-medium text-complete-700">{note}</p> : null}
        </section>

        {/* Captured this meeting */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line-card bg-surface p-4 shadow-card">
            <h4 className="m-0 text-[13px] font-bold uppercase tracking-wide text-ink-muted">Decisions captured</h4>
            {decisions.length ? (
              <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                {decisions.map((d) => (
                  <li key={d.id} className="rounded-lg bg-surface-muted px-3 py-2 text-[13px] text-ink">
                    {d.decision}
                    {d.decidedByName ? <span className="text-ink-muted"> · {d.decidedByName}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[12.5px] text-ink-muted">No decisions captured yet.</p>
            )}
          </div>
          <div className="rounded-2xl border border-line-card bg-surface p-4 shadow-card">
            <h4 className="m-0 text-[13px] font-bold uppercase tracking-wide text-ink-muted">Follow-ups &amp; next steps</h4>
            {followUps.length ? (
              <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                {followUps.map((f) => (
                  <li key={f.id} className="rounded-lg bg-surface-muted px-3 py-2 text-[13px] text-ink">
                    {f.title}
                    <span className="text-ink-muted">
                      {f.ownerName ? ` · ${f.ownerName}` : ""}
                      {f.dueISO ? ` · due ${f.dueISO.slice(0, 10)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[12.5px] text-ink-muted">No follow-ups yet — capture next steps above.</p>
            )}
          </div>
        </section>

        <p className="m-0 text-center text-[12px] text-ink-muted">
          The meeting happens in Zoom / Meet — this just captures what was said. Manage all actions in the{" "}
          <Link href="/actions" className="font-semibold text-brand-700 no-underline hover:underline">
            action tracker
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
