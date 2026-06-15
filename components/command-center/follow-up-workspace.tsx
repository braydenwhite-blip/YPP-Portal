"use client";

import Link from "next/link";
import { useState } from "react";

import {
  BrowseAllPanel,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { ButtonLink, cn, StatusBadge } from "@/components/ui-v2";
import type {
  CcComposerTarget,
  CcFollowUpItem,
  CcFollowUpType,
  FollowUpWorkspaceVM,
} from "@/lib/command-center";

import { CommandModeProvider, CommandModeToggle, ExecutiveOnly, useIsExecutive } from "./command-mode";
import { CcIcon } from "./icons";
import { Avatar, EmptyHint, MissionBriefCard, PanelCard, SummaryTile, SummaryTileRow, ViewAllLink } from "./primitives";

/**
 * Follow Up — the waiting-on / outreach operating desk. Who we're waiting on,
 * what's open and overdue, who needs outreach, and a composer that routes into
 * real messaging / action / meeting flows (never fakes sending).
 */

function FollowUpRow({ item }: { item: CcFollowUpItem }) {
  return (
    <Link href={item.href} className="flex items-center gap-3 rounded-[12px] border border-transparent px-2.5 py-2.5 transition-colors hover:border-line-soft hover:bg-surface-soft">
      <Avatar name={item.personName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
        <span className="block truncate text-[12px] text-ink-muted">
          {[item.personName ?? "Unassigned", item.categoryLabel, item.relatedLabel].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge tone={item.stateTone}>{item.stateLabel}</StatusBadge>
        {item.dueLabel ? <span className="text-[11px] text-ink-muted">{item.dueLabel}</span> : null}
      </span>
    </Link>
  );
}

function Composer({ targets }: { targets: CcComposerTarget[] }) {
  const [selected, setSelected] = useState<CcComposerTarget | null>(targets[0] ?? null);
  return (
    <PanelCard icon="send" title="Follow-Up Composer">
      <div className="flex flex-col gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[12px] font-bold text-ink">Who are you following up with?</p>
          {targets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => setSelected(target)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                    selected?.id === target.id ? "border-brand-300/60 bg-brand-50 text-brand-700" : "border-line-soft text-ink-muted hover:text-ink"
                  )}
                >
                  <Avatar name={target.name} size="sm" />
                  {target.name}
                </button>
              ))}
            </div>
          ) : (
            <EmptyHint>No one is waiting on a reply right now.</EmptyHint>
          )}
        </div>

        {selected ? (
          <div className="rounded-[12px] border border-line-soft bg-surface-soft/50 p-3">
            <p className="m-0 text-[13px] font-bold text-ink">{selected.name}</p>
            <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{selected.reason}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          {[
            { href: "/messages", label: "Send reminder", icon: "send" as const },
            { href: "/actions/new", label: "Create action", icon: "check" as const },
            { href: "/meet", label: "Add to meeting", icon: "calendar" as const },
            { href: "/work/queue?queue=waiting", label: "Mark followed up", icon: "check" as const },
            { href: "/work/queue?queue=waiting", label: "Defer", icon: "clock" as const },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface-soft"
            >
              <CcIcon name={action.icon} size={15} className="text-brand-600" />
              {action.label}
            </Link>
          ))}
        </div>
        <p className="m-0 text-[11px] text-ink-muted">Composer actions open the existing messaging, action, and meeting flows.</p>
      </div>
    </PanelCard>
  );
}

