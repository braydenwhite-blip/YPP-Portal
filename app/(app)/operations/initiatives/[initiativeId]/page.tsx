import Link from "next/link";
import { notFound } from "next/navigation";

import { InitiativeActionsPanel } from "@/components/people-strategy/initiative-actions-panel";
import { ProgressBar } from "@/components/people-strategy/strategic-initiatives";
import {
  ButtonLink,
  KeyFactsGrid,
  PageHeaderV2,
  RecordSection,
  StatusBadge,
  type KeyFact,
} from "@/components/ui-v2";
import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import {
  canCreateAction,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";
import { getInitiativePageData } from "@/lib/people-strategy/strategic-initiative-queries";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const def = getInitiativeDef(initiativeId);
  return { title: def ? `${def.title} · Initiatives` : "Initiative · Work" };
}

/** One initiative = the plan. Actions on this page are the work under that plan. */
export default async function StrategicInitiativeDetailPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  if (!isOperationsHubEnabled() || !isActionTrackerEnabled() || !isStrategicInitiativesEnabled()) {
    notFound();
  }

  const sessionUser = await requireOfficer().catch(() => null);
  if (!sessionUser) notFound();

  const viewer: ActionViewer = {
    id: sessionUser.id,
    roles: sessionUser.roles,
    primaryRole: sessionUser.primaryRole,
    adminSubtypes: sessionUser.adminSubtypes,
  };

  const { initiativeId } = await params;
  const now = new Date();
  const canCreate = canCreateAction(viewer);

  const [pageData, assignableUsers, departments] = await Promise.all([
    getInitiativePageData(initiativeId, viewer, { now }),
    canCreate ? listActionAssignableUsers() : Promise.resolve([]),
    canCreate ? listActionDepartments() : Promise.resolve([]),
  ]);

  if (!pageData) notFound();

  const { def, summary, actions } = pageData;
  const topRec = summary.recommendations[0];

  const healthBadgeTone =
    summary.health.tone === "overdue"
      ? "danger"
      : summary.health.tone === "warning"
        ? "warning"
        : summary.health.tone === "success"
          ? "success"
          : "neutral";

  const facts: KeyFact[] = [
    {
      label: "Open actions",
      value: summary.counts.openActions,
      href: `/actions?initiative=${initiativeId}&who=all`,
    },
    {
      label: "Overdue",
      value: summary.counts.overdueActions,
      tone: summary.counts.overdueActions > 0 ? "attention" : "default",
    },
    {
      label: "Progress",
      value: `${summary.progress.percent}%`,
      detail: `${summary.progress.completedActions}/${summary.progress.totalTracked} done`,
    },
    {
      label: "Owner",
      value: summary.owner ?? "Unassigned",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 pb-10">
      <PageHeaderV2
        eyebrow="Initiatives"
        backHref="/work?view=initiatives"
        backLabel="Work"
        title={summary.title}
        subtitle={summary.description}
        actions={
          <ButtonLink
            href={`/actions?initiative=${initiativeId}&who=all`}
            variant="ghost"
            size="sm"
          >
            All actions →
          </ButtonLink>
        }
      >
        <StatusBadge tone={healthBadgeTone}>{summary.health.label}</StatusBadge>
      </PageHeaderV2>

      <KeyFactsGrid facts={facts} className="grid-cols-2 sm:grid-cols-4" />

      <RecordSection title="Plan progress">
        <ProgressBar percent={summary.progress.percent} />
        {topRec ? (
          <p className="mb-0 mt-3 text-[13px] text-ink-muted">
            <span className="font-semibold text-brand-700">Next: </span>
            {topRec.title} — {topRec.detail}
          </p>
        ) : (
          <p className="mb-0 mt-3 text-[13px] text-ink-muted">
            {summary.healthExplanation.headline}
          </p>
        )}
      </RecordSection>

      <InitiativeActionsPanel
        initiative={def}
        actions={actions}
        now={now}
        canCreate={canCreate}
        assignableUsers={assignableUsers}
        departments={departments}
        currentUserId={viewer.id}
      />

      <p className="m-0 text-[12.5px] text-ink-muted">
        <Link href="/operations/initiatives" className="font-semibold text-brand-700 no-underline hover:underline">
          All initiatives
        </Link>
      </p>
    </div>
  );
}
