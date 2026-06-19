import { notFound, redirect } from "next/navigation";

import ActionDetailCard, {
  type ActionDetailDTO,
  type RelatedActionLite,
} from "@/components/people-strategy/action-detail-card";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import {
  PrimaryFocusCard,
  SimpleListCard,
  SimpleRow,
  SimpleSurface,
  type SimpleAction,
} from "@/components/command-center/simple";
import { ActionIntelPanel } from "@/components/people-strategy/action-intel-panel";
import { StrategicContextSection } from "@/components/people-strategy/strategic-context";
import { ButtonLink, PageHeaderV2, type StatusTone } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { getSession } from "@/lib/auth-supabase";
import {
  isActionTrackerEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { deriveActionSignals } from "@/lib/people-strategy/action-attention";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import {
  deriveActionNextMove,
  deriveActionQualityLabels,
  deriveActionUrgency,
} from "@/lib/people-strategy/action-intel";
import {
  deriveActionSource,
  deriveActionStrategicLinkage,
} from "@/lib/people-strategy/action-source";
import {
  getActionItemById,
  getActionsForEntity,
  getActionsForMeeting,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { ACTION_STATUS_LABELS, isRelatedEntityType } from "@/lib/people-strategy/constants";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import {
  areaForRelatedEntityType,
  operationalAreaLabel,
} from "@/lib/people-strategy/operational-context";
import { effectiveDeadline } from "@/lib/people-strategy/my-actions-selectors";
import {
  canEditAction,
  canDeleteAction,
  canFlagAction,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { deriveStrategicContextForAction } from "@/lib/people-strategy/strategic-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action · Work" };

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

const STATUS_TONE: Record<string, StatusTone> = {
  OVERDUE: "danger",
  BLOCKED: "danger",
  IN_PROGRESS: "info",
  NOT_STARTED: "neutral",
  COMPLETE: "success",
  DROPPED: "neutral",
};

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

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
    successDefinition: item.successDefinition,
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
    strategicInitiativeId: item.strategicInitiativeId,
    strategicProjectId: item.strategicProjectId,
    relatedEntityType: item.relatedEntityType,
    relatedEntityId: item.relatedEntityId,
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

function ownerLabel(item: NonNullable<Awaited<ReturnType<typeof getActionItemById>>>): string {
  return item.lead?.name ?? item.lead?.email ?? "Unassigned";
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
  if (!actionShape) notFound();

  const canEdit = canEditAction(viewer, actionShape);
  const canDelete = canDeleteAction(viewer, actionShape);
  const canFlag = canFlagAction(viewer, actionShape);
  const officer = isOfficerTier(viewer);
  const closeHref = officer ? "/actions?who=all" : "/actions";

  const now = new Date();
  const detail = toDetailDTO(item);
  const status = effectiveStatus(item, now);
  const due = effectiveDeadline(item);
  const dueLabel =
    status === "OVERDUE" ? "Overdue" : `Due ${formatMonthDay(due)}`;

  const attentionSignals = deriveActionSignals(item, now);
  const topSignal =
    attentionSignals.length > 0
      ? [...attentionSignals].sort(
          (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        )[0]
      : null;

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

  const strategicContext =
    officer && isStrategicInitiativesEnabled() ? deriveStrategicContextForAction(item) : null;

  const intel = {
    nextMove: deriveActionNextMove(item, now),
    labels: deriveActionQualityLabels(item, now),
    source: deriveActionSource(item),
    linkage: deriveActionStrategicLinkage(item),
    urgency: deriveActionUrgency(item, now),
  };
  const intelCtaHref = canEdit ? `/actions/${item.id}/edit` : `/actions/${item.id}`;
  const meetingHref = item.officerMeetingId ? `/actions/meetings/${item.officerMeetingId}` : null;

  const focusReason = topSignal
    ? `${topSignal.reason}. Next: ${topSignal.nextStep}`
    : `${intel.nextMove.move} — ${intel.nextMove.why}`;

  const focus = (
    <PrimaryFocusCard
      eyebrow={topSignal ? "Needs attention" : "Next step"}
      title={item.title}
      reason={focusReason}
      icon={topSignal?.severity === "critical" || status === "OVERDUE" ? "bolt" : "target"}
      tone={status === "COMPLETE" ? "success" : "brand"}
      ctaLabel={canEdit ? intel.nextMove.ctaLabel : "Back to actions"}
      ctaHref={canEdit ? `/actions/${item.id}/edit` : closeHref}
    />
  );

  const calmRows = [
    <SimpleRow
      key="lead"
      href={item.leadId ? `/people/${item.leadId}` : `/actions/${item.id}`}
      icon="user"
      name={ownerLabel(item)}
      what="Lead"
      status={{
        label: ACTION_STATUS_LABELS[status] ?? status,
        tone: STATUS_TONE[status] ?? "neutral",
      }}
      meta={dueLabel}
    />,
    ...(item.officerMeetingId
      ? [
          <SimpleRow
            key="meeting"
            href={`/actions/meetings/${item.officerMeetingId}`}
            icon="calendar"
            name={item.officerMeeting?.title ?? "Source meeting"}
            what="From meeting"
          />,
        ]
      : []),
    ...(detail.relatedEntityHref && detail.relatedEntityLabel
      ? [
          <SimpleRow
            key="related"
            href={detail.relatedEntityHref}
            icon="layers"
            name={detail.relatedEntityLabel}
            what={detail.relatedArea ?? "Related"}
          />,
        ]
      : []),
    ...sameEntityActions.slice(0, 2).map((related) => (
      <SimpleRow
        key={related.id}
        href={`/actions/${related.id}`}
        icon="bolt"
        name={related.title}
        what={related.leadName}
        status={{
          label: ACTION_STATUS_LABELS[related.status] ?? related.status,
          tone: STATUS_TONE[related.status] ?? "neutral",
        }}
      />
    )),
  ];

  const calm = <SimpleListCard title="At a glance">{calmRows}</SimpleListCard>;

  const strip: SimpleAction[] = [
    ...(canEdit
      ? [{ label: "Edit action", href: `/actions/${item.id}/edit`, icon: "bolt" as const, primary: true }]
      : []),
    { label: "All actions", href: closeHref, icon: "layers" as const },
    { label: "My queue", href: "/work/queue?queue=my", icon: "list" as const },
  ];

  return (
    <div className={skin.portalSkin}>
    <SimpleSurface
      maxWidth={720}
      header={
        <div className="flex flex-col gap-4">
          <PageHeaderV2
            eyebrow="Work"
            backHref={closeHref}
            backLabel="Actions"
            title="Action"
            subtitle={`${ownerLabel(item)} · ${dueLabel}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <ButtonLink href={`/actions/${item.id}/edit`} variant="secondary" size="sm">
                    Edit
                  </ButtonLink>
                ) : null}
                <CommandModeToggle />
              </div>
            }
          />
        </div>
      }
      focus={focus}
      calm={calm}
      actions={strip}
      browseLabel="Update & full detail"
      browseHint="Status, people, comments, files, and connected work."
    >
      <div className="flex flex-col gap-5">
        <ActionDetailCard
          item={detail}
          canEdit={canEdit}
          canDelete={canDelete}
          canFlag={canFlag}
          closeHref={closeHref}
          sameEntityActions={sameEntityActions}
          sameMeetingActions={sameMeetingActions}
          calmLayout
        />
        {officer ? (
          <div className="flex flex-col gap-4">
            <ActionIntelPanel
              nextMove={intel.nextMove}
              labels={intel.labels}
              source={intel.source}
              linkage={intel.linkage}
              urgency={intel.urgency}
              ctaHref={intelCtaHref}
              meetingHref={meetingHref}
            />
            {strategicContext ? (
              <StrategicContextSection context={strategicContext} kind="action" />
            ) : null}
          </div>
        ) : null}
      </div>
    </SimpleSurface>
    </div>
  );
}
