import { prisma } from "@/lib/prisma";

const ACTIVE_OFFERING_STATUSES = ["PUBLISHED", "IN_PROGRESS"] as const;
const ACTIVE_ENROLLMENT_STATUSES = new Set(["ENROLLED", "WAITLISTED", "COMPLETED"]);

type StepRequirementLike = {
  id: string;
  stepOrder: number;
  classTemplateId: string | null;
  title: string | null;
  classTemplate: { title: string } | null;
  course: { title: string } | null;
};

type StepLike = StepRequirementLike & {
  courseId: string | null;
  prerequisites?: StepRequirementLike[];
};

type OfferingLike = {
  id: string;
  title: string;
  templateId: string;
  pathwayStepId: string | null;
  chapterId: string | null;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  locationName: string | null;
  locationAddress: string | null;
  zoomLink: string | null;
  status: string;
  chapter: {
    id: string;
    name: string;
    city: string | null;
    region: string | null;
  } | null;
  instructor: {
    id: string;
    name: string;
  };
  _count: {
    enrollments: number;
  };
};

type EnrollmentLike = {
  status: "ENROLLED" | "WAITLISTED" | "DROPPED" | "COMPLETED";
  offering: {
    id: string;
    title: string;
    templateId: string;
    pathwayStepId: string | null;
    chapterId: string | null;
  };
};

type FallbackRequestLike = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  pathwayStepId: string;
  targetOfferingId: string | null;
};

export type JourneyOfferingSummary = {
  id: string;
  title: string;
  chapterId: string | null;
  chapterName: string | null;
  chapterLabel: string | null;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  locationName: string | null;
  locationAddress: string | null;
  zoomLink: string | null;
  enrolledCount: number;
  instructorName: string;
  requestStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
};

export type JourneyStepSummary = {
  id: string;
  stepOrder: number;
  title: string;
  classTemplateId: string | null;
  status: "NOT_STARTED" | "WAITLISTED" | "ENROLLED" | "COMPLETED";
  requiredStepTitles: string[];
  requirementsMet: boolean;
  isLocallyAvailable: boolean;
  localOfferings: JourneyOfferingSummary[];
  partnerOfferings: JourneyOfferingSummary[];
  allOfferings: JourneyOfferingSummary[];
};

export type ChapterPathwayJourneySummary = {
  id: string;
  name: string;
  description: string;
  interestArea: string;
  isVisibleInChapter: boolean;
  isFeatured: boolean;
  displayOrder: number;
  runStatus: "NOT_OFFERED" | "COMING_SOON" | "ACTIVE" | "PAUSED";
  ownerName: string | null;
  hasLocalRun: boolean;
  localAvailableStepCount: number;
  totalCount: number;
  completedCount: number;
  progressPercent: number;
  isEnrolled: boolean;
  isComplete: boolean;
  hasLegacyOnlySteps: boolean;
  currentStep: JourneyStepSummary | null;
  nextJoinableStep: JourneyStepSummary | null;
  nextRecommendedStep: JourneyStepSummary | null;
  localNextOffering: JourneyOfferingSummary | null;
  fallbackOfferings: JourneyOfferingSummary[];
  steps: JourneyStepSummary[];
};

export type StudentChapterJourneyData = {
  chapterId: string | null;
  chapterName: string | null;
  chapterCity: string | null;
  chapterRegion: string | null;
  pathways: ChapterPathwayJourneySummary[];
  visiblePathways: ChapterPathwayJourneySummary[];
  activeLocalPathways: ChapterPathwayJourneySummary[];
};

function getStepTitle(step: StepRequirementLike) {
  return step.classTemplate?.title?.trim() || step.course?.title?.trim() || step.title?.trim() || `Step ${step.stepOrder}`;
}

function getActiveAcademicSteps<T extends StepLike>(steps: T[]) {
  return steps
    .filter((step): step is T & { classTemplateId: string } => Boolean(step.classTemplateId))
    .sort((left, right) => left.stepOrder - right.stepOrder);
}

