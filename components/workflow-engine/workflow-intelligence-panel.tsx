"use client";

/**
 * Workflow cockpit — Intelligence panel.
 *
 * Deepens the existing `/workflows/[id]` cockpit with the "why" context: the
 * source entity, linked chapter + metric (current vs target with a trend
 * sparkline), the concrete health reason, timing, and how much downstream work
 * this workflow has created. It does NOT repeat the cockpit's status / stages /
 * steps / related-objects / timeline sections — it sits above them as context.
 */

import Link from "next/link";

import { CardV2 } from "@/components/ui-v2/card";
import { StatusBadge, type StatusTone } from "@/components/ui-v2/status-badge";
import { Sparkline } from "@/components/data-360/charts/sparkline";
import type { WorkflowHealthStatus } from "@/lib/workflow-engine/health";
import type {
  WorkflowCockpitAdvisingIntel,
  WorkflowCockpitIntel,
} from "@/lib/data-360/workflow-cockpit-intel";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function healthTone(status: WorkflowHealthStatus): StatusTone {
  switch (status) {
    case "ON_TRACK":
    case "COMPLETE":
      return "success";
    case "NEEDS_ATTENTION":
    case "STALLED":
      return "warning";
    case "BLOCKED":
    case "OVERDUE":
      return "danger";
    default:
      return "neutral";
  }
}

const HEALTH_LABEL: Record<WorkflowHealthStatus, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  BLOCKED: "Blocked",
  OVERDUE: "Overdue",
  STALLED: "Stalled",
  COMPLETE: "Complete",
  ARCHIVED: "Archived",
};

function metricTone(status: string): StatusTone {
  switch (status) {
    case "met":
      return "success";
    case "approaching":
      return "warning";
    case "below":
    case "over":
      return "danger";
    default:
      return "neutral";
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-[13.5px] font-semibold text-ink">{value}</span>
    </div>
  );
}

export function WorkflowIntelligencePanel({ intel }: { intel: WorkflowCockpitIntel }) {
  const linkedTotal = intel.linkedActionCount + intel.linkedMeetingCount;

  return (
    <CardV2 padding="md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">Why this workflow exists</h2>
        <StatusBadge tone={healthTone(intel.health)}>{HEALTH_LABEL[intel.health]}</StatusBadge>
      </div>

      <p className="m-0 text-[13px] text-ink-muted">
        {intel.sourceEntityLabel ? (
          <>
            Started from a <b className="font-semibold text-ink">{intel.sourceEntityLabel}</b>
          </>
        ) : (
          "Started manually"
        )}
        {intel.chapterName ? (
          <>
            {" "}· chapter{" "}
            {intel.chapterId ? (
              <Link
                href={`/data-360?tab=chapters`}
                className="font-semibold text-brand-700 hover:underline"
              >
                {intel.chapterName}
              </Link>
            ) : (
              <b className="font-semibold text-ink">{intel.chapterName}</b>
            )}
            {intel.chapterPhaseLabel ? ` (${intel.chapterPhaseLabel})` : ""}
          </>
        ) : null}
        .
      </p>

      {intel.healthReasons.length > 0 ? (
        <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 p-0">
          {intel.healthReasons.slice(0, 3).map((r, i) => (
            <li key={i} className="text-[12.5px] text-ink-muted">
              · {r}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 sm:grid-cols-4">
        <Fact label="Age" value={`${intel.ageDays}d`} />
        <Fact label="Progress" value={`${intel.completionPercent}%`} />
        <Fact label="Stage" value={intel.currentStageName ?? "—"} />
        <Fact
          label="Created work"
          value={
            linkedTotal === 0
              ? "None yet"
              : `${intel.linkedActionCount} action${intel.linkedActionCount === 1 ? "" : "s"}, ${
                  intel.linkedMeetingCount
                } mtg${intel.linkedMeetingCount === 1 ? "" : "s"}`
          }
        />
      </div>

      {intel.metric ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-line-soft bg-surface-soft px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">{intel.metric.label}</span>
              <StatusBadge tone={metricTone(intel.metric.status)}>
                {intel.metric.statusLabel}
              </StatusBadge>
            </div>
            <div className="mt-0.5 text-[12px] text-ink-muted">
              Now{" "}
              <b className="font-semibold text-ink">
                {intel.metric.value === null ? "—" : intel.metric.value}
              </b>{" "}
              · target {intel.metric.expectationLabel}
            </div>
          </div>
          {intel.metric.trend && intel.metric.trend.length > 0 ? (
            <Sparkline
              points={intel.metric.trend.map((p) => ({ t: p.t, value: p.value }))}
              width={104}
              height={34}
            />
          ) : null}
        </div>
      ) : null}

      {intel.advising ? <AdvisingContext advising={intel.advising} /> : null}

      {intel.attachmentCount > 0 ? (
        <p className="m-0 mt-2 text-[12px] text-ink-muted">
          {intel.attachmentCount} evidence attachment{intel.attachmentCount === 1 ? "" : "s"} linked.
        </p>
      ) : null}
    </CardV2>
  );
}

/** The live advising relationship this workflow is operating on. */
function AdvisingContext({ advising }: { advising: WorkflowCockpitAdvisingIntel }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[12px] border border-line-soft bg-surface-soft px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{advising.studentName}</span>
          <StatusBadge tone={advising.lifecycleTone}>{advising.lifecycleLabel}</StatusBadge>
          <span className="text-[12px] text-ink-muted">Advisor: {advising.advisorName}</span>
        </div>
        <Link
          href={advising.advisingHref}
          className="text-[11.5px] font-medium text-brand-700 hover:underline"
        >
          Open in advising queue →
        </Link>
      </div>
      <p className="m-0 text-[12.5px] text-ink-muted">{advising.reason}</p>
      <div className="grid grid-cols-3 gap-3 border-t border-line-soft pt-2">
        <Fact label="Last check-in" value={fmtDate(advising.lastCheckInISO)} />
        <Fact label="Next due" value={fmtDate(advising.nextCheckInDueISO)} />
        <Fact
          label="Open recs"
          value={
            advising.openRecommendations === 0 ? "None" : String(advising.openRecommendations)
          }
        />
      </div>
      <div className="rounded-[8px] bg-surface px-2.5 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          Next advising step
        </span>
        <p className="m-0 mt-0.5 text-[12.5px] font-medium text-ink">{advising.nextAction}</p>
      </div>
    </div>
  );
}