function FollowUpInner({ vm }: { vm: FollowUpWorkspaceVM }) {
  const executive = useIsExecutive();
  const [filter, setFilter] = useState<CcFollowUpType>("all");

  const filtered =
    filter === "all"
      ? vm.items
      : filter === "overdue"
        ? vm.items.filter((item) => item.overdue)
        : vm.items.filter((item) => item.category === filter);
  const topFollowUps = executive ? filtered : filtered.slice(0, 5);

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        title={
          <span className="inline-flex items-center gap-2">
            Follow Up
            <CcIcon name="inbox" size={22} className="text-brand-400" />
          </span>
        }
        lede="Stay on top of who we're waiting on and keep momentum moving."
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/actions/new" variant="primary" size="sm">
              New follow-up
            </ButtonLink>
            <CommandModeToggle />
          </div>
        }
      />

      <WorkspaceBody>
        <MissionBriefCard icon="inbox" eyebrow="Follow-up brief" headline={vm.brief} />

        <ExecutiveOnly>
          <SummaryTileRow>
            <SummaryTile icon="inbox" value={vm.summary.open} label="Open" tone="brand" />
            <SummaryTile icon="clock" value={vm.summary.overdue} label="Overdue" tone="danger" />
            <SummaryTile icon="hourglass" value={vm.summary.waitingOnPeople} label="Waiting on people" tone="info" />
            <SummaryTile icon="send" value={vm.summary.needOutreach} label="Need outreach" tone="warning" />
            <SummaryTile icon="check" value={vm.summary.resolvedThisWeek} label="Resolved this week" tone="success" />
          </SummaryTileRow>
        </ExecutiveOnly>

        <div className="flex flex-wrap gap-1.5">
          {vm.typeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors",
                filter === chip.key ? "border-brand-300/60 bg-brand-600 text-white" : "border-line-soft bg-surface/70 text-ink-muted hover:text-ink"
              )}
            >
              {chip.label}
              <span className={cn("rounded-full px-1.5 text-[11px] font-bold", filter === chip.key ? "bg-white/20 text-white" : "bg-brand-50 text-brand-700")}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "grid items-start gap-4",
            executive ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""
          )}
        >
          <div className="flex flex-col gap-4">
            <PanelCard icon="hourglass" title="Waiting On People" action={<ViewAllLink href="/delegate">View ownership</ViewAllLink>}>
              {vm.waitingPeople.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {vm.waitingPeople.map((person, index) => (
                    <Link key={`${person.name}-${index}`} href={person.href} className="flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-surface-soft">
                      <Avatar name={person.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{person.name}</span>
                        <span className="block truncate text-[12px] text-ink-muted">{[person.owes, person.relatedLabel].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge tone={person.stateTone}>Waiting</StatusBadge>
                        {person.ageLabel ? <span className="text-[11px] text-warning-700">{person.ageLabel}</span> : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyHint>No one is blocking active work. Momentum is clear.</EmptyHint>
              )}
            </PanelCard>

            <PanelCard
              icon="inbox"
              title="Top Follow-Ups Needing Attention"
              action={<span className="text-[12px] text-ink-muted">{filtered.length} shown</span>}
            >
              {topFollowUps.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {topFollowUps.map((item) => (
                    <FollowUpRow key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyHint>No follow-ups match this filter. Try another type.</EmptyHint>
              )}
            </PanelCard>

            <ExecutiveOnly>
              <div className="grid gap-4 md:grid-cols-2">
                <PanelCard icon="clock" title="Stale / No Update">
                  {vm.stale.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {vm.stale.map((item) => (
                        <FollowUpRow key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <EmptyHint>Nothing has gone stale. Everything has a recent update.</EmptyHint>
                  )}
                </PanelCard>
                <PanelCard icon="layers" title="Follow-Up by Type">
                  {vm.byType.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {vm.byType.map((entry) => (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => setFilter(entry.key)}
                          className="flex flex-col items-start rounded-[12px] border border-line-soft bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-soft"
                        >
                          <span className="text-[18px] font-bold text-ink">{entry.count}</span>
                          <span className="text-[11.5px] text-ink-muted">{entry.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyHint>No categorized follow-ups yet.</EmptyHint>
                  )}
                </PanelCard>
              </div>
            </ExecutiveOnly>
          </div>

          {/* In Calm the composer stays out of the way — act from a row, or use
              "New follow-up" above. Executive mode brings it alongside. */}
          <ExecutiveOnly>
            <Composer targets={vm.composerTargets} />
          </ExecutiveOnly>
        </div>

        <BrowseAllPanel label="Browse all follow-ups" hint="Explore every follow-up by person, type, and status.">
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/work?flag=overdue#browse-all", label: "Overdue work" },
              { href: "/actions/meetings", label: "Meeting follow-ups" },
              { href: "/people", label: "People" },
              { href: "/partners", label: "Partners" },
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

export function FollowUpWorkspace({ vm }: { vm: FollowUpWorkspaceVM }) {
  return (
    <CommandModeProvider>
      <FollowUpInner vm={vm} />
    </CommandModeProvider>
  );
}