function getRequiredAcademicStepsFor<T extends StepLike>(step: T, allSteps: T[]) {
  const configuredRequirements = [...(step.prerequisites ?? [])]
    .filter((candidate): candidate is StepRequirementLike & { classTemplateId: string } => Boolean(candidate.classTemplateId))
    .sort((left, right) => left.stepOrder - right.stepOrder);

  if (configuredRequirements.length > 0) {
    return configuredRequirements;
  }

  const previousAcademicStep = getActiveAcademicSteps(allSteps)
    .filter((candidate) => candidate.stepOrder < step.stepOrder)
    .at(-1);

  return previousAcademicStep ? [previousAcademicStep] : [];
}

function getEnrollmentPriority(status: EnrollmentLike["status"]) {
  switch (status) {
    case "COMPLETED":
      return 4;
    case "ENROLLED":
      return 3;
    case "WAITLISTED":
      return 2;
    case "DROPPED":
      return 1;
    default:
      return 0;
  }
}

function matchesStep(step: StepLike, offering: { pathwayStepId: string | null; templateId: string }) {
  if (offering.pathwayStepId) {
    return offering.pathwayStepId === step.id;
  }

  return Boolean(step.classTemplateId) && offering.templateId === step.classTemplateId;
}

function toJourneyOfferingSummary(
  offering: OfferingLike,
  requestStatus: JourneyOfferingSummary["requestStatus"]
): JourneyOfferingSummary {
  const chapterLabel = offering.chapter
    ? offering.chapter.city
      ? `${offering.chapter.name} (${offering.chapter.city})`
      : offering.chapter.name
    : null;

  return {
    id: offering.id,
    title: offering.title,
    chapterId: offering.chapterId,
    chapterName: offering.chapter?.name ?? null,
    chapterLabel,
    startDate: offering.startDate,
    endDate: offering.endDate,
    meetingDays: offering.meetingDays,
    meetingTime: offering.meetingTime,
    deliveryMode: offering.deliveryMode,
    locationName: offering.locationName,
    locationAddress: offering.locationAddress,
    zoomLink: offering.zoomLink,
    enrolledCount: offering._count.enrollments,
    instructorName: offering.instructor.name,
    requestStatus,
  };
}

function comparePathwaySummaries(
  left: ChapterPathwayJourneySummary,
  right: ChapterPathwayJourneySummary
) {
  const leftLocal = Number(left.hasLocalRun);
  const rightLocal = Number(right.hasLocalRun);
  if (leftLocal !== rightLocal) {
    return rightLocal - leftLocal;
  }

  const leftActive = Number(left.runStatus === "ACTIVE");
  const rightActive = Number(right.runStatus === "ACTIVE");
  if (leftActive !== rightActive) {
    return rightActive - leftActive;
  }

  const leftFeatured = Number(left.isFeatured);
  const rightFeatured = Number(right.isFeatured);
  if (leftFeatured !== rightFeatured) {
    return rightFeatured - leftFeatured;
  }

  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }

  return left.name.localeCompare(right.name);
}

