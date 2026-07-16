import { prisma } from "@/lib/prisma";
import { PositionType } from "@prisma/client";
import { requireAdminPage } from "@/lib/page-guards";
import { isHiddenStaffPositionTitle } from "@/lib/applicant-board-kind";
import {
  AdvancedFilters,
  ButtonLink,
  FilterChipLink,
  MetricStrip,
  TrackerShell,
  ViewSwitcher,
} from "@/components/ui-v2";
import ApplicationsView from "./applications-view";

type ApplicationFilters = {
  type?: string;
  chapterProposal?: string;
  status?: string;
};

const POSITION_TYPES: PositionType[] = [
  "INSTRUCTOR",
  "CHAPTER_PRESIDENT",
  "MENTOR",
  "STAFF",
  "GLOBAL_ADMIN",
];

const TYPE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  MENTOR: "Mentor",
  STAFF: "Staff",
  GLOBAL_ADMIN: "Admin",
};

// Each summary card / chip maps to one or more application statuses.
const STATUS_FILTERS: Record<string, { label: string; statuses: string[] }> = {
  submitted: { label: "Submitted", statuses: ["SUBMITTED"] },
  "in-review": { label: "In review", statuses: ["UNDER_REVIEW"] },
  interviewing: {
    label: "Interviewing",
    statuses: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"],
  },
  accepted: { label: "Accepted", statuses: ["ACCEPTED"] },
  rejected: { label: "Rejected", statuses: ["REJECTED"] },
};

function normalizeType(value: string | undefined): PositionType | null {
  if (!value) return null;
  return POSITION_TYPES.includes(value as PositionType) ? (value as PositionType) : null;
}

