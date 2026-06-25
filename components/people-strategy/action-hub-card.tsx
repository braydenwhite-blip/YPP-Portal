"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ActionItemStatus } from "@prisma/client";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { deriveActionStrategicLinkage } from "@/lib/people-strategy/action-source";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import { approveActionItem, updateActionStatus } from "@/lib/people-strategy/action-items-actions";
import {
  canApproveAction,
  canAssignAction,
  canEditAction,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  isApprovedAction,
  isRecentlyApprovedOnHub,
  isWaitingForActionApproval,
} from "@/lib/people-strategy/action-approval";
import { ACTION_VISIBILITY_LABELS } from "@/lib/people-strategy/constants";
import {
  ActionStatusBadge,
  InitialsAvatar,
  dueLabel,
} from "@/components/people-strategy/action-presentation";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { Button, cn } from "@/components/ui-v2";
import {
  ActionAssignMeetingButton,
  ActionMeetingLink,
} from "@/components/people-strategy/action-assign-meeting-button";
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
  const [localApprovedAt, setLocalApprovedAt] = useState<Date | null>(item.approvedAt);

  useEffect(() => {
    setLocalStatus(item.status);
    setLocalApprovedAt(item.approvedAt);
  }, [item.status, item.approvedAt]);

  const hubItem = { ...item, status: localStatus, approvedAt: localApprovedAt };
  const due = dueLabel(hubItem, now);
  const status = effectiveStatus(hubItem, now);
  const strategic = deriveActionStrategicLinkage(item);
  const canEdit = canEditAction(viewer, toAccessShape(item));
  const canApprove = canApproveAction(viewer);
  const canAssignMeeting = canAssignAction(viewer);
  const waitingApproval = isWaitingForActionApproval(hubItem);
  const recentlyApproved = isRecentlyApprovedOnHub(hubItem, now);
  const isApproved = isApprovedAction(hubItem);
  const isComplete = status === "COMPLETE";
  const isDropped = status === "DROPPED";
  const showMarkComplete = canEdit && !isComplete && !isDropped;

  const lead = item.lead ? [item.lead] : [];
  const executing = item.assignments
    .filter((a) => a.role === "EXECUTING")
    .map((a) => a.user)
    .filter((user) => user.id !== item.leadId);
  const input = item.assignments.filter((a) => a.role === "INPUT").map((a) => a.user);

  const goal =
    strategic.initiativeTitle ??
    (item.goalCategory ? item.goalCategory : null);

  const actionSource = deriveActionSource(item);
  // Prefer the explicit picker assignment (dedicated meetingId FK); fall back to
  // the source-derived meeting for legacy actions whose provenance is a meeting.
  const linkedMeetingId = item.meetingId ?? actionSource.meetingId;

  const hasRoles = lead.length > 0 || executing.length > 0 || input.length > 0;

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
        setLocalApprovedAt(null);
        await updateActionStatus(item.id, "COMPLETE");
        router.refresh();
      } catch (err) {
        setLocalStatus(item.status);
        setLocalApprovedAt(item.approvedAt);
        setError(err instanceof Error ? err.message : "Could not mark complete.");
      }
    });
  }

  function approve(event: React.MouseEvent) {
    event.stopPropagation();
    setError(null);
    startTransition(async () => {
      try {
        const approvedAt = new Date();
        setLocalApprovedAt(approvedAt);
        await approveActionItem(item.id);
        router.refresh();
      } catch (err) {
        setLocalApprovedAt(item.approvedAt);
        setError(err instanceof Error ? err.message : "Could not approve.");
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
        <span className="shrink-0 rounded-md bg-brand-50 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-brand-800">
          {ACTION_VISIBILITY_LABELS[item.visibility]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold"
          style={{ color: due.danger ? "#e5484d" : "#9a9ab0" }}
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
        {waitingApproval ? (
          <span className="inline-flex h-7 items-center rounded-[9px] border border-amber-300/60 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-900">
            Waiting for approval
          </span>
        ) : null}
        {isApproved ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-[9px] border border-complete-700/30 bg-complete-50 px-2.5 text-[11px] font-semibold text-complete-700">
            <span aria-hidden>✓</span>
            Approved
          </span>
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
        ) : canAssignMeeting ? (
          <ActionAssignMeetingButton actionItemId={item.id} />
        ) : null}
        {waitingApproval && canApprove ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            onClick={approve}
            className="h-7 px-2.5 text-[11px]"
          >
            Approve
          </Button>
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

      {waitingApproval && !canApprove ? (
        <p className="m-0 mt-2 text-[12px] font-medium text-amber-900">
          Waiting for officer approval — it will move to Approved once signed off.
        </p>
      ) : null}

      {recentlyApproved ? (
        <p className="m-0 mt-2 text-[12px] text-ink-muted">
          Approved — this will roll off the main list in a few minutes.
        </p>
      ) : null}

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
            <RolePills label="Input" users={input} />
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