export async function getStudentChapterJourneyData(
  userId: string,
  options?: { pathwayId?: string }
): Promise<StudentChapterJourneyData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      chapterId: true,
      chapter: {
        select: {
          name: true,
          city: true,
          region: true,
        },
      },
    },
  });

  const chapterId = user?.chapterId ?? null;

  const pathways = await prisma.pathway.findMany({
    where: {
      isActive: true,
      ...(options?.pathwayId ? { id: options.pathwayId } : {}),
    },
    include: {
      chapterConfigs: {
        where: chapterId ? { chapterId } : { chapterId: "__no_chapter__" },
        include: {
          owner: { select: { name: true } },
        },
      },
      steps: {
        include: {
          classTemplate: {
            select: {
              id: true,
              title: true,
            },
          },
          course: {
            select: {
              title: true,
            },
          },
          prerequisites: {
            select: {
              id: true,
              stepOrder: true,
              classTemplateId: true,
              title: true,
              classTemplate: { select: { title: true } },
              course: { select: { title: true } },
            },
          },
        },
        orderBy: { stepOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const stepIds = pathways.flatMap((pathway) => pathway.steps.map((step) => step.id));
  const templateIds = pathways
    .flatMap((pathway) => pathway.steps.map((step) => step.classTemplateId))
    .filter((templateId): templateId is string => Boolean(templateId));

  const [offerings, enrollments, fallbackRequests] = await Promise.all([
    stepIds.length === 0 && templateIds.length === 0
      ? Promise.resolve([] as OfferingLike[])
      : prisma.classOffering.findMany({
          where: {
            status: { in: [...ACTIVE_OFFERING_STATUSES] },
            OR: [
              stepIds.length > 0 ? { pathwayStepId: { in: stepIds } } : undefined,
              templateIds.length > 0
                ? {
                    pathwayStepId: null,
                    templateId: { in: templateIds },
                  }
                : undefined,
            ].filter(Boolean) as Array<Record<string, unknown>>,
          },
          include: {
            chapter: {
              select: {
                id: true,
                name: true,
                city: true,
                region: true,
              },
            },
            instructor: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                enrollments: {
                  where: { status: "ENROLLED" },
                },
              },
            },
          },
          orderBy: [{ startDate: "asc" }, { title: "asc" }],
        }),
    stepIds.length === 0 && templateIds.length === 0
      ? Promise.resolve([] as EnrollmentLike[])
      : prisma.classEnrollment.findMany({
          where: {
            studentId: userId,
            offering: {
              OR: [
                stepIds.length > 0 ? { pathwayStepId: { in: stepIds } } : undefined,
                templateIds.length > 0
                  ? {
                      pathwayStepId: null,
                      templateId: { in: templateIds },
                    }
                  : undefined,
              ].filter(Boolean) as Array<Record<string, unknown>>,
            },
          },
          select: {
            status: true,
            offering: {
              select: {
                id: true,
                title: true,
                templateId: true,
                pathwayStepId: true,
                chapterId: true,
              },
            },
          },
        }),
    stepIds.length === 0
      ? Promise.resolve([] as FallbackRequestLike[])
      : prisma.pathwayFallbackRequest.findMany({
          where: {
            studentId: userId,
            pathwayStepId: { in: stepIds },
            status: { in: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
          },
          select: {
            id: true,
            status: true,
            pathwayStepId: true,
            targetOfferingId: true,
          },
        }),
  ]);

  const requestStatusByOfferingId = new Map<string, JourneyOfferingSummary["requestStatus"]>();
  for (const request of fallbackRequests) {
    if (!request.targetOfferingId) continue;
    requestStatusByOfferingId.set(request.targetOfferingId, request.status);
  }

  const bestEnrollmentByStepId = new Map<string, EnrollmentLike["status"]>();
  for (const pathway of pathways) {
    for (const step of pathway.steps) {
      for (const enrollment of enrollments) {
        if (!matchesStep(step, enrollment.offering)) {
          continue;
        }

        const currentStatus = bestEnrollmentByStepId.get(step.id);
        if (
          !currentStatus ||
          getEnrollmentPriority(enrollment.status) > getEnrollmentPriority(currentStatus)
        ) {
          bestEnrollmentByStepId.set(step.id, enrollment.status);
        }
      }
    }
  }

  const summaries = pathways.map((pathway) => {
    const config = chapterId ? pathway.chapterConfigs[0] ?? null : null;
    const activeSteps = getActiveAcademicSteps(pathway.steps);
    const completedStepIds = new Set(
      activeSteps
        .filter((step) => bestEnrollmentByStepId.get(step.id) === "COMPLETED")
        .map((step) => step.id)
    );

    const stepSummaries: JourneyStepSummary[] = activeSteps.map((step) => {
      const offeringsForStep = offerings.filter((offering) => matchesStep(step, offering));
      const localOfferings = offeringsForStep
        .filter((offering) => offering.chapterId === chapterId)
        .map((offering) =>
          toJourneyOfferingSummary(
            offering,
            requestStatusByOfferingId.get(offering.id) ?? null
          )
        );
      const partnerOfferings = offeringsForStep
        .filter((offering) => offering.chapterId !== null && offering.chapterId !== chapterId)
        .map((offering) =>
          toJourneyOfferingSummary(
            offering,
            requestStatusByOfferingId.get(offering.id) ?? null
          )
        );

      const allOfferings = [...localOfferings, ...partnerOfferings];
      const enrollmentStatus = bestEnrollmentByStepId.get(step.id);
      const requiredSteps = getRequiredAcademicStepsFor(step, activeSteps);
      const status: JourneyStepSummary["status"] =
        enrollmentStatus === "COMPLETED"
          ? "COMPLETED"
          : enrollmentStatus === "ENROLLED"
            ? "ENROLLED"
            : enrollmentStatus === "WAITLISTED"
              ? "WAITLISTED"
              : "NOT_STARTED";
      const requirementsMet = requiredSteps.every((requiredStep) =>
        completedStepIds.has(requiredStep.id)
      );

      return {
        id: step.id,
        stepOrder: step.stepOrder,
        title: getStepTitle(step),
        classTemplateId: step.classTemplateId,
        status,
        requiredStepTitles: requiredSteps.map((requiredStep) => getStepTitle(requiredStep)),
        requirementsMet,
        isLocallyAvailable: localOfferings.length > 0,
        localOfferings,
        partnerOfferings,
        allOfferings,
      };
    });

    const completedCount = stepSummaries.filter((step) => step.status === "COMPLETED").length;
    const totalCount = stepSummaries.length;
    const isEnrolled = stepSummaries.some((step) => ACTIVE_ENROLLMENT_STATUSES.has(step.status));
    const isComplete = totalCount > 0 && completedCount === totalCount;
    const currentStep =
      stepSummaries.find(
        (step) => step.status === "ENROLLED" || step.status === "WAITLISTED"
      ) ?? null;
    const nextJoinableStep =
      stepSummaries.find(
        (step) => step.status === "NOT_STARTED" && step.requirementsMet
      ) ?? null;
    const nextRecommendedStep = currentStep ?? nextJoinableStep;
    const localNextOffering = nextRecommendedStep?.localOfferings[0] ?? null;
    const fallbackOfferings =
      nextRecommendedStep && nextRecommendedStep.localOfferings.length === 0
        ? nextRecommendedStep.partnerOfferings
        : [];
    const localAvailableStepCount = stepSummaries.filter((step) => step.isLocallyAvailable).length;
    const hasLocalRun =
      (config?.runStatus ?? "NOT_OFFERED") === "ACTIVE" || localAvailableStepCount > 0;

    return {
      id: pathway.id,
      name: pathway.name,
      description: pathway.description,
      interestArea: pathway.interestArea,
      isVisibleInChapter: config?.isAvailable ?? true,
      isFeatured: config?.isFeatured ?? false,
      displayOrder: config?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      runStatus: config?.runStatus ?? "NOT_OFFERED",
      ownerName: config?.owner?.name ?? null,
      hasLocalRun,
      localAvailableStepCount,
      totalCount,
      completedCount,
      progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      isEnrolled,
      isComplete,
      hasLegacyOnlySteps: pathway.steps.some(
        (step) => step.classTemplateId == null && step.courseId != null
      ),
      currentStep,
      nextJoinableStep,
      nextRecommendedStep,
      localNextOffering,
      fallbackOfferings,
      steps: stepSummaries,
    } satisfies ChapterPathwayJourneySummary;
  });

  const visiblePathways = summaries
    .filter((pathway) => pathway.isVisibleInChapter || pathway.isEnrolled)
    .sort(comparePathwaySummaries);

  return {
    chapterId,
    chapterName: user?.chapter?.name ?? null,
    chapterCity: user?.chapter?.city ?? null,
    chapterRegion: user?.chapter?.region ?? null,
    pathways: summaries.sort(comparePathwaySummaries),
    visiblePathways,
    activeLocalPathways: visiblePathways.filter((pathway) => pathway.hasLocalRun),
  };
}

export async function getSingleStudentPathwayJourney(
  userId: string,
  pathwayId: string
) {
  const data = await getStudentChapterJourneyData(userId, { pathwayId });
  return data.pathways.find((pathway) => pathway.id === pathwayId) ?? null;
}
