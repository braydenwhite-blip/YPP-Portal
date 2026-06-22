"use client";

import { useState } from "react";
import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import { pullGlobalImpactUpdatesIntoAgenda } from "@/lib/people-strategy/impact-meeting-actions";
import type {
  ImpactMeetingAgenda,
  ImpactMeetingAgendaSection,
} from "@/lib/people-strategy/impact-meetings";

type BoardStatus = { label: string; tone: StatusTone };

function boardStatus(s: ImpactMeetingAgendaSection): BoardStatus {
  if (s.readiness === "missing") return { label: "Not submitted", tone: "danger" };
  if (s.readiness === "draft") return { label: "In progress", tone: "warning" };
  if (s.agendaItemStatus === "DISCUSSED" || s.readiness === "discussed") return { label: "Discussed", tone: "info" };
  if (s.needsAttention.length > 0) return { label: "Needs revision", tone: "warning" };
  return { label: "Ready", tone: "success" };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function summaryLine(s: ImpactMeetingAgendaSection): string {
  if (s.readiness === "missing") return "No update submitted yet.";
  return s.completedThisWeek[0] ?? s.commentsOrNotes[0] ?? s.nextWeekCommitments[0] ?? "Update submitted.";
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function Donut({ ready, total }: { ready: number; total: number }) {
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;
  return (
    <div
      className="flex size-12 items-center justify-center rounded-full text-[12px] font-bold text-brand-700"
      style={{ background: `conic-gradient(var(--ypp-purple, #6b21c8) ${pct}%, var(--ypp-purple-100, #ede4ff) 0)` }}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-surface">{ready}/{total}</span>
    </div>
  );
}

function TeamCard({ section }: { section: ImpactMeetingAgendaSection }) {
  const status = boardStatus(section);
  const flagged = section.readiness !== "missing" && section.readiness !== "draft" ? section.needsAttention.length : 0;
  const accent =
    status.tone === "success"
      ? "border-t-[var(--ypp-purple,#6b21c8)]"
      : status.tone === "danger"
        ? "border-t-red-400"
        : status.tone === "warning"
          ? "border-t-amber-400"
          : "border-t-brand-300";

  return (
    <article className={`flex flex-col rounded-2xl border border-line-card border-t-[3px] bg-surface p-4 shadow-card ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700 text-[13px] font-bold text-white">
            {initials(section.teamName)}
          </span>
          <div>
            <h3 className="m-0 text-[16px] font-bold leading-tight text-ink">{section.teamName}</h3>
            <p className="m-0 text-[12px] font-semibold text-ink-muted">
              {section.presenterName ?? "No presenter"} · {section.estimatedMinutes} min
            </p>
          </div>
        </div>
        <StatusBadge tone={status.tone} withDot>
          {status.label}
        </StatusBadge>
      </div>

      <p className="m-0 mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink">{summaryLine(section)}</p>

      {section.deliverables.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {section.deliverables.slice(0, 3).map((d) => (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-line-soft bg-surface-muted px-2 py-1 text-[12px] font-semibold text-brand-700 no-underline"
            >
              {d.label} ↗
            </a>
          ))}
        </div>
      ) : section.readiness !== "missing" ? (
        <p className="m-0 mt-3 rounded-md bg-red-50 px-2 py-1 text-[12px] font-semibold text-red-600">No link or file attached</p>
      ) : null}

      {flagged > 0 ? (
        <p className="m-0 mt-2 text-[12px] font-semibold text-amber-700">⚠ {flagged} {flagged === 1 ? "field" : "fields"} flagged</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3 text-[12.5px] font-bold">
        <Link href={section.briefHref} className="text-brand-700 no-underline hover:underline">
          {section.readiness === "missing" ? "Open blank update →" : "View submission →"}
        </Link>
        {status.label === "Not submitted" ? (
          <Link href={section.briefHref} className="text-amber-700 no-underline hover:underline">
            Send reminder →
          </Link>
        ) : flagged > 0 ? (
          <Link href={section.briefHref} className="text-amber-700 no-underline hover:underline">
            See flags →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

type DecisionItem = { team: string; text: string; kind: "decision" | "input" | "blocker" | "carried" };

function decisionItems(agenda: ImpactMeetingAgenda): DecisionItem[] {
  const items: DecisionItem[] = [];
  for (const s of agenda.sections) {
    for (const d of s.decisionsNeeded) items.push({ team: s.teamName, text: d, kind: "decision" });
    for (const r of s.inputRequests) items.push({ team: s.teamName, text: r, kind: "input" });
    for (const b of s.blockers) items.push({ team: s.teamName, text: b, kind: "blocker" });
    if (s.agendaItemStatus === "DEFERRED") items.push({ team: s.teamName, text: `${s.teamName} carried from last week`, kind: "carried" });
  }
  return items;
}

const KIND_LABEL: Record<DecisionItem["kind"], string> = {
  decision: "Decision",
  input: "Input",
  blocker: "Blocker",
  carried: "Carried",
};

function DecisionsCard({ agenda }: { agenda: ImpactMeetingAgenda }) {
  const items = decisionItems(agenda);
  return (
    <article className="flex flex-col rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-[14px] text-white">⚑</span>
        <div>
          <h3 className="m-0 text-[16px] font-bold text-ink">Decisions &amp; Blockers</h3>
          <p className="m-0 text-[12px] font-semibold text-ink-muted">Open items · 10 min</p>
        </div>
      </div>
      {items.length ? (
        <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
          {items.slice(0, 8).map((item, i) => (
            <li key={`${item.kind}-${i}`} className="rounded-lg bg-surface px-3 py-2 text-[13px] text-ink">
              <span className="mr-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                {KIND_LABEL[item.kind]}
              </span>
              <span className="font-semibold text-ink-muted">{item.team}:</span> {item.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">No decisions or blockers raised yet.</p>
      )}
    </article>
  );
}

function ListRow({ section }: { section: ImpactMeetingAgendaSection }) {
  const status = boardStatus(section);
  return (
    <div className="grid grid-cols-1 items-center gap-2 border-b border-line-soft px-3 py-2.5 last:border-b-0 md:grid-cols-[1.2fr_1fr_70px_140px_1fr]">
      <span className="text-[14px] font-bold text-ink">{section.teamName}</span>
      <span className="text-[13px] text-ink-muted">{section.presenterName ?? "No presenter"}</span>
      <span className="text-[13px] text-ink-muted">{section.estimatedMinutes} min</span>
      <StatusBadge tone={status.tone} withDot>
        {status.label}
      </StatusBadge>
      <Link href={section.briefHref} className="text-[13px] font-bold text-brand-700 no-underline hover:underline">
        {section.readiness === "missing" ? "Open update →" : "View submission →"}
      </Link>
    </div>
  );
}

export function ImpactAgendaBoard({
  agenda,
  captureHref = "#capture",
}: {
  agenda: ImpactMeetingAgenda;
  captureHref?: string;
}) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const total = agenda.sections.length;
  const ready = agenda.sections.filter(
    (s) => s.readiness !== "missing" && s.readiness !== "draft" && s.needsAttention.length === 0
  ).length;
  const missing = agenda.sections.filter((s) => s.readiness === "missing" || s.readiness === "draft").length;
  const totalMinutes = agenda.sections.reduce((sum, s) => sum + s.estimatedMinutes, 0) + 10;
  const itemCount = total + 1;
  const decisions = decisionItems(agenda).filter((i) => i.kind === "decision" || i.kind === "input").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Top status bar */}
      <section className="rounded-2xl border border-line-card bg-surface shadow-card">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <Donut ready={ready} total={total} />
            <div>
              <p className="m-0 text-[14px] font-bold text-ink">{ready} of {total} ready</p>
              <p className="m-0 text-[12px] text-ink-muted">{missing} missing or in progress</p>
            </div>
          </div>
          <div>
            <p className="m-0 text-[14px] font-bold text-ink">⏱ {totalMinutes} min total</p>
            <p className="m-0 text-[12px] text-ink-muted">{itemCount} agenda items</p>
          </div>
          <div>
            <p className="m-0 text-[14px] font-bold text-brand-700">⚑ {decisions} {decisions === 1 ? "decision" : "decisions"} needed</p>
            <p className="m-0 text-[12px] text-ink-muted">On agenda</p>
          </div>
          <p className="m-0 ml-auto text-[13px] font-semibold text-ink-muted">{fmtDateTime(agenda.meetingDateISO)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
          <div className="inline-flex rounded-lg border border-line-soft bg-surface-muted p-0.5 text-[13px] font-semibold">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`rounded-md px-3 py-1.5 ${view === "cards" ? "bg-brand-700 text-white" : "text-ink-muted"}`}
            >
              ▦ Cards
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-md px-3 py-1.5 ${view === "list" ? "bg-brand-700 text-white" : "text-ink-muted"}`}
            >
              ☰ List
            </button>
          </div>
          <div className="flex items-center gap-2">
            <form action={pullGlobalImpactUpdatesIntoAgenda.bind(null, { meetingId: agenda.meetingId })}>
              <button className="rounded-lg border border-line-soft bg-white px-3 py-2 text-[13px] font-semibold text-ink hover:border-brand-400">
                Pull updates into agenda
              </button>
            </form>
            <Link href={captureHref} className="rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-bold text-white no-underline shadow-sm">
              ▶ Start meeting capture
            </Link>
          </div>
        </div>
      </section>

      {view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agenda.sections.map((section) => (
            <TeamCard key={section.teamId} section={section} />
          ))}
          <DecisionsCard agenda={agenda} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-2xl border border-line-card bg-surface shadow-card">
            <div className="hidden grid-cols-[1.2fr_1fr_70px_140px_1fr] gap-2 border-b border-line-soft bg-surface-muted px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted md:grid">
              <span>Team</span>
              <span>Presenter</span>
              <span>Time</span>
              <span>Status</span>
              <span>Submission</span>
            </div>
            {agenda.sections.map((section) => (
              <ListRow key={section.teamId} section={section} />
            ))}
          </section>
          <DecisionsCard agenda={agenda} />
        </div>
      )}
    </div>
  );
}
