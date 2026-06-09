import Link from "next/link";

import { addDays, formatMonthDayYear } from "@/lib/leadership-action-center/dates";
import type {
  ActionTriage,
  WeeklyOperationalDigest,
} from "@/lib/people-strategy/operational-digest";

/**
 * Weekly Leadership Review — the guided operating rhythm. A deterministic,
 * step-driven view over the SAME weekly digest the Command Center renders (no
 * persisted "review session" this pass — the step lives in the `?step=` param),
 * so a leader can work overdue work, meeting follow-through, entity health, and
 * un-owned decisions in one ordered pass. Pure presentational server components.
 */

export const WEEKLY_REVIEW_STEPS = [
  {
    key: "triage",
    label: "Triage",
    title: "Triage open work",
    hint: "Overdue, blocked, unowned, and due-soon actions — decide what moves.",
  },
  {
    key: "meetings",
    label: "Meetings",
    title: "Meeting follow-through",
    hint: "Recent meetings with open follow-ups, decisions, or no action yet.",
  },
  {
    key: "entities",
    label: "Health",
    title: "Entity health",
    hint: "Critical and drifting parts of YPP — classes, mentorships, partners, people.",
  },
  {
    key: "decisions",
    label: "Decisions",
    title: "Decisions → action",
    hint: "Decisions made recently that aren't owned yet — convert them to execution.",
  },
  {
    key: "wrap",
    label: "Wrap-up",
    title: "Wrap-up",
    hint: "What you reviewed, what's left, and when to review next.",
  },
] as const;

export type WeeklyReviewStepKey = (typeof WEEKLY_REVIEW_STEPS)[number]["key"];

export function isWeeklyReviewStep(value: unknown): value is WeeklyReviewStepKey {
  return (
    typeof value === "string" &&
    WEEKLY_REVIEW_STEPS.some((s) => s.key === value)
  );
}

/** The active step, defaulting to the first when the param is missing/invalid. */
export function resolveWeeklyReviewStep(value: string | undefined): WeeklyReviewStepKey {
  return isWeeklyReviewStep(value) ? value : WEEKLY_REVIEW_STEPS[0].key;
}

export function weeklyReviewStepHref(key: WeeklyReviewStepKey): string {
  return `/operations/weekly-review?step=${key}`;
}

/** The recommended next review date — one operating week out. */
export function nextReviewDate(now: Date = new Date()): Date {
  return addDays(now, 7);
}

export function stepMeta(key: WeeklyReviewStepKey) {
  return WEEKLY_REVIEW_STEPS.find((s) => s.key === key) ?? WEEKLY_REVIEW_STEPS[0];
}

// --- stepper -----------------------------------------------------------------

