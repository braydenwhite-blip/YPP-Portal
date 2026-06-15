"use client";

import Link from "next/link";
import { useState } from "react";

import {
  BrowseAllPanel,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/queue";
import { ButtonLink, cn } from "@/components/ui-v2";
import type { CcMeeting, CcMeetingRoom, MeetWorkspaceVM } from "@/lib/command-center";
import type { QueueItem } from "@/lib/queue/types";

import { CommandModeProvider, CommandModeToggle } from "./command-mode";
import { CcIcon } from "./icons";
import { Avatar, EmptyHint, ItemRow, PanelCard, ViewAllLink } from "./primitives";

/**
 * Meet — meetings as live operating rooms. A meeting rail (Current / Upcoming /
 * Recent), a center room with a Before / During / After phase switcher, and a
 * context rail of the Queue Engine loops connected to the meeting. Edits route
 * into the existing meeting record — no faked inline mutation.
 */

type Phase = "before" | "during" | "after";

function initialPhase(room: CcMeetingRoom | null): Phase {
  if (!room) return "before";
  if (room.live || room.status === "in_progress") return "during";
  if (room.status === "completed" || room.status === "needs_follow_up") return "after";
  return "before";
}

function AttendeeChips({ attendees }: { attendees: CcMeeting["attendees"] }) {
  if (attendees.length === 0) return null;
  return (
    <span className="flex -space-x-1.5">
      {attendees.slice(0, 4).map((person) => (
        <span
          key={person.id}
          title={person.name}
          className="inline-flex size-6 items-center justify-center rounded-full border-2 border-surface bg-brand-100 text-[10px] font-bold text-brand-700"
        >
          {person.initials}
        </span>
      ))}
      {attendees.length > 4 ? (
        <span className="inline-flex size-6 items-center justify-center rounded-full border-2 border-surface bg-brand-50 text-[10px] font-bold text-brand-700">
          +{attendees.length - 4}
        </span>
      ) : null}
    </span>
  );
}

function MeetingRailItem({ meeting, active }: { meeting: CcMeeting; active: boolean }) {
  return (
    <Link
      href={`/meet?m=${meeting.id}`}
      className={cn(
        "flex flex-col gap-1.5 rounded-[12px] border px-3 py-2.5 transition-colors",
        active ? "border-brand-300/60 bg-brand-50/70" : "border-line-soft bg-surface/70 hover:bg-surface-soft"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            meeting.live ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
          )}
        >
          {meeting.live ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
          {meeting.statusLabel}
        </span>
        <span className="text-[11.5px] font-semibold text-ink-muted">{meeting.timeLabel}</span>
      </div>
      <span className="text-[13.5px] font-bold text-ink">{meeting.title}</span>
      {meeting.purpose ? <span className="line-clamp-1 text-[12px] text-ink-muted">{meeting.purpose}</span> : null}
      <AttendeeChips attendees={meeting.attendees} />
    </Link>
  );
}

function RailSection({
  label,
  meetings,
  activeId,
  emptyHint,
}: {
  label: string;
  meetings: CcMeeting[];
  activeId: string | null;
  emptyHint: string;
}) {
  return (
    <div>
      <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      {meetings.length > 0 ? (
        <div className="flex flex-col gap-2">
          {meetings.map((meeting) => (
            <MeetingRailItem key={meeting.id} meeting={meeting} active={meeting.id === activeId} />
          ))}
        </div>
      ) : (
        <p className="m-0 px-1 pb-1 text-[12px] text-ink-muted">{emptyHint}</p>
      )}
    </div>
  );
}

function PhaseTab({ phase, active, onClick, label }: { phase: Phase; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-brand-600 text-white shadow-card" : "text-ink-muted hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function CaptureLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-line px-2.5 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-surface-soft"
    >
      <span className="text-[14px] leading-none">+</span> {label}
    </Link>
  );
}

function BeforePhase({ room }: { room: CcMeetingRoom }) {
  const prep = [
    { label: "Review agenda", detail: `${room.agendaCount} item${room.agendaCount === 1 ? "" : "s"}`, done: room.agendaDoneCount >= room.agendaCount && room.agendaCount > 0 },
    { label: "Confirm purpose & attendees", detail: `${room.attendeeCount} attendees`, done: Boolean(room.purpose) },
    { label: "Clear open follow-ups", detail: `${room.openFollowUps} open`, done: room.openFollowUps === 0 },
    { label: "Draft decisions to make", detail: `${room.decisionCount} logged`, done: room.decisionCount > 0 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-ink-muted">Get ready before the meeting starts.</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {prep.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5 rounded-[10px] border border-line-soft bg-surface-soft/50 px-3 py-2.5">
            <span className={cn("flex size-5 items-center justify-center rounded-full", step.done ? "bg-success-100 text-success-700" : "border border-line text-ink-muted")}>
              {step.done ? <CcIcon name="check" size={13} /> : null}
            </span>
            <span className="flex-1 text-[13px] font-semibold text-ink">{step.label}</span>
            <span className="text-[12px] text-ink-muted">{step.detail}</span>
          </li>
        ))}
      </ul>
      <ButtonLink href={room.href} variant="secondary" size="sm" className="self-start">
        Open full meeting record →
      </ButtonLink>
    </div>
  );
}

