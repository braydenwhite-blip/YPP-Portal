"use client";

import { useMemo, useState } from "react";

import { ClassOperationsCardGrid } from "@/components/classes/class-operations-card-grid";
import type { AdminClassOperationsListItem } from "@/lib/admin-class-operations";
import {
  buildClassOperationsCard,
  sortClassOperationsCards,
  type ClassOperationsCardData,
} from "@/lib/classes/class-operations-cards";
import type { ClassSignals } from "@/lib/class-next-action";
import { EmptyStateV2, SearchInputV2, type StatusTone } from "@/components/ui-v2";

type ProposalQueueItem = {
  id: string;
  title: string;
  startDate: Date;
  instructor: { id: string; name: string; email: string } | null;
  approval: {
    status: string;
    requestedAt: Date | null;
  } | null;
};

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function ClassOperationsBoard({
  tab,
  operations,
  proposals,
}: {
  tab: string;
  operations: AdminClassOperationsListItem[];
  proposals: ProposalQueueItem[];
}) {
  const [query, setQuery] = useState("");

  const readyToPublish = useMemo(() => filterByTab(operations, "ready"), [operations]);
  const filteredProposals = useMemo(
    () => filterProposals(proposals, query),
    [proposals, query]
  );
  const filteredReady = useMemo(
    () => filterOperations(readyToPublish, query),
    [readyToPublish, query]
  );
  const filtered = useMemo(
    () => filterOperations(filterByTab(operations, tab), query),
    [operations, tab, query]
  );

  const reviewCards = useMemo(
    () => buildReviewCards(filteredProposals, filteredReady),
    [filteredProposals, filteredReady]
  );
  const operationCards = useMemo(() => cardsFromOperations(filtered), [filtered]);

  if (tab === "review") {
    if (proposals.length === 0 && readyToPublish.length === 0) {
      return (
        <BoardEmpty
          title="Nothing to review"
          body="New proposals and approved drafts will appear here."
        />
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <BoardSearch value={query} onChange={setQuery} />
        {reviewCards.length === 0 ? (
          <BoardEmpty title="No matches" body="Try a different search term." compact />
        ) : (
          <ClassOperationsCardGrid cards={reviewCards} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BoardSearch value={query} onChange={setQuery} />
      {operationCards.length === 0 ? (
        <BoardEmpty
          title={query ? "No matches" : emptyCopy(tab).title}
          body={query ? "Try a different search term." : emptyCopy(tab).body}
        />
      ) : (
        <ClassOperationsCardGrid cards={operationCards} />
      )}
    </div>
  );
}

function BoardSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SearchInputV2
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search classes or instructors…"
      aria-label="Search classes"
      className="h-10 max-w-md rounded-[10px] border-line-soft bg-surface-soft pl-9 text-[14px] shadow-none focus:bg-surface"
    />
  );
}

function BoardEmpty({
  title,
  body,
  compact,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <EmptyStateV2
      tone="neutral"
      className={compact ? "py-8" : undefined}
      title={title}
      body={body}
    />
  );
}

function operationSignals(offering: AdminClassOperationsListItem): ClassSignals {
  return {
    status: offering.status,
    startDate: offering.startDate,
    endDate: offering.endDate,
    hasLeadInstructor: offering.instructor != null,
    sessionCount: offering._count.sessions,
    nextSessionAt: null,
    enrolledCount: offering.confirmedCount,
    partnerLinked: offering.partner != null,
    partnerConfirmationNeeded: false,
    openActionCount: 0,
    overdueActionCount: 0,
    hasReflection: false,
    feedbackCount: 0,
  };
}

function cardsFromOperations(items: AdminClassOperationsListItem[]): ClassOperationsCardData[] {
  return sortClassOperationsCards(
    items.map((offering) =>
      buildClassOperationsCard(offering, {
        signals: operationSignals(offering),
        href: `/admin/classes/${offering.id}`,
      })
    )
  );
}

function buildReviewCards(
  proposals: ProposalQueueItem[],
  readyToPublish: AdminClassOperationsListItem[]
): ClassOperationsCardData[] {
  const proposalCards: ClassOperationsCardData[] = proposals.map((proposal) => {
    const status = summarizeProposalStatus(proposal.approval?.status ?? "REQUESTED");
    return {
      id: proposal.id,
      title: proposal.title,
      locationLine: null,
      statusBadge: mapProposalBadge(status),
      instructorName: proposal.instructor?.name?.split(/\s+/)[0] ?? null,
      curriculumMentorName: null,
      scheduleLabel: proposal.startDate.toLocaleDateString(undefined, DATE_FMT),
      enrollmentLabel: "—",
      setupFooter: { tone: "warning", message: "Proposal awaiting review" },
      href: `/admin/classes/${proposal.id}/review`,
      sortRank: 0,
    };
  });

  return sortClassOperationsCards([...proposalCards, ...cardsFromOperations(readyToPublish)]);
}

function mapProposalBadge(status: {
  label: string;
  tone: StatusTone;
}): ClassOperationsCardData["statusBadge"] {
  if (status.tone === "danger") return { label: status.label, tone: "warning" };
  if (status.tone === "brand") return { label: status.label, tone: "info" };
  if (status.tone === "success") return { label: status.label, tone: "success" };
  return { label: status.label, tone: "info" };
}

function filterOperations(
  items: AdminClassOperationsListItem[],
  query: string
): AdminClassOperationsListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.title,
      item.instructor?.name,
      item.instructor?.email,
      item.chapter?.name,
      item.partner?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function filterProposals(items: ProposalQueueItem[], query: string): ProposalQueueItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [item.title, item.instructor?.name, item.instructor?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function summarizeProposalStatus(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "CHANGES_REQUESTED":
      return { label: "Changes needed", tone: "danger" };
    case "UNDER_REVIEW":
      return { label: "In review", tone: "info" };
    case "APPROVED":
      return { label: "Approved", tone: "success" };
    default:
      return { label: "New proposal", tone: "brand" };
  }
}

function filterByTab(
  operations: AdminClassOperationsListItem[],
  tab: string
): AdminClassOperationsListItem[] {
  switch (tab) {
    case "ready":
      return operations.filter((o) => o.actionFlags.approvedNotPublished);
    case "attention":
      return operations.filter(
        (o) =>
          o.actionFlags.full ||
          o.actionFlags.hasWaitlist ||
          o.actionFlags.missingLocation ||
          o.actionFlags.missingMeetingLink
      );
    case "archive":
      return operations.filter(
        (o) => o.actionFlags.isCancelled || o.actionFlags.isCompleted
      );
    case "operations":
    default:
      return operations.filter(
        (o) => !o.actionFlags.isCancelled && !o.actionFlags.isCompleted
      );
  }
}

function emptyCopy(tab: string): { title: string; body: string } {
  const copy: Record<string, { title: string; body: string }> = {
    operations: {
      title: "No live classes",
      body: "Published and in-progress classes will show up here.",
    },
    archive: {
      title: "No past classes",
      body: "Completed and cancelled classes are kept here.",
    },
  };
  return copy[tab] ?? { title: "Nothing here", body: "No classes in this view." };
}