function applicationsHref(params: {
  type?: string | null;
  chapterProposal?: boolean;
  status?: string;
}): string {
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  if (params.chapterProposal) search.set("chapterProposal", "true");
  if (params.status) search.set("status", params.status);
  const qs = search.toString();
  return qs ? `/admin/applications?${qs}` : "/admin/applications";
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<ApplicationFilters>;
}) {
  const params = await searchParams;
  await requireAdminPage();

  const selectedType = normalizeType(params.type);
  const chapterProposalOnly = params.chapterProposal === "true";
  const statusKey =
    params.status && STATUS_FILTERS[params.status] ? params.status : undefined;

  // One query scoped by type / chapter-proposal (NOT status), so the summary
  // counts stay a stable overview; the status filter is then applied in memory
  // to the list itself.
  const baseApplications = (
    await prisma.application.findMany({
    where: {
      archivedAt: null,
      ...(selectedType ? { position: { type: selectedType } } : {}),
      ...(chapterProposalOnly
        ? {
            position: {
              ...(selectedType ? { type: selectedType } : {}),
              chapterId: null,
              type: "CHAPTER_PRESIDENT",
            },
          }
        : {}),
    },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      position: {
        include: {
          chapter: {
            select: { name: true },
          },
        },
      },
      interviewSlots: {
        orderBy: { scheduledAt: "asc" },
      },
      decision: {
        select: { accepted: true, decidedAt: true, hiringChairStatus: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  })
  ).filter((app) => !isHiddenStaffPositionTitle(app.position.title));

  const statusCounts = {
    submitted: baseApplications.filter((a) => a.status === "SUBMITTED").length,
    inReview: baseApplications.filter((a) => a.status === "UNDER_REVIEW").length,
    interviewing: baseApplications.filter((a) =>
      ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(a.status),
    ).length,
    accepted: baseApplications.filter((a) => a.status === "ACCEPTED").length,
    rejected: baseApplications.filter((a) => a.status === "REJECTED").length,
  };

  const applications = statusKey
    ? baseApplications.filter((a) =>
        STATUS_FILTERS[statusKey].statuses.includes(a.status),
      )
    : baseApplications;

  // Serialize dates for client components
  const serialized = applications.map((app) => ({
    ...app,
    submittedAt: app.submittedAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    interviewSlots: app.interviewSlots.map((slot) => ({
      ...slot,
      scheduledAt: slot.scheduledAt.toISOString(),
      confirmedAt: slot.confirmedAt?.toISOString() ?? null,
      completedAt: slot.completedAt?.toISOString() ?? null,
      createdAt: slot.createdAt.toISOString(),
    })),
    decision: app.decision
      ? {
          ...app.decision,
          decidedAt: app.decision.decidedAt.toISOString(),
        }
      : null,
  }));

  const activeFilterCount = (chapterProposalOnly ? 1 : 0) + (statusKey ? 1 : 0);
  const countLabel = [
    `${applications.length} application${applications.length === 1 ? "" : "s"}`,
    statusKey ? STATUS_FILTERS[statusKey].label.toLowerCase() : null,
    chapterProposalOnly ? "new chapter proposals" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TrackerShell
      eyebrow="Admin"
      title="Applications"
      subtitle="Review applications, manage interview scheduling, and monitor Chair-reviewed decisions. Interview scheduling and reviews live in Interviews."
      primaryAction={
        <ButtonLink
          href="/interviews?scope=hiring&view=team&state=needs_action"
          variant="secondary"
          size="md"
        >
          Open Interviews
        </ButtonLink>
      }
      views={[
        {
          key: "all",
          label: "All types",
          href: applicationsHref({
            chapterProposal: chapterProposalOnly,
            status: statusKey,
          }),
          active: !selectedType,
        },
        ...POSITION_TYPES.map((type) => ({
          key: type,
          label: TYPE_LABELS[type] ?? type,
          href: applicationsHref({
            type,
            chapterProposal: chapterProposalOnly,
            status: statusKey,
          }),
          active: selectedType === type,
        })),
      ]}
      filters={
        <AdvancedFilters
          defaultOpen={activeFilterCount > 0}
          hint={activeFilterCount > 0 ? `${activeFilterCount} active` : undefined}
        >
          <FilterChipLink
            href={applicationsHref({ type: selectedType, status: statusKey })}
            active={!chapterProposalOnly}
          >
            All applications
          </FilterChipLink>
          <FilterChipLink
            href={applicationsHref({
              type: selectedType,
              chapterProposal: true,
              status: statusKey,
            })}
            active={chapterProposalOnly}
          >
            New chapter proposals
          </FilterChipLink>
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          <FilterChipLink
            href={applicationsHref({
              type: selectedType,
              chapterProposal: chapterProposalOnly,
            })}
            active={!statusKey}
          >
            Any status
          </FilterChipLink>
          {Object.entries(STATUS_FILTERS).map(([key, { label }]) => (
            <FilterChipLink
              key={key}
              href={applicationsHref({
                type: selectedType,
                chapterProposal: chapterProposalOnly,
                status: key,
              })}
              active={statusKey === key}
            >
              {label}
            </FilterChipLink>
          ))}
        </AdvancedFilters>
      }
      metrics={
        <MetricStrip
          aria-label="Applications by status"
          metrics={[
            {
              label: "Submitted",
              value: statusCounts.submitted,
              href: applicationsHref({
                type: selectedType,
                chapterProposal: chapterProposalOnly,
                status: "submitted",
              }),
            },
            {
              label: "In review",
              value: statusCounts.inReview,
              href: applicationsHref({
                type: selectedType,
                chapterProposal: chapterProposalOnly,
                status: "in-review",
              }),
            },
            {
              label: "Interviewing",
              value: statusCounts.interviewing,
              href: applicationsHref({
                type: selectedType,
                chapterProposal: chapterProposalOnly,
                status: "interviewing",
              }),
            },
            {
              label: "Accepted",
              value: statusCounts.accepted,
              href: applicationsHref({
                type: selectedType,
                chapterProposal: chapterProposalOnly,
                status: "accepted",
              }),
            },
            {
              label: "Rejected",
              value: statusCounts.rejected,
              href: applicationsHref({
                type: selectedType,
                chapterProposal: chapterProposalOnly,
                status: "rejected",
              }),
            },
          ]}
        />
      }
      count={countLabel}
    >
      <ApplicationsView applications={serialized as never} />
    </TrackerShell>
  );
}