export function WeeklyReviewStepper({
  activeKey,
  counts,
}: {
  activeKey: WeeklyReviewStepKey;
  counts: Partial<Record<WeeklyReviewStepKey, number>>;
}) {
  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {WEEKLY_REVIEW_STEPS.map((step, i) => {
        const active = step.key === activeKey;
        const count = counts[step.key];
        return (
          <li key={step.key} style={{ flex: "1 1 150px", minWidth: 130 }}>
            <Link
              href={weeklyReviewStepHref(step.key)}
              aria-current={active ? "step" : undefined}
              className="card cc-focusable"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                textDecoration: "none",
                color: "inherit",
                borderLeft: `3px solid ${active ? "var(--ypp-purple, #6b21c8)" : "var(--border, #e5e7eb)"}`,
                background: active ? "var(--surface-alt, #f9fafb)" : undefined,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  fontSize: 12,
                  fontWeight: 700,
                  color: active ? "#fff" : "var(--muted)",
                  background: active ? "var(--ypp-purple, #6b21c8)" : "var(--surface-alt, #eef0f3)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{step.label}</span>
                {typeof count === "number" && count > 0 ? (
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{count} to review</span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// --- prev / next nav ---------------------------------------------------------

export function WeeklyReviewNav({ activeKey }: { activeKey: WeeklyReviewStepKey }) {
  const index = WEEKLY_REVIEW_STEPS.findIndex((s) => s.key === activeKey);
  const prev = index > 0 ? WEEKLY_REVIEW_STEPS[index - 1] : null;
  const next = index < WEEKLY_REVIEW_STEPS.length - 1 ? WEEKLY_REVIEW_STEPS[index + 1] : null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
      {prev ? (
        <Link href={weeklyReviewStepHref(prev.key)} className="button outline small">
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={weeklyReviewStepHref(next.key)} className="button primary small">
          {next.label} →
        </Link>
      ) : (
        <Link href="/operations/command-center" className="button primary small">
          Back to Command Center
        </Link>
      )}
    </div>
  );
}

// --- step shell --------------------------------------------------------------

export function WeeklyReviewStepShell({
  stepKey,
  children,
}: {
  stepKey: WeeklyReviewStepKey;
  children: React.ReactNode;
}) {
  const meta = stepMeta(stepKey);
  const index = WEEKLY_REVIEW_STEPS.findIndex((s) => s.key === stepKey);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)" }}>
          Step {index + 1} of {WEEKLY_REVIEW_STEPS.length}
        </p>
        <h2 className="section-title" style={{ margin: "4px 0 0" }}>
          {meta.title}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>{meta.hint}</p>
      </div>
      {children}
    </section>
  );
}

// --- wrap-up -----------------------------------------------------------------

export function WeeklyReviewWrapUp({
  digest,
  triage,
  nextReviewISO,
}: {
  digest: WeeklyOperationalDigest;
  triage: ActionTriage;
  nextReviewISO: string;
}) {
  const reviewedActions = new Set<string>();
  for (const list of [triage.overdue, triage.blocked, triage.unassigned, triage.dueSoon]) {
    for (const a of list) reviewedActions.add(a.id);
  }
  const remainingUrgent = digest.counts.overdueActions + digest.counts.blockedActions;

  const rows: Array<{ label: string; value: number; tone?: "bad" | "warn" | "ok" }> = [
    { label: "Actions triaged", value: reviewedActions.size },
    { label: "Meetings needing follow-up", value: digest.meetingsNeedingFollowThrough.length, tone: digest.meetingsNeedingFollowThrough.length > 0 ? "warn" : "ok" },
    { label: "Decisions to convert", value: digest.decisionsNeedingAction.length, tone: digest.decisionsNeedingAction.length > 0 ? "warn" : "ok" },
    { label: "Critical areas", value: digest.counts.criticalEntities, tone: digest.counts.criticalEntities > 0 ? "bad" : "ok" },
    { label: "Still overdue or blocked", value: remainingUrgent, tone: remainingUrgent > 0 ? "bad" : "ok" },
    { label: "Resolved recently", value: digest.counts.recentlyCompletedActions, tone: "ok" },
  ];

  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
        {remainingUrgent === 0
          ? "Nice — nothing is overdue or blocked after this review. Keep the rhythm going."
          : `${remainingUrgent} item${remainingUrgent === 1 ? "" : "s"} still need a decision. Assign, reschedule, or unblock them before they pile up.`}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {rows.map((r) => (
          <div key={r.label}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color:
                  r.tone === "bad"
                    ? "var(--error-color, #991b1b)"
                    : r.tone === "warn"
                      ? "var(--warning-color, #854d0e)"
                      : r.tone === "ok"
                        ? "var(--success-color, #166534)"
                        : "inherit",
              }}
            >
              {r.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.3 }}>
              {r.label}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 13 }}>
        Recommended next review: <strong>{formatMonthDayYear(new Date(nextReviewISO))}</strong>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/operations/command-center" className="button primary small">
          Back to Command Center
        </Link>
        <Link href="/actions/all?status=OVERDUE" className="button outline small">
          Open overdue actions
        </Link>
      </div>
    </div>
  );
}
