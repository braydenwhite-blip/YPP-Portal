import Link from "next/link";
import { notFound } from "next/navigation";

import { InitiativeActionsPanel } from "@/components/people-strategy/initiative-actions-panel";
import {
  InitiativeHealthBadge,
  ProgressBar,
} from "@/components/people-strategy/strategic-initiatives";
import { StrategicWorkspaceHeader } from "@/components/people-strategy/strategic-workspace-nav";
import { StatCard } from "@/components/people-strategy/stat-card";
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
  return { title: def ? `${def.title} · Initiatives` : "Initiative · Operations" };
}

/**
 * One initiative = the plan. Actions on this page are the work under that plan.
 */
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

  return (
    <div className="page-shell" style={{ maxWidth: 900 }}>
      <StrategicWorkspaceHeader
        current="initiatives"
        breadcrumbs={[
          { label: "Initiatives", href: "/operations/initiatives" },
          { label: summary.title },
        ]}
        eyebrow={`Plan · ${summary.areaLabel}`}
        title={summary.title}
        subtitle={summary.description}
        meta={
          <>
            <InitiativeHealthBadge health={summary.health} />
            <span style={{ marginLeft: 8 }}>
              {summary.progress.percent}% complete · owner {summary.owner ?? "unassigned"}
            </span>
          </>
        }
      />

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <StatCard label="Open actions" value={summary.counts.openActions} icon="layers" tone="accent" />
        <StatCard
          label="Overdue"
          value={summary.counts.overdueActions}
          icon="clock"
          tone={summary.counts.overdueActions > 0 ? "danger" : "default"}
        />
        <StatCard label="Progress" value={`${summary.progress.percent}%`} icon="target" />
      </div>

      <div className="card" style={{ marginTop: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar percent={summary.progress.percent} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {summary.progress.completedActions}/{summary.progress.totalTracked} actions done
          </span>
        </div>
        {topRec ? (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ypp-purple, #6b21c8)" }}>Next: </strong>
            {topRec.title} — {topRec.detail}
          </p>
        ) : (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
            {summary.healthExplanation.headline}
          </p>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <InitiativeActionsPanel
          initiative={def}
          actions={actions}
          now={now}
          canCreate={canCreate}
          assignableUsers={assignableUsers}
          departments={departments}
          currentUserId={viewer.id}
        />
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--muted)" }}>
        <Link href="/operations/initiatives">← All initiatives</Link>
      </p>
    </div>
  );
}
