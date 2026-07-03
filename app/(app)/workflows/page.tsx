import Link from "next/link";

import { PageHeaderV2 } from "@/components/ui-v2/page-header";
import { ButtonLink } from "@/components/ui-v2/button";
import { CardV2 } from "@/components/ui-v2/card";
import { StatCardV2 } from "@/components/ui-v2/stat-card";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import {
  DataTableShell,
  TableV2,
  TableHeadCell,
  TableCell,
} from "@/components/ui-v2/data-table-shell";
import { EmptyStateV2 } from "@/components/ui-v2/empty-state";
import { requirePageRoles } from "@/lib/page-guards";
import { listInstances } from "@/lib/workflow-engine/queries";
import {
  INSTANCE_STATUS_LABELS,
  INSTANCE_STATUS_TONE,
} from "@/lib/workflow-engine/constants";
import { loadWorkflowAnalyticsInstances } from "@/lib/data-360/workflow-analytics";
import { WORKFLOW_HEALTH_LABELS } from "@/lib/data-360/workflow-analytics-core";
import type { WorkflowHealthStatus } from "@/lib/workflow-engine/health";
import { workflowEntityTypeLabel } from "@/lib/workflow-engine/entity-types";

export const metadata = { title: "Workflows · MissionOS" };

const OFFICER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as const;

type WorkflowRow = {
  id: string;
  title: string;
  templateName: string;
  currentStageName: string | null;
  ownerName: string | null;
  completionPercent: number;
  status: string;
  isOverdue: boolean;
};

const HEALTH_VALUES: WorkflowHealthStatus[] = [
  "BLOCKED",
  "OVERDUE",
  "STALLED",
  "NEEDS_ATTENTION",
  "ON_TRACK",
];

export default async function WorkflowsPage(
  props: {
    searchParams?: Promise<{
      status?: string;
      health?: string;
      chapterId?: string;
      templateId?: string;
      entityType?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  await requirePageRoles(OFFICER_ROLES as unknown as string[]);

  const sp = searchParams ?? {};
  const statusFilter = sp.status?.toUpperCase();
  const healthFilterRaw = sp.health?.toUpperCase();
  const healthFilter = HEALTH_VALUES.find((h) => h === healthFilterRaw) ?? null;
  const chapterId = sp.chapterId || undefined;
  const templateId = sp.templateId || undefined;
  const entityType = sp.entityType?.toUpperCase() || undefined;

  const all = await listInstances();
  const count = (s: string) => all.filter((i) => i.status === s).length;
  const overdue = all.filter((i) => i.isOverdue).length;

  // Health and entity-type filters need the engine-scored instances; the other
  // filters (status / chapter / template) resolve at the query level.
  let filtered: WorkflowRow[];
  let filterLabel: string | null = null;

  if (healthFilter || entityType) {
    const enriched = await loadWorkflowAnalyticsInstances();
    filtered = enriched
      .filter((i) => (healthFilter ? i.health === healthFilter : true))
      .filter((i) => (entityType ? i.entityType === entityType : true))
      .filter((i) => (chapterId ? i.chapterId === chapterId : true))
      .filter((i) => (templateId ? i.templateId === templateId : true))
      .filter((i) => (statusFilter ? i.status === statusFilter : true))
      .map((i) => ({
        id: i.id,
        title: i.title,
        templateName: i.templateName,
        currentStageName: i.currentStageName,
        ownerName: i.ownerName,
        completionPercent: i.completionPercent,
        status: i.status,
        isOverdue: i.health === "OVERDUE",
      }));
    filterLabel = healthFilter
      ? `${WORKFLOW_HEALTH_LABELS[healthFilter]} workflows`
      : `${workflowEntityTypeLabel(entityType ?? null)} workflows`;
  } else {
    const list = await listInstances({
      chapterId,
      templateId,
      status: statusFilter ? [statusFilter] : undefined,
    });
    filtered = (statusFilter ? list : list.filter((i) => i.status !== "CANCELLED")).map((i) => ({
      id: i.id,
      title: i.title,
      templateName: i.templateName,
      currentStageName: i.currentStageName,
      ownerName: i.ownerName,
      completionPercent: i.completionPercent,
      status: i.status,
      isOverdue: i.isOverdue,
    }));
    filterLabel = statusFilter
      ? `${INSTANCE_STATUS_LABELS[statusFilter] ?? statusFilter} workflows`
      : chapterId || templateId
      ? "Filtered workflows"
      : null;
  }

  const hasFilter = Boolean(statusFilter || healthFilter || chapterId || templateId || entityType);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <PageHeaderV2
        eyebrow="MissionOS"
        title="Workflows"
        subtitle="Every business process, run as a reusable workflow."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/workflows/analytics" variant="secondary">
              Analytics
            </ButtonLink>
            <ButtonLink href="/workflows/new">Start workflow</ButtonLink>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCardV2 label="Active" value={count("ACTIVE")} href="/workflows?status=active" accent="brand" />
          <StatCardV2 label="Blocked" value={count("BLOCKED")} href="/workflows?status=blocked" accent="danger" />
          <StatCardV2
            label="Overdue"
            value={overdue}
            detail={overdue > 0 ? "needs attention" : "all on track"}
            href="/workflows"
            accent={overdue > 0 ? "warning" : "neutral"}
          />
          <StatCardV2
            label="Completed"
            value={count("COMPLETED")}
            href="/workflows?status=completed"
            accent="success"
          />
        </div>
      </PageHeaderV2>

      {filtered.length === 0 ? (
        <CardV2 padding="lg">
          <EmptyStateV2
            title="No workflows here yet"
            body="Start a workflow from a published template to see it tracked end to end."
            action={<ButtonLink href="/workflows/new">Start workflow</ButtonLink>}
          />
        </CardV2>
      ) : (
        <DataTableShell
          header={
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink">
                {filterLabel ?? "Open workflows"} ({filtered.length})
              </span>
              {hasFilter ? (
                <Link href="/workflows" className="text-[12px] text-brand-700 hover:underline">
                  Clear filter
                </Link>
              ) : null}
            </div>
          }
        >
          <TableV2>
            <thead>
              <tr>
                <TableHeadCell>Workflow</TableHeadCell>
                <TableHeadCell>Template</TableHeadCell>
                <TableHeadCell>Stage</TableHeadCell>
                <TableHeadCell>Owner</TableHeadCell>
                <TableHeadCell>Progress</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <TableCell>
                    <Link href={`/workflows/${i.id}`} className="font-medium text-brand-700 hover:underline">
                      {i.title}
                    </Link>
                  </TableCell>
                  <TableCell>{i.templateName}</TableCell>
                  <TableCell>{i.currentStageName ?? "—"}</TableCell>
                  <TableCell>{i.ownerName ?? "Unassigned"}</TableCell>
                  <TableCell>{i.completionPercent}%</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusBadge tone={INSTANCE_STATUS_TONE[i.status] ?? "neutral"}>
                        {INSTANCE_STATUS_LABELS[i.status] ?? i.status}
                      </StatusBadge>
                      {i.isOverdue ? <StatusBadge tone="danger">overdue</StatusBadge> : null}
                    </span>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </TableV2>
        </DataTableShell>
      )}
    </div>
  );
}
