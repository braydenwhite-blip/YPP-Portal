import { CcIcon } from "@/components/command-center/icons";

/**
 * The "next session" calm card (Calm Mentorship, Phase 5). A mentee's schedule
 * shouldn't open onto a calendar grid — it should open onto the one session
 * that's actually coming up: when it is, what kind, and a join link the moment
 * one exists. The full calendar (requests, available times) stays one toggle
 * away in Executive mode.
 */

const SESSION_TYPE_LABELS: Record<string, string> = {
  KICKOFF: "Kickoff",
  CHECK_IN: "Check-in",
  REVIEW_PREP: "Review prep",
  QUARTERLY_REVIEW: "Quarterly review",
  OFFICE_HOURS: "Office hours",
};

function whenLabel(iso: string): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  let day: string;
  if (diffDays <= 0) day = "Today";
  else if (diffDays === 1) day = "Tomorrow";
  else if (diffDays < 7) day = date.toLocaleDateString("en-US", { weekday: "long" });
  else
    day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${time}`;
}

export function SessionFocusCard({
  title,
  whenISO,
  type,
  meetingLink,
}: {
  title: string;
  whenISO: string;
  type: string;
  meetingLink?: string | null;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/70 via-surface to-surface/90 p-5 shadow-card backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-6">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-brand-100 text-brand-700">
        <CcIcon name="calendar" size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-700">
          Next session · {SESSION_TYPE_LABELS[type] ?? "Session"}
        </p>
        <p className="m-0 text-[21px] font-bold leading-snug tracking-[-0.01em] text-ink">{title}</p>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-muted">{whenLabel(whenISO)}</p>
      </div>
      {meetingLink ? (
        <a
          href={meetingLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-card transition-colors hover:bg-brand-700"
        >
          Join session <span aria-hidden>→</span>
        </a>
      ) : (
        <span className="shrink-0 rounded-full bg-surface-soft px-4 py-2 text-[12.5px] font-semibold text-ink-muted">
          Link shared before the session
        </span>
      )}
    </section>
  );
}
