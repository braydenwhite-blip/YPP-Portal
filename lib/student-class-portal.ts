import type { PathwayFallbackRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getClassTemplateCapabilities,
  getClassTemplateSelect,
} from "@/lib/class-template-compat";

type OfferingCardRecord = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  capacity: number;
  enrollmentOpen: boolean;
  introVideoUrl: string | null;
  chapterId: string | null;
  template: {
    description: string;
    interestArea: string;
    difficultyLevel: string;
    learnerFitLabel: string | null;
    learnerFitDescription: string | null;
    learningOutcomes: string[];
    durationWeeks: number;
  };
  instructor: {
    id: string;
    name: string;
  };
  chapter: {
    id: string;
    name: string;
    city: string | null;
    region: string | null;
  } | null;
  pathwayStep: {
    id: string;
    stepOrder: number;
    pathwayId: string;
    pathway: {
      id: string;
      name: string;
    };
  } | null;
  sessions: Array<{
    date: Date;
    startTime: string;
    topic: string;
  }>;
  _count: {
    enrollments: number;
  };
};

export type StudentClassCard = {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  enrollmentOpen: boolean;
  introVideoUrl: string | null;
  capacity: number;
  enrolledCount: number;
  spotsLeft: number;
  isFull: boolean;
  chapterId: string | null;
  chapterLabel: string | null;
  isPartnerChapter: boolean;
  template: {
    interestArea: string;
    difficultyLevel: string;
    learnerFitLabel: string | null;
    learnerFitDescription: string | null;
    learningOutcomes: string[];
    durationWeeks: number;
  };
  instructor: {
    id: string;
    name: string;
  };
  pathway:
    | {
        id: string;
        name: string;
        stepOrder: number;
      }
    | null;
  nextSession:
    | {
        date: Date;
        startTime: string;
        topic: string;
      }
    | null;
  recommendationReasons: string[];
  reasonLabel: string | null;
};

export type StudentClassOpportunityContext = {
  requiresFallbackApproval: boolean;
  fallbackRequestStatus: PathwayFallbackRequestStatus | null;
  canRequestFallback: boolean;
  fallbackPathwayId: string | null;
  fallbackPathwayStepId: string | null;
  alternatives: StudentClassCard[];
};

export type MyClassesHubData = {
  stats: {
    activeCount: number;
    waitlistedCount: number;
    assignmentsDueCount: number;
    upcomingSessionsCount: number;
  };
  activeClasses: Array<{
    id: string;
    enrolledAt: Date;
    sessionsAttended: number;
    offering: StudentClassCard;
  }>;
  waitlistedClasses: Array<{
    id: string;
    enrolledAt: Date;
    waitlistPosition: number | null;
    offering: StudentClassCard;
  }>;
  nextSession:
    | {
        id: string;
        date: Date;
        startTime: string;
        endTime: string;
        topic: string;
        offeringId: string;
        classTitle: string;
        instructorName: string;
        zoomLink: string | null;
      }
    | null;
  dueAssignments: Array<{
    id: string;
    title: string;
    dueAt: Date;
    offeringId: string;
    offeringTitle: string;
    submissionStatus: string | null;
    isOverdue: boolean;
  }>;
  recentAnnouncements: Array<{
    id: string;
    title: string;
    createdAt: Date;
    isPinned: boolean;
    authorName: string;
    offeringId: string;
    offeringTitle: string;
  }>;
  recommendedClasses: StudentClassCard[];
};

function normalizeInterestArea(value: string) {
  return value.trim().toLowerCase().replace(/_/g, " ");
}

function formatChapterLabel(chapter: {
  name: string;
  city: string | null;
  region: string | null;
} | null) {
  if (!chapter) return null;
  if (chapter.city && chapter.region) return `${chapter.name} (${chapter.city}, ${chapter.region})`;
  if (chapter.city) return `${chapter.name} (${chapter.city})`;
  return chapter.name;
}