function DuringPhase({ room }: { room: CcMeetingRoom }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="m-0 mb-2 text-[13px] font-bold text-ink">Agenda</p>
          {room.agenda.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {room.agenda.map((item, index) => (
                <li key={item.id} className="flex items-start gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-soft">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{item.title}</span>
                    <span className="block text-[11.5px] text-ink-muted">{item.statusLabel}{item.ownerName ? ` · ${item.ownerName}` : ""}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyHint>No agenda items yet.</EmptyHint>
          )}
          <div className="mt-2"><CaptureLink href={room.href} label="Add agenda item" /></div>
        </div>
        <div>
          <p className="m-0 mb-2 text-[13px] font-bold text-ink">Live notes</p>
          {room.notes ? (
            <p className="m-0 whitespace-pre-line rounded-[10px] border border-line-soft bg-surface-soft/50 p-3 text-[13px] leading-relaxed text-ink">{room.notes}</p>
          ) : (
            <EmptyHint>No notes captured yet. Open the meeting record to take notes.</EmptyHint>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="m-0 text-[13px] font-bold text-ink">Decisions</p>
            <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-bold text-warning-700">
              {room.decisions.filter((d) => d.pending).length} pending
            </span>
          </div>
          {room.decisions.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {room.decisions.map((decision) => (
                <li key={decision.id} className="flex items-start gap-2 rounded-[10px] border border-line-soft bg-surface-soft/50 px-2.5 py-2">
                  <CcIcon name={decision.pending ? "scale" : "check"} size={15} className={cn("mt-0.5 shrink-0", decision.pending ? "text-warning-700" : "text-success-700")} />
                  <span className="min-w-0 text-[12.5px] font-semibold text-ink">{decision.decision}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint>No decisions logged yet.</EmptyHint>
          )}
          <div className="mt-2"><CaptureLink href={room.href} label="Add decision" /></div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="m-0 text-[13px] font-bold text-ink">Actions</p>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{room.actions.length} open</span>
          </div>
          {room.actions.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {room.actions.map((action) => (
                <li key={action.id}>
                  <Link href={action.href} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-surface-soft">
                    <Avatar name={action.ownerName} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{action.title}</span>
                    {action.dueLabel ? <span className="shrink-0 text-[11px] text-ink-muted">{action.dueLabel}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint>No actions captured yet.</EmptyHint>
          )}
          <div className="mt-2"><CaptureLink href="/actions/new" label="Capture action" /></div>
        </div>
      </div>
    </div>
  );
}

function AfterPhase({ room }: { room: CcMeetingRoom }) {
  const steps = [
    { icon: "scale" as const, label: "Confirm decisions", detail: `${room.decisions.filter((d) => d.pending).length} pending` },
    { icon: "check" as const, label: "Create actions", detail: `${room.actions.length} open` },
    { icon: "handoff" as const, label: "Assign owners", detail: `${room.actions.filter((a) => !a.ownerName).length} unassigned` },
    { icon: "clock" as const, label: "Set due dates", detail: `${room.actions.filter((a) => !a.dueLabel).length} without dates` },
    { icon: "send" as const, label: "Save & send summary", detail: "to attendees" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line-soft bg-surface-soft/40 p-4">
      <p className="m-0 text-[13px] font-bold text-ink">After meeting — wrap up and close the loops.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <div key={step.label} className="flex flex-col items-start gap-1 rounded-[10px] bg-surface px-3 py-2.5 shadow-card">
            <CcIcon name={step.icon} size={16} className="text-brand-600" />
            <span className="text-[12.5px] font-bold text-ink">{step.label}</span>
            <span className="text-[11px] text-ink-muted">{step.detail}</span>
          </div>
        ))}
      </div>
      <ButtonLink href={room.href} variant="primary" size="md" className="self-start">
        End &amp; save summary →
      </ButtonLink>
    </div>
  );
}

function MeetingRoom({ room }: { room: CcMeetingRoom }) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(room));
  return (
    <section className="flex flex-col gap-4 rounded-[18px] border border-line-soft bg-surface/85 p-5 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            Meeting Room
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal", room.live ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700")}>
              {room.live ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
              {room.statusLabel}
            </span>
            <span className="font-semibold normal-case tracking-normal text-ink-muted">{room.timeLabel}</span>
          </p>
          <h2 className="m-0 mt-1 text-[22px] font-bold tracking-[-0.01em] text-ink">{room.title}</h2>
          {room.purpose ? <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{room.purpose}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <AttendeeChips attendees={room.attendees} />
          <ButtonLink href={room.href} variant="primary" size="sm">
            <span className="inline-flex items-center gap-1.5"><CcIcon name="compass" size={14} /> Open meeting</span>
          </ButtonLink>
        </div>
      </div>

      <div className="flex gap-1 rounded-[12px] border border-line-soft bg-surface-soft/60 p-1">
        <PhaseTab phase="before" active={phase === "before"} onClick={() => setPhase("before")} label="Before meeting" />
        <PhaseTab phase="during" active={phase === "during"} onClick={() => setPhase("during")} label="During meeting" />
        <PhaseTab phase="after" active={phase === "after"} onClick={() => setPhase("after")} label="After meeting" />
      </div>

      {phase === "before" ? <BeforePhase room={room} /> : null}
      {phase === "during" ? <DuringPhase room={room} /> : null}
      {phase === "after" ? <AfterPhase room={room} /> : null}
    </section>
  );
}

function MeetCounter({ icon, value, label, tone }: { icon: Parameters<typeof CcIcon>[0]["name"]; value: number; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] border border-line-soft bg-surface/80 px-3 py-2 shadow-card">
      <span className={cn("flex size-7 items-center justify-center rounded-[8px]", tone)}>
        <CcIcon name={icon} size={15} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[17px] font-bold text-ink">{value}</span>
        <span className="text-[11px] text-ink-muted">{label}</span>
      </span>
    </div>
  );
}

function RailItemList({ items, now, emptyHint }: { items: QueueItem[]; now: Date; emptyHint: string }) {
  if (items.length === 0) return <EmptyHint>{emptyHint}</EmptyHint>;
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} now={now} showAvatar={false} />
      ))}
    </div>
  );
}

