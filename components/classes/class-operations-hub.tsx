import Link from "next/link";

import ClassOperationsList from "@/app/(app)/admin/classes/class-operations-list";
import type { AdminClassOperationsListItem } from "@/lib/admin-class-operations";
import { getAdminClassOperationsList } from "@/lib/admin-class-operations";
import type { ClassCommandCenter as ClassCommandCenterData } from "@/lib/classes/command-center";
import { ClassCommandCenter } from "@/components/classes/class-command-center";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";

type ProposalQueueItem = Parameters<typeof ClassOperationsList>[0]["proposals"][number];

/** Three views — live catalog, review queue, history. */
export type ClassOperationsTab = "operations" | "review" | "archive";

export type ClassOperationsCounts = {
  needsReview: number;
  needsRevision: number;
  approvedNotPublished: number;
  cancelled: number;
  completed: number;
};

export function deriveClassOperationsCounts(
  operations: AdminClassOperationsListItem[],
  proposals: ProposalQueueItem[]
): ClassOperationsCounts {
  return {
    needsReview: proposals.filter(
      (p) => p.approval?.status === "REQUESTED" || p.approval?.status === "UNDER_REVIEW"
    ).length,
    needsRevision: proposals.filter((p) => p.approval?.status === "CHANGES_REQUESTED").length,
    approvedNotPublished: operations.filter((o) => o.actionFlags.approvedNotPublished).length,
    cancelled: operations.filter((o) => o.actionFlags.isCancelled).length,
    completed: operations.filter((o) => o.actionFlags.isCompleted).length,
  };
}

export function ClassOperationsHub({
  tab,
  operationsPage,
  proposals,
  counts,
  commandCenter,
}: {
  tab: ClassOperationsTab;
  operationsPage: Awaited<ReturnType<typeof getAdminClassOperationsList>>;
  proposals: ProposalQueueItem[];
  counts: ClassOperationsCounts;
  /** Enriched operations view; present only on the operations tab. */
  commandCenter?: ClassCommandCenterData | null;
}) {
  const operations = operationsPage.items;
  const reviewCount =
    counts.needsReview + counts.needsRevision + counts.approvedNotPublished;
  const liveCount = operations.filter(
    (o) => !o.actionFlags.isCancelled && !o.actionFlags.isCompleted
  ).length;

  const tabCounts: Record<ClassOperationsTab, number> = {
    operations: liveCount,
    review: reviewCount,
    archive: counts.cancelled + counts.completed,
  };

  const nextPageHref = operationsPage.nextCursor
    ? `/admin/classes?tab=${tab}&cursor=${encodeURIComponent(operationsPage.nextCursor)}`
    : null;

  const visibleCount =
    tab === "review"
      ? reviewCount
      : tab === "archive"
        ? tabCounts.archive
        : liveCount;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 pb-10">
      <PageHeaderV2
        title="Classes"
        subtitle="How classes fit into chapters, partners, instructors, and curriculum. Setup gaps surface first."
        actions={
          <ButtonLink href="/admin/classes/reports" variant="ghost" size="sm">
            Reports
          </ButtonLink>
        }
      />

      <ClassViewTabs active={tab} counts={tabCounts} />

      <div>
        {tab === "operations" && commandCenter ? (
          <ClassCommandCenter data={commandCenter} />
        ) : (
          <>
            <p className="mb-4 mt-0 text-[12.5px] text-ink-muted">
              {visibleCount} {visibleCount === 1 ? "class" : "classes"}
              {tab === "review" ? " need your attention" : null}
              {tab === "archive" ? " in history" : null}
            </p>

            <ClassOperationsList tab={tab} operations={operations} proposals={proposals} />
          </>
        )}
      </div>

      {nextPageHref && tab !== "review" ? (
        <div className="border-t border-line-soft pt-4 text-center">
          <Link
            href={nextPageHref}
            className="inline-flex rounded-[8px] px-4 py-2 text-[13px] font-semibold text-brand-700 no-underline transition-colors hover:bg-brand-50"
          >
            Load more classes
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ClassViewTabs({
  active,
  counts,
}: {
  active: ClassOperationsTab;
  counts: Record<ClassOperationsTab, number>;
}) {
  const tabs: { value: ClassOperationsTab; label: string }[] = [
    { value: "operations", label: "Live" },
    { value: "review", label: "Review" },
    { value: "archive", label: "Past" },
  ];

  return (
    <nav className="ps-workspace-nav" aria-label="Class views">
      <div className="ps-tabs m-0 w-full max-w-none">
        {tabs.map((t) => {
          const href = t.value === "operations" ? "/admin/classes" : `/admin/classes?tab=${t.value}`;
          const isActive = active === t.value;
          const count = counts[t.value];

          return isActive ? (
            <span key={t.value} className="ps-tab" aria-current="page">
              {t.label}
              {count > 0 ? (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10px] font-bold">
                  {count}
                </span>
              ) : null}
            </span>
          ) : (
            <Link key={t.value} href={href} className="ps-tab">
              {t.label}
              {count > 0 ? (
                <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 text-[10px] font-bold text-brand-700">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
