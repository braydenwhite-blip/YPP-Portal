import { notFound, redirect } from "next/navigation";

import ActionDetailCard, {
  type ActionDetailDTO,
  type RelatedActionLite,
} from "@/components/people-strategy/action-detail-card";
import { getSession } from "@/lib/auth-supabase";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { deriveStrategicContextForAction } from "@/lib/people-strategy/strategic-context";
import { StrategicContextSection } from "@/components/people-strategy/strategic-context";
import {
  getActionItemById,
  getActionsForEntity,
  getActionsForMeeting,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import { effectiveDeadline } from "@/lib/people-strategy/my-actions-selectors";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import {
  areaForRelatedEntityType,
  operationalAreaLabel,
} from "@/lib/people-strategy/operational-context";
import { isRelatedEntityType } from "@/lib/people-strategy/constants";
import {
  canEditAction,
  canFlagAction,
  isLeadershipOrBoard,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Detail · People Strategy" };

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
  // System-authored audit entries (e.g. the Board roll-up record) have no
  // user; render them as a synthetic "System" person.
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

function toActionShape(item: Awaited<ReturnType<typeof getActionItemById>>) {
  if (!item) return null;
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
  const input = item.assignments
    .filter((assignment) => assignment.role === "INPUT")
    .map((assignment) => personDTO(assignment.user));

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    goalCategory: item.goalCategory,
    actionType: item.actionType,
    departmentName: item.department?.name ?? "Unassigned",
    departmentSlug: item.department?.slug ?? null,
    status: item.status,
    priority: item.priority,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    deadlineStart: item.deadlineStart.toISOString(),
    deadlineEnd: item.deadlineEnd ? item.deadlineEnd.toISOString() : null,
    visibility: item.visibility,
    officerMeetingId: item.officerMeetingId,
    officerMeetingTitle: item.officerMeeting?.title ?? null,
    officerMeetingDate: item.officerMeeting?.date ? item.officerMeeting.date.toISOString() : null,
    relatedEntityType: item.relatedEntityType,
    relatedArea:
      item.relatedEntityType && isRelatedEntityType(item.relatedEntityType)
        ? operationalAreaLabel(areaForRelatedEntityType(item.relatedEntityType))
        : null,
    flaggedAt: item.flaggedAt ? item.flaggedAt.toISOString() : null,
    lead,
    people: {
      lead: uniquePeople([lead, ...leadAssignments]),
      executing: uniquePeople(executing),
      input: uniquePeople(input),
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

  // Step 1: the feature flag is the outer gate. If it is off, this page does
  // not exist to the app.
  if (!isActionTrackerEnabled()) notFound();

  // Step 2: a signed-out visitor goes to login. A signed-in but unauthorized
  // visitor gets notFound below after the per-record guard runs.
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  // Step 3: getActionItemById applies the server-side view guard. It returns
  // null for missing records, unauthorized viewers, and flag-off states.
  const item = await getActionItemById(id, viewer);
  if (!item) notFound();

  const actionShape = toActionShape(item);
  if (!actionShape) notFound();

  const canEdit = canEditAction(viewer, actionShape);
  const canFlag = canFlagAction(viewer, actionShape);
  const officer = isOfficerTier(viewer);
  const closeHref = officer ? "/actions/all" : "/actions";
  const showPeople = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);

  const now = new Date();
  const detail = toDetailDTO(item);

  // Cross-portal connective tissue: resolve the linked entity for a real link +
  // pull the nearby work (same entity / same source meeting) so the action never
  // reads as an island. Each load fails safe.
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
    item.officerMeetingId
      ? getActionsForMeeting(item.officerMeetingId, viewer).catch(
          () => [] as ActionItemWithRelations[]
        )
      : Promise.resolve([] as ActionItemWithRelations[]),
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

  // Strategic context (3.0): which initiative / project does this action ladder
  // up to? Pure derivation from the action's own fields — no DB, officer-only.
  const strategicContext =
    officer && isStrategicInitiativesEnabled() ? deriveStrategicContextForAction(item) : null;

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      {/* Persistent tabs so the detail view is reachable-from / returns-to the
          rest of the tracker (comment #17). Officers only — other viewers reach
          a detail page solely from My Actions. */}
      {officer && <ActionTrackerTabs showPeople={showPeople} />}
      <ActionDetailCard
        item={detail}
        canEdit={canEdit}
        canFlag={canFlag}
        closeHref={closeHref}
        sameEntityActions={sameEntityActions}
        sameMeetingActions={sameMeetingActions}
      />
      {strategicContext ? <StrategicContextSection context={strategicContext} kind="action" /> : null}
    </div>
  );
}
