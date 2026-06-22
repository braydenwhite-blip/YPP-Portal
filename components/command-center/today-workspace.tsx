"use client";

import Link from "next/link";

import {
  BrowseAllPanel,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { ButtonLink } from "@/components/ui-v2";
import type { CcMeeting, CcStep, TodayWorkspaceVM } from "@/lib/command-center";

import { CommandModeProvider, CommandModeToggle, ExecutiveOnly, useIsExecutive } from "./command-mode";
import { CcIcon, type CcIconName } from "./icons";
import { PrimaryFocusCard } from "./simple";
import {
  ChangeList,
  ItemRow,
  MissionBriefCard,
  PanelCard,
  StatChip,
  ViewAllLink,
} from "./primitives";

/**
 * Command Center / Today — the daily home. It answers one question: what should
 * I do right now? Calm mode shows the mission, ONE big focus card (the next
 * move), three supporting cards (next meeting, a decision, who we're waiting on),
 * recent changes, and a collapsed Browse all — nothing else. Executive mode adds
 * the Now / Next / Later flow, the metric chips, and a launcher row.
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

/** The one big "what should I do right now?" card — the daily next move. */
function FocusCard({ step }: { step: CcStep | null }) {
  if (!step) {
    return (
      <PrimaryFocusCard
        eyebrow="Today's focus"
        title="You're all clear."
        reason="Nothing urgent right now — review upcoming meetings or plan next week."
        icon="check"
        tone="success"
        ctaLabel="Open My Queue"
        ctaHref="/work/queue"
      />
    );
  }
  return (
    <PrimaryFocusCard
      eyebrow="Today's focus"
      title={step.title}
      reason={step.detail}
      icon={(step.icon as CcIconName) ?? "target"}
      ctaLabel={step.ctaLabel ?? "Start now"}
      ctaHref={step.ctaHref}
    />
  );
}

/** Clean supporting card — icon + small eyebrow, content, one quiet link. */
function SupportingCard({
  icon,
  eyebrow,
  children,
  footer,
}: {
  icon: CcIconName;
  eyebrow: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[16px] border border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
          <CcIcon name={icon} size={16} />
        </span>
        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">{eyebrow}</span>
      </div>
      <div className="flex-1">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}

function NextMeetingCard({ meeting }: { meeting: CcMeeting | null }) {
  if (!meeting) {
    return (
      <SupportingCard icon="calendar" eyebrow="Next meeting">
        <p className="m-0 text-[13px] text-ink-muted">No meeting scheduled. You&apos;re clear.</p>
      </SupportingCard>
    );
  }
  return (
    <SupportingCard
      icon="calendar"
      eyebrow="Next meeting"
      footer={<ViewAllLink href={`/meet?m=${meeting.id}`}>Prep meeting</ViewAllLink>}
    >
      <p className="m-0 text-[16px] font-bold leading-snug text-ink">{meeting.title}</p>
      <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{meeting.timeLabel}</p>
      {meeting.location ? <p className="m-0 text-[12.5px] text-ink-muted">{meeting.location}</p> : null}
    </SupportingCard>
  );
}

function DecisionCard({ decision }: { decision: TodayWorkspaceVM["decisions"][number] | null }) {
  if (!decision) {
    return (
      <SupportingCard icon="scale" eyebrow="Decision">
        <p className="m-0 text-[13px] text-ink-muted">No decisions need you today.</p>
      </SupportingCard>
    );
  }
  const label = decision.signals.missingOwner ? "Assign owner" : "View decision";
  return (
    <SupportingCard
      icon="scale"
      eyebrow="Decision"
      footer={<ViewAllLink href={decision.primaryAction.href}>{label}</ViewAllLink>}
    >
      <p className="m-0 text-[16px] font-bold leading-snug text-ink">{decision.title}</p>
      <p className="m-0 mt-1 text-[12.5px] leading-snug text-ink-muted">{decision.why}</p>
    </SupportingCard>
  );
}

function WaitingOnCard({
  items,
  count,
}: {
  items: TodayWorkspaceVM["waitingOn"];
  count: number;
}) {
  return (
    <SupportingCard
      icon="hourglass"
      eyebrow="Waiting on"
      footer={count > 0 ? <ViewAllLink href="/follow-up">View all ({count})</ViewAllLink> : null}
    >
      {items.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {items.slice(0, 2).map((item) => {
            const person = item.relatedPerson?.label ?? item.ownerName ?? "Unassigned";
            return (
              <li key={item.id} className="min-w-0">
                <p className="m-0 truncate text-[14px] font-semibold text-ink">{person}</p>
                <p className="m-0 truncate text-[12px] text-ink-muted">{item.title}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-[13px] text-ink-muted">No one is blocking active work.</p>
      )}
    </SupportingCard>
  );
}

const LAUNCHERS: { href: string; label: string; icon: CcIconName }[] = [
  { href: "/decide", label: "Decide", icon: "scale" },
  { href: "/delegate", label: "Delegate", icon: "users" },
  { href: "/meet", label: "Meet", icon: "calendar" },
  { href: "/review", label: "Review", icon: "activity" },
  { href: "/follow-up", label: "Follow Up", icon: "inbox" },
];

function LauncherRow() {
  return (
    <div className="flex flex-wrap gap-2">
      {LAUNCHERS.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface/80 px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted shadow-card transition-colors hover:text-ink"
        >
          <CcIcon name={tool.icon} size={14} className="text-brand-600" />
          {tool.label}
        </Link>
      ))}
    </div>
  );
}

function TodayInner({ vm, nowISO }: { vm: TodayWorkspaceVM; nowISO: string }) {
  const now = new Date(nowISO);
  const executive = useIsExecutive();
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
        <ExecutiveOnly>
          <div className="flex flex-wrap gap-2">
            <StatChip value={vm.counts.open} label="open now" />
            <StatChip value={vm.counts.overdue} label="overdue" tone="danger" />
            <StatChip value={vm.counts.needsDecision} label="need a decision" tone="brand" />
            <StatChip value={vm.counts.waiting} label="waiting on" tone="info" />
            <StatChip value={vm.counts.clearedThisWeek} label="cleared this week" tone="success" />
          </div>
        </ExecutiveOnly>
      </WorkspaceHeader>

      <WorkspaceBody>
        {/* The one obvious next move. */}
        <FocusCard step={vm.flow.now ?? null} />

        {/* Executive mode reveals the full mission + Now / Next / Later sequence. */}
        <ExecutiveOnly>
          <MissionBriefCard eyebrow="Today's mission" headline={vm.mission} />
          {vm.flow.now || vm.flow.next || vm.flow.later ? (
            <section aria-label="Now, next, later" className="flex flex-col gap-2 lg:flex-row">
              {vm.flow.now ? <FlowStep step={vm.flow.now} /> : null}
              {vm.flow.now && vm.flow.next ? <FlowConnector /> : null}
              {vm.flow.next ? <FlowStep step={vm.flow.next} /> : null}
              {vm.flow.next && vm.flow.later ? <FlowConnector /> : null}
              {vm.flow.later ? <FlowStep step={vm.flow.later} /> : null}
            </section>
          ) : null}
        </ExecutiveOnly>

        {/* Three supporting cards — next meeting, a decision, who we're waiting on. */}
        <div className="grid gap-4 lg:grid-cols-3">
          <NextMeetingCard meeting={vm.meeting} />
          <DecisionCard decision={vm.decisions[0] ?? null} />
          <WaitingOnCard items={vm.waitingOn} count={vm.waitingOnCount} />
        </div>

        {/* Recent changes — a calm, full-width activity strip. */}
        <PanelCard
          icon="activity"
          title="Recent changes"
          action={<ViewAllLink href="/review">View all activity</ViewAllLink>}
        >
          <ChangeList
            changes={vm.recentlyChanged.slice(0, changesMax)}
            emptyHint="Nothing has changed in the last few days."
          />
        </PanelCard>

        <ExecutiveOnly>
          <LauncherRow />
        </ExecutiveOnly>

        <BrowseAllPanel
          label="Browse all"
          hint="Search meetings, initiatives, actions, people, and more."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/browse", label: "Browse records" },
                { href: "/work", label: "All work" },
                { href: "/meetings", label: "Meetings" },
                { href: "/operations/initiatives", label: "Initiatives" },
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
