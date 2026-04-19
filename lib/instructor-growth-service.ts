import {
  InstructorGrowthCategory,
  InstructorGrowthSourceMethod,
  InstructorGrowthStatus,
  InstructorGrowthTier,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import {
  getClassTemplateCapabilities,
  getTemplateSubmissionStatus,
} from "@/lib/class-template-compat";
import {
  INSTRUCTOR_GROWTH_BADGES,
  INSTRUCTOR_GROWTH_CLAIM_TEMPLATES,
  INSTRUCTOR_GROWTH_RULES,
  INSTRUCTOR_GROWTH_TIERS,
  deriveSemesterLabel,
  getCurrentSemesterLabel,
  getInstructorGrowthClaimTemplate,
  getInstructorGrowthRule,
  getInstructorGrowthTier,
  getInstructorGrowthTierForXp,
  getNextInstructorGrowthTier,
  isStrongParentFeedback,
} from "@/lib/instructor-growth-config";

type ViewerContext = {
  userId: string;
  roles: string[];
  chapterId?: string | null;
};

type PendingReviewDecision = "APPROVED" | "REJECTED";

type GrowthBreakdown = Record<
  InstructorGrowthCategory,
  { label: string; value: number }
>;

type GrowthTemplateSummary = {
  id: string;
  title: string;
  isPublished: boolean;
  submissionStatus: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LiveOfferingSummary = {
  id: string;
  title: string;
  semester: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  sessions: Array<{
    id: string;
    date: Date;
    sessionNumber: number;
    attendance: Array<{ status: string; studentId: string }>;
  }>;
  enrollments: Array<{ studentId: string; status: string }>;
  template: {
    submissionStatus: string;
  };
};

type BadgeCriterionContext = {
  approvedEvents: Array<{
    id: string;
    eventKey: string;
    category: InstructorGrowthCategory;
    semesterLabel: string | null;
    status: InstructorGrowthStatus;
  }>;
  offerings: LiveOfferingSummary[];
  strongParentFeedbackBySemester: Map<string, { count: number; totalRating: number }>;
};

export type InstructorGrowthSuspicionFlag = {
  title: string;
  detail: string;
  severity: "info" | "warning";
};

function emptyBreakdown(): GrowthBreakdown {
  return {
    TEACHING: { label: "Teaching", value: 0 },
    GROWTH: { label: "Growth", value: 0 },
    COMMUNITY: { label: "Community", value: 0 },
    IMPACT: { label: "Impact", value: 0 },
  };
}

function buildStatusPill(status: InstructorGrowthStatus) {
  if (status === "APPROVED") {
    return { label: "Approved", color: "#0f766e", background: "#e6f5f2" };
  }
  if (status === "PENDING") {
    return { label: "Pending", color: "#9a6700", background: "#fdf4d7" };
  }
  if (status === "REJECTED") {
    return { label: "Rejected", color: "#b42318", background: "#feebe9" };
  }
  return { label: "Revoked", color: "#475467", background: "#f2f4f7" };
}

function getCategoryLabel(category: InstructorGrowthCategory) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function formatRoleLabel(role: string | null | undefined) {
  if (!role) return "";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getGrowthSourceHref(event: {
  sourceType: string | null;
  sourceId: string | null;
  sourceMethod: InstructorGrowthSourceMethod;
}) {
  if (event.sourceType === "CLASS_TEMPLATE") {
    return "/instructor/workspace?tab=curricula";
  }
  if (event.sourceType === "CLASS_OFFERING") {
    return "/instructor/class-settings";
  }
  if (event.sourceType === "CLASS_SESSION" || event.sourceType === "LESSON_PLAN") {
    return "/instructor/workspace?tab=lesson-plans";
  }
  if (event.sourceType === "TRAINING_COMPLETION" || event.sourceType === "TEACHING_PERMISSION") {
    return "/instructor/certifications";
  }
  if (event.sourceMethod === "CLAIM") {
    return "/instructor-growth";
  }
  return null;
}

function coalesceSemesterLabel(value: string | null | undefined, date: Date) {
  return value?.trim() || deriveSemesterLabel(date);
}

function toTierEnum(tierKey: string): InstructorGrowthTier {
  return tierKey as InstructorGrowthTier;
}

function toCategoryEnum(categoryKey: string): InstructorGrowthCategory {
  return categoryKey as InstructorGrowthCategory;
}

function isInstructorRole(roles: string[], primaryRole?: string | null) {
  return roles.includes("INSTRUCTOR") || primaryRole === "INSTRUCTOR";
}

export async function ensureInstructorGrowthBadgeDefinitions() {
  await prisma.$transaction(
    INSTRUCTOR_GROWTH_BADGES.map((badge) =>
      prisma.instructorGrowthBadgeDefinition.upsert({
        where: { slug: badge.slug },
        create: {
          slug: badge.slug,
          name: badge.name,
          description: badge.description,
          flavorText: badge.flavorText,
          icon: badge.icon,
          accentColor: badge.accentColor,
          perkText: badge.perkText,
          criteria: badge.criteria as Prisma.InputJsonValue,
          order: badge.order,
          isActive: true,
        },
        update: {
          name: badge.name,
          description: badge.description,
          flavorText: badge.flavorText,
          icon: badge.icon,
          accentColor: badge.accentColor,
          perkText: badge.perkText,
          criteria: badge.criteria as Prisma.InputJsonValue,
          order: badge.order,
          isActive: true,
        },
      })
    )
  );
}

export async function ensureInstructorGrowthProfile(instructorId: string) {
  return prisma.instructorGrowthProfile.upsert({
    where: { instructorId },
    create: {
      instructorId,
      currentTier: "SPARK",
      currentSemesterLabel: getCurrentSemesterLabel(),
    },
    update: {},
  });
}

export async function getAssignedInstructorMentor(instructorId: string) {
  return prisma.mentorship.findFirst({
    where: {
      menteeId: instructorId,
      type: "INSTRUCTOR",
      status: "ACTIVE",
    },
    orderBy: { startDate: "desc" },
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function canViewInstructorGrowth(
  viewer: ViewerContext,
  instructorId: string
) {
  if (viewer.userId === instructorId) {
    return true;
  }

  if (viewer.roles.includes("ADMIN")) {
    return true;
  }

  if (viewer.roles.includes("CHAPTER_PRESIDENT")) {
    const instructor = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { chapterId: true },
    });
    return Boolean(instructor?.chapterId && instructor.chapterId === viewer.chapterId);
  }

  if (viewer.roles.includes("MENTOR")) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: viewer.userId,
        menteeId: instructorId,
        type: "INSTRUCTOR",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    return Boolean(mentorship);
  }

  return false;
}

export async function canReviewInstructorGrowth(
  viewer: ViewerContext,
  instructorId: string
) {
  if (viewer.roles.includes("ADMIN")) {
    return true;
  }

  if (viewer.roles.includes("CHAPTER_PRESIDENT")) {
    const instructor = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { chapterId: true },
    });
    return Boolean(instructor?.chapterId && instructor.chapterId === viewer.chapterId);
  }

  if (viewer.roles.includes("MENTOR")) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: viewer.userId,
        menteeId: instructorId,
        type: "INSTRUCTOR",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    return Boolean(mentorship);
  }

  return false;
}