function dedupeCards(cards: StudentClassCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function mapOfferingCard(
  offering: OfferingCardRecord,
  userChapterId: string | null,
  recommendationReasons: string[] = [],
  reasonLabel: string | null = null,
): StudentClassCard {
  const enrolledCount = offering._count.enrollments;
  const spotsLeft = Math.max(0, offering.capacity - enrolledCount);

  return {
    id: offering.id,
    title: offering.title,
    description: offering.template.description,
    startDate: offering.startDate,
    endDate: offering.endDate,
    meetingDays: offering.meetingDays,
    meetingTime: offering.meetingTime,
    deliveryMode: offering.deliveryMode,
    enrollmentOpen: offering.enrollmentOpen,
    introVideoUrl: offering.introVideoUrl,
    capacity: offering.capacity,
    enrolledCount,
    spotsLeft,
    isFull: spotsLeft <= 0,
    chapterId: offering.chapterId,
    chapterLabel: formatChapterLabel(offering.chapter),
    isPartnerChapter: Boolean(userChapterId && offering.chapterId && offering.chapterId !== userChapterId),
    template: {
      interestArea: offering.template.interestArea,
      difficultyLevel: offering.template.difficultyLevel,
      learnerFitLabel: offering.template.learnerFitLabel,
      learnerFitDescription: offering.template.learnerFitDescription,
      learningOutcomes: offering.template.learningOutcomes,
      durationWeeks: offering.template.durationWeeks,
    },
    instructor: offering.instructor,
    pathway: offering.pathwayStep
      ? {
          id: offering.pathwayStep.pathway.id,
          name: offering.pathwayStep.pathway.name,
          stepOrder: offering.pathwayStep.stepOrder,
        }
      : null,
    nextSession: offering.sessions[0]
      ? {
          date: offering.sessions[0].date,
          startTime: offering.sessions[0].startTime,
          topic: offering.sessions[0].topic,
        }
      : null,
    recommendationReasons,
    reasonLabel,
  };
}

function shouldBoostLocalChapter(offeringChapterId: string | null, userChapterId: string | null) {
  return Boolean(userChapterId && offeringChapterId === userChapterId);
}

export function shouldUseUnifiedStudentClassExperience(input: {
  primaryRole?: string | null;
  roles?: string[] | null;
}) {
  const roles = new Set(input.roles ?? []);

  if (input.primaryRole === "STUDENT") {
    return true;
  }

  if (!roles.has("STUDENT")) {
    return false;
  }

  return !["ADMIN", "STAFF", "INSTRUCTOR", "CHAPTER_PRESIDENT"].some((role) =>
    roles.has(role),
  );
}

async function getOfferingCards(where: Record<string, unknown>) {
  const capabilities = await getClassTemplateCapabilities();

  return prisma.classOffering.findMany({
    where,
    include: {
      template: {
        select: getClassTemplateSelect({
          includeLearnerFit: capabilities.hasLearnerFitFields,
          includeWorkflow: capabilities.hasReviewWorkflow,
        }),
      },
      instructor: { select: { id: true, name: true } },
      chapter: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
        },
      },
      pathwayStep: {
        select: {
          id: true,
          stepOrder: true,
          pathwayId: true,
          pathway: { select: { id: true, name: true } },
        },
      },
      sessions: {
        where: { date: { gte: new Date() }, isCancelled: false },
        orderBy: { date: "asc" },
        take: 1,
        select: { date: true, startTime: true, topic: true },
      },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
  }) as Promise<OfferingCardRecord[]>;
}

