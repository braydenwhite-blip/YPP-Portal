"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ActionItemStatus } from "@prisma/client";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { deriveActionStrategicLinkage } from "@/lib/people-strategy/action-source";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import { updateActionStatus } from "@/lib/people-strategy/action-items-actions";
import {
  canEditAction,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  ActionStatusBadge,
  InitialsAvatar,
  dueLabel,
} from "@/components/people-strategy/action-presentation";
import { departmentHeaderColor } from "@/lib/people-strategy/actions-hub-grouping";
import { actionItemDepartments } from "@/lib/people-strategy/action-item-departments";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { Button, cn } from "@/components/ui-v2";
import { ActionMeetingLink } from "@/components/people-strategy/action-assign-meeting-button";
import { deriveActionSource } from "@/lib/people-strategy/action-source";

function personName(user: { name: string | null; email: string } | null | undefined): string {
  return user?.name?.trim() || user?.email || "Unknown";
}

function RolePills({
  label,
  users,
}: {
  label: string;
  users: Array<{ id: string; name: string | null; email: string }>;
}) {
  if (users.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      {users.map((user) => (
        <span
          key={user.id}
          className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-ink"
        >
          <InitialsAvatar name={personName(user)} size={18} />
          {personName(user)}
        </span>
      ))}
    </div>
  );
}

function toAccessShape(item: ActionItemWithRelations) {
  return {
    leadId: item.leadId,
    createdById: item.createdById,
    visibility: item.visibility,
    assignments: item.assignments.map((a) => ({ userId: a.user.id, role: a.role })),
  };
}

export function ActionHubCard({
  item,
  now,
  viewer,
  isLast = false,
}: {
  item: ActionItemWithRelations;
  now: Date;
  viewer: ActionViewer;
  isLast?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<ActionItemStatus>(item.status);

  useEffect(() => {
    setLocalStatus(item.status);
  }, [item.status]);

  const hubItem = { ...item, status: localStatus };
  const due = dueLabel(hubItem, now);
  const status = effectiveStatus(hubItem, now);
  const strategic = deriveActionStrategicLinkage(item);
  const canEdit = canEditAction(viewer, toAccessShape(item));
  const isComplete = status === "COMPLETE";
  const isDropped = status === "DROPPED";
  const showMarkComplete = canEdit && !isComplete && !isDropped;

  const lead = item.lead ? [item.lead] : [];
  const executing = item.assignments
    .filter((a) => a.role === "EXECUTING")
    .map((a) => a.user)
    .filter((user) => user.id !== item.leadId);

  const goal =
    strategic.initiativeTitle ??
    (item.goalCategory ? item.goalCategory : null);

  const actionSource = deriveActionSource(item);
  const linkedMeetingId = item.meetingId ?? actionSource.meetingId;

  const hasRoles = lead.length > 0 || executing.length > 0;

  const teams = actionItemDepartments(item);
  const teamBadges =
    teams.length > 0
      ? teams
      : [{ id: "unassigned", name: "Unassigned", slug: null as string | null }];

  const actionHref = `/actions/${item.id}`;

  function openAction() {
    router.push(actionHref);
  }

  function stopCardNavigation(event: React.MouseEvent) {
    event.stopPropagation();
  }

  function markComplete(event: React.MouseEvent) {
    event.stopPropagation();
    setError(null);
    startTransition(async () => {
      try {
        setLocalStatus("COMPLETE");
        await updateActionStatus(item.id, "COMPLETE");
        router.refresh();
      } catch (err) {
        setLocalStatus(item.status);
        setError(err instanceof Error ? err.message : "Could not mark complete.");
      }
    });
  }

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open action: ${item.title}`}
      onClick={openAction}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAction();
        }
      }}
      className={cn(
        "cursor-pointer px-4 py-3.5 transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-400",
        !isLast && "border-b border-line-soft"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[14px] font-bold leading-snug text-ink">
          {item.title}
        </span>
        <div className="flex max-w-[52%] shrink-0 flex-wrap justify-end gap-1">
          {teamBadges.map((team) => {
            const color = departmentHeaderColor(team.slug);
            return (
              <span
                key={team.id}
                className="rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.04em]"
                style={{
                  color,
                  background: `${color}14`,
                }}
              >
                {team.name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold"
          style={{ color: due.danger ? "#e5484d" : "#5c5c74" }}
        >
          {due.danger ? (
            <span aria-hidden className="text-[11px]">
              ⚠
            </span>
          ) : null}
          {formatMonthDay(item.deadlineEnd ?? item.deadlineStart)}
        </span>
        {!isComplete ? (
          <ActionStatusBadge item={hubItem} now={now} />
        ) : null}
        {linkedMeetingId ? (
          <ActionMeetingLink
            meetingId={linkedMeetingId}
            meetingTitle={item.meeting?.title ?? null}
            meetingDate={
              item.meeting
                ? new Date(item.meeting.scheduledAt)
                : new Date(item.deadlineEnd ?? item.deadlineStart)
            }
            meetingHref={`/meetings/${linkedMeetingId}`}
          />
        ) : null}
        {showMarkComplete ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            onClick={(event) => markComplete(event)}
            className="h-7 px-2.5 text-[11px]"
          >
            Mark as complete
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="m-0 mt-1.5 text-[12px] text-blocked-700">
          {error}
        </p>
      ) : null}

      {goal ? (
        <p className="m-0 mt-2 text-[12px] font-medium text-brand-800">
          Goal: {goal}
        </p>
      ) : null}

      {item.chapter ? (
        <p className="m-0 mt-2 text-[12px] font-medium text-ink-muted">
          Chapter:{" "}
          <a
            href={`/admin/chapters/${item.chapter.id}`}
            onClick={stopCardNavigation}
            className="font-semibold text-brand-700 hover:underline"
          >
            {item.chapter.name}
          </a>
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        {hasRoles ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <RolePills label="Lead" users={lead} />
            <RolePills label="Executing" users={executing} />
          </div>
        ) : (
          <span />
        )}
        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[#b4b4c6]">
          💬 {item.comments.length}
        </span>
      </div>
    </article>
  );
}
