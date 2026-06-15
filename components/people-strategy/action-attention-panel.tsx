import Link from "next/link";

import type {
  ActionAttentionSeverity,
  ActionAttentionSignal,
  DataQualityFlag,
} from "@/lib/people-strategy/action-attention";

/**
 * People Strategy — Action Tracker "Needs Attention" + "Data quality" panels.
 *
 * Presentational renderers for the signals produced by
 * `lib/people-strategy/action-attention.ts`. Used at the top of `/actions`
 * (personal feed for a member, leadership-wide feed for officers) and the
 * leadership data-quality sweep — so every action surface speaks the same
 * severity / reason / next-step language and links straight to the action.
 */

const SEVERITY_STYLE: Record<
  ActionAttentionSeverity,
  { label: string; bg: string; fg: string }
> = {
  critical: { label: "Critical", bg: "#fee2e2", fg: "#b91c1c" },
  high: { label: "High", bg: "#ffedd5", fg: "#c2410c" },
  medium: { label: "Medium", bg: "#fef9c3", fg: "#a16207" },
  low: { label: "Low", bg: "#f1f5f9", fg: "#475569" },
};

function SeverityChip({ severity }: { severity: ActionAttentionSeverity }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span
      className="shrink-0 rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-[0.3px]"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function ActionAttentionPanel({
  title,
  subtitle,
  signals,
  limit = 8,
  emptyHint = "Nothing needs attention right now.",
}: {
  title: string;
  subtitle?: string;
  signals: ActionAttentionSignal[];
  limit?: number;
  emptyHint?: string;
}) {
  if (signals.length === 0) {
    return (
      <section className="rounded-[12px] border border-line-soft bg-surface p-4">
        <h2 className="m-0 text-[13px] font-bold">{title}</h2>
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{emptyHint}</p>
      </section>
    );
  }

  const shown = signals.slice(0, limit);
  const remaining = signals.length - shown.length;

  return (
    <section className="rounded-[12px] border border-line-soft bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-[13px] font-bold">{title}</h2>
        <span className="text-[12px] text-ink-muted">{signals.length}</span>
      </div>
      {subtitle ? <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{subtitle}</p> : null}
      <ul className="m-0 mt-3 grid list-none gap-2 p-0">
        {shown.map((s, i) => (
          <li key={`${s.kind}-${s.actionId}-${i}`}>
            <Link
              href={s.href}
              className="flex items-start gap-3 rounded-[10px] border border-line-soft bg-surface-muted px-3 py-2 no-underline transition-colors hover:border-line"
            >
              <SeverityChip severity={s.severity} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{s.title}</span>
                <span className="block text-[12.5px] text-ink-muted">{s.reason}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
                  <span className="font-semibold text-[var(--ypp-purple,#6b21c8)]">
                    Next: {s.nextStep}
                  </span>
                  {s.ownerName ? <span>· {s.ownerName}</span> : <span>· Unassigned</span>}
                  {s.meetingTitle ? <span>· Meeting: {s.meetingTitle}</span> : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="m-0 mt-2 text-[12px] text-ink-muted">+{remaining} more</p>
      ) : null}
    </section>
  );
}

export function ActionDataQualityPanel({
  flags,
  limit = 12,
}: {
  flags: DataQualityFlag[];
  limit?: number;
}) {
  if (flags.length === 0) {
    return (
      <section className="rounded-[12px] border border-line-soft bg-surface p-4">
        <h2 className="m-0 text-[13px] font-bold">Data quality</h2>
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
          Every open action has a lead, a deadline, and a clean record. ✓
        </p>
      </section>
    );
  }

  const shown = flags.slice(0, limit);
  const remaining = flags.length - shown.length;

  return (
    <section className="rounded-[12px] border border-line-soft bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-[13px] font-bold">Data quality</h2>
        <span className="text-[12px] text-ink-muted">{flags.length} to fix</span>
      </div>
      <p className="m-0 mt-0.5 text-[12px] text-ink-muted">
        Hygiene problems that make the tracker untrustworthy — leadership only.
      </p>
      <ul className="m-0 mt-3 grid list-none gap-2 p-0">
        {shown.map((f, i) => (
          <li key={`${f.kind}-${f.actionId}-${i}`}>
            <Link
              href={f.href}
              className="flex items-start gap-3 rounded-[10px] border border-line-soft bg-surface-muted px-3 py-2 no-underline transition-colors hover:border-line"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{f.title}</span>
                <span className="block text-[12.5px] text-ink-muted">{f.issue}</span>
                <span className="mt-0.5 block text-[11.5px] font-semibold text-[var(--ypp-purple,#6b21c8)]">
                  Fix: {f.recommendedFix}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="m-0 mt-2 text-[12px] text-ink-muted">+{remaining} more</p>
      ) : null}
    </section>
  );
}
