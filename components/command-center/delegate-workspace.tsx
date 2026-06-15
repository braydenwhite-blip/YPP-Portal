"use client";

import Link from "next/link";

import {
  BrowseAllPanel,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { ButtonLink, cn, StatusBadge } from "@/components/ui-v2";
import type {
  CcAssignmentItem,
  CcBatchTool,
  CcOwnerLane,
  CcWaitingPerson,
  DelegateWorkspaceVM,
} from "@/lib/command-center";

import { CommandModeProvider, CommandModeToggle, ExecutiveOnly, useIsExecutive } from "./command-mode";
import { CcIcon } from "./icons";
import { Avatar, EmptyHint, MissionBriefCard, PanelCard, SummaryTile, SummaryTileRow, ViewAllLink } from "./primitives";

/**
 * Delegate — the ownership & accountability workspace. The assignment queue of
 * ownerless work on the left, owner lanes in the center (operational status, not
 * a health score), and batch tools + who we're waiting on at the right. Bulk
 * mutations route into the existing queue / work flows.
 */

function AssignmentCard({ item }: { item: CcAssignmentItem }) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line-soft bg-surface-soft/40 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-100 text-brand-700">
          <CcIcon name="flag" size={16} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[13.5px] font-bold leading-snug text-ink">{item.title}</p>
          <p className="m-0 mt-0.5 text-[12px] leading-snug text-ink-muted">{item.whyItMatters}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={item.priorityTone}>{item.priorityLabel}</StatusBadge>
          {item.suggestedOwnerName ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
              <span className="text-ink-muted">Suggested:</span>
              <Avatar name={item.suggestedOwnerName} size="sm" />
              {item.suggestedOwnerName}
            </span>
          ) : null}
        </div>
        <ButtonLink href={item.assignHref} variant="secondary" size="sm">
          Assign →
        </ButtonLink>
      </div>
    </div>
  );
}

function OwnerStat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className={cn("text-[16px] font-bold leading-none", tone)}>{value}</span>
      <span className="mt-0.5 text-[10.5px] text-ink-muted">{label}</span>
    </span>
  );
}

