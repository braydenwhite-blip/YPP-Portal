import "server-only";

import { prisma } from "@/lib/prisma";
import { readReviewDocumentTitle } from "@/lib/mentorship/review-document-meta";

export type MenteeHomeProcessStep = {
  id: string;
  label: string;
  /** complete | current | upcoming | due */
  state: "complete" | "current" | "upcoming" | "due";
  dateLabel: string | null;
};

export type MenteeHomeDocument = {
  id: string;
  kind: "performance_review" | "gr";
  title: string;
  periodLabel: string;
  cycleLabel: string;
  typeLabel: string;
  updatedAtLabel: string;
  updatedBy: string | null;
  href: string;
  actionLabel: "View" | "Start";
  actionVariant: "primary" | "secondary";
  steps: MenteeHomeProcessStep[];
};

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

function cyclePeriodLabel(cycleMonth: Date, _isQuarterly: boolean) {
  const month = cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  // Monthly performance reviews use the calendar month under review
  // (e.g. early August → "July 2026"). Quarterly committee reviews keep
  // their own quarter keys elsewhere.
  return { titleCycle: month, period: month };
}

function reviewSteps(input: {
  reflectionSubmittedAt: Date | null;
  submittedToChairAt: Date | null;
  chairApprovedAt: Date | null;
  releasedToMenteeAt: Date | null;
  status: string;
}): MenteeHomeProcessStep[] {
  const reflectionDone = Boolean(input.reflectionSubmittedAt);
  const submittedToChair =
    Boolean(input.submittedToChairAt) ||
    input.status === "PENDING_CHAIR_APPROVAL" ||
    input.status === "APPROVED" ||
    Boolean(input.chairApprovedAt) ||
    Boolean(input.releasedToMenteeAt);
  const released = Boolean(input.releasedToMenteeAt);

  const states: Array<"complete" | "current" | "upcoming"> = reflectionDone
    ? submittedToChair
      ? released
        ? ["complete", "complete", "complete"]
        : ["complete", "complete", "current"]
      : ["complete", "current", "upcoming"]
    : ["current", "upcoming", "upcoming"];

  return [
    {
      id: "reflection",
      label: "Self-Reflection Form Submitted",
      state: states[0]!,
      dateLabel: input.reflectionSubmittedAt
        ? formatMonthYear(input.reflectionSubmittedAt)
        : null,
    },
    {
      id: "chair",
      label: "Review Submitted to Chair",
      state: states[1]!,
      dateLabel: input.chairApprovedAt
        ? formatMonthYear(input.chairApprovedAt)
        : input.submittedToChairAt
          ? formatMonthYear(input.submittedToChairAt)
          : null,
    },
    {
      id: "mentee",
      label: "Review Sent to Mentee",
      state: states[2]!,
      dateLabel: input.releasedToMenteeAt
        ? formatMonthYear(input.releasedToMenteeAt)
        : null,
    },
  ];
}

function grSteps(status: string, updatedAt: Date): MenteeHomeProcessStep[] {
  if (status === "ACTIVE") {
    const done = formatMonthYear(updatedAt);
    return [
      { id: "draft", label: "Draft started", state: "complete", dateLabel: done },
      { id: "review", label: "Shared for review", state: "complete", dateLabel: done },
      { id: "active", label: "Active with mentee", state: "complete", dateLabel: done },
    ];
  }
  if (status === "PENDING_APPROVAL") {
    return [
      {
        id: "draft",
        label: "Draft started",
        state: "complete",
        dateLabel: formatMonthYear(updatedAt),
      },
      { id: "review", label: "Shared for review", state: "current", dateLabel: null },
      { id: "active", label: "Active with mentee", state: "upcoming", dateLabel: null },
    ];
  }
  return [
    { id: "draft", label: "Draft started", state: "current", dateLabel: null },
    { id: "review", label: "Shared for review", state: "upcoming", dateLabel: null },
    { id: "active", label: "Active with mentee", state: "upcoming", dateLabel: null },
  ];
}

/**
 * Documents for the mentee home “Reviews & Documents” table.
 */
