import { notFound, redirect } from "next/navigation";

import ActionDetailCard, {
  type ActionDetailDTO,
} from "@/components/people-strategy/action-detail-card";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled, isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getActionItemById } from "@/lib/people-strategy/action-queries";
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

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      {/* Persistent tabs so the detail view is reachable-from / returns-to the
          rest of the tracker (comment #17). Officers only — other viewers reach
          a detail page solely from My Actions. */}
      {officer && <ActionTrackerTabs showPeople={showPeople} />}
      <ActionDetailCard
        item={toDetailDTO(item)}
        canEdit={canEdit}
        canFlag={canFlag}
        closeHref={closeHref}
      />
    </div>
  );
}
