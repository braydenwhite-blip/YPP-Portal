import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAboutThis } from "@/components/help-agent/ask-about-this";
import { InitiativeActionsPanel } from "@/components/people-strategy/initiative-actions-panel";
import {
  InitiativeAttentionBanner,
  InitiativeMeetingsSection,
  InitiativeSummaryHead,
} from "@/components/people-strategy/initiative-detail-360";
import {
  MilestoneList,
  OwnershipPanel,
  RecommendationsList,
  RiskPanel,
  StrategicTimelineView,
} from "@/components/people-strategy/strategic-initiatives";
import {
  ButtonLink,
  PageHeaderV2,
  RecordSection,
  StatusBadge,
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
import { primaryNextStep } from "@/lib/people-strategy/strategic-initiative-attention";
import { getInitiativePageData } from "@/lib/people-strategy/strategic-initiative-queries";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { loadInitiativeWeeklyBriefSummaries } from "@/lib/people-strategy/weekly-team-briefs";

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

/** One initiative — the single place to understand it: progress, milestones, actions, meetings, owners, blockers. */
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
  const weeklyBriefs = await loadInitiativeWeeklyBriefSummaries(initiativeId, now).catch(() => []);

  const { def, summary, actions } = pageData;

  const healthBadgeTone =
    summary.health.tone === "overdue"
      ? "danger"
      : summary.health.tone === "warning"
        ? "warning"
        : summary.health.tone === "success"
          ? "success"
          : "neutral";

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 pb-10">
      <PageHeaderV2
        eyebrow="Initiatives"
        backHref="/operations/initiatives"
        backLabel="All initiatives"
        title={summary.title}
        subtitle={`Next step: ${primaryNextStep(summary)}`}
        actions={
          <div className="flex items-center gap-2">
            <AskAboutThis entityType="initiative" entityId={initiativeId} />
            <ButtonLink
              href={`/actions?initiative=${initiativeId}&who=all`}
              variant="ghost"
              size="sm"
            >
              All actions →
            </ButtonLink>
          </div>
        }
      >
        <StatusBadge tone={healthBadgeTone}>{summary.statusLabel}</StatusBadge>
      </PageHeaderV2>

      <InitiativeAttentionBanner initiative={summary} now={now} />

      <InitiativeSummaryHead initiative={summary} />

      <RecordSection
        id="milestones"
        title="Milestones"
        description="The progress path — completed, current, and upcoming checkpoints."
      >
        <MilestoneList milestones={summary.milestones} />
      </RecordSection>

      <InitiativeActionsPanel
        initiative={def}
        milestones={summary.milestones}
        actions={actions}
        now={now}
        canCreate={canCreate}
        assignableUsers={assignableUsers}
        departments={departments}
        currentUserId={viewer.id}
      />

      <InitiativeMeetingsSection initiative={summary} />

      {weeklyBriefs.length ? (
        <RecordSection
          id="weekly-team-briefs"
          title="Teams & this week"
          description="Team Meeting workspaces for the current reporting week."
        >
          <div className="grid gap-3">
            {weeklyBriefs.map((brief) => (
              <Link
                key={brief.workstreamId}
                href={brief.href}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 no-underline transition hover:border-brand-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-sm font-bold text-ink">{brief.workstreamTitle}</p>
                    {brief.workstreamDescription ? (
                      <p className="m-0 mt-1 text-sm text-ink-muted">{brief.workstreamDescription}</p>
                    ) : null}
                  </div>
                  <StatusBadge tone={brief.status === "FINALIZED" ? "success" : brief.status === "SUBMITTED" ? "warning" : "neutral"}>
                    {brief.status.replaceAll("_", " ")}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
                  <span>{brief.taskCount} task{brief.taskCount === 1 ? "" : "s"}</span>
                  <span>{brief.readyTasks} ready for team</span>
                  <span>{brief.officerReady} ready for officers</span>
                  <span>{brief.preparedCount} prepared item{brief.preparedCount === 1 ? "" : "s"}</span>
                  {brief.blockers ? <span className="text-red-700">{brief.blockers} blocker{brief.blockers === 1 ? "" : "s"}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </RecordSection>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <OwnershipPanel ownership={summary.ownership} />
        <RiskPanel risk={summary.risk} />
      </div>

      <RecordSection
        id="timeline"
        title="Activity timeline"
        description="Meetings, decisions, completed actions, and milestones reached — newest first."
      >
        <StrategicTimelineView timeline={summary.timeline} />
      </RecordSection>

      <RecordSection
        id="next-steps"
        title="Recommended next steps"
        description="Concrete moves to keep this initiative on track."
      >
        <RecommendationsList recommendations={summary.recommendations} />
      </RecordSection>

      <p className="m-0 text-[12.5px] text-ink-muted">
        <Link
          href="/operations/initiatives"
          className="font-semibold text-brand-700 no-underline hover:underline"
        >
          All initiatives
        </Link>
      </p>
    </div>
  );
}