async function getStrongParentFeedbackSummaryBySemester(instructorId: string) {
  const feedback = await prisma.parentChapterFeedback.findMany({
    where: {
      targetUserId: instructorId,
      type: "INSTRUCTOR_FEEDBACK",
    },
    select: {
      id: true,
      rating: true,
      wouldRecommend: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const bySemester = new Map<string, { count: number; totalRating: number }>();
  for (const item of feedback) {
    if (!isStrongParentFeedback(item)) continue;
    const semesterLabel = deriveSemesterLabel(item.createdAt);
    const current = bySemester.get(semesterLabel) ?? { count: 0, totalRating: 0 };
    current.count += 1;
    current.totalRating += item.rating;
    bySemester.set(semesterLabel, current);
  }

  return { bySemester, feedback };
}

async function getInstructorGrowthTemplateSummaries(
  instructorId: string
): Promise<GrowthTemplateSummary[]> {
  const capabilities = await getClassTemplateCapabilities();
  const templates = await prisma.classTemplate.findMany({
    where: { createdById: instructorId },
    select: capabilities.hasReviewWorkflow
      ? {
          id: true,
          title: true,
          isPublished: true,
          submittedAt: true,
          submissionStatus: true,
          createdAt: true,
          updatedAt: true,
        }
      : {
          id: true,
          title: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
    orderBy: { createdAt: "asc" },
  });

  return templates.map((template) => {
    const submittedAt =
      capabilities.hasReviewWorkflow && "submittedAt" in template
        ? (template.submittedAt as Date | null)
        : null;

    return {
      id: template.id,
      title: template.title,
      isPublished: template.isPublished,
      submissionStatus: getTemplateSubmissionStatus(
        template,
        capabilities.hasReviewWorkflow
      ),
      submittedAt,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  });
}

async function getInstructorGrowthRelatedUserOptions(
  instructorId: string,
  chapterId?: string | null
) {
  const [mentorLink, chapterPeers] = await Promise.all([
    getAssignedInstructorMentor(instructorId),
    chapterId
      ? prisma.user.findMany({
          where: {
            id: { not: instructorId },
            chapterId,
            archivedAt: null,
            roles: {
              some: {
                role: {
                  in: ["INSTRUCTOR", "MENTOR", "CHAPTER_PRESIDENT", "ADMIN"],
                },
              },
            },
          },
          select: {
            id: true,
            name: true,
            primaryRole: true,
          },
          orderBy: [{ primaryRole: "asc" }, { name: "asc" }],
          take: 24,
        })
      : Promise.resolve([]),
  ]);

  const options = new Map<
    string,
    { id: string; name: string | null; primaryRole: string | null }
  >();

  for (const peer of chapterPeers) {
    options.set(peer.id, peer);
  }

  if (mentorLink?.mentor?.id && mentorLink.mentor.id !== instructorId) {
    options.set(mentorLink.mentor.id, {
      id: mentorLink.mentor.id,
      name: mentorLink.mentor.name,
      primaryRole: "MENTOR",
    });
  }

  return Array.from(options.values()).map((option) => ({
    ...option,
    label:
      option.primaryRole && option.primaryRole !== "INSTRUCTOR"
        ? `${option.name ?? "Unknown"} (${formatRoleLabel(option.primaryRole)})`
        : (option.name ?? "Unknown"),
  }));
}

async function awardAutoGrowthEvent(input: {
  instructorId: string;
  eventKey: string;
  title: string;
  description: string;
  xpAmount: number;
  category: InstructorGrowthCategory;
  occurredAt: Date;
  semesterLabel?: string | null;
  sourceType: string;
  sourceId: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.instructorGrowthEvent.findFirst({
    where: {
      instructorId: input.instructorId,
      dedupeKey: input.dedupeKey,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const mentor = await getAssignedInstructorMentor(input.instructorId);
  return prisma.instructorGrowthEvent.create({
    data: {
      instructorId: input.instructorId,
      category: input.category,
      sourceMethod: "AUTO",
      status: "APPROVED",
      eventKey: input.eventKey,
      title: input.title,
      description: input.description,
      xpAmount: input.xpAmount,
      semesterLabel: coalesceSemesterLabel(input.semesterLabel, input.occurredAt),
      occurredAt: input.occurredAt,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKey,
      assignedMentorId: mentor?.mentor.id ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true },
  });
}

async function getLiveOfferingSummaries(instructorId: string) {
  const capabilities = await getClassTemplateCapabilities();
  const offerings = await prisma.classOffering.findMany({
    where: {
      instructorId,
      status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
    },
    select: {
      id: true,
      title: true,
      semester: true,
      startDate: true,
      endDate: true,
      status: true,
      template: {
        select: capabilities.hasReviewWorkflow
          ? {
              isPublished: true,
              submissionStatus: true,
            }
          : {
              isPublished: true,
            },
      },
      sessions: {
        select: {
          id: true,
          date: true,
          sessionNumber: true,
          attendance: {
            select: {
              status: true,
              studentId: true,
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      },
      enrollments: {
        select: {
          studentId: true,
          status: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  return offerings.map((offering) => ({
    ...offering,
    template: {
      submissionStatus: getTemplateSubmissionStatus(
        offering.template,
        capabilities.hasReviewWorkflow
      ),
    },
  }));
}

function buildAttendanceRate(offering: LiveOfferingSummary) {
  let presentish = 0;
  let total = 0;

  for (const session of offering.sessions) {
    for (const record of session.attendance) {
      total += 1;
      if (record.status === "PRESENT" || record.status === "LATE") {
        presentish += 1;
      }
    }
  }

  if (total === 0) {
    return 0;
  }

  return presentish / total;
}

function buildRetentionRate(offering: LiveOfferingSummary) {
  const counted = offering.enrollments.filter((enrollment) => enrollment.status !== "WAITLISTED");
  if (counted.length === 0) {
    return 0;
  }

  const retained = counted.filter((enrollment) =>
    enrollment.status === "ENROLLED" || enrollment.status === "COMPLETED"
  ).length;

  return retained / counted.length;
}

async function syncTeachingSignals(instructorId: string) {
  const [
    requiredModuleCount,
    completedRequiredModuleCount,
    completedRequiredAssignments,
    teachingPermissions,
    templates,
    offerings,
  ] =
    await Promise.all([
      prisma.trainingModule.count({
        where: { required: true },
      }),
      prisma.trainingAssignment.count({
        where: {
          userId: instructorId,
          status: "COMPLETE",
          module: { required: true },
        },
      }),
      prisma.trainingAssignment.findMany({
        where: {
          userId: instructorId,
          status: "COMPLETE",
          module: { required: true },
        },
        select: {
          completedAt: true,
          updatedAt: true,
        },
        orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.instructorTeachingPermission.findMany({
        where: { instructorId },
        select: {
          id: true,
          level: true,
          grantedAt: true,
        },
        orderBy: { grantedAt: "asc" },
      }),
      getInstructorGrowthTemplateSummaries(instructorId),
      getLiveOfferingSummaries(instructorId),
    ]);

  if (requiredModuleCount > 0 && requiredModuleCount === completedRequiredModuleCount) {
    const latestCompletionAt =
      completedRequiredAssignments.find((assignment) => assignment.completedAt)?.completedAt ??
      completedRequiredAssignments[0]?.updatedAt ??
      new Date();

    await awardAutoGrowthEvent({
      instructorId,
      eventKey: "TRAINING_COMPLETE",
      title: "Required training complete",
      description: "All required instructor training modules were completed.",
      xpAmount: 80,
      category: "TEACHING",
      occurredAt: latestCompletionAt,
      sourceType: "TRAINING_COMPLETION",
      sourceId: instructorId,
      dedupeKey: "training-complete",
    });
  }

  for (const permission of teachingPermissions) {
    await awardAutoGrowthEvent({
      instructorId,
      eventKey: "TEACHING_PERMISSION_GRANTED",
      title: `Teaching permission unlocked: ${permission.level.replace("LEVEL_", "Level ")}`,
      description: "A new teaching permission or readiness milestone was granted.",
      xpAmount: 45,
      category: "GROWTH",
      occurredAt: permission.grantedAt,
      sourceType: "TEACHING_PERMISSION",
      sourceId: permission.id,
      dedupeKey: `teaching-permission:${permission.id}`,
      metadata: { level: permission.level },
    });
  }

  for (const template of templates) {
    if (
      (template.submissionStatus === "SUBMITTED" ||
        template.submissionStatus === "APPROVED") &&
      template.submittedAt
    ) {
      await awardAutoGrowthEvent({
        instructorId,
        eventKey: "CURRICULUM_SUBMITTED",
        title: "Curriculum submitted for review",
        description: `${template.title} was submitted for review.`,
        xpAmount: 40,
        category: "TEACHING",
        occurredAt: template.submittedAt,
        sourceType: "CLASS_TEMPLATE",
        sourceId: template.id,
        dedupeKey: `curriculum-submitted:${template.id}`,
        metadata: { templateId: template.id, templateTitle: template.title },
      });
    }

    if (template.submissionStatus === "APPROVED") {
      await awardAutoGrowthEvent({
        instructorId,
        eventKey: "CURRICULUM_APPROVED",
        title: "Curriculum approved",
        description: `${template.title} was approved for launch.`,
        xpAmount: 90,
        category: "TEACHING",
        occurredAt: template.submittedAt ?? template.updatedAt ?? template.createdAt,
        sourceType: "CLASS_TEMPLATE",
        sourceId: template.id,
        dedupeKey: `curriculum-approved:${template.id}`,
        metadata: { templateId: template.id, templateTitle: template.title },
      });
    }
  }

  const otherEnrollments = await prisma.classEnrollment.findMany({
    where: {
      studentId: {
        in: Array.from(
          new Set(
            offerings.flatMap((offering) =>
              offering.enrollments.map((enrollment) => enrollment.studentId)
            )
          )
        ),
      },
      offeringId: { notIn: offerings.map((offering) => offering.id) },
      status: { in: ["ENROLLED", "COMPLETED"] },
    },
    select: {
      studentId: true,
    },
  });
  const studentsWithReturnTicket = new Set(otherEnrollments.map((entry) => entry.studentId));

  for (const offering of offerings) {
    const semesterLabel = coalesceSemesterLabel(offering.semester, offering.startDate);

    await awardAutoGrowthEvent({
      instructorId,
      eventKey: "OFFERING_PUBLISHED",
      title: "Live class offering launched",
      description: `${offering.title} moved into a live teaching state.`,
      xpAmount: 35,
      category: "TEACHING",
      occurredAt: offering.startDate,
      semesterLabel,
      sourceType: "CLASS_OFFERING",
      sourceId: offering.id,
      dedupeKey: `offering-published:${offering.id}`,
      metadata: { offeringId: offering.id, offeringTitle: offering.title },
    });

    for (const session of offering.sessions) {
      if (session.attendance.length === 0) continue;

      await awardAutoGrowthEvent({
        instructorId,
        eventKey: "CLASS_SESSION_TAUGHT",
        title: "Verified class session taught",
        description: `${offering.title} session recorded attendance in the portal.`,
        xpAmount: 12,
        category: "TEACHING",
        occurredAt: session.date,
        semesterLabel,
        sourceType: "CLASS_SESSION",
        sourceId: session.id,
        dedupeKey: `class-session:${session.id}`,
        metadata: {
          offeringId: offering.id,
          offeringTitle: offering.title,
          sessionId: session.id,
          sessionNumber: session.sessionNumber,
        },
      });
    }

    if (offering.status === "COMPLETED" && buildRetentionRate(offering) >= 0.85) {
      await awardAutoGrowthEvent({
        instructorId,
        eventKey: "HIGH_RETENTION_OFFERING",
        title: "High-retention offering",
        description: `${offering.title} held strong retention through the offering.`,
        xpAmount: 60,
        category: "IMPACT",
        occurredAt: offering.endDate,
        semesterLabel,
        sourceType: "CLASS_OFFERING",
        sourceId: offering.id,
        dedupeKey: `high-retention:${offering.id}`,
        metadata: { retentionRate: buildRetentionRate(offering) },
      });
    }

    const reEnrolledCount = offering.enrollments.filter((enrollment) =>
      studentsWithReturnTicket.has(enrollment.studentId)
    ).length;
    if (reEnrolledCount >= 3) {
      await awardAutoGrowthEvent({
        instructorId,
        eventKey: "RETURN_TICKET",
        title: "Students returned to YPP classes",
        description: `${reEnrolledCount} students from ${offering.title} continued into other YPP classes.`,
        xpAmount: 30,
        category: "IMPACT",
        occurredAt: offering.endDate,
        semesterLabel,
        sourceType: "CLASS_OFFERING",
        sourceId: offering.id,
        dedupeKey: `return-ticket:${offering.id}`,
        metadata: { reEnrolledCount },
      });
    }
  }

  const semesterEntries = offerings
    .map((offering) => ({
      semesterLabel: coalesceSemesterLabel(offering.semester, offering.startDate),
      startDate: offering.startDate,
      offeringId: offering.id,
    }))
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());

  const distinctSemesters = Array.from(
    new Map(
      semesterEntries.map((entry) => [
        entry.semesterLabel,
        entry,
      ])
    ).values()
  );

  for (const entry of distinctSemesters.slice(1)) {
    await awardAutoGrowthEvent({
      instructorId,
      eventKey: "RETURNING_SEMESTER",
      title: "Returned for a new teaching semester",
      description: `You returned to teach again in ${entry.semesterLabel}.`,
      xpAmount: 50,
      category: "GROWTH",
      occurredAt: entry.startDate,
      semesterLabel: entry.semesterLabel,
      sourceType: "CLASS_OFFERING",
      sourceId: entry.offeringId,
      dedupeKey: `returning-semester:${entry.semesterLabel}`,
    });
  }
}

async function syncLessonPlanSignals(instructorId: string) {
  const [lessonPlans, offerings, existingAwards] = await Promise.all([
    prisma.lessonPlan.findMany({
      where: {
        authorId: instructorId,
        classTemplateId: { not: null },
      },
      select: {
        id: true,
        title: true,
        classTemplateId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.classOffering.findMany({
      where: {
        instructorId,
        status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
      },
      select: {
        id: true,
        templateId: true,
        title: true,
        semester: true,
        startDate: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.instructorGrowthEvent.findMany({
      where: {
        instructorId,
        eventKey: "LESSON_PLAN_LINKED",
        status: "APPROVED",
      },
      select: {
        dedupeKey: true,
        semesterLabel: true,
      },
    }),
  ]);

  const templateToOffering = new Map<string, (typeof offerings)[number]>();
  for (const offering of offerings) {
    if (!templateToOffering.has(offering.templateId)) {
      templateToOffering.set(offering.templateId, offering);
    }
  }

  const semesterCounts = new Map<string, number>();
  for (const existing of existingAwards) {
    if (!existing.semesterLabel) continue;
    semesterCounts.set(
      existing.semesterLabel,
      (semesterCounts.get(existing.semesterLabel) ?? 0) + 1
    );
  }

  for (const plan of lessonPlans) {
    const offering = plan.classTemplateId
      ? templateToOffering.get(plan.classTemplateId)
      : null;
    if (!offering) continue;

    const semesterLabel = coalesceSemesterLabel(offering.semester, offering.startDate);
    const currentCount = semesterCounts.get(semesterLabel) ?? 0;
    if (currentCount >= 16) continue;

    const dedupeKey = `lesson-plan:${plan.id}`;
    const alreadyAwarded = existingAwards.some((existing) => existing.dedupeKey === dedupeKey);
    if (alreadyAwarded) continue;

    await awardAutoGrowthEvent({
      instructorId,
      eventKey: "LESSON_PLAN_LINKED",
      title: "Lesson plan tied to a scheduled class",
      description: `${plan.title} is attached to live teaching work.`,
      xpAmount: 6,
      category: "TEACHING",
      occurredAt: plan.createdAt,
      semesterLabel,
      sourceType: "LESSON_PLAN",
      sourceId: plan.id,
      dedupeKey,
      metadata: {
        lessonPlanId: plan.id,
        lessonPlanTitle: plan.title,
        offeringId: offering.id,
      },
    });

    semesterCounts.set(semesterLabel, currentCount + 1);
  }
}

async function syncImpactSignals(instructorId: string) {
  const [{ feedback }, existingStrongFeedbackEvents] = await Promise.all([
    getStrongParentFeedbackSummaryBySemester(instructorId),
    prisma.instructorGrowthEvent.findMany({
      where: {
        instructorId,
        eventKey: "STRONG_PARENT_FEEDBACK",
        status: "APPROVED",
      },
      select: {
        semesterLabel: true,
      },
    }),
  ]);

  const countsBySemester = new Map<string, number>();
  for (const event of existingStrongFeedbackEvents) {
    if (!event.semesterLabel) continue;
    countsBySemester.set(
      event.semesterLabel,
      (countsBySemester.get(event.semesterLabel) ?? 0) + 1
    );
  }

  for (const item of feedback) {
    if (!isStrongParentFeedback(item)) continue;
    const semesterLabel = deriveSemesterLabel(item.createdAt);
    const currentCount = countsBySemester.get(semesterLabel) ?? 0;
    if (currentCount >= 5) continue;

    await awardAutoGrowthEvent({
      instructorId,
      eventKey: "STRONG_PARENT_FEEDBACK",
      title: "Strong parent feedback",
      description: "A strong parent feedback response was recorded for your work.",
      xpAmount: 10,
      category: "IMPACT",
      occurredAt: item.createdAt,
      semesterLabel,
      sourceType: "PARENT_FEEDBACK",
      sourceId: item.id,
      dedupeKey: `parent-feedback:${item.id}`,
      metadata: {
        rating: item.rating,
        wouldRecommend: item.wouldRecommend ?? null,
      },
    });

    countsBySemester.set(semesterLabel, currentCount + 1);
  }
}

export async function syncInstructorGrowthSignalsForInstructor(instructorId: string) {
  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: {
      id: true,
      primaryRole: true,
      roles: { select: { role: true } },
    },
  });

  if (!instructor) {
    return null;
  }

  const roles = instructor.roles.map((entry) => entry.role);
  if (!isInstructorRole(roles, instructor.primaryRole)) {
    return null;
  }

  await ensureInstructorGrowthBadgeDefinitions();
  await ensureInstructorGrowthProfile(instructorId);

  await syncTeachingSignals(instructorId);
  await syncLessonPlanSignals(instructorId);
  await syncImpactSignals(instructorId);
  await syncInstructorGrowthRollups(instructorId);

  return prisma.instructorGrowthProfile.findUnique({
    where: { instructorId },
  });
}

async function buildBadgeCriterionContext(
  instructorId: string
): Promise<BadgeCriterionContext> {
  const [approvedEvents, offerings, strongParentFeedback] = await Promise.all([
    prisma.instructorGrowthEvent.findMany({
      where: {
        instructorId,
        status: "APPROVED",
      },
      select: {
        id: true,
        eventKey: true,
        category: true,
        semesterLabel: true,
        status: true,
      },
    }),
    getLiveOfferingSummaries(instructorId),
    getStrongParentFeedbackSummaryBySemester(instructorId),
  ]);

  return {
    approvedEvents,
    offerings,
    strongParentFeedbackBySemester: strongParentFeedback.bySemester,
  };
}

function hasCurriculumLaunch(ctx: BadgeCriterionContext) {
  return ctx.offerings.some(
    (offering) =>
      offering.template.submissionStatus === "APPROVED" &&
      (offering.status === "PUBLISHED" || offering.status === "IN_PROGRESS" || offering.status === "COMPLETED")
  );
}

function getEventCountByKey(
  ctx: BadgeCriterionContext,
  eventKey: string,
  semesterLabel?: string | null
) {
  return ctx.approvedEvents.filter(
    (event) =>
      event.eventKey === eventKey &&
      (semesterLabel ? event.semesterLabel === semesterLabel : true)
  ).length;
}

function hasSemesterEventThreshold(
  ctx: BadgeCriterionContext,
  eventKeys: string[],
  minCount: number
) {
  const bySemester = new Map<string, number>();
  for (const event of ctx.approvedEvents) {
    if (!event.semesterLabel || !eventKeys.includes(event.eventKey)) continue;
    bySemester.set(event.semesterLabel, (bySemester.get(event.semesterLabel) ?? 0) + 1);
  }
  return Array.from(bySemester.values()).some((count) => count >= minCount);
}

function hasCompletedOfferingWithMinSessions(
  ctx: BadgeCriterionContext,
  minSessions: number
) {
  return ctx.offerings.some((offering) => {
    const taughtSessions = offering.sessions.filter((session) => session.attendance.length > 0);
    return taughtSessions.length >= minSessions;
  });
}

function hasStrongParentFeedbackSemester(
  ctx: BadgeCriterionContext,
  minCount: number,
  minAverage: number
) {
  return Array.from(ctx.strongParentFeedbackBySemester.values()).some((summary) => {
    if (summary.count < minCount) return false;
    return summary.totalRating / summary.count >= minAverage;
  });
}

function hasAttendanceThreshold(ctx: BadgeCriterionContext, minRate: number) {
  return ctx.offerings.some((offering) => {
    if (offering.status !== "COMPLETED") return false;
    return buildAttendanceRate(offering) >= minRate;
  });
}

function badgeMetBySlug(slug: string, ctx: BadgeCriterionContext) {
  switch (slug) {
    case "first-whistle":
      return getEventCountByKey(ctx, "CLASS_SESSION_TAUGHT") >= 1;
    case "blueprint-builder":
      return getEventCountByKey(ctx, "CURRICULUM_SUBMITTED") >= 1;
    case "launch-code":
      return hasCurriculumLaunch(ctx);
    case "roll-call-royalty":
      return getEventCountByKey(ctx, "ROLL_CALL_ROYALTY") >= 1;
    case "proof-of-prep":
      return hasSemesterEventThreshold(ctx, ["LESSON_PLAN_LINKED"], 6);
    case "full-season":
      return hasCompletedOfferingWithMinSessions(ctx, 8);
    case "feedback-flipper":
      return getEventCountByKey(ctx, "FEEDBACK_APPLIED") >= 1;
    case "comeback-season":
      return getEventCountByKey(ctx, "RETURNING_SEMESTER") >= 1;
    case "double-take":
      return getEventCountByKey(ctx, "INSTRUCTOR_COLLABORATION") >= 1;
    case "glue-person":
      return hasSemesterEventThreshold(
        ctx,
        [
          "COMMUNITY_EVENT_ATTENDED",
          "INSTRUCTOR_COLLABORATION",
          "NEWER_INSTRUCTOR_SUPPORT",
          "PATHWAYS_CONTRIBUTION",
        ],
        3
      );
    case "torchbearer":
      return getEventCountByKey(ctx, "NEWER_INSTRUCTOR_SUPPORT") >= 1;
    case "pathways-pen":
      return getEventCountByKey(ctx, "PATHWAYS_CONTRIBUTION") >= 1;
    case "crowd-favorite":
      return hasStrongParentFeedbackSemester(ctx, 5, 4.8);
    case "full-house":
      return hasAttendanceThreshold(ctx, 0.85);
    case "return-ticket":
      return getEventCountByKey(ctx, "RETURN_TICKET") >= 1;
    case "seat-at-the-table":
      return getEventCountByKey(ctx, "LEADERSHIP_CONTRIBUTION") >= 1;
    default:
      return false;
  }
}

async function syncInstructorGrowthBadgeAwards(instructorId: string) {
  const [definitions, existingAwards, ctx] = await Promise.all([
    prisma.instructorGrowthBadgeDefinition.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.instructorGrowthBadgeAward.findMany({
      where: { instructorId },
      select: {
        id: true,
        badge: {
          select: {
            slug: true,
          },
        },
      },
    }),
    buildBadgeCriterionContext(instructorId),
  ]);

  const earnedSlugs = new Set(
    definitions
      .filter((definition) => badgeMetBySlug(definition.slug, ctx))
      .map((definition) => definition.slug)
  );
  const existingBySlug = new Map(
    existingAwards.map((award) => [award.badge.slug, award.id] as const)
  );

  const createOps = definitions
    .filter((definition) => earnedSlugs.has(definition.slug) && !existingBySlug.has(definition.slug))
    .map((definition) =>
      prisma.instructorGrowthBadgeAward.create({
        data: {
          instructorId,
          badgeId: definition.id,
          semesterLabel: getCurrentSemesterLabel(),
        },
      })
    );

  const deleteIds = existingAwards
    .filter((award) => !earnedSlugs.has(award.badge.slug))
    .map((award) => award.id);

  if (createOps.length > 0) {
    await prisma.$transaction(createOps);
  }
  if (deleteIds.length > 0) {
    await prisma.instructorGrowthBadgeAward.deleteMany({
      where: {
        id: { in: deleteIds },
      },
    });
  }

  return prisma.instructorGrowthBadgeAward.findMany({
    where: { instructorId },
    include: {
      badge: true,
    },
    orderBy: { awardedAt: "desc" },
  });
}

async function syncInstructorGrowthSemesterStats(
  instructorId: string,
  approvedEvents: Array<{
    category: InstructorGrowthCategory;
    semesterLabel: string | null;
    xpAmount: number;
    occurredAt: Date;
  }>,
  pendingEvents: Array<{ semesterLabel: string | null }>,
  badgeAwards: Array<{ semesterLabel: string | null }>
) {
  const statsMap = new Map<
    string,
    {
      totalXp: number;
      teachingXp: number;
      growthXp: number;
      communityXp: number;
      impactXp: number;
      approvedEventCount: number;
      pendingEventCount: number;
      badgeCount: number;
      lastEventAt: Date | null;
    }
  >();

  for (const event of approvedEvents) {
    if (!event.semesterLabel) continue;
    const current = statsMap.get(event.semesterLabel) ?? {
      totalXp: 0,
      teachingXp: 0,
      growthXp: 0,
      communityXp: 0,
      impactXp: 0,
      approvedEventCount: 0,
      pendingEventCount: 0,
      badgeCount: 0,
      lastEventAt: null,
    };
    current.totalXp += event.xpAmount;
    current.approvedEventCount += 1;
    current.lastEventAt =
      !current.lastEventAt || event.occurredAt > current.lastEventAt
        ? event.occurredAt
        : current.lastEventAt;

    if (event.category === "TEACHING") current.teachingXp += event.xpAmount;
    if (event.category === "GROWTH") current.growthXp += event.xpAmount;
    if (event.category === "COMMUNITY") current.communityXp += event.xpAmount;
    if (event.category === "IMPACT") current.impactXp += event.xpAmount;

    statsMap.set(event.semesterLabel, current);
  }

  for (const event of pendingEvents) {
    if (!event.semesterLabel) continue;
    const current = statsMap.get(event.semesterLabel) ?? {
      totalXp: 0,
      teachingXp: 0,
      growthXp: 0,
      communityXp: 0,
      impactXp: 0,
      approvedEventCount: 0,
      pendingEventCount: 0,
      badgeCount: 0,
      lastEventAt: null,
    };
    current.pendingEventCount += 1;
    statsMap.set(event.semesterLabel, current);
  }

  for (const award of badgeAwards) {
    if (!award.semesterLabel) continue;
    const current = statsMap.get(award.semesterLabel) ?? {
      totalXp: 0,
      teachingXp: 0,
      growthXp: 0,
      communityXp: 0,
      impactXp: 0,
      approvedEventCount: 0,
      pendingEventCount: 0,
      badgeCount: 0,
      lastEventAt: null,
    };
    current.badgeCount += 1;
    statsMap.set(award.semesterLabel, current);
  }

  const semesterLabels = Array.from(statsMap.keys());
  const existing = await prisma.instructorGrowthSemesterStat.findMany({
    where: { instructorId },
    select: { id: true, semesterLabel: true },
  });

  for (const [semesterLabel, stat] of statsMap.entries()) {
    await prisma.instructorGrowthSemesterStat.upsert({
      where: {
        instructorId_semesterLabel: {
          instructorId,
          semesterLabel,
        },
      },
      create: {
        instructorId,
        semesterLabel,
        totalXp: stat.totalXp,
        teachingXp: stat.teachingXp,
        growthXp: stat.growthXp,
        communityXp: stat.communityXp,
        impactXp: stat.impactXp,
        approvedEventCount: stat.approvedEventCount,
        pendingEventCount: stat.pendingEventCount,
        badgeCount: stat.badgeCount,
        lastEventAt: stat.lastEventAt,
      },
      update: {
        totalXp: stat.totalXp,
        teachingXp: stat.teachingXp,
        growthXp: stat.growthXp,
        communityXp: stat.communityXp,
        impactXp: stat.impactXp,
        approvedEventCount: stat.approvedEventCount,
        pendingEventCount: stat.pendingEventCount,
        badgeCount: stat.badgeCount,
        lastEventAt: stat.lastEventAt,
      },
    });
  }

  const staleIds = existing
    .filter((entry) => !semesterLabels.includes(entry.semesterLabel))
    .map((entry) => entry.id);
  if (staleIds.length > 0) {
    await prisma.instructorGrowthSemesterStat.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}

export async function syncInstructorGrowthRollups(instructorId: string) {
  await ensureInstructorGrowthProfile(instructorId);

  const [approvedEvents, pendingEvents, badgeAwards] = await Promise.all([
    prisma.instructorGrowthEvent.findMany({
      where: {
        instructorId,
        status: "APPROVED",
      },
      select: {
        category: true,
        semesterLabel: true,
        xpAmount: true,
        occurredAt: true,
      },
    }),
    prisma.instructorGrowthEvent.findMany({
      where: {
        instructorId,
        status: "PENDING",
      },
      select: {
        semesterLabel: true,
      },
    }),
    syncInstructorGrowthBadgeAwards(instructorId),
  ]);

  const lifetimeXp = approvedEvents.reduce((sum, event) => sum + event.xpAmount, 0);
  const currentSemesterLabel = getCurrentSemesterLabel();
  const currentSemesterXp = approvedEvents
    .filter((event) => event.semesterLabel === currentSemesterLabel)
    .reduce((sum, event) => sum + event.xpAmount, 0);
  const currentTier = getInstructorGrowthTierForXp(lifetimeXp);

  await syncInstructorGrowthSemesterStats(
    instructorId,
    approvedEvents,
    pendingEvents,
    badgeAwards
  );

  await prisma.instructorGrowthProfile.update({
    where: { instructorId },
    data: {
      currentTier: toTierEnum(currentTier.key),
      lifetimeXp,
      currentSemesterLabel,
      currentSemesterXp,
      approvedEventCount: approvedEvents.length,
      pendingEventCount: pendingEvents.length,
      badgeCount: badgeAwards.length,
      lastEvaluatedAt: new Date(),
    },
  });
}

function buildGrowthBreakdown(
  events: Array<{ category: InstructorGrowthCategory; xpAmount: number }>
): GrowthBreakdown {
  const breakdown = emptyBreakdown();
  for (const event of events) {
    breakdown[event.category].value += event.xpAmount;
  }
  return breakdown;
}

export async function getInstructorGrowthSuspicionFlags(
  instructorId: string
): Promise<InstructorGrowthSuspicionFlag[]> {
  const events = await prisma.instructorGrowthEvent.findMany({
    where: {
      instructorId,
      sourceMethod: { in: ["CLAIM", "MANUAL"] },
    },
    select: {
      id: true,
      status: true,
      eventKey: true,
      evidenceUrl: true,
      relatedUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const flags: InstructorGrowthSuspicionFlag[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sameWeekPending = events.filter(
    (event) => event.status === "PENDING" && event.createdAt >= sevenDaysAgo
  ).length;
  if (sameWeekPending >= 5) {
    flags.push({
      title: "High pending claim volume",
      detail: `${sameWeekPending} pending claims landed in the last 7 days.`,
      severity: "warning",
    });
  }

  const duplicateEvidence = new Map<string, number>();
  for (const event of events) {
    if (!event.evidenceUrl) continue;
    duplicateEvidence.set(
      event.evidenceUrl,
      (duplicateEvidence.get(event.evidenceUrl) ?? 0) + 1
    );
  }
  const duplicateEvidenceCount = Array.from(duplicateEvidence.values()).filter(
    (count) => count > 1
  ).length;
  if (duplicateEvidenceCount > 0) {
    flags.push({
      title: "Repeated evidence links",
      detail: `${duplicateEvidenceCount} evidence link pattern${duplicateEvidenceCount === 1 ? "" : "s"} repeated across claims.`,
      severity: "warning",
    });
  }

  const reviewed = events.filter(
    (event) => event.status === "APPROVED" || event.status === "REJECTED" || event.status === "REVOKED"
  );
  if (reviewed.length >= 4) {
    const rejected = reviewed.filter(
      (event) => event.status === "REJECTED" || event.status === "REVOKED"
    ).length;
    const rejectRatio = rejected / reviewed.length;
    if (rejectRatio >= 0.5) {
      flags.push({
        title: "High reject ratio",
        detail: `${Math.round(rejectRatio * 100)}% of recent reviewed claims were rejected or revoked.`,
        severity: "warning",
      });
    }
  }

  const repeatedPairs = new Map<string, number>();
  for (const event of events) {
    if (!event.relatedUserId) continue;
    if (
      event.eventKey !== "INSTRUCTOR_COLLABORATION" &&
      event.eventKey !== "NEWER_INSTRUCTOR_SUPPORT"
    ) {
      continue;
    }
    const pairKey = `${event.eventKey}:${event.relatedUserId}`;
    repeatedPairs.set(pairKey, (repeatedPairs.get(pairKey) ?? 0) + 1);
  }
  if (Array.from(repeatedPairs.values()).some((count) => count >= 3)) {
    flags.push({
      title: "Repeated collaborator pairing",
      detail: "The same collaborator appears repeatedly across reviewed claims.",
      severity: "info",
    });
  }

  const sameDayCounts = new Map<string, number>();
  for (const event of events) {
    if (event.status !== "PENDING") continue;
    const dayKey = event.createdAt.toISOString().slice(0, 10);
    sameDayCounts.set(dayKey, (sameDayCounts.get(dayKey) ?? 0) + 1);
  }
  const highestSameDayVolume = Math.max(0, ...sameDayCounts.values());
  if (highestSameDayVolume >= 4) {
    flags.push({
      title: "Same-day claim spike",
      detail: `${highestSameDayVolume} claims were submitted on the same day.`,
      severity: "info",
    });
  }

  return flags;
}

export async function submitInstructorGrowthClaim(input: {
  instructorId: string;
  submittedById: string;
  eventKey: string;
  claimDate: Date;
  claimContext: string;
  evidenceUrl?: string | null;
  relatedUserId?: string | null;
}) {
  const template = getInstructorGrowthClaimTemplate(input.eventKey);
  if (!template) {
    throw new Error("That claim type is not available.");
  }

  if (template.needsCounterparty && !input.relatedUserId) {
    throw new Error("Please choose the other instructor involved before submitting this claim.");
  }

  const mentor = await getAssignedInstructorMentor(input.instructorId);
  const semesterLabel = deriveSemesterLabel(input.claimDate);

  if (template.eventKey === "REFLECTION_SUBMITTED") {
    const monthStart = new Date(input.claimDate.getFullYear(), input.claimDate.getMonth(), 1);
    const nextMonth = new Date(input.claimDate.getFullYear(), input.claimDate.getMonth() + 1, 1);
    const existingReflectionClaims = await prisma.instructorGrowthEvent.count({
      where: {
        instructorId: input.instructorId,
        eventKey: "REFLECTION_SUBMITTED",
        status: { in: ["PENDING", "APPROVED"] },
        occurredAt: {
          gte: monthStart,
          lt: nextMonth,
        },
      },
    });
    if (existingReflectionClaims >= 2) {
      throw new Error("Reflection claims are capped at 2 per month.");
    }
  }

  return prisma.instructorGrowthEvent.create({
    data: {
      instructorId: input.instructorId,
      category: toCategoryEnum(template.category),
      sourceMethod: "CLAIM",
      status: "PENDING",
      eventKey: template.eventKey,
      title: template.title,
      description: template.prompt,
      xpAmount: template.xpAmount,
      semesterLabel,
      occurredAt: input.claimDate,
      sourceType: "CLAIM",
      sourceId: input.submittedById,
      relatedUserId: input.relatedUserId || null,
      submittedById: input.submittedById,
      assignedMentorId: mentor?.mentor.id ?? null,
      claimContext: input.claimContext,
      evidenceUrl: input.evidenceUrl || null,
    },
    select: {
      id: true,
      assignedMentorId: true,
    },
  });
}

export async function reviewInstructorGrowthClaim(input: {
  eventId: string;
  reviewerId: string;
  decision: PendingReviewDecision;
  reviewNotes?: string | null;
}) {
  const existing = await prisma.instructorGrowthEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      instructorId: true,
      status: true,
    },
  });

  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (existing.status !== "PENDING") {
    throw new Error("Only pending claims can be reviewed.");
  }
  if (input.decision === "REJECTED" && !input.reviewNotes?.trim()) {
    throw new Error("Please leave a short note when rejecting a claim.");
  }

  const updated = await prisma.instructorGrowthEvent.update({
    where: { id: input.eventId },
    data: {
      status: input.decision,
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes?.trim() || null,
    },
    select: {
      id: true,
      instructorId: true,
      status: true,
    },
  });

  await syncInstructorGrowthRollups(updated.instructorId);
  return updated;
}

export async function revokeInstructorGrowthEvent(input: {
  eventId: string;
  reviewerId: string;
  reason: string;
}) {
  const existing = await prisma.instructorGrowthEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      instructorId: true,
      status: true,
      sourceMethod: true,
    },
  });

  if (!existing) {
    throw new Error("Growth event not found.");
  }
  if (existing.status !== "APPROVED") {
    throw new Error("Only approved events can be revoked.");
  }
  if (existing.sourceMethod === "AUTO") {
    throw new Error("Auto-tracked events cannot be manually revoked from this surface.");
  }
  if (!input.reason.trim()) {
    throw new Error("Please include a reason for the reversal.");
  }

  const updated = await prisma.instructorGrowthEvent.update({
    where: { id: input.eventId },
    data: {
      status: "REVOKED",
      revokedById: input.reviewerId,
      revokedAt: new Date(),
      revokedReason: input.reason.trim(),
    },
    select: {
      id: true,
      instructorId: true,
      status: true,
    },
  });

  await syncInstructorGrowthRollups(updated.instructorId);
  return updated;
}

export async function getInstructorGrowthDashboardData(instructorId: string) {
  await syncInstructorGrowthSignalsForInstructor(instructorId);

  const [
    instructor,
    profile,
    mentorLink,
    relatedUserOptions,
    pendingClaims,
    recentEvents,
    approvedEvents,
    badgeDefinitions,
    badgeAwards,
    semesterStats,
  ] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: instructorId },
        select: {
          id: true,
          name: true,
          email: true,
          chapterId: true,
          chapter: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.instructorGrowthProfile.findUnique({
        where: { instructorId },
      }),
      getAssignedInstructorMentor(instructorId),
      prisma.user.findUnique({
        where: { id: instructorId },
        select: { chapterId: true },
      }).then((user) =>
        getInstructorGrowthRelatedUserOptions(instructorId, user?.chapterId ?? null)
      ),
      prisma.instructorGrowthEvent.findMany({
        where: {
          instructorId,
          status: "PENDING",
          sourceMethod: "CLAIM",
        },
        include: {
          relatedUser: {
            select: { id: true, name: true },
          },
          submittedBy: {
            select: { id: true, name: true },
          },
          assignedMentor: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.instructorGrowthEvent.findMany({
        where: { instructorId },
        include: {
          relatedUser: {
            select: { id: true, name: true },
          },
          reviewer: {
            select: { id: true, name: true },
          },
          submittedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 14,
      }),
      prisma.instructorGrowthEvent.findMany({
        where: {
          instructorId,
          status: "APPROVED",
        },
        select: {
          category: true,
          xpAmount: true,
          semesterLabel: true,
        },
      }),
      prisma.instructorGrowthBadgeDefinition.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }),
      prisma.instructorGrowthBadgeAward.findMany({
        where: { instructorId },
        include: { badge: true },
      }),
      prisma.instructorGrowthSemesterStat.findMany({
        where: { instructorId },
        orderBy: { semesterLabel: "desc" },
        take: 6,
      }),
    ]);

  if (!instructor || !profile) {
    return null;
  }

  const currentTier = getInstructorGrowthTier(profile.currentTier);
  const nextTier = getNextInstructorGrowthTier(profile.lifetimeXp);
  const xpIntoCurrentTier = profile.lifetimeXp - currentTier.minXp;
  const xpNeededForNextTier = nextTier
    ? nextTier.minXp - currentTier.minXp
    : 0;
  const progressPercent =
    nextTier && xpNeededForNextTier > 0
      ? Math.max(0, Math.min(100, Math.round((xpIntoCurrentTier / xpNeededForNextTier) * 100)))
      : 100;

  const currentSemesterLabel = profile.currentSemesterLabel || getCurrentSemesterLabel();
  const lifetimeBreakdown = buildGrowthBreakdown(
    approvedEvents.map((event) => ({
      category: event.category,
      xpAmount: event.xpAmount,
    }))
  );
  const semesterBreakdown = buildGrowthBreakdown(
    approvedEvents
      .filter(
        (event) =>
          event.semesterLabel === currentSemesterLabel
      )
      .map((event) => ({
        category: event.category,
        xpAmount: event.xpAmount,
      }))
  );

  const earnedBadgeIds = new Set(badgeAwards.map((award) => award.badgeId));
  const visibleBadges = badgeDefinitions.map((badge) => {
    const award = badgeAwards.find((candidate) => candidate.badgeId === badge.id) ?? null;
    return {
      ...badge,
      award,
      unlocked: earnedBadgeIds.has(badge.id),
    };
  });

  return {
    instructor,
    mentor: mentorLink?.mentor ?? null,
    mentorMissing: !mentorLink,
    profile,
    currentTier,
    nextTier,
    progressPercent,
    pointsToNextTier: nextTier ? nextTier.minXp - profile.lifetimeXp : 0,
    lifetimeBreakdown,
    semesterBreakdown,
    currentSemesterLabel,
    recentEvents: recentEvents.map((event) => ({
      ...event,
      categoryLabel: getCategoryLabel(event.category),
      statusPill: buildStatusPill(event.status),
      sourceHref: getGrowthSourceHref(event),
    })),
    pendingClaims: pendingClaims.map((event) => ({
      ...event,
      categoryLabel: getCategoryLabel(event.category),
      statusPill: buildStatusPill(event.status),
    })),
    tierRail: INSTRUCTOR_GROWTH_TIERS,
    rules: INSTRUCTOR_GROWTH_RULES,
    claimTemplates: INSTRUCTOR_GROWTH_CLAIM_TEMPLATES,
    relatedUserOptions,
    visibleBadges,
    semesterStats,
    suspiciousFlags: await getInstructorGrowthSuspicionFlags(instructorId),
  };
}

export async function getInstructorGrowthReviewQueueData(viewer: ViewerContext) {
  const where: Prisma.InstructorGrowthEventWhereInput = {
    status: "PENDING",
    sourceMethod: "CLAIM",
  };

  if (viewer.roles.includes("MENTOR") && !viewer.roles.includes("ADMIN") && !viewer.roles.includes("CHAPTER_PRESIDENT")) {
    where.assignedMentorId = viewer.userId;
  } else if (viewer.roles.includes("CHAPTER_PRESIDENT") && !viewer.roles.includes("ADMIN")) {
    where.instructor = {
      chapterId: viewer.chapterId ?? null,
    };
  }

  const [pendingClaims, recentReviewed] = await Promise.all([
    prisma.instructorGrowthEvent.findMany({
      where,
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
        assignedMentor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        relatedUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.instructorGrowthEvent.findMany({
      where: {
        ...where,
        status: { in: ["APPROVED", "REJECTED"] },
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
      take: 8,
    }),
  ]);

  const uniqueInstructorIds = Array.from(
    new Set(pendingClaims.map((claim) => claim.instructorId))
  );
  const flagEntries = await Promise.all(
    uniqueInstructorIds.map(async (instructorId) => ({
      instructorId,
      flags: await getInstructorGrowthSuspicionFlags(instructorId),
    }))
  );
  const flagsByInstructor = new Map(
    flagEntries.map((entry) => [entry.instructorId, entry.flags] as const)
  );

  return {
    summary: {
      pendingCount: pendingClaims.length,
      instructorCount: uniqueInstructorIds.length,
      mentorRoutedCount: pendingClaims.filter((claim) => Boolean(claim.assignedMentorId)).length,
      missingMentorCount: pendingClaims.filter((claim) => !claim.assignedMentorId).length,
    },
    pendingClaims: pendingClaims.map((claim) => ({
      ...claim,
      statusPill: buildStatusPill(claim.status),
      flags: flagsByInstructor.get(claim.instructorId) ?? [],
    })),
    recentReviewed: recentReviewed.map((claim) => ({
      ...claim,
      statusPill: buildStatusPill(claim.status),
    })),
  };
}
