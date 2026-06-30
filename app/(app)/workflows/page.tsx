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

export const metadata = { title: "Workflows · MissionOS" };

const OFFICER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as const;

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  await requirePageRoles(OFFICER_ROLES as unknown as string[]);

  const all = await listInstances();
  const statusFilter = searchParams?.status?.toUpperCase();
  const filtered = statusFilter
    ? all.filter((i) => i.status === statusFilter)
    : all.filter((i) => i.status !== "CANCELLED");

  const count = (s: string) => all.filter((i) => i.status === s).length;
  const overdue = all.filter((i) => i.isOverdue).length;

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
                {statusFilter
                  ? `${INSTANCE_STATUS_LABELS[statusFilter] ?? statusFilter} workflows`
                  : "Open workflows"}{" "}
                ({filtered.length})
              </span>
              {statusFilter ? (
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
