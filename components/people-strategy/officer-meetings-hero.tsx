import Link from "next/link";

import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import {
  PRIMARY_MEETING_MODE_META,
  meetingNextAction,
  selectPrimaryMeeting,
} from "@/lib/people-strategy/meeting-command-center";

/**
 * Officer Meetings hero — the YPP Portal mockup's signature next-meeting card
 * with the Before → During → After phase rail. Pure render over the loaded
 * meeting cards: it reuses `selectPrimaryMeeting` (the same selector the rest of
 * the surface uses) so "the meeting that matters now" never disagrees with the
 * tracker below it.
 */

type Phase = "before" | "during" | "after";

const PHASES: { key: Phase; num: number; label: string; sub: string }[] = [
  { key: "before", num: 1, label: "Before", sub: "Build the agenda" },
  { key: "during", num: 2, label: "During", sub: "Run & capture" },
  { key: "after", num: 3, label: "After", sub: "Summary & follow-ups" },
];

function phaseOf(status: MeetingCardDTO["effectiveStatus"]): Phase {
  if (status === "in_progress") return "during";
  if (status === "completed" || status === "needs_follow_up") return "after";
  return "before";
}

function withRelated(m: MeetingCardDTO) {
  return { ...m, hasRelatedEntity: !!m.relatedEntityType && !!m.relatedEntityId };
}

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function OfficerMeetingsHero({ cards, now }: { cards: MeetingCardDTO[]; now: Date }) {
  const selection = selectPrimaryMeeting(cards.map(withRelated), now);

  if (!selection) {
    return (
      <section className="rounded-[16px] border border-line-card bg-surface p-5 shadow-card">
        <p className="m-0 text-[15px] font-bold text-ink">No meeting needs you right now.</p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Nothing is live or coming up this week, and finished meetings are wrapped up.
        </p>
        <Link
          href="/actions/meetings/new"
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[linear-gradient(135deg,#5a1da8_0%,#6b21c8_52%,#8b3fe8_100%)] px-4 text-[13px] font-semibold text-white no-underline"
        >
          ＋ Schedule a meeting
        </Link>
      </section>
    );
  }

  const m = selection.meeting;
  const meta = PRIMARY_MEETING_MODE_META[selection.mode];
  const next = meetingNextAction(m);
  const current = phaseOf(m.effectiveStatus);
  const when = selection.mode === "current" ? "Happening now" : fmtWhen(m.startISO);
  const start = new Date(m.startISO);

  return (
    <section className="rounded-[16px] border border-line-card bg-surface p-5 shadow-card">
      {/* next meeting row */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-[50px] shrink-0 text-center">
          <div className="text-[21px] font-extrabold leading-none text-brand-700">
            {start.getDate()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#a8a8bd]">
            {start.toLocaleString("en-US", { month: "short" })}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold text-ink">{m.title}</div>
          <div className="truncate text-[12.5px] text-ink-muted">
            {[when, m.facilitator?.name].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span className="shrink-0 rounded-[7px] bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700">
          {meta.eyebrow}
        </span>
      </div>

      {/* Before / During / After rail */}
      <div className="flex gap-2">
        {PHASES.map((p) => {
          const active = p.key === current;
          const done = PHASES.findIndex((x) => x.key === current) > PHASES.findIndex((x) => x.key === p.key);
          return (
            <div
              key={p.key}
              className="flex flex-1 flex-col gap-0.5 rounded-[11px] border px-3.5 py-2.5"
              style={{
                background: active ? "#f3ecff" : "#fff",
                borderColor: active ? "#e4d8f7" : "#ececf3",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: active ? "#6b21c8" : done ? "#dcfce7" : "#f1f1f6",
                    color: active ? "#fff" : done ? "#15803d" : "#9a9ab0",
                  }}
                >
                  {done ? "✓" : p.num}
                </span>
                <span
                  className="text-[13px] font-bold"
                  style={{ color: active ? "#5a1da8" : "#3a3a52" }}
                >
                  {p.label}
                </span>
              </div>
              <span className="pl-[26px] text-[11px] text-ink-muted">{p.sub}</span>
            </div>
          );
        })}
      </div>

      {/* primary next action */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={next.href}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#5a1da8_0%,#6b21c8_52%,#8b3fe8_100%)] px-4 text-[13px] font-bold text-white no-underline"
        >
          {next.label} →
        </Link>
        <span className="text-[12.5px] text-ink-muted">{next.reason}</span>
      </div>
    </section>
  );
}
