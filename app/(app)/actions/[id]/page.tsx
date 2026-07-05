import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import ActionDetailCard, {
  type ActionDetailDTO,
  type RelatedActionLite,
} from "@/components/people-strategy/action-detail-card";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import { deriveActionSource, deriveActionStrategicLinkage } from "@/lib/people-strategy/action-source";
import {
  getActionItemById,
  getActionsForEntity,
  getActionsForMeeting,
  listActionAssignableUsers,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { ACTION_VISIBILITY_LABELS, isRelatedEntityType } from "@/lib/people-strategy/constants";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { effectiveDeadline } from "@/lib/people-strategy/my-actions-selectors";
import {
  canApproveActionCompletion,
  isPendingCompletionApproval,
} from "@/lib/people-strategy/action-approval";
import {
  canAssignAction,
  canEditAction,
  canDeleteAction,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { departmentHeaderColor } from "@/lib/people-strategy/actions-hub-grouping";
import {
  ActionStatusBadge,
} from "@/components/people-strategy/action-presentation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action" };

type PageProps = {
  params: Promise<{ id: string }>;
};

type PersonSource = {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
  title?: string | null;
  profile?: { avatarUrl: string | null } | null;
};

function personDTO(person: PersonSource | null) {
  if (!person) {
    return {
      id: "system",
      name: "System",
      email: "",
      primaryRole: null as string | null,
      title: null as string | null,
      avatarUrl: null as string | null,
    };
  }
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    primaryRole: person.primaryRole,
    title: person.title ?? null,
    avatarUrl: person.profile?.avatarUrl ?? null,
  };
}

function uniquePeople(people: ReturnType<typeof personDTO>[]) {
  const seen = new Set<string>();
  return people.filter((person) => {
    if (seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

function toActionShape(item: NonNullable<Awaited<ReturnType<typeof getActionItemById>>>) {
  return {
    leadId: item.leadId,
    createdById: item.createdById,
    visibility: item.visibility,
    assignments: item.assignments.map((assignment) => ({
      userId: assignment.user.id,
      role: assignment.role,
    })),
  };
}

function toDetailDTO(
  item: NonNullable<Awaited<ReturnType<typeof getActionItemById>>>
): ActionDetailDTO {
  const lead = personDTO(item.lead);
  const leadAssignments = item.assignments
    .filter((assignment) => assignment.role === "LEAD")
    .map((assignment) => personDTO(assignment.user));
  const executing = item.assignments
    .filter((assignment) => assignment.role === "EXECUTING")
    .map((assignment) => personDTO(assignment.user));

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    successDefinition: item.successDefinition,
    goalCategory: item.goalCategory,
    actionType: item.actionType,
    departmentName: item.department?.name ?? "Unassigned",
    departmentSlug: item.department?.slug ?? null,
    status: item.status,
    priority: item.priority,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
    approvedByName: item.approvedBy?.name?.trim() || item.approvedBy?.email || null,
    deadlineStart: item.deadlineStart.toISOString(),
    deadlineEnd: item.deadlineEnd ? item.deadlineEnd.toISOString() : null,
    visibility: item.visibility,
    officerMeetingId: item.meetingId,
    officerMeetingTitle: item.meeting?.title ?? null,
    officerMeetingDate: item.meeting?.scheduledAt ? item.meeting.scheduledAt.toISOString() : null,
    strategicInitiativeId: item.strategicInitiativeId,
    strategicProjectId: item.strategicProjectId,
    chapterId: item.chapterId,
    chapterName: item.chapter?.name ?? null,
    chapterLifecycle: item.chapter?.lifecycleStatus ?? null,
    relatedEntityType: item.relatedEntityType,
    relatedEntityId: item.relatedEntityId,
    relatedEntityLabel: null,
    relatedEntityHref: null,
    relatedArea: null,
    flaggedAt: item.flaggedAt ? item.flaggedAt.toISOString() : null,
    lead,
    people: {
      lead: uniquePeople([lead, ...leadAssignments]),
      executing: uniquePeople(executing),
    },
    comments: item.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      type: comment.type,
      createdAt: comment.createdAt.toISOString(),
      author: personDTO(comment.author),
    })),
    fileLinks: item.fileLinks.map((file) => ({
      id: file.id,
      label: file.label,
      url: file.url,
      addedAt: file.addedAt.toISOString(),
      addedBy: personDTO(file.addedBy),
    })),
  };
}

function toLiteAction(item: ActionItemWithRelations, now: Date): RelatedActionLite {
  return {
    id: item.id,
    title: item.title,
    status: effectiveStatus(item, now),
    dueISO: effectiveDeadline(item).toISOString(),
    leadName: item.lead?.name ?? item.lead?.email ?? "Unassigned",
  };
}

