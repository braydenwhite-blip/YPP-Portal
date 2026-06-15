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
  CcChange,
  CcInitiativeRoom,
  CcReviewRow,
  CcReviewSessionStep,
  ReviewWorkspaceVM,
} from "@/lib/command-center";

import { CommandModeProvider, CommandModeToggle, useIsExecutive } from "./command-mode";
import { CcIcon, type CcIconName } from "./icons";
import { Avatar, ChangeRow, EmptyHint, PanelCard, ViewAllLink } from "./primitives";

/**
 * Review — the weekly operating review ritual. What changed, what needs review,
 * the guided review session, initiative review rooms, a recent-changes timeline,
 * and the focus for next week. Concrete operating states only.
 */

const ROW_ICON: Record<string, CcIconName> = {
  completed: "check",
  created: "bolt",
  "from-meetings": "calendar",
  blockers: "flag",
  unowned: "user",
  "stale-initiatives": "flag",
  overdue: "clock",
  decisions: "scale",
  "meeting-followups": "calendar",
  applicants: "user",
  classes: "layers" as CcIconName,
};

function ReviewRow({ row }: { row: CcReviewRow }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-2 transition-colors hover:bg-surface-soft">
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-[9px]", tone(row.tone))}>
        <CcIcon name={ROW_ICON[row.id] ?? "activity"} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink">{row.label}</span>
        <span className="block text-[11.5px] text-ink-muted">e.g. {row.example}</span>
      </span>
      <span className="shrink-0 text-[15px] font-bold text-ink">{row.count}</span>
    </div>
  );
}

function tone(value: CcReviewRow["tone"]): string {
  const map: Record<CcReviewRow["tone"], string> = {
    brand: "bg-brand-100 text-brand-700",
    danger: "bg-danger-100 text-danger-700",
    warning: "bg-warning-100 text-warning-700",
    info: "bg-info-100 text-info-700",
    success: "bg-success-100 text-success-700",
    neutral: "bg-brand-50 text-brand-700",
  };
  return map[value];
}

function ReviewStat({ value, label, toneClass }: { value: number; label: string; toneClass: string }) {
  return (
    <div className={cn("flex flex-col rounded-[12px] border px-3 py-2", toneClass)}>
      <span className="text-[20px] font-bold leading-none">{value}</span>
      <span className="mt-1 text-[11.5px] font-medium text-ink-muted">{label}</span>
    </div>
  );
}

function SessionStep({ step }: { step: CcReviewSessionStep }) {
  return (
    <Link href={step.href} className="flex items-center gap-2.5 rounded-[10px] border border-line-soft bg-surface px-3 py-2.5 transition-colors hover:bg-surface-soft">
      <span className="flex size-7 items-center justify-center rounded-[9px] bg-brand-50 text-brand-700">
        <CcIcon name={step.icon as CcIconName} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink">{step.label}</span>
        <span className="block text-[11.5px] text-ink-muted">{step.count} {step.count === 1 ? "item" : "items"}</span>
      </span>
      <CcIcon name="arrowRight" size={14} className="shrink-0 text-ink-muted" />
    </Link>
  );
}

