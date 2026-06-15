"use client";

import Link from "next/link";

import {
  BrowseAllPanel,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { ButtonLink, cn } from "@/components/ui-v2";
import type {
  CcDecisionLogEntry,
  CcFocusDecision,
  CcMeeting,
  DecideWorkspaceVM,
} from "@/lib/command-center";
import type { QueueItem } from "@/lib/queue/types";

import { CommandModeProvider, CommandModeToggle, ExecutiveOnly, useIsExecutive } from "./command-mode";
import { CcIcon } from "./icons";
import {
  Avatar,
  EmptyHint,
  ItemRow,
  MissionBriefCard,
  PanelCard,
  SummaryTile,
  SummaryTileRow,
  ViewAllLink,
  WaitingOnRows,
} from "./primitives";

/**
 * Decide — the decision operating system. Decision lanes on the left, the focus
 * decision in the center (with deterministic owner options + recommended next
 * move), and connected context on the right. The raw decision log is demoted to
 * a collapsed panel at the bottom.
 */

function LaneGroup({
  icon,
  label,
  count,
  items,
  now,
  emptyHint,
}: {
  icon: Parameters<typeof CcIcon>[0]["name"];
  label: string;
  count: number;
  items: QueueItem[];
  now: Date;
  emptyHint: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <span className="flex size-5 items-center justify-center rounded-[7px] bg-brand-50 text-brand-700">
            <CcIcon name={icon} size={13} />
          </span>
          {label}
        </span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-bold text-brand-700">{count}</span>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-col">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex flex-col rounded-[10px] px-2.5 py-2 transition-colors hover:bg-surface-soft"
            >
              <span className="truncate text-[13px] font-semibold text-ink">{item.title}</span>
              <span className="truncate text-[11.5px] text-ink-muted">{item.statusLabel}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="m-0 px-2.5 py-2 text-[12px] text-ink-muted">{emptyHint}</p>
      )}
    </div>
  );
}

function FocusFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <div className="mt-1 text-[13px] font-semibold text-ink">{children}</div>
    </div>
  );
}

