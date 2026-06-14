"use client";

import Link from "next/link";
import { useState } from "react";

import type { AdminClassOperationsListItem } from "@/lib/admin-class-operations";
import {
  cn,
  EmptyStateV2,
  SearchInputV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";

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

const DOT_BY_TONE: Record<StatusTone, string> = {
  success: "bg-success-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)]",
  danger: "bg-danger-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]",
  warning: "bg-warning-500 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
  info: "bg-info-500 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]",
  brand: "bg-brand-600 shadow-[0_0_0_3px_rgba(107,33,200,0.18)]",
  neutral: "bg-brand-200 shadow-[0_0_0_3px_rgba(107,33,200,0.08)]",
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

  if (tab === "review") {
    const readyToPublish = filterByTab(operations, "ready");
    const filteredProposals = filterProposals(proposals, query);
    const filteredReady = filterOperations(readyToPublish, query);

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
        {filteredProposals.length > 0 ? (
          <BoardSection label="Proposals" count={filteredProposals.length}>
            {filteredProposals.map((proposal) => (
              <ProposalRow key={proposal.id} proposal={proposal} />
            ))}
          </BoardSection>
        ) : null}
        {filteredReady.length > 0 ? (
          <BoardSection label="Ready to publish" count={filteredReady.length}>
            {filteredReady.map((offering) => (
              <li key={offering.id}>
                <OperationRow offering={offering} showEnrolled={false} />
              </li>
            ))}
          </BoardSection>
        ) : null}
        {query && filteredProposals.length === 0 && filteredReady.length === 0 ? (
          <BoardEmpty title="No matches" body="Try a different search term." compact />
        ) : null}
      </div>
    );
  }

  const filtered = filterOperations(filterByTab(operations, tab), query);

  return (
    <div className="flex flex-col gap-4">
      <BoardSearch value={query} onChange={setQuery} />
      {filtered.length === 0 ? (
        <BoardEmpty
          title={query ? "No matches" : emptyCopy(tab).title}
          body={query ? "Try a different search term." : emptyCopy(tab).body}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {filtered.map((offering) => (
            <li key={offering.id}>
              <OperationRow
                offering={offering}
                showEnrolled={tab !== "archive"}
              />
            </li>
          ))}
        </ul>
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
      className="h-10 rounded-[10px] border-line-soft bg-surface-soft pl-9 text-[14px] shadow-none focus:bg-surface"
    />
  );
}

function BoardSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          {label}
        </h2>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
          {count}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{children}</ul>
    </section>
  );
}

function OperationRow({
  offering,
  showEnrolled,
}: {
  offering: AdminClassOperationsListItem;
  showEnrolled: boolean;
}) {
  const status = summarizeOperationStatus(offering);
  const capacity = offering.capacity || 0;
  const fillPct =
    capacity > 0 ? Math.min(100, (offering.confirmedCount / capacity) * 100) : 0;
  const meta = [
    offering.instructor?.name ?? "No instructor",
    offering.chapter?.name,
    offering.startDate.toLocaleDateString(undefined, DATE_FMT),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/admin/classes/${offering.id}`}
      className={cn(
        "group flex items-center gap-4 rounded-[12px] border border-transparent px-4 py-3.5",
        "bg-surface transition-all duration-200",
        "hover:border-line-soft hover:bg-surface-soft hover:shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      )}
    >
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", DOT_BY_TONE[status.tone])}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink group-hover:text-brand-800">
            {offering.title}
          </p>
          <StatusBadge tone={status.tone} title={status.detail} className="hidden sm:inline-flex">
            {status.label}
          </StatusBadge>
        </div>
        <p className="m-0 mt-0.5 truncate text-[13px] text-ink-muted">{meta}</p>
        {showEnrolled ? (
          <div className="mt-2.5 flex max-w-[200px] items-center gap-2.5">
            <div
              className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-brand-50"
              role="presentation"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  fillPct >= 100
                    ? "bg-warning-500"
                    : fillPct >= 80
                      ? "bg-brand-400"
                      : "bg-brand-600"
                )}
                style={{ width: `${Math.max(fillPct, offering.confirmedCount > 0 ? 8 : 0)}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-muted">
              {capacity > 0
                ? `${offering.confirmedCount}/${capacity}`
                : offering.confirmedCount}
              {offering.waitlistedCount > 0 ? ` (+${offering.waitlistedCount})` : ""}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={status.tone} className="sm:hidden">
          {status.label}
        </StatusBadge>
        <Chevron />
      </div>
    </Link>
  );
}

function ProposalRow({ proposal }: { proposal: ProposalQueueItem }) {
  const status = summarizeProposalStatus(proposal.approval?.status ?? "REQUESTED");
  const meta = [
    proposal.instructor?.name ?? "No instructor",
    proposal.startDate.toLocaleDateString(undefined, DATE_FMT),
    proposal.approval?.requestedAt
      ? `Submitted ${proposal.approval.requestedAt.toLocaleDateString(undefined, DATE_FMT)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={`/admin/classes/${proposal.id}/review`}
        className={cn(
          "group flex items-center gap-4 rounded-[12px] border border-transparent px-4 py-3.5",
          "bg-surface transition-all duration-200",
          "hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-card",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        )}
      >
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full", DOT_BY_TONE[status.tone])}
        />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink group-hover:text-brand-800">
            {proposal.title}
          </p>
          <p className="m-0 mt-0.5 truncate text-[13px] text-ink-muted">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span className="hidden rounded-[8px] bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-card transition-colors group-hover:bg-brand-700 sm:inline-block">
            Review
          </span>
          <Chevron />
        </div>
      </Link>
    </li>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0 text-ink-muted/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      icon={
        <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
          <svg aria-hidden className="size-5" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M8 9h8M8 12.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      }
      title={title}
      body={body}
    />
  );
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

function summarizeOperationStatus(
  offering: AdminClassOperationsListItem
): { label: string; tone: StatusTone; detail?: string } {
  const flags = offering.actionFlags;

  if (flags.missingMeetingLink) {
    return { label: "Missing link", tone: "danger", detail: "Add a meeting link before publishing" };
  }
  if (flags.missingLocation) {
    return { label: "Missing location", tone: "danger", detail: "Add a location before publishing" };
  }
  if (flags.needsRevision) return { label: "Changes needed", tone: "warning" };
  if (flags.needsReview) return { label: "Awaiting review", tone: "info" };
  if (flags.approvedNotPublished) return { label: "Ready to publish", tone: "brand" };
  if (flags.isCancelled) return { label: "Cancelled", tone: "neutral" };
  if (flags.isCompleted) return { label: "Completed", tone: "neutral" };
  if (flags.full) return { label: "Full", tone: "warning" };
  if (flags.hasWaitlist) return { label: "Waitlist", tone: "warning" };
  if (offering.status === "IN_PROGRESS") return { label: "In session", tone: "info" };
  if (offering.status === "PUBLISHED" && offering.enrollmentOpen) {
    return { label: "Live", tone: "success" };
  }
  if (offering.status === "PUBLISHED") return { label: "Closed", tone: "neutral" };
  if (flags.startsWithin7Days) return { label: "Starts soon", tone: "warning" };
  if (flags.noEnrollments) return { label: "No signups", tone: "neutral" };
  return { label: "Draft", tone: "neutral" };
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