export default async function ActionDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isActionTrackerEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  const item = await getActionItemById(id, viewer);
  if (!item) notFound();

  const actionShape = toActionShape(item);
  const canEdit = canEditAction(viewer, actionShape);
  const canAssign = canAssignAction(viewer);
  const canDelete = canDeleteAction(viewer, actionShape);
  const closeHref = "/actions";

  const assignableUsers = canEdit || canAssign ? await listActionAssignableUsers() : [];

  const now = new Date();
  const detail = toDetailDTO(item);
  const status = effectiveStatus(item, now);
  const due = effectiveDeadline(item);
  const overdue = status === "OVERDUE";
  const strategic = deriveActionStrategicLinkage(item);
  const goal =
    strategic.initiativeTitle ?? (item.goalCategory ? item.goalCategory : null);
  const deptColor = departmentHeaderColor(item.department?.slug ?? null);

  const hasEntity =
    item.relatedEntityType != null &&
    item.relatedEntityId != null &&
    isRelatedEntityType(item.relatedEntityType);

  const [summary, sameEntityRaw, sameMeetingRaw] = await Promise.all([
    hasEntity
      ? loadRelatedEntitySummary(item.relatedEntityType!, item.relatedEntityId!).catch(() => null)
      : Promise.resolve(null),
    hasEntity
      ? getActionsForEntity(item.relatedEntityType as never, item.relatedEntityId!, viewer).catch(
          () => [] as ActionItemWithRelations[]
        )
      : Promise.resolve([] as ActionItemWithRelations[]),
    (() => {
      const meetingId = item.meetingId ?? deriveActionSource(item).meetingId;
      return meetingId
        ? getActionsForMeeting(meetingId, viewer).catch(() => [] as ActionItemWithRelations[])
        : Promise.resolve([] as ActionItemWithRelations[]);
    })(),
  ]);

  if (summary) {
    detail.relatedEntityLabel = summary.label;
    detail.relatedEntityHref = summary.href;
  }

  const sameEntityActions = sameEntityRaw
    .filter((a) => a.id !== item.id)
    .slice(0, 6)
    .map((a) => toLiteAction(a, now));
  const sameMeetingActions = sameMeetingRaw
    .filter((a) => a.id !== item.id)
    .slice(0, 6)
    .map((a) => toLiteAction(a, now));

  const actionSource = deriveActionSource(item);
  const linkedMeetingId = item.meetingId ?? actionSource.meetingId;

  const canApproveCompletion =
    canApproveActionCompletion(viewer) && isPendingCompletionApproval(item);

  return (
    <div className={`${skin.portalSkin} ${skin.fadeIn}`}>
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 pb-12 pt-4">
        <Link
          href={closeHref}
          className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
        >
          ← All actions
        </Link>

        <header
          className="rounded-[14px] border border-line-card bg-surface px-5 py-4 shadow-card"
          style={{ borderLeft: `4px solid ${deptColor}` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: deptColor }}
                />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                  {detail.departmentName}
                </span>
              </div>
              <h1 className="m-0 text-[22px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
                {item.title}
              </h1>
            </div>
            <span className="shrink-0 rounded-md bg-brand-50 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-brand-800">
              {ACTION_VISIBILITY_LABELS[item.visibility]}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 text-[13px] font-semibold"
              style={{ color: overdue ? "#e5484d" : "#9a9ab0" }}
            >
              {overdue ? <span aria-hidden>⚠</span> : null}
              {overdue ? "Overdue · " : ""}
              {formatMonthDay(due)}
            </span>
            <ActionStatusBadge item={item} now={now} />
            {linkedMeetingId ? (
              <Link
                href={`/meetings/${linkedMeetingId}`}
                className="inline-flex items-center rounded-md bg-[#fdf8ec] px-2 py-1 text-[11px] font-semibold text-[#7a5d00] no-underline hover:bg-[#f9f0dc]"
              >
                Meeting linked
              </Link>
            ) : null}
          </div>

          {goal ? (
            <p className="m-0 mt-2.5 text-[13px] font-medium text-brand-800">Goal: {goal}</p>
          ) : null}
        </header>

        <ActionDetailCard
          item={detail}
          canEdit={canEdit}
          canAssign={canAssign}
          canDelete={canDelete}
          closeHref={closeHref}
          assignableUsers={assignableUsers}
          sameEntityActions={sameEntityActions}
          sameMeetingActions={sameMeetingActions}
          variant="hub"
          canApproveCompletion={canApproveCompletion}
        />
      </div>
    </div>
  );
}
