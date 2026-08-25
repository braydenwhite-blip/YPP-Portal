"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { cn } from "@/components/ui-v2";
import {
  addAnalyticsMetricAction,
  markAnalyticsMetricDiscussed,
  toggleAnalyticsMetricAction,
} from "@/lib/chapters/analytics-actions";
import type { LeaderboardModel, MetricPanelModel, PaceCell } from "@/lib/chapters/analytics-types";
import {
  analyticsPanelKey,
  METRIC_LABELS,
  type AnalyticsMetricKey,
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

const COLUMN_LABELS: Record<AnalyticsMetricKey, string> = {
  partners: "Partners",
  instructors: "Instructors",
  students: "Students",
  classes: "Classes",
  retention: "Retention",
  quality: "Quality",
};

const OWNER_COLORS = ["#6366f1", "#0d9488", "#c026d3", "#ea580c", "#2563eb", "#7c3aed"];

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

function formatCell(cell: PaceCell) {
  if (cell.metric === "retention") return `${Math.round(cell.actual)}%`;
  if (cell.metric === "quality") {
    return `${cell.actual.toFixed(1)} / ${cell.expected.toFixed(1)}`;
  }
  return `${Math.round(cell.actual)} / ${Math.round(cell.expected)}`;
}

function ActionPanel({
  panel,
  periodKey,
  onClose,
  onRefresh,
  canCreateActions,
}: {
  panel: MetricPanelModel;
  periodKey: string;
  onClose: () => void;
  onRefresh: () => void;
  canCreateActions: boolean;
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
              disabled={pending || !canCreateActions}
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
              if (!canCreateActions || !title.trim()) return;
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
            {canCreateActions ? (
              <>
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
              </>
            ) : (
              <p className="m-0 text-[12px] leading-snug text-[#64748b]">
                You can add action items for your own chapter.
              </p>
            )}
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
                  disabled={pending || !canCreateActions}
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
                    disabled={pending || !canCreateActions}
                    onChange={(e) => {
                      if (!canCreateActions || !e.target.checked) return;
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
    <div className="relative flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            {isLeadership ? (
              <Link
                href="/admin/chapters"
                className="mb-1 inline-block text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
              >
                ← Chapters
              </Link>
            ) : null}
            <h1 className="text-[26px] font-bold tracking-tight text-[#111827]">Chapter Analytics</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={overviewHref}
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[12px] font-semibold text-[#4b5563] hover:border-[#c7d2fe] hover:text-[#4338ca]"
              >
                Overview
              </Link>
              <span className="rounded-full bg-[#4f46e5] px-3 py-1 text-[12px] font-semibold text-white">
                Leaderboard
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] font-semibold text-[#111827] shadow-sm">
            {model.asOfLabel}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] font-semibold text-[#374151] shadow-sm hover:border-[#c7d2fe]"
            aria-label="Refresh"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
        <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight text-ink">Leaderboard</h2>
          <p className="m-0 text-[12px] text-ink-muted">Actual / goal · tap a number for actions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-y border-line-card">
                <th className="px-5 py-2 text-[12px] font-medium text-ink-muted">Chapter</th>
                <th className="px-2 py-2 text-center text-[12px] font-medium text-ink-muted">
                  Months
                </th>
                {LEADERBOARD_METRICS.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-2 text-center text-[12px] font-medium text-ink-muted"
                  >
                    {COLUMN_LABELS[m]}
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
                    className={cn(
                      "border-b border-line-card last:border-b-0",
                      focused && "bg-surface-soft"
                    )}
                  >
                    <td className="px-5 py-2.5 text-[13.5px] font-semibold text-ink">
                      {row.chapterName}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[13px] tabular-nums text-ink-muted">
                      {row.monthsActive}
                    </td>
                    {LEADERBOARD_METRICS.map((metric) => {
                      const cell = row.cells[metric];
                      const key = analyticsPanelKey(row.chapterId, metric);
                      const selected = selectedKey === key;
                      return (
                        <td
                          key={metric}
                          role="button"
                          tabIndex={0}
                          title={
                            cell.discussedOn
                              ? `Discussed ${cell.discussedOn}`
                              : `Open actions for ${COLUMN_LABELS[metric]}`
                          }
                          onClick={() =>
                            setSelectedKey((prev) => (prev === key ? null : key))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedKey((prev) => (prev === key ? null : key));
                            }
                          }}
                          className={cn(
                            "cursor-pointer px-2 py-2.5 text-center text-[13px] font-medium tabular-nums text-brand-800",
                            "hover:bg-brand-50",
                            selected && "bg-brand-50"
                          )}
                        >
                          {formatCell(cell)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {model.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-ink-muted">
                    No chapters to rank yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {panel ? (
          <ActionPanel
            panel={panel}
            periodKey={model.asOfKey}
            canCreateActions={Boolean(
              isLeadership || (focusChapterId && panel.chapterId === focusChapterId)
            )}
            onClose={() => setSelectedKey(null)}
            onRefresh={() => {
              window.location.reload();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
