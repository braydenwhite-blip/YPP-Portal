"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  addAnalyticsMetricAction,
  markAnalyticsMetricDiscussed,
  toggleAnalyticsMetricAction,
} from "@/lib/chapters/analytics-actions";
import type { LeaderboardModel, MetricPanelModel } from "@/lib/chapters/analytics-types";
import {
  analyticsPanelKey,
  MATURE_TARGETS,
  METRIC_LABELS,
  type AnalyticsMetricKey,
  type PaceStatus,
} from "@/lib/chapters/analytics-pace";

const LEADERBOARD_METRICS: AnalyticsMetricKey[] = [
  "partners",
  "instructors",
  "students",
  "classes",
  "retention",
  "quality",
];

const RECOMMENDED: Record<AnalyticsMetricKey, string[]> = {
  partners: [
    "Schedule 2 partner intro meetings this week",
    "Follow up with warm leads from last month",
    "Ask faculty advisor for 3 school introductions",
  ],
  instructors: [
    "Recruit 2 more instructors this week",
    "Convert pipeline applicants to interviews",
    "Assign trained instructors to open classes",
  ],
  students: [
    "Launch a weekend enrollment push",
    "Re-engage waitlisted students",
    "Ask instructors to invite 3 peers each",
  ],
  classes: [
    "Publish one ready curriculum this week",
    "Confirm room + schedule for next launch",
    "Pair an unassigned instructor with a class",
  ],
  retention: [
    "Call families of at-risk students",
    "Run a mid-session engagement check-in",
    "Pair mentors with low-attendance students",
  ],
  quality: [
    "Review lowest-rated class sessions",
    "Collect missing parent feedback",
    "Coach instructors below 4.0 average",
  ],
};

const OWNER_COLORS = ["#6366f1", "#0d9488", "#c026d3", "#ea580c", "#2563eb", "#7c3aed"];

/** Leaderboard status chips — soft pastels like the product mock. */
const CHIP: Record<
  PaceStatus,
  { wrap: string; icon: string; label: string }
> = {
  above: {
    wrap: "border-[#86efac] bg-[#dcfce7] text-[#14532d]",
    icon: "check",
    label: "Above & Beyond",
  },
  on_track: {
    wrap: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    icon: "check",
    label: "On Track",
  },
  needs_attention: {
    wrap: "border-[#fdba74] bg-[#fff7ed] text-[#9a3412]",
    icon: "dash",
    label: "Needs Attention",
  },
  at_risk: {
    wrap: "border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]",
    icon: "exclaim",
    label: "At Risk",
  },
};

function goalLabel(metric: AnalyticsMetricKey): string {
  if (metric === "quality") return String(MATURE_TARGETS.quality);
  return "70%";
}

