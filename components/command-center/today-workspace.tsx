"use client";

import Link from "next/link";

import {
  BrowseAllPanel,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { ButtonLink, cn } from "@/components/ui-v2";
import type { CcMeeting, CcStep, TodayWorkspaceVM } from "@/lib/command-center";

import { CommandModeProvider, CommandModeToggle, useIsExecutive } from "./command-mode";
import { CcIcon } from "./icons";
import {
  Avatar,
  ChangeList,
  EmptyHint,
  ItemRow,
  MissionBriefCard,
  PanelCard,
  StatChip,
  ViewAllLink,
  WaitingOnRows,
} from "./primitives";

/**
 * Command Center / Today — the default daily operating cockpit. Mission, a
 * guided Now / Next / Later sequence, the current meeting, today's decisions,
 * who we're waiting on, and what just changed. One obvious next move; Browse all
 * is demoted to the bottom.
 */

const PHASE_META: Record<CcStep["phase"], { label: string; index: number }> = {
  now: { label: "Now", index: 1 },
  next: { label: "Next", index: 2 },
  later: { label: "Later", index: 3 },
};

function FlowStep({ step }: { step: CcStep }) {
  const meta = PHASE_META[step.phase];
  return (
    <div className="flex flex-1 flex-col rounded-[16px] border border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-700">
          {meta.index}
        </span>
        <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-brand-700">{meta.label}</span>
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
          <CcIcon name={step.icon as never} size={16} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-bold leading-snug text-ink">{step.title}</p>
          <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-ink-muted">{step.detail}</p>
        </div>
      </div>
      <ButtonLink href={step.ctaHref} variant="secondary" size="sm" className="mt-4 self-start">
        {step.ctaLabel} →
      </ButtonLink>
    </div>
  );
}

function FlowConnector() {
  return (
    <div aria-hidden className="hidden items-center self-center px-1 text-line lg:flex">
      <svg width="28" height="12" viewBox="0 0 28 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1 6h22M19 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 3" />
      </svg>
    </div>
  );
}

function TodayMeetingCard({ meeting }: { meeting: CcMeeting }) {
  const reviewed = meeting.agendaCount > 0 ? `${meeting.agendaDoneCount} of ${meeting.agendaCount} reviewed` : null;
  const progress = meeting.agendaCount > 0 ? Math.round((meeting.agendaDoneCount / meeting.agendaCount) * 100) : 0;
  return (
    <PanelCard icon="calendar" title="Today's Meeting" className="h-full">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold",
              meeting.live ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
            )}
          >
            {meeting.live ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
            {meeting.statusLabel}
          </span>
          <span className="text-[12.5px] font-semibold text-ink-muted">{meeting.timeLabel}</span>
        </div>
        <div>
          <h4 className="m-0 text-[18px] font-bold text-ink">{meeting.title}</h4>
          {meeting.location ? (
            <p className="m-0 mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-muted">
              <CcIcon name="compass" size={13} /> {meeting.location}
            </p>
          ) : null}
        </div>
        {meeting.purpose ? (
          <div>
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">Purpose</p>
            <p className="m-0 mt-0.5 text-[13px] text-ink">{meeting.purpose}</p>
          </div>
        ) : null}
        {reviewed ? (
          <div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="font-bold text-ink">Prep needed</span>
              <span className="text-ink-muted">{reviewed}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-50">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
        {meeting.openFollowUps > 0 ? (
          <p className="m-0 text-[12.5px] text-ink-muted">
            <span className="font-bold text-warning-700">{meeting.openFollowUps}</span> open follow-ups before the
            meeting.
          </p>
        ) : null}
        <ButtonLink href={`/meet?m=${meeting.id}`} variant="primary" size="md" className="mt-1 w-full justify-center">
          Prep meeting →
        </ButtonLink>
      </div>
    </PanelCard>
  );
}

function DecisionMiniCard({ vm }: { vm: TodayWorkspaceVM["decisions"][number] }) {
  const action = vm.signals.missingOwner ? "Assign owner" : "Review & decide";
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-line-soft bg-surface-soft/50 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-100 text-brand-700">
          <CcIcon name={vm.signals.missingOwner ? "user" : "scale"} size={18} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-bold leading-snug text-ink">{vm.title}</p>
          <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-ink-muted">{vm.why}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
          <Avatar name={vm.ownerName} size="sm" />
          {vm.ownerName ?? "Unassigned"}
        </span>
        <ButtonLink href={vm.primaryAction.href} variant="secondary" size="sm">
          {action} →
        </ButtonLink>
      </div>
    </div>
  );
}

function TodayInner({ vm, nowISO }: { vm: TodayWorkspaceVM; nowISO: string }) {
  const now = new Date(nowISO);
  const executive = useIsExecutive();
  const decisions = executive ? vm.decisions : vm.decisions.slice(0, 2);
  const waitingMax = executive ? 5 : 2;
  const changesMax = executive ? vm.recentlyChanged.length : 3;

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        title={
          <span className="inline-flex items-center gap-2">
            {vm.greeting}, {vm.viewerFirstName}
            <CcIcon name="sun" size={26} className="text-brand-400" />
          </span>
        }
        lede="Here's what matters today."
        actions={
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
              <CcIcon name="calendar" size={15} /> {vm.dateLabel}
            </span>
            <CommandModeToggle />
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <StatChip value={vm.counts.open} label="open now" />
          <StatChip value={vm.counts.overdue} label="overdue" tone="danger" />
          <StatChip value={vm.counts.needsDecision} label="need a decision" tone="brand" />
          <StatChip value={vm.counts.waiting} label="waiting on" tone="info" />
          <StatChip value={vm.counts.clearedThisWeek} label="cleared this week" tone="success" />
        </div>
      </WorkspaceHeader>

      <WorkspaceBody>
        <MissionBriefCard eyebrow="Today's mission" headline={vm.mission} />

        <section aria-label="Now, next, later" className="flex flex-col gap-2 lg:flex-row">
          {vm.flow.now ? <FlowStep step={vm.flow.now} /> : null}
          {vm.flow.now && vm.flow.next ? <FlowConnector /> : null}
          {vm.flow.next ? <FlowStep step={vm.flow.next} /> : null}
          {vm.flow.next && vm.flow.later ? <FlowConnector /> : null}
          {vm.flow.later ? <FlowStep step={vm.flow.later} /> : null}
          {!vm.flow.now && !vm.flow.next && !vm.flow.later ? (
            <EmptyHint>Your queue is clear. Review upcoming meetings or plan next week.</EmptyHint>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          {vm.meeting ? (
            <TodayMeetingCard meeting={vm.meeting} />
          ) : (
            <PanelCard icon="calendar" title="Today's Meeting">
              <EmptyHint>No meeting scheduled today. Review upcoming meetings in Meet.</EmptyHint>
            </PanelCard>
          )}

          <PanelCard
            icon="scale"
            title="Today's Decisions"
            action={<ViewAllLink href="/decide">View all decisions</ViewAllLink>}
          >
            {decisions.length > 0 ? (
              <div className="flex flex-col gap-3">
                {decisions.map((decision) => (
                  <DecisionMiniCard key={decision.id} vm={decision} />
                ))}
              </div>
            ) : (
              <EmptyHint>No decisions need you today. Nice and clear.</EmptyHint>
            )}
          </PanelCard>

          <div className="flex flex-col gap-4">
            <PanelCard
              icon="hourglass"
              title="Waiting On"
              action={
                vm.waitingOnCount > 0 ? (
                  <ViewAllLink href="/follow-up">View all ({vm.waitingOnCount})</ViewAllLink>
                ) : null
              }
            >
              <WaitingOnRows items={vm.waitingOn} now={now} max={waitingMax} />
            </PanelCard>
            <PanelCard
              icon="activity"
              title="Recently Changed"
              action={<ViewAllLink href="/review">View all activity</ViewAllLink>}
            >
              <ChangeList
                changes={vm.recentlyChanged.slice(0, changesMax)}
                emptyHint="Nothing has changed in the last few days."
              />
            </PanelCard>
          </div>
        </div>

        <BrowseAllPanel
          label="Browse all"
          hint="Explore all meetings, initiatives, actions, and people."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/work", label: "All work" },
                { href: "/actions/meetings", label: "Meetings" },
                { href: "/operations/initiatives", label: "Initiatives" },
                { href: "/actions", label: "Actions" },
                { href: "/people", label: "People" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-line-soft bg-surface px-3 py-1 text-[12.5px] font-semibold text-brand-700 hover:bg-surface-soft"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {vm.browse.slice(0, 10).map((item) => (
                <ItemRow key={item.id} item={item} now={now} />
              ))}
            </div>
          </div>
        </BrowseAllPanel>
      </WorkspaceBody>
    </WorkspaceShell>
  );
}

export function TodayWorkspace({ vm, nowISO }: { vm: TodayWorkspaceVM; nowISO: string }) {
  return (
    <CommandModeProvider>
      <TodayInner vm={vm} nowISO={nowISO} />
    </CommandModeProvider>
  );
}