function OwnerLaneCard({ lane }: { lane: CcOwnerLane }) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-line-soft bg-surface/85 p-4 shadow-card backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Avatar name={lane.ownerName} size="lg" />
        <div className="min-w-0">
          <p className="m-0 truncate text-[14px] font-bold text-ink">{lane.ownerName}</p>
          <StatusBadge tone={lane.status.tone} withDot>
            {lane.status.label}
          </StatusBadge>
        </div>
      </div>

      <div className="flex items-center justify-around rounded-[12px] bg-surface-soft/60 py-2">
        <OwnerStat value={lane.open} label="Open" tone="text-ink" />
        <OwnerStat value={lane.overdue} label="Overdue" tone={lane.overdue > 0 ? "text-danger-700" : "text-ink"} />
        <OwnerStat value={lane.meetings} label="Meetings" tone="text-ink" />
      </div>

      <div>
        <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Top open actions</p>
        {lane.topActions.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {lane.topActions.map((action) => (
              <li key={action.id}>
                <Link href={action.href} className="flex items-center gap-1.5 truncate rounded-[8px] px-1 py-1 text-[12.5px] text-ink hover:bg-surface-soft">
                  <span className="size-1.5 shrink-0 rounded-full bg-brand-300" />
                  <span className="truncate">{action.title}</span>
                </Link>
              </li>
            ))}
            {lane.moreCount > 0 ? (
              <li className="px-1 pt-0.5 text-[11.5px] font-semibold text-brand-700">+{lane.moreCount} more</li>
            ) : null}
          </ul>
        ) : (
          <p className="m-0 px-1 text-[12px] text-ink-muted">No open actions.</p>
        )}
      </div>

      {lane.nextFollowUpLabel ? (
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Next follow-up</p>
          <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-brand-700">{lane.nextFollowUpLabel}</p>
          {lane.nextFollowUpTitle ? <p className="m-0 truncate text-[12px] text-ink-muted">{lane.nextFollowUpTitle}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[12px] text-ink-muted">
        <CcIcon name="hourglass" size={14} className="text-warning-700" />
        <span className="font-semibold text-ink">{lane.waitingOnMe}</span> waiting on them
      </div>
    </div>
  );
}

function BatchToolRow({ tool }: { tool: CcBatchTool }) {
  const inner = (
    <div className={cn("flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5 transition-colors", tool.disabled ? "border-line-soft bg-surface-soft/40" : "border-line-soft bg-surface hover:bg-surface-soft")}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
          <CcIcon name="handoff" size={16} />
        </span>
        <span className="flex flex-col">
          <span className="text-[13px] font-bold text-ink">{tool.label}</span>
          <span className="text-[11.5px] text-ink-muted">{tool.itemsLabel}</span>
        </span>
      </div>
      <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", tool.disabled ? "text-ink-muted" : "bg-brand-50 text-brand-700")}>
        Review
      </span>
    </div>
  );
  if (tool.disabled) return inner;
  return <Link href={tool.href}>{inner}</Link>;
}

function WaitingPersonRow({ person }: { person: CcWaitingPerson }) {
  return (
    <div className="flex items-center gap-2.5 px-1 py-1.5">
      <Avatar name={person.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{person.name}</span>
        <span className="block truncate text-[11.5px] text-ink-muted">{person.reason}</span>
      </span>
      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-bold text-brand-700">{person.count}</span>
    </div>
  );
}

function DelegateInner({ vm }: { vm: DelegateWorkspaceVM }) {
  const executive = useIsExecutive();
  const assignments = executive ? vm.assignmentQueue : vm.assignmentQueue.slice(0, 3);
  const ownerLanes = executive ? vm.ownerLanes : vm.ownerLanes.slice(0, 4);

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        title="Owners"
        lede="Work that needs someone responsible."
        actions={<CommandModeToggle />}
      />

      <WorkspaceBody>
        <MissionBriefCard icon="users" eyebrow="Owners" headline={vm.briefHeadline} sub={vm.briefSub} />

        <ExecutiveOnly>
          <SummaryTileRow className="xl:grid-cols-4">
            <SummaryTile icon="user" value={vm.summary.needOwnership} label="Need ownership" tone="brand" />
            <SummaryTile icon="clock" value={vm.summary.overdueItems} label="Overdue items" tone="danger" />
            <SummaryTile icon="handoff" value={vm.summary.needsReassignment} label="Needs reassignment" tone="warning" />
            <SummaryTile icon="hourglass" value={vm.summary.waitingOnPeople} label="Waiting on people" tone="info" />
          </SummaryTileRow>
        </ExecutiveOnly>

        <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          <PanelCard
            icon="inbox"
            title={
              <span className="flex items-center gap-2">
                Assignment Queue
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-bold text-brand-700">{vm.summary.needOwnership}</span>
              </span>
            }
            action={<ViewAllLink href="/work/queue?queue=owner-accountability">View all</ViewAllLink>}
          >
            {assignments.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {assignments.map((item) => (
                  <AssignmentCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyHint>Every active item has an owner. Nothing to assign right now.</EmptyHint>
            )}
          </PanelCard>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="m-0 text-[15px] font-bold text-ink">Owner Lanes</h3>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">See who owns what, what&apos;s overdue, and what they&apos;re waiting on.</p>
              </div>
              <ViewAllLink href="/people">View all people</ViewAllLink>
            </div>
            {ownerLanes.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {ownerLanes.map((lane) => (
                  <OwnerLaneCard key={lane.ownerId ?? lane.ownerName} lane={lane} />
                ))}
              </div>
            ) : (
              <EmptyHint>No open work to attribute yet.</EmptyHint>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <PanelCard icon="bolt" title="Batch Assignment">
              <div className="flex flex-col gap-2">
                {vm.batchTools.map((tool) => (
                  <BatchToolRow key={tool.id} tool={tool} />
                ))}
              </div>
            </PanelCard>
            <PanelCard icon="hourglass" title="Waiting On" action={vm.waitingOn.length > 0 ? <ViewAllLink href="/follow-up">View all waiting on</ViewAllLink> : null}>
              {vm.waitingOn.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {vm.waitingOn.map((person) => (
                    <WaitingPersonRow key={person.name} person={person} />
                  ))}
                </div>
              ) : (
                <EmptyHint>No one is waiting on an update right now.</EmptyHint>
              )}
            </PanelCard>
          </div>
        </div>

        <BrowseAllPanel label="Browse all ownership data" hint="Explore all actions, initiatives, meetings, and follow-ups by owner, status, or filter.">
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/work?flag=unowned#browse-all", label: "Unowned work" },
              { href: "/work?flag=overdue#browse-all", label: "Overdue work" },
              { href: "/people", label: "People" },
              { href: "/actions", label: "Actions" },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full border border-line-soft bg-surface px-3 py-1 text-[12.5px] font-semibold text-brand-700 hover:bg-surface-soft">
                {link.label}
              </Link>
            ))}
          </div>
        </BrowseAllPanel>
      </WorkspaceBody>
    </WorkspaceShell>
  );
}

export function DelegateWorkspace({ vm }: { vm: DelegateWorkspaceVM }) {
  return (
    <CommandModeProvider>
      <DelegateInner vm={vm} />
    </CommandModeProvider>
  );
}
