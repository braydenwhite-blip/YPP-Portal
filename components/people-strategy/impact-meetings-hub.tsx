import type { ReactNode } from "react";

import {
  ButtonLink,
  CardV2,
  EmptyStateV2,
  PageHeaderV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";

/**
 * Standalone Impact Meetings hub — the "Impact presentation" overview from the
 * YPP Portal mockup, composed on the ui-v2 primitives. It reads the same
 * Global Operations Impact agenda that powers the in-meeting panel, then lays it
 * out as: a meeting card with a submit → agenda → live → summary stage rail,
 * stat tiles, the four team weekly-update cards, a needs-attention list, and the
 * "Chapter Impact Updates" coming-soon strip. All interactivity is links into
 * the existing meeting detail + team brief surfaces, so nothing is duplicated.
 */

export type ImpactStageStep = {
  label: string;
  sub: string;
  /** Completed phases. */
  done: boolean;
  /** The phase currently in progress. */
  current: boolean;
};

export type ImpactTeamCardData = {
  teamId: string;
  teamName: string;
  presenterInitials: string[];
  statusLabel: string;
  statusTone: StatusTone;
  missing: boolean;
  completedCount: number;
  deliverableCount: number;
  decisionCount: number;
  blockerCount: number;
  briefHref: string;
  warnText: string | null;
};

export type ImpactHubData = {
  meetingId: string | null;
  meetingTitle: string;
  weekLabel: string;
  meetingDateLabel: string | null;
  meetingHref: string | null;
  leadLabel: string;
  stats: {
    submitted: number;
    total: number;
    missing: number;
    decisions: number;
    blockers: number;
  };
  stageSteps: ImpactStageStep[];
  teams: ImpactTeamCardData[];
  needsAttention: string[];
  chapterCards: Array<{ name: string; president: string | null }>;
};

function StageRail({ steps }: { steps: ImpactStageStep[] }) {
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-3 p-0">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={
                step.done
                  ? "flex size-6 items-center justify-center rounded-full bg-complete-50 text-[12px] font-bold text-complete-700"
                  : step.current
                    ? "flex size-6 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white"
                    : "flex size-6 items-center justify-center rounded-full bg-idle-50 text-[12px] font-bold text-ink-muted"
              }
            >
              {step.done ? "✓" : i + 1}
            </span>
            <span className="flex flex-col leading-tight">
              <span
                className={
                  step.current
                    ? "text-[12.5px] font-bold text-ink"
                    : "text-[12.5px] font-semibold text-ink-muted"
                }
              >
                {step.label}
              </span>
              <span className="text-[11px] text-ink-muted">{step.sub}</span>
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span aria-hidden className="mx-1 hidden h-px w-8 bg-line sm:block" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function StatTile({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: "neutral" | "danger" | "warning";
}) {
  const lit = tone !== "neutral" && value !== "0";
  return (
    <div
      className={
        lit
          ? tone === "danger"
            ? "rounded-[12px] border border-blocked-50 bg-blocked-50 px-3.5 py-3"
            : "rounded-[12px] border border-progress-50 bg-progress-50 px-3.5 py-3"
          : "rounded-[12px] border border-line-card bg-surface px-3.5 py-3"
      }
    >
      <div
        className={
          lit
            ? tone === "danger"
              ? "text-[22px] font-bold leading-none tabular-nums text-blocked-700"
              : "text-[22px] font-bold leading-none tabular-nums text-progress-700"
            : "text-[22px] font-bold leading-none tabular-nums text-ink"
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] font-medium text-ink-muted">{label}</div>
    </div>
  );
}

function TeamCard({ team }: { team: ImpactTeamCardData }) {
  return (
    <CardV2 padding="none" className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-brand-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-ink">{team.teamName}</div>
          {team.presenterInitials.length > 0 ? (
            <div className="mt-1 flex items-center gap-1">
              {team.presenterInitials.map((init, i) => (
                <span
                  key={`${init}-${i}`}
                  className="flex size-5 items-center justify-center rounded-full bg-brand-50 text-[9.5px] font-bold text-brand-700"
                >
                  {init}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <StatusBadge tone={team.statusTone}>{team.statusLabel}</StatusBadge>
      </div>

      {team.missing ? (
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <div className="flex items-center gap-2 text-[12.5px] text-progress-700">
            <span aria-hidden>⚠</span>
            <span>No update submitted yet</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={team.briefHref} variant="primary" size="sm">
              Start update
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <div className="grid grid-cols-3 gap-2">
            <TeamStat value={team.completedCount} label="completed" />
            <TeamStat value={team.deliverableCount} label="deliverables" />
            <TeamStat value={team.decisionCount} label="decisions" />
          </div>
          {team.warnText ? (
            <div className="flex items-start gap-1.5 rounded-[8px] bg-progress-50 px-2.5 py-1.5 text-[12px] text-progress-700">
              <span aria-hidden>⚠</span>
              <span>{team.warnText}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={team.briefHref} variant="secondary" size="sm">
              Open update
            </ButtonLink>
          </div>
        </div>
      )}
    </CardV2>
  );
}

function TeamStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[8px] bg-surface-soft px-2 py-1.5 text-center">
      <div className="text-[16px] font-bold leading-none tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[10.5px] text-ink-muted">{label}</div>
    </div>
  );
}

export function ImpactMeetingsHub({
  data,
  summaryAction,
}: {
  data: ImpactHubData;
  /** The single manual "Send summary email" control (rendered after the meeting). */
  summaryAction?: ReactNode;
}) {
  const { stats } = data;
  const meetingBaseHref = data.meetingId
    ? `/impact-meetings/${data.meetingId}`
    : data.meetingHref ?? "/impact-meetings/current";
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 pb-10">
      <PageHeaderV2
        eyebrow="Impact Meetings"
        title="Impact Meetings"
        subtitle={`Teams submit a quick weekly update, the agenda pulls them in, leadership runs the meeting, and a summary goes out. ${data.weekLabel}.`}
        actions={
          data.meetingHref ? (
            <ButtonLink href="/impact-meetings/current" variant="primary" size="sm">
              Open current meeting
            </ButtonLink>
          ) : (
            <ButtonLink href="/actions/meetings" variant="secondary" size="sm">
              Open meetings
            </ButtonLink>
          )
        }
      />

      {/* Global Operations Impact Meeting card + stage rail */}
      <CardV2 className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[15px] font-bold text-ink">{data.meetingTitle}</span>
          <StatusBadge tone="brand">Weekly</StatusBadge>
          <span className="text-[12.5px] text-ink-muted">
            {[data.meetingDateLabel ?? data.weekLabel, data.leadLabel].filter(Boolean).join(" · ")}
          </span>
        </div>

        <StageRail steps={data.stageSteps} />

        {data.meetingHref ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`${meetingBaseHref}/agenda`} variant="secondary" size="sm">
              Prepared agenda
            </ButtonLink>
            <ButtonLink href={`${meetingBaseHref}/presentation`} variant="secondary" size="sm">
              Presentation board
            </ButtonLink>
            <ButtonLink href={`${meetingBaseHref}/live`} variant="secondary" size="sm">
              Live room
            </ButtonLink>
            <ButtonLink href={`${meetingBaseHref}/summary`} variant="secondary" size="sm">
              Summary draft
            </ButtonLink>
            {summaryAction}
          </div>
        ) : null}
      </CardV2>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile value={`${stats.submitted} / ${stats.total}`} label="Updates submitted" />
        <StatTile value={String(stats.missing)} label="Missing update" tone="danger" />
        <StatTile value={String(stats.decisions)} label="Decisions needed" tone="warning" />
        <StatTile value={String(stats.blockers)} label="Blockers raised" tone="warning" />
      </div>

      {/* Team weekly updates */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Team weekly updates
          </h2>
          <span className="text-[12px] text-ink-muted">
            {data.teams.map((t) => t.teamName).join(" · ")}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.teams.map((team) => (
            <TeamCard key={team.teamId} team={team} />
          ))}
        </div>
      </section>

      {/* Needs attention */}
      {data.needsAttention.length > 0 ? (
        <CardV2 padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface-soft/70 px-4 py-3">
            <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.07em] text-ink-muted">
              Needs attention
            </h2>
            <span className="text-[12px] text-ink-muted">
              {data.needsAttention.length} item{data.needsAttention.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col divide-y divide-line-soft/70 p-0">
            {data.needsAttention.map((item, i) => (
              <li key={`${item}-${i}`} className="flex items-center gap-2 px-4 py-2.5">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-progress-700" />
                <span className="text-[13px] text-ink">{item}</span>
              </li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      {/* Chapter Impact Updates — coming soon */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Chapter Impact Updates
          </h2>
          <span className="text-[12px] text-ink-muted">Rolling out next</span>
        </div>
        {data.chapterCards.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.chapterCards.map((c) => (
              <CardV2 key={c.name} padding="md" className="opacity-80">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 rounded-full bg-line" />
                  <span className="text-[14px] font-bold text-ink">{c.name}</span>
                  {c.president ? (
                    <span className="text-[12px] text-ink-muted">President: {c.president}</span>
                  ) : null}
                </div>
                <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                  A chapter version of the weekly update is coming — outreach, partner progress,
                  student/applicant progress, classes running, blockers, decisions, and next-week
                  commitments.
                </p>
              </CardV2>
            ))}
          </div>
        ) : (
          <EmptyStateV2
            tone="neutral"
            title="Chapter impact updates are coming next"
            body="A chapter version of the weekly update — outreach, partner progress, students and applicants, classes running, blockers, decisions, and next-week commitments — will roll out here."
          />
        )}
      </section>
    </div>
  );
}

/** Convenience export for the empty (no meeting scheduled yet) state. */
export function ImpactMeetingsEmpty() {
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 pb-10">
      <PageHeaderV2
        eyebrow="Impact Meetings"
        title="Impact Meetings"
        subtitle="Teams submit a quick weekly update, the agenda pulls them in, leadership runs the meeting, and a summary goes out."
        actions={
          <ButtonLink href="/actions/meetings/new" variant="primary" size="sm">
            ＋ Schedule impact meeting
          </ButtonLink>
        }
      />
      <EmptyStateV2
        tone="neutral"
        title="No impact meeting scheduled yet"
        body="Schedule a Global Operations Impact Presentation to collect the weekly team updates (Tech, Fundraising, Expansion, Socials), build the agenda, run it live, and send a summary."
      />
    </div>
  );
}