function MeetInner({ vm, nowISO }: { vm: MeetWorkspaceVM; nowISO: string }) {
  const now = new Date(nowISO);
  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader
        title={
          <span className="inline-flex items-center gap-2">
            Meet
            <CcIcon name="calendar" size={22} className="text-brand-400" />
          </span>
        }
        lede="Run meetings as live operating rooms — before, during, and after."
        actions={<CommandModeToggle />}
      />

      <WorkspaceBody>
        <section className="flex flex-col gap-4 rounded-[18px] border border-line-soft bg-gradient-to-br from-brand-50/70 via-surface to-surface/90 p-5 shadow-card backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-100 text-brand-700">
              <CcIcon name="calendar" size={24} />
            </span>
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-700">Meeting brief</p>
              <p className="m-0 mt-0.5 max-w-xl text-[15px] font-semibold leading-snug text-ink">{vm.brief}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MeetCounter icon="bolt" value={vm.counts.current} label="Current" tone="bg-brand-100 text-brand-700" />
            <MeetCounter icon="calendar" value={vm.counts.upcoming} label="Upcoming" tone="bg-info-100 text-info-700" />
            <MeetCounter icon="inbox" value={vm.counts.followUpsOpen} label="Follow-ups open" tone="bg-warning-100 text-warning-700" />
            <MeetCounter icon="scale" value={vm.counts.decisionsToConfirm} label="Decisions to confirm" tone="bg-brand-100 text-brand-700" />
          </div>
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
          <PanelCard icon="calendar" title="Meetings">
            <div className="flex flex-col gap-4">
              <RailSection label="Current" meetings={vm.rail.current} activeId={vm.room?.id ?? null} emptyHint="No meeting in progress." />
              <RailSection label="Upcoming" meetings={vm.rail.upcoming} activeId={vm.room?.id ?? null} emptyHint="No upcoming meetings." />
              <RailSection label="Recent" meetings={vm.rail.recent} activeId={vm.room?.id ?? null} emptyHint="No recent meetings." />
            </div>
          </PanelCard>

          {vm.room ? (
            <MeetingRoom room={vm.room} />
          ) : (
            <PanelCard title="Meeting Room">
              <EmptyHint>No meeting selected. Pick a meeting from the rail, or schedule the next one.</EmptyHint>
            </PanelCard>
          )}

          <div className="flex flex-col gap-4">
            <PanelCard icon="check" title="Related Actions" action={vm.relatedActions.length > 0 ? <ViewAllLink href="/actions">View all</ViewAllLink> : null}>
              <RailItemList items={vm.relatedActions} now={now} emptyHint="No actions tied to this meeting." />
            </PanelCard>
            {vm.room ? (
              <PanelCard icon="users" title={`Attendees (${vm.room.attendees.length})`}>
                {vm.room.attendees.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {vm.room.attendees.map((person) => (
                      <li key={person.id} className="flex items-center gap-2.5 px-1 py-1">
                        <Avatar name={person.name} size="sm" />
                        <span className="flex-1 text-[13px] font-semibold text-ink">{person.name}</span>
                        {person.role ? <span className="text-[11.5px] text-ink-muted">{person.role}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyHint>No attendees recorded.</EmptyHint>
                )}
              </PanelCard>
            ) : null}
            <PanelCard icon="scale" title="Decisions Needed">
              <RailItemList items={vm.decisionsNeeded} now={now} emptyHint="No decisions waiting on this meeting." />
            </PanelCard>
            <PanelCard icon="hourglass" title="Open Loops">
              <RailItemList items={vm.openLoops} now={now} emptyHint="No open loops blocking this meeting." />
            </PanelCard>
          </div>
        </div>

        <BrowseAllPanel label="Browse all meetings" hint="Explore all meetings, past and upcoming.">
          <div className="flex flex-wrap gap-2">
            <Link href="/actions/meetings" className="rounded-full border border-line-soft bg-surface px-3 py-1 text-[12.5px] font-semibold text-brand-700 hover:bg-surface-soft">
              All meetings
            </Link>
            <Link href="/officer-meetings" className="rounded-full border border-line-soft bg-surface px-3 py-1 text-[12.5px] font-semibold text-brand-700 hover:bg-surface-soft">
              Officer meetings
            </Link>
          </div>
        </BrowseAllPanel>
      </WorkspaceBody>
    </WorkspaceShell>
  );
}

export function MeetWorkspace({ vm, nowISO }: { vm: MeetWorkspaceVM; nowISO: string }) {
  return (
    <CommandModeProvider>
      <MeetInner vm={vm} nowISO={nowISO} />
    </CommandModeProvider>
  );
}