export async function loadMenteeHomeDocuments(input: {
  menteeId: string;
  goalsHref: string;
  reviewsHref: string;
}): Promise<MenteeHomeDocument[]> {
  const [reviews, grDocs, openReflection] = await Promise.all([
    prisma.mentorGoalReview.findMany({
      where: { menteeId: input.menteeId },
      orderBy: { cycleMonth: "desc" },
      take: 12,
      select: {
        id: true,
        cycleMonth: true,
        isQuarterly: true,
        status: true,
        updatedAt: true,
        chairApprovedAt: true,
        releasedToMenteeAt: true,
        mentor: { select: { name: true, email: true } },
        selfReflection: { select: { submittedAt: true } },
        nextMonthGoalDraftsJson: true,
      },
    }),
    prisma.gRDocument.findMany({
      where: { userId: input.menteeId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        roleStartDate: true,
        template: { select: { title: true } },
        mentorship: {
          select: { mentor: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.monthlySelfReflection.findFirst({
      where: {
        menteeId: input.menteeId,
        goalReview: null,
      },
      orderBy: { cycleMonth: "desc" },
      select: {
        id: true,
        cycleMonth: true,
        cycleNumber: true,
        submittedAt: true,
      },
    }),
  ]);

  const docs: MenteeHomeDocument[] = [];

  for (const review of reviews) {
    const { titleCycle, period } = cyclePeriodLabel(
      review.cycleMonth,
      review.isQuarterly,
    );
    const released = Boolean(review.releasedToMenteeAt);
    const canStart =
      !released &&
      review.status === "DRAFT" &&
      !review.chairApprovedAt;
    const reviewHref = `${input.reviewsHref}${
      input.reviewsHref.includes("?") ? "&" : "?"
    }reviewId=${encodeURIComponent(review.id)}`;
    docs.push({
      id: `review-${review.id}`,
      kind: "performance_review",
      title:
        readReviewDocumentTitle(review.nextMonthGoalDraftsJson) ||
        `${titleCycle} Performance Review`,
      periodLabel: period.replace(/^Q\d \d{4} \(/, "").replace(/\)$/, "") || period,
      cycleLabel: period,
      typeLabel: "Performance Review",
      updatedAtLabel: formatMonthYear(review.updatedAt),
      updatedBy: review.mentor.name || review.mentor.email,
      href: reviewHref,
      actionLabel: canStart && !released ? "Start" : "View",
      actionVariant: canStart && !released ? "primary" : "secondary",
      steps: reviewSteps({
        reflectionSubmittedAt: review.selfReflection.submittedAt,
        submittedToChairAt:
          review.status === "PENDING_CHAIR_APPROVAL" ||
          review.status === "APPROVED" ||
          review.status === "CHANGES_REQUESTED"
            ? review.updatedAt
            : null,
        chairApprovedAt: review.chairApprovedAt,
        releasedToMenteeAt: review.releasedToMenteeAt,
        status: review.status,
      }),
    });
  }

  // Open reflection waiting on mentor review — show as startable performance review row.
  if (openReflection) {
    const isQuarterly = openReflection.cycleNumber % 3 === 0;
    const { titleCycle, period } = cyclePeriodLabel(
      openReflection.cycleMonth,
      isQuarterly,
    );
    docs.push({
      id: `reflection-${openReflection.id}`,
      kind: "performance_review",
      title: `${titleCycle} Performance Review`,
      periodLabel: period,
      cycleLabel: period,
      typeLabel: "Performance Review",
      updatedAtLabel: formatMonthYear(openReflection.submittedAt),
      updatedBy: null,
      href: input.reviewsHref,
      actionLabel: "View",
      actionVariant: "secondary",
      steps: reviewSteps({
        reflectionSubmittedAt: openReflection.submittedAt,
        submittedToChairAt: null,
        chairApprovedAt: null,
        releasedToMenteeAt: null,
        status: "DRAFT",
      }),
    });
  }

  for (const gr of grDocs) {
    const year = gr.roleStartDate.getUTCFullYear();
    const title = gr.template.title || "Goal & Responsibility";
    docs.push({
      id: `gr-${gr.id}`,
      kind: "gr",
      title: title.includes("G&R") ? title : `G&R — ${title}`,
      periodLabel: String(year),
      cycleLabel: `${year}`,
      typeLabel: "Goal & Responsibility",
      updatedAtLabel: formatMonthYear(gr.updatedAt),
      updatedBy:
        gr.mentorship.mentor.name || gr.mentorship.mentor.email || null,
      href: input.goalsHref,
      actionLabel: gr.status === "DRAFT" ? "Start" : "View",
      actionVariant: gr.status === "DRAFT" ? "primary" : "secondary",
      steps: grSteps(gr.status, gr.updatedAt),
    });
  }

  return docs.sort((a, b) => {
    // Prefer actionable "Start" first, then by updated label recency is already in query order — keep stable-ish
    if (a.actionLabel !== b.actionLabel) {
      return a.actionLabel === "Start" ? -1 : 1;
    }
    return 0;
  });
}

export function nextReviewLabel(cycleMonth: Date | null | undefined): string | null {
  if (!cycleMonth) return null;
  return cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
