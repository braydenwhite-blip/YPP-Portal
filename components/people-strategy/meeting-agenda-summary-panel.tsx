"use client";

import { useState } from "react";

/**
 * Meeting workspace — deterministic Agenda / Summary generator panel.
 *
 * The text is generated server-side (see `meeting-agenda-summary.ts`) and passed
 * in pre-built, so this is a thin client shell: switch between Agenda and
 * Summary, edit the draft, and copy it to the clipboard. No AI, no network — the
 * draft is editable so the facilitator owns the final wording. Email delivery is
 * intentionally NOT invented here; copy/paste into the existing channel is the
 * safe path until a meeting-summary send flow exists.
 */

type Tab = "agenda" | "summary";

export function MeetingAgendaSummaryPanel({
  agendaText,
  summaryText,
  summaryWarnings,
  summaryMissingNotes,
}: {
  agendaText: string;
  summaryText: string;
  summaryWarnings: string[];
  summaryMissingNotes: boolean;
}) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [agenda, setAgenda] = useState(agendaText);
  const [summary, setSummary] = useState(summaryText);
  const [copied, setCopied] = useState(false);

  const value = tab === "agenda" ? agenda : summary;
  const setValue = tab === "agenda" ? setAgenda : setSummary;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the textarea is selectable as a fallback.
    }
  }

  return (
    <section className="rounded-[12px] border border-line-soft bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[14px] font-bold">Agenda &amp; summary</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab("agenda")}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
              tab === "agenda"
                ? "bg-[var(--ypp-purple,#6b21c8)] text-white"
                : "bg-surface-muted text-ink-muted"
            }`}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
              tab === "summary"
                ? "bg-[var(--ypp-purple,#6b21c8)] text-white"
                : "bg-surface-muted text-ink-muted"
            }`}
          >
            Summary
          </button>
        </div>
      </div>

      <p className="m-0 mt-1 text-[12px] text-ink-muted">
        {tab === "agenda"
          ? "Generated from this meeting's linked actions, agenda items, and carry-forwards. Edit and copy."
          : "Generated from notes, decisions, follow-ups, and action updates. Edit and copy."}
      </p>

      {tab === "summary" && summaryMissingNotes ? (
        <p className="m-0 mt-2 rounded-[8px] bg-[#fffbeb] px-3 py-2 text-[12px] text-[#a16207]">
          Nothing has been logged yet — add notes, decisions, or follow-ups for a useful summary.
        </p>
      ) : null}

      {tab === "summary" && summaryWarnings.length > 0 ? (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0">
          {summaryWarnings.map((w, i) => (
            <li key={i} className="rounded-[8px] bg-[#fff7ed] px-3 py-1.5 text-[12px] text-[#c2410c]">
              ⚠ {w}
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        rows={Math.min(20, Math.max(8, value.split("\n").length + 1))}
        className="mt-3 w-full resize-y rounded-[10px] border border-line-soft bg-surface-muted p-3 font-mono text-[12.5px] leading-relaxed text-ink"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-[8px] bg-[var(--ypp-purple,#6b21c8)] px-3 py-1.5 text-[12.5px] font-semibold text-white"
        >
          {copied ? "Copied ✓" : `Copy ${tab}`}
        </button>
        <span className="text-[11.5px] text-ink-muted">Paste into your meeting channel.</span>
      </div>
    </section>
  );
}