function FocusDecisionPanel({ focus }: { focus: CcFocusDecision }) {
  return (
    <section className="flex flex-col gap-4 rounded-[18px] border border-line-soft bg-surface/85 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-bold text-brand-700">
          <span className="flex size-7 items-center justify-center rounded-[9px] bg-brand-100">
            <CcIcon name="target" size={16} />
          </span>
          Focus decision
        </span>
        {focus.dueToday ? (
          <span className="rounded-full bg-warning-100 px-2.5 py-0.5 text-[12px] font-bold text-warning-700">
            Due today
          </span>
        ) : null}
      </div>

      <h2 className="m-0 text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">{focus.title}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Decision needed</p>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink">{focus.decisionNeeded}</p>
        </div>
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Why it matters</p>
          <p className="m-0 mt-0.5 text-[13.5px] text-ink">{focus.whyItMatters}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-[14px] border border-line-soft bg-surface-soft/50 p-3.5 sm:grid-cols-4">
        <FocusFact label="Owner">
          <span className="flex items-center gap-1.5">
            <Avatar name={focus.ownerName ?? "?"} size="sm" tone={focus.ownerName ? "brand" : "neutral"} />
            {focus.ownerName ?? focus.ownerFallback ?? "Unassigned"}
          </span>
        </FocusFact>
        <FocusFact label="Deadline">{focus.deadlineLabel ?? "No due date"}</FocusFact>
        <FocusFact label="Related meeting">{focus.relatedMeeting?.title ?? "—"}</FocusFact>
        <FocusFact label="Related initiative">{focus.relatedInitiative?.title ?? "—"}</FocusFact>
      </div>

      {focus.options.length > 0 ? (
        <div>
          <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Options</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {focus.options.map((option) => (
              <div
                key={option.id}
                className={cn(
                  "flex items-center gap-2 rounded-[12px] border px-3 py-2.5",
                  option.recommended
                    ? "border-brand-300/60 bg-brand-50/70 ring-1 ring-brand-300/50"
                    : "border-line-soft bg-surface"
                )}
              >
                <Avatar name={option.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-ink">{option.name}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{option.reason}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {focus.recommendation ? (
        <div className="flex items-start gap-2 text-[13px] text-ink">
          <CcIcon name="sparkle" size={16} className="mt-0.5 shrink-0 text-brand-500" />
          <span>
            <span className="font-bold text-ink">Recommendation. </span>
            {focus.recommendation}
          </span>
        </div>
      ) : null}

      {focus.recommendedNextMove ? (
        <div className="flex items-start gap-2 rounded-[12px] bg-brand-50/70 px-3.5 py-3 text-[13px] text-ink">
          <CcIcon name="sparkle" size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <span>
            <span className="font-bold text-brand-700">Recommended next move. </span>
            {focus.recommendedNextMove}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={focus.actions.chooseHref} variant="primary" size="md">
          {focus.actions.chooseLabel} →
        </ButtonLink>
        {focus.actions.assignHref ? (
          <ButtonLink href={focus.actions.assignHref} variant="secondary" size="md">
            Assign owner
          </ButtonLink>
        ) : null}
        {focus.actions.meetingHref ? (
          <ButtonLink href={focus.actions.meetingHref} variant="secondary" size="md">
            Add to meeting
          </ButtonLink>
        ) : null}
        {focus.actions.deferHref ? (
          <ButtonLink href={focus.actions.deferHref} variant="ghost" size="md">
            Defer
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}

function RelatedMeetingCard({ meeting }: { meeting: CcMeeting }) {
  return (
    <PanelCard icon="calendar" title="Related meeting">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[15px] font-bold text-ink">{meeting.title}</p>
        <p className="m-0 text-[12.5px] text-ink-muted">{meeting.timeLabel}{meeting.location ? ` · ${meeting.location}` : ""}</p>
        {meeting.purpose ? (
          <div>
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Purpose</p>
            <p className="m-0 mt-0.5 text-[12.5px] text-ink">{meeting.purpose}</p>
          </div>
        ) : null}
        <ButtonLink href={`/meet?m=${meeting.id}`} variant="secondary" size="sm" className="mt-1 self-start">
          Prep meeting →
        </ButtonLink>
      </div>
    </PanelCard>
  );
}

function RecentlyDecidedList({ entries }: { entries: CcDecisionLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyHint>No decisions logged yet this week.</EmptyHint>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link href={entry.meetingHref} className="flex items-start gap-2 rounded-[10px] px-1.5 py-1 transition-colors hover:bg-surface-soft">
            <CcIcon name="check" size={15} className="mt-0.5 shrink-0 text-success-700" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">{entry.decision}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">
                {[entry.decidedByName ? `by ${entry.decidedByName}` : null, entry.whenLabel].filter(Boolean).join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DecideInner({
  vm,
  relatedMeeting,
  nowISO,
}: {
  vm: DecideWorkspaceVM;
  relatedMeeting: CcMeeting | null;
  nowISO: string;
}) {
  const now = new Date(nowISO);
  const executive = useIsExecutive();
  const laneMax = executive ? 5 : 3;

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        title="Decisions"
        lede="Choices that need a call."
        actions={<CommandModeToggle />}
      />

      <WorkspaceBody>
        <MissionBriefCard
          icon="scale"
          eyebrow="Decisions"
          headline={vm.brief}
          action={
            <ButtonLink href="#decision-log" variant="secondary" size="md">
              View decision log →
            </ButtonLink>
          }
        />

        <ExecutiveOnly>
          <SummaryTileRow>
            <SummaryTile icon="scale" value={vm.summary.needsDecisionToday} label="Needs decision today" tone="brand" active />
            <SummaryTile icon="user" value={vm.summary.needsOwner} label="Needs owner" tone="warning" href="/delegate" />
            <SummaryTile icon="calendar" value={vm.summary.needsMeeting} label="Needs meeting" tone="info" href="/meet" />
            <SummaryTile icon="hourglass" value={vm.summary.waitingForContext} label="Waiting for context" tone="neutral" href="/follow-up" />
            <SummaryTile icon="check" value={vm.summary.recentlyDecided} label="Recently decided" tone="success" />
          </SummaryTileRow>
        </ExecutiveOnly>

        <div
          className={cn(
            "grid items-start gap-4",
            executive ? "xl:grid-cols-[260px_minmax(0,1fr)_300px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"
          )}
        >
          <ExecutiveOnly>
            <PanelCard icon="list" title="Decision Lanes">
              <div className="flex flex-col gap-4">
                <LaneGroup icon="scale" label="Needs decision today" count={vm.summary.needsDecisionToday} items={vm.lanes.needsDecisionToday.slice(0, laneMax)} now={now} emptyHint="No decisions due today." />
                <LaneGroup icon="user" label="Needs owner" count={vm.summary.needsOwner} items={vm.lanes.needsOwner.slice(0, laneMax)} now={now} emptyHint="Every item has an owner." />
                <LaneGroup icon="calendar" label="Needs meeting" count={vm.summary.needsMeeting} items={vm.lanes.needsMeeting.slice(0, laneMax)} now={now} emptyHint="Nothing waiting on a meeting." />
              </div>
            </PanelCard>
          </ExecutiveOnly>

          {vm.focus ? (
            <FocusDecisionPanel focus={vm.focus} />
          ) : (
            <PanelCard title="Focus decision">
              <EmptyHint>No decisions need leadership right now. Review ownership gaps and upcoming meetings.</EmptyHint>
            </PanelCard>
          )}

          <div className="flex flex-col gap-4">
            {relatedMeeting ? <RelatedMeetingCard meeting={relatedMeeting} /> : null}
            <PanelCard
              icon="hourglass"
              title="Waiting on"
              action={vm.waitingOn.length > 0 ? <ViewAllLink href="/follow-up">View all ({vm.summary.waitingForContext})</ViewAllLink> : null}
            >
              <WaitingOnRows items={vm.waitingOn} now={now} max={executive ? 5 : 3} />
            </PanelCard>
            <PanelCard icon="check" title="Recently decided">
              <RecentlyDecidedList entries={vm.recentlyDecided} />
            </PanelCard>
          </div>
        </div>

        <div id="decision-log">
          <BrowseAllPanel label="Decision log" hint="See decided and deferred decisions.">
            <RecentlyDecidedList entries={vm.decisionLog} />
          </BrowseAllPanel>
        </div>
      </WorkspaceBody>
    </WorkspaceShell>
  );
}

export function DecideWorkspace({
  vm,
  relatedMeeting,
  nowISO,
}: {
  vm: DecideWorkspaceVM;
  relatedMeeting: CcMeeting | null;
  nowISO: string;
}) {
  return (
    <CommandModeProvider>
      <DecideInner vm={vm} relatedMeeting={relatedMeeting} nowISO={nowISO} />
    </CommandModeProvider>
  );
}