function StatusGlyph({ kind }: { kind: string }) {
  if (kind === "check") {
    return (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "dash") {
    return (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 3.6v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="8.6" r="0.7" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(145deg,#ede9fe_0%,#e0e7ff_100%)] text-[#6b21c8]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z"
          stroke="currentColor"
          strokeWidth="1.7"
          fill="rgba(107,33,200,0.08)"
        />
      </svg>
    </span>
  );
}

function InitialsAvatar({ initials, seed }: { initials: string; seed: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  const bg = OWNER_COLORS[hash % OWNER_COLORS.length];
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ background: bg }}
      title={initials}
    >
      {initials.slice(0, 2)}
    </span>
  );
}

function MetricCellButton({
  display,
  status,
  discussedOn,
  selected,
  onClick,
}: {
  display: string;
  status: PaceStatus;
  discussedOn: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const chip = CHIP[status];
  return (
    <button type="button" onClick={onClick} className="group flex w-full flex-col items-center gap-0.5">
      <span
        className={`inline-flex w-full max-w-[6.5rem] items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1 text-[11px] font-bold tabular-nums transition duration-150 ${chip.wrap} ${
          selected
            ? "ring-2 ring-[#a5b4fc] ring-offset-1"
            : "group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_10px_rgba(59,15,110,0.08)]"
        }`}
      >
        <StatusGlyph kind={chip.icon} />
        {display}
      </span>
      {discussedOn ? (
        <span className="max-w-full truncate rounded-full bg-[#dbeafe] px-1 py-0.5 text-[8px] font-semibold leading-none text-[#1d4ed8]">
          {discussedOn}
        </span>
      ) : null}
    </button>
  );
}

function ActionPanel({
  panel,
  periodKey,
  onClose,
  onRefresh,
}: {
  panel: MetricPanelModel;
  periodKey: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const gap = Math.round((panel.cell.actual - panel.cell.expected) * 10) / 10;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else onRefresh();
    });
  }

  return (
    <section className="border-t border-[#ebe6f4] bg-[#fcfbfe]">
      <div className="flex items-center justify-between border-b border-[#efeaf7] bg-white px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold tracking-tight text-[#1e1b4b]">Action Items</h2>
          <p className="truncate text-[12px] font-semibold text-[#6b21c8]">
            {panel.chapterName} · {METRIC_LABELS[panel.metric]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#475569]"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="rounded-xl border border-[#ebe6f4] bg-white p-3 shadow-[0_1px_2px_rgba(46,16,101,0.04)]">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Current</div>
                <div className="mt-0.5 text-[20px] font-bold tabular-nums text-[#1e1b4b]">{panel.cell.actual}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Expected</div>
                <div className="mt-0.5 text-[20px] font-bold tabular-nums text-[#1e1b4b]">{panel.cell.expected}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Gap</div>
                <div
                  className={`mt-0.5 text-[20px] font-bold tabular-nums ${
                    gap < 0 ? "text-[#dc2626]" : gap > 0 ? "text-[#16a34a]" : "text-[#1e1b4b]"
                  }`}
                >
                  {gap > 0 ? `+${gap}` : gap}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#f3f0f8] pt-2 text-[11px] text-[#64748b]">
              <span className="font-medium">{panel.cell.percentOfExpected}% of expected</span>
              {panel.deltaVsPriorMonth != null ? (
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    panel.deltaVsPriorMonth < 0 ? "text-[#dc2626]" : "text-[#16a34a]"
                  }`}
                >
                  {panel.deltaVsPriorMonth >= 0 ? "↑" : "↓"} {Math.abs(panel.deltaVsPriorMonth)} vs last month
                </span>
              ) : null}
            </div>
            {panel.warning ? (
              <div className="mt-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-2.5 py-2 text-[11px] leading-relaxed text-[#991b1b]">
                {panel.warning}
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
              Actions to Date
            </h3>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[11px]">
              <div className="rounded-lg border border-[#bbf7d0]/60 bg-[#f0fdf4] px-1.5 py-1.5">
                <div className="text-[14px] font-bold text-[#166534]">{panel.actionsCompleted}</div>
                <div className="text-[#64748b]">Done</div>
              </div>
              <div className="rounded-lg border border-[#bbf7d0]/60 bg-[#f0fdf4] px-1.5 py-1.5">
                <div className="text-[14px] font-bold text-[#166534]">{panel.actionsOnTime}</div>
                <div className="text-[#64748b]">On time</div>
              </div>
              <div className="rounded-lg border border-[#fecaca]/70 bg-[#fef2f2] px-1.5 py-1.5">
                <div className="text-[14px] font-bold text-[#991b1b]">{panel.actionsLate}</div>
                <div className="text-[#64748b]">Late</div>
              </div>
            </div>
            {panel.lastCompletedLabel ? (
              <p className="mt-1.5 text-[11px] leading-snug text-[#64748b]">
                Last: {panel.lastCompletedLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-[#ebe6f4] bg-white p-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
            Discussion & Ownership
          </h3>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#334155]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#6b21c8] focus:ring-[#c4b5fd]"
              checked={Boolean(panel.discussedOn)}
              disabled={pending}
              onChange={(e) =>
                run(() =>
                  markAnalyticsMetricDiscussed({
                    chapterId: panel.chapterId,
                    metric: panel.metric,
                    periodKey,
                    discussed: e.target.checked,
                  })
                )
              }
            />
            <span className="flex-1">Discussed in weekly meeting</span>
            {panel.discussedOn ? (
              <span className="text-[11px] font-semibold text-[#6b21c8]">{panel.discussedOn}</span>
            ) : null}
          </label>
          <label className="flex items-center gap-2.5 text-[13px] text-[#334155]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#6b21c8]"
              checked={panel.actions.length > 0}
              readOnly
            />
            <span className="flex-1">Action items assigned</span>
            {panel.assignedInitials ? (
              <InitialsAvatar initials={panel.assignedInitials} seed={panel.assignedInitials} />
            ) : null}
          </label>

          <form
            className="space-y-2 border-t border-[#f3f0f8] pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              const due = new Date();
              due.setDate(due.getDate() + 7);
              run(async () => {
                const res = await addAnalyticsMetricAction({
                  chapterId: panel.chapterId,
                  metric: panel.metric,
                  title: title.trim(),
                  deadlineStart: due.toISOString(),
                });
                if (res.ok) setTitle("");
                return res;
              });
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New action item…"
              className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#ede9fe]"
            />
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="w-full rounded-lg bg-[linear-gradient(135deg,#5a1da8_0%,#6b21c8_55%,#7c3aed_100%)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_6px_14px_rgba(107,33,200,0.22)] transition hover:brightness-105 disabled:opacity-50"
            >
              + Add Action Item
            </button>
          </form>
          {error ? <p className="text-[12px] text-[#dc2626]">{error}</p> : null}
        </div>

        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
            Recommended Actions
          </h3>
          <ul className="mt-1.5 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
            {panel.actions.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2 rounded-lg border border-[#efeaf7] bg-white px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#6b21c8]"
                  checked={a.status === "COMPLETE"}
                  disabled={pending}
                  onChange={(e) =>
                    run(() =>
                      toggleAnalyticsMetricAction({
                        chapterId: panel.chapterId,
                        actionId: a.id,
                        complete: e.target.checked,
                      })
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-snug text-[#1e1b4b]">{a.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#94a3b8]">
                    <InitialsAvatar initials={a.leadInitials} seed={a.leadName} />
                    <span>
                      {new Date(a.deadlineStart).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {a.status === "COMPLETE" ? (
                      <span className="font-semibold text-[#16a34a]">Assigned</span>
                    ) : a.late ? (
                      <span className="font-semibold text-[#dc2626]">Overdue</span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
            {RECOMMENDED[panel.metric]
              .filter((rec) => !panel.actions.some((a) => a.title === rec))
              .map((rec, idx) => (
                <li
                  key={rec}
                  className="flex items-start gap-2 rounded-lg border border-dashed border-[#e2e8f0] bg-white/70 px-2.5 py-2"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#6b21c8]"
                    disabled={pending}
                    onChange={(e) => {
                      if (!e.target.checked) return;
                      const due = new Date();
                      due.setDate(due.getDate() + 7);
                      run(() =>
                        addAnalyticsMetricAction({
                          chapterId: panel.chapterId,
                          metric: panel.metric,
                          title: rec,
                          deadlineStart: due.toISOString(),
                        })
                      );
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] leading-snug text-[#475569]">{rec}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[#94a3b8]">
                      <InitialsAvatar
                        initials={["JM", "SP", "AR", "DC"][idx % 4]}
                        seed={`${rec}-${idx}`}
                      />
                      <span>Suggest assigning</span>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LeaderboardLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-[11px] text-[#64748b]">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
        <span className="font-medium text-[#334155]">Above & Beyond</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
        <span className="font-medium text-[#334155]">On Track</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#f97316]" />
        <span className="font-medium text-[#334155]">Needs Attention</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
        <span className="font-medium text-[#334155]">At Risk</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded bg-[#3b82f6]" />
        <span className="font-medium text-[#334155]">Discussed</span>
      </span>
    </div>
  );
}

export function ChapterAnalyticsLeaderboard({
  model,
  focusChapterId,
  overviewHref,
  isLeadership = false,
}: {
  model: LeaderboardModel;
  focusChapterId?: string | null;
  overviewHref: string;
  isLeadership?: boolean;
}) {
  // Start with no cell selected so the full table uses the viewport width.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const panel = selectedKey ? model.panels[selectedKey] : null;

  return (
    <div className="relative flex flex-col gap-3">
      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={overviewHref}
              className="rounded-full border border-[#e2e8f0] bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#64748b] shadow-sm transition hover:border-[#c4b5fd] hover:text-[#6b21c8]"
            >
              Overview
            </Link>
            <span className="rounded-full bg-[#6b21c8] px-2.5 py-0.5 text-[11px] font-semibold text-white">
              Leaderboard
            </span>
            {isLeadership ? (
              <Link
                href="/chapter/impact/goals"
                className="rounded-full border border-[#e2e8f0] bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#64748b] shadow-sm transition hover:border-[#c4b5fd] hover:text-[#6b21c8]"
              >
                Goals
              </Link>
            ) : null}
            <h1 className="text-[20px] font-bold tracking-tight text-[#1e1b4b] sm:text-[22px]">
              Chapter Leaderboard
            </h1>
          </div>
          <p className="mt-0.5 hidden text-[12px] text-[#7c3aed]/85 sm:block">
            Ranked by pace vs month-adjusted expectations
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#1e1b4b]">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden className="text-[#94a3b8]">
              <rect x="1.5" y="2.2" width="11" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1.5 5.2h11M4.2 1.3v2.2M9.8 1.3v2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {model.asOfLabel}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11px] text-[#64748b] transition hover:text-[#6b21c8]"
            aria-label="Refresh"
            onClick={() => window.location.reload()}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M2.2 7a4.8 4.8 0 0 1 8.5-3M11.8 7a4.8 4.8 0 0 1-8.5 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path d="M10.2 1.8v2.8H13M3.8 12.2V9.4H1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {model.updatedLabel}
          </button>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-[16px] border border-[#ebe6f4] bg-white shadow-[0_6px_24px_rgba(46,16,101,0.05)]">
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[8%]" />
              <col className="w-[12.5%]" />
              <col className="w-[12.5%]" />
              <col className="w-[12.5%]" />
              <col className="w-[12.5%]" />
              <col className="w-[12.5%]" />
              <col className="w-[13.5%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#f1ecf8] bg-[#fbfafe] text-[10px] uppercase tracking-[0.04em] text-[#94a3b8]">
                <th className="px-3 py-2.5 font-semibold">Chapter</th>
                <th className="px-1 py-2.5 text-center font-semibold">
                  <span className="hidden xl:inline">Months Active</span>
                  <span className="xl:hidden">Mo.</span>
                </th>
                {LEADERBOARD_METRICS.map((m) => (
                  <th key={m} className="px-1 py-2.5 text-center font-semibold">
                    <div className="truncate text-[#64748b]">{METRIC_LABELS[m]}</div>
                    <div className="mt-0.5 font-normal normal-case tracking-normal text-[#cbd5e1]">
                      {goalLabel(m)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => {
                const focused = row.chapterId === focusChapterId;
                return (
                  <tr
                    key={row.chapterId}
                    className={`border-b border-[#f6f3fb] transition-colors ${
                      focused ? "bg-[#faf7ff]" : "hover:bg-[#fbfafe]"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <ShieldIcon />
                        <span className="truncate text-[12.5px] font-semibold text-[#1e1b4b]">
                          {row.chapterName}
                        </span>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-center text-[12px] font-medium tabular-nums text-[#64748b]">
                      {row.monthsActive}
                    </td>
                    {LEADERBOARD_METRICS.map((metric) => {
                      const cell = row.cells[metric];
                      const key = analyticsPanelKey(row.chapterId, metric);
                      return (
                        <td key={metric} className="px-1 py-1.5 align-middle">
                          <MetricCellButton
                            display={cell.display}
                            status={cell.status}
                            discussedOn={cell.discussedOn}
                            selected={selectedKey === key}
                            onClick={() => setSelectedKey((prev) => (prev === key ? null : key))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {model.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[13px] text-[#94a3b8]">
                    No chapters to rank yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="border-t border-[#f1ecf8] bg-[#fbfafe]/80">
            <LeaderboardLegend />
          </div>
        </div>

        {panel ? (
          <ActionPanel
            panel={panel}
            periodKey={model.asOfKey}
            onClose={() => setSelectedKey(null)}
            onRefresh={() => {
              window.location.reload();
            }}
          />
        ) : (
          <div className="border-t border-dashed border-[#ebe6f4] bg-[#fbfafe] px-4 py-3 text-center text-[12px] text-[#94a3b8]">
            Click a metric cell to open action items below.
          </div>
        )}
      </div>
    </div>
  );
}