export async function getRecommendedClassOfferings(
  userId: string,
  options?: {
    excludeOfferingId?: string;
    interestArea?: string;
    limit?: number;
  },
) {
  const limit = options?.limit ?? 6;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      chapterId: true,
      profile: { select: { interests: true } },
      classEnrollments: {
        where: {
          status: { in: ["ENROLLED", "WAITLISTED", "COMPLETED"] },
        },
        select: {
          offeringId: true,
          status: true,
          offering: {
            select: {
              chapterId: true,
              template: {
                select: {
                  interestArea: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const userChapterId = user?.chapterId ?? null;
  const excludedOfferingIds = new Set(
    user?.classEnrollments.map((enrollment) => enrollment.offeringId) ?? [],
  );

  if (options?.excludeOfferingId) {
    excludedOfferingIds.add(options.excludeOfferingId);
  }

  const interestHints = new Set(
    (user?.profile?.interests ?? []).map((interest) => normalizeInterestArea(interest)),
  );
  const activeAreas = new Set(
    (user?.classEnrollments ?? [])
      .filter((enrollment) => enrollment.status === "ENROLLED" || enrollment.status === "WAITLISTED")
      .map((enrollment) => normalizeInterestArea(enrollment.offering.template.interestArea)),
  );
  const completedAreas = new Set(
    (user?.classEnrollments ?? [])
      .filter((enrollment) => enrollment.status === "COMPLETED")
      .map((enrollment) => normalizeInterestArea(enrollment.offering.template.interestArea)),
  );

  const offerings = await getOfferingCards({
    status: { in: ["PUBLISHED", "IN_PROGRESS"] },
    ...(excludedOfferingIds.size > 0
      ? { id: { notIn: [...excludedOfferingIds] } }
      : {}),
    ...(options?.interestArea
      ? {
          template: {
            interestArea: options.interestArea,
          },
        }
      : {}),
  });

  const scoredCards = offerings
    .map((offering) => {
      const reasons: string[] = [];
      let score = 0;
      const normalizedArea = normalizeInterestArea(offering.template.interestArea);

      if (interestHints.has(normalizedArea)) {
        score += 14;
        reasons.push("Matches your interests");
      }

      if (completedAreas.has(normalizedArea)) {
        score += 8;
        reasons.push("Builds on classes you've already finished");
      } else if (activeAreas.has(normalizedArea)) {
        score += 6;
        reasons.push("Keeps momentum in a passion area you're already exploring");
      }

      if (options?.interestArea && normalizedArea === normalizeInterestArea(options.interestArea)) {
        score += 5;
        reasons.push("Stays close to the area you're exploring right now");
      }

      if (shouldBoostLocalChapter(offering.chapterId, userChapterId)) {
        score += 4;
        reasons.push("Runs through your chapter");
      }

      if (offering.pathwayStep) {
        score += 3;
        reasons.push(`Connected to ${offering.pathwayStep.pathway.name}`);
      }

      if (offering.introVideoUrl) {
        score += 1;
        reasons.push("Includes an instructor intro");
      }

      if (!offering.enrollmentOpen) {
        score -= 3;
      }

      return {
        card: mapOfferingCard(offering, userChapterId, reasons.slice(0, 3), reasons[0] ?? null),
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.card.isPartnerChapter !== right.card.isPartnerChapter) {
        return Number(left.card.isPartnerChapter) - Number(right.card.isPartnerChapter);
      }
      return left.card.startDate.getTime() - right.card.startDate.getTime();
    })
    .map((entry) => entry.card);

  if (scoredCards.length >= limit) {
    return scoredCards.slice(0, limit);
  }

  const fallbackCards = offerings
    .filter((offering) => !scoredCards.some((card) => card.id === offering.id))
    .map((offering) =>
      mapOfferingCard(
        offering,
        userChapterId,
        [shouldBoostLocalChapter(offering.chapterId, userChapterId) ? "Available through your chapter" : "Open class you can explore next"],
        shouldBoostLocalChapter(offering.chapterId, userChapterId)
          ? "Available through your chapter"
          : "Open class you can explore next",
      ),
    )
    .sort((left, right) => {
      if (left.isPartnerChapter !== right.isPartnerChapter) {
        return Number(left.isPartnerChapter) - Number(right.isPartnerChapter);
      }
      if (left.isFull !== right.isFull) {
        return Number(left.isFull) - Number(right.isFull);
      }
      return left.startDate.getTime() - right.startDate.getTime();
    });

  return [...scoredCards, ...fallbackCards].slice(0, limit);
}

export async function getStudentClassOpportunityContext(
  offeringId: string,
  userId: string,
): Promise<StudentClassOpportunityContext> {
  const [student, offering] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { chapterId: true },
    }),
    prisma.classOffering.findUnique({
      where: { id: offeringId },
      select: {
        id: true,
        chapterId: true,
        template: {
          select: {
            interestArea: true,
            difficultyLevel: true,
          },
        },
        pathwayStep: {
          select: {
            id: true,
            pathwayId: true,
          },
        },
      },
    }),
  ]);

  if (!offering) {
    return {
      requiresFallbackApproval: false,
      fallbackRequestStatus: null,
      canRequestFallback: false,
      fallbackPathwayId: null,
      fallbackPathwayStepId: null,
      alternatives: [],
    };
  }

  const requiresFallbackApproval = Boolean(
    student?.chapterId &&
      offering.chapterId &&
      student.chapterId !== offering.chapterId,
  );

  const fallbackRequest = requiresFallbackApproval
    ? await prisma.pathwayFallbackRequest.findFirst({
        where: {
          studentId: userId,
          targetOfferingId: offeringId,
        },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      })
    : null;

  const sameStepAlternatives = offering.pathwayStep?.id
    ? await getOfferingCards({
        id: { not: offeringId },
        status: { in: ["PUBLISHED", "IN_PROGRESS"] },
        pathwayStepId: offering.pathwayStep.id,
      })
    : [];

  const sameAreaAlternatives = await getOfferingCards({
    id: { not: offeringId },
    status: { in: ["PUBLISHED", "IN_PROGRESS"] },
    template: {
      interestArea: offering.template.interestArea,
      difficultyLevel: offering.template.difficultyLevel,
    },
  });

  const recommended = await getRecommendedClassOfferings(userId, {
    excludeOfferingId: offeringId,
    interestArea: offering.template.interestArea,
    limit: 6,
  });

  const localAlternativeCards = sameAreaAlternatives
    .filter((candidate) => candidate.chapterId === student?.chapterId)
    .map((candidate) =>
      mapOfferingCard(
        candidate,
        student?.chapterId ?? null,
        ["Local option in the same interest area"],
        "Local option",
      ),
    );

  const sameStepCards = sameStepAlternatives.map((candidate) =>
    mapOfferingCard(
      candidate,
      student?.chapterId ?? null,
      ["Another run for this same pathway step"],
      "Same pathway step",
    ),
  );

  const alternativeCards = dedupeCards([
    ...sameStepCards,
    ...localAlternativeCards,
    ...recommended,
  ]).sort((left, right) => {
    if (left.reasonLabel === "Same pathway step" && right.reasonLabel !== "Same pathway step") {
      return -1;
    }
    if (right.reasonLabel === "Same pathway step" && left.reasonLabel !== "Same pathway step") {
      return 1;
    }
    if (left.isFull !== right.isFull) {
      return Number(left.isFull) - Number(right.isFull);
    }
    if (left.isPartnerChapter !== right.isPartnerChapter) {
      return Number(left.isPartnerChapter) - Number(right.isPartnerChapter);
    }
    return left.startDate.getTime() - right.startDate.getTime();
  });

  return {
    requiresFallbackApproval,
    fallbackRequestStatus: fallbackRequest?.status ?? null,
    canRequestFallback: Boolean(offering.pathwayStep?.id && offering.pathwayStep.pathwayId),
    fallbackPathwayId: offering.pathwayStep?.pathwayId ?? null,
    fallbackPathwayStepId: offering.pathwayStep?.id ?? null,
    alternatives: alternativeCards.slice(0, 4),
  };
}

export async function getMyClassesHubData(userId: string): Promise<MyClassesHubData> {
  const capabilities = await getClassTemplateCapabilities();
  const [user, enrollments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { chapterId: true },
    }),
    prisma.classEnrollment.findMany({
    where: {
      studentId: userId,
      status: { in: ["ENROLLED", "WAITLISTED"] },
    },
    include: {
      offering: {
        include: {
          template: {
            select: getClassTemplateSelect({
              includeLearnerFit: capabilities.hasLearnerFitFields,
              includeWorkflow: capabilities.hasReviewWorkflow,
            }),
          },
          instructor: { select: { id: true, name: true } },
          chapter: {
            select: {
              id: true,
              name: true,
              city: true,
              region: true,
            },
          },
          pathwayStep: {
            select: {
              id: true,
              stepOrder: true,
              pathwayId: true,
              pathway: { select: { id: true, name: true } },
            },
          },
          sessions: {
            where: { date: { gte: new Date() }, isCancelled: false },
            orderBy: { date: "asc" },
            take: 1,
            select: { date: true, startTime: true, topic: true },
          },
          _count: {
            select: {
              enrollments: { where: { status: "ENROLLED" } },
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
    }),
  ]);

  const activeClasses = enrollments
    .filter((enrollment) => enrollment.status === "ENROLLED")
    .map((enrollment) => ({
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      sessionsAttended: enrollment.sessionsAttended,
      offering: mapOfferingCard(
        enrollment.offering as unknown as OfferingCardRecord,
        user?.chapterId ?? null,
      ),
    }))
    .sort((left, right) => {
      const leftNext = left.offering.nextSession?.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightNext = right.offering.nextSession?.date?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftNext - rightNext;
    });

  const waitlistedClasses = enrollments
    .filter((enrollment) => enrollment.status === "WAITLISTED")
    .map((enrollment) => ({
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      waitlistPosition: enrollment.waitlistPosition,
      offering: mapOfferingCard(
        enrollment.offering as unknown as OfferingCardRecord,
        user?.chapterId ?? null,
      ),
    }))
    .sort((left, right) => (left.waitlistPosition ?? 999) - (right.waitlistPosition ?? 999));

  const activeOfferingIds = activeClasses.map((enrollment) => enrollment.offering.id);

  const [dueAssignmentsRaw, recentAnnouncements, nextSession, upcomingSessionsCount] =
    activeOfferingIds.length > 0
      ? await Promise.all([
          prisma.classAssignment.findMany({
            where: {
              offeringId: { in: activeOfferingIds },
              isPublished: true,
              OR: [
                { hardDeadline: { not: null } },
                { suggestedDueDate: { not: null } },
              ],
            },
            include: {
              offering: { select: { id: true, title: true } },
              submissions: {
                where: { studentId: userId },
                select: { status: true },
                take: 1,
              },
            },
          }),
          prisma.classAnnouncement.findMany({
            where: { offeringId: { in: activeOfferingIds } },
            orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
            take: 5,
            select: {
              id: true,
              title: true,
              createdAt: true,
              isPinned: true,
              author: { select: { name: true } },
              offering: { select: { id: true, title: true } },
            },
          }),
          prisma.classSession.findFirst({
            where: {
              offeringId: { in: activeOfferingIds },
              date: { gte: new Date() },
              isCancelled: false,
            },
            orderBy: { date: "asc" },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              topic: true,
              offering: {
                select: {
                  id: true,
                  title: true,
                  zoomLink: true,
                  instructor: { select: { name: true } },
                },
              },
            },
          }),
          prisma.classSession.count({
            where: {
              offeringId: { in: activeOfferingIds },
              date: {
                gte: new Date(),
                lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
              isCancelled: false,
            },
          }),
        ])
      : [[], [], null, 0];

  const dueAssignments: MyClassesHubData["dueAssignments"] = [];
  dueAssignmentsRaw.forEach((assignment) => {
      const dueAt = assignment.hardDeadline ?? assignment.suggestedDueDate;
      const submissionStatus = assignment.submissions[0]?.status ?? null;

      if (!dueAt) return;
      if (submissionStatus === "SUBMITTED" || submissionStatus === "FEEDBACK_GIVEN") return;

      dueAssignments.push({
        id: assignment.id,
        title: assignment.title,
        dueAt,
        offeringId: assignment.offering.id,
        offeringTitle: assignment.offering.title,
        submissionStatus,
        isOverdue: dueAt.getTime() < Date.now(),
      });
    });

  dueAssignments.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
  const trimmedDueAssignments = dueAssignments.slice(0, 6);

  const recommendedClasses =
    activeClasses.length === 0 && waitlistedClasses.length === 0
      ? await getRecommendedClassOfferings(userId, { limit: 4 })
      : [];

  return {
    stats: {
      activeCount: activeClasses.length,
      waitlistedCount: waitlistedClasses.length,
      assignmentsDueCount: trimmedDueAssignments.length,
      upcomingSessionsCount,
    },
    activeClasses,
    waitlistedClasses,
    nextSession: nextSession
      ? {
          id: nextSession.id,
          date: nextSession.date,
          startTime: nextSession.startTime,
          endTime: nextSession.endTime,
          topic: nextSession.topic,
          offeringId: nextSession.offering.id,
          classTitle: nextSession.offering.title,
          instructorName: nextSession.offering.instructor.name,
          zoomLink: nextSession.offering.zoomLink,
        }
      : null,
    dueAssignments: trimmedDueAssignments,
    recentAnnouncements: recentAnnouncements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      createdAt: announcement.createdAt,
      isPinned: announcement.isPinned,
      authorName: announcement.author.name,
      offeringId: announcement.offering.id,
      offeringTitle: announcement.offering.title,
    })),
    recommendedClasses,
  };
}