function InitiativeRoomRow({ room }: { room: CcInitiativeRoom }) {
  return (
    <Link href={room.href} className="grid gap-2 rounded-[12px] border border-line-soft bg-surface px-3.5 py-3 transition-colors hover:bg-surface-soft lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="m-0 truncate text-[14px] font-bold text-ink">{room.title}</p>
        <p className="m-0 truncate text-[12px] text-ink-muted">{room.progressLabel}</p>
        {room.topBlocker ? (
          <p className="m-0 mt-1 flex items-center gap-1 text-[11.5px] text-warning-700">
            <CcIcon name="flag" size={12} /> {room.topBlocker}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 text-[12px]">
        <span className="inline-flex items-center gap-1.5 text-ink-muted">
          <Avatar name={room.ownerName ?? "?"} size="sm" tone={room.ownerName ? "brand" : "neutral"} />
          {room.ownerName ?? "No owner"}
        </span>
        <span className="flex items-center gap-2">
          <StatusBadge tone={room.statusTone}>{room.statusLabel}</StatusBadge>
          <span className="text-ink-muted">{room.stageLabel}</span>
        </span>
        {room.nextMove ? <span className="truncate text-ink-muted">Next: {room.nextMove}</span> : null}
      </div>
      <div className="flex items-center gap-3 self-center text-[12px] text-ink-muted">
        <span className="flex flex-col items-center"><span className="text-[14px] font-bold text-ink">{room.actions}</span>Actions</span>
        <span className="flex flex-col items-center"><span className="text-[14px] font-bold text-ink">{room.meetings}</span>Meetings</span>
      </div>
    </Link>
  );
}

function TimelineGroup({ label, changes }: { label: string; changes: CcChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div>
      <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <div className="flex flex-col gap-0.5">
        {changes.map((change) => (
          <ChangeRow key={change.id} change={change} />
        ))}
      </div>
    </div>
  );
}

function ReviewInner({ vm }: { vm: ReviewWorkspaceVM }) {
  const executive = useIsExecutive();
  const initiatives = executive ? vm.initiativeRooms : vm.initiativeRooms.slice(0, 4);
  const hasTimeline =
    vm.recentChanges.today.length + vm.recentChanges.yesterday.length + vm.recentChanges.earlier.length > 0;

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        eyebrow="Weekly review"
        title={
          <span className="inline-flex items-center gap-2">
            Review
            <CcIcon name="activity" size={22} className="text-brand-400" />
          </span>
        }
        lede="Weekly progress review and what needs your attention."
        actions={
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface/80 px-3 py-1 text-[12.5px] font-semibold text-ink shadow-card">
              <CcIcon name="calendar" size={14} className="text-brand-600" /> {vm.weekLabel} · {vm.weekRangeLabel}
            </span>
            <div className="flex items-center gap-2">
              <ButtonLink href={vm.startSessionHref} variant="primary" size="sm">
                Start review session →
              </ButtonLink>
              <CommandModeToggle />
            </div>
          </div>
        }
      />

      <WorkspaceBody>
        <section className="flex flex-col gap-4 rounded-[18px] border border-line-soft bg-gradient-to-br from-brand-50/70 via-surface to-surface/90 p-5 shadow-card backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-100 text-brand-700">
              <CcIcon name="activity" size={24} />
            </span>
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-700">Review brief</p>
              <p className="m-0 mt-0.5 max-w-xl text-[14.5px] font-semibold leading-snug text-ink">{vm.brief}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <ReviewStat value={vm.summary.actionsMoved} label="Actions moved" toneClass="border-success-700/20 bg-success-100/40 text-success-700" />
            <ReviewStat value={vm.summary.overdue} label="Overdue" toneClass="border-danger-700/20 bg-danger-100/40 text-danger-700" />
            <ReviewStat value={vm.summary.initiativesNeedNextSteps} label="Need next steps" toneClass="border-warning-700/20 bg-warning-100/40 text-warning-700" />
            <ReviewStat value={vm.summary.unresolvedFollowUp} label="Unresolved follow-up" toneClass="border-brand-200/60 bg-brand-50/70 text-brand-700" />
            <ReviewStat value={vm.summary.totalChanges} label="Total changes" toneClass="border-info-700/20 bg-info-100/40 text-info-700" />
          </div>
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <PanelCard icon="activity" title="What Changed" action={<ViewAllLink href="/work">View all</ViewAllLink>}>
                {vm.whatChanged.length > 0 ? (
                  <div className="flex flex-col">
                    {vm.whatChanged.map((row) => (
                      <ReviewRow key={row.id} row={row} />
                    ))}
                  </div>
                ) : (
                  <EmptyHint>No changes recorded this week yet.</EmptyHint>
                )}
              </PanelCard>
              <PanelCard icon="eye" title="What Needs Review" action={<ViewAllLink href="/work">View all</ViewAllLink>}>
                {vm.whatNeedsReview.length > 0 ? (
                  <div className="flex flex-col">
                    {vm.whatNeedsReview.map((row) => (
                      <ReviewRow key={row.id} row={row} />
                    ))}
                  </div>
                ) : (
                  <EmptyHint>Nothing needs review. The week is clean.</EmptyHint>
                )}
              </PanelCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <PanelCard icon="check" title="Review Session">
                <div className="flex flex-col gap-2">
                  {vm.reviewSession.map((step) => (
                    <SessionStep key={step.id} step={step} />
                  ))}
                  <ButtonLink href={vm.startSessionHref} variant="primary" size="md" className="mt-1 w-full justify-center">
                    Start review session →
                  </ButtonLink>
                </div>
              </PanelCard>
              <PanelCard icon="flag" title="Initiative Review Rooms" action={<ViewAllLink href="/operations/initiatives">View all initiatives</ViewAllLink>}>
                {initiatives.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {initiatives.map((room) => (
                      <InitiativeRoomRow key={room.id} room={room} />
                    ))}
                  </div>
                ) : (
                  <EmptyHint>No active initiatives to review.</EmptyHint>
                )}
              </PanelCard>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <PanelCard icon="activity" title="Recent Changes Timeline" action={<ViewAllLink href="/work">View all activity</ViewAllLink>}>
              {hasTimeline ? (
                <div className="flex flex-col gap-3">
                  <TimelineGroup label="Today" changes={vm.recentChanges.today} />
                  <TimelineGroup label="Yesterday" changes={vm.recentChanges.yesterday} />
                  <TimelineGroup label="Earlier" changes={vm.recentChanges.earlier} />
                </div>
              ) : (
                <EmptyHint>No recent activity to show.</EmptyHint>
              )}
            </PanelCard>
            <PanelCard icon="target" title="Focus for Next Week">
              {vm.focusNextWeek.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {vm.focusNextWeek.map((focus) => (
                    <li key={focus} className="flex items-start gap-2 text-[13px] text-ink">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                      {focus}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint>Next week is clear so far.</EmptyHint>
              )}
            </PanelCard>
          </div>
        </div>

        <BrowseAllPanel label="Browse all review data" hint="Explore all actions, initiatives, meetings, decisions, and changes.">
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/work", label: "All work" },
              { href: "/operations/initiatives", label: "Initiatives" },
              { href: "/actions/meetings", label: "Meetings" },
              { href: "/decide", label: "Decisions" },
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

export function ReviewWorkspace({ vm }: { vm: ReviewWorkspaceVM }) {
  return (
    <CommandModeProvider>
      <ReviewInner vm={vm} />
    </CommandModeProvider>
  );
}
