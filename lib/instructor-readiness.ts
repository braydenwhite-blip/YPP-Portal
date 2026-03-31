import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

type NextAction = {
  title: string;
  detail: string;
  href: string;
};

export type MissingRequirement = {
  code: string;
  title: string;
  detail: string;
  href: string;
};

export type InstructorReadiness = {
  instructorId: string;
  featureEnabled: boolean;
  requiredModulesCount: number;
  completedRequiredModules: number;
  /** All required academy modules marked complete (video/checkpoint/quiz/evidence). */
  academyModulesComplete: boolean;
  /** Lesson Design Studio package submitted or approved (v1 capstone after 3 video modules). */
  studioCapstoneComplete: boolean;
  /** Academy modules complete and studio capstone satisfied (full training lane). */
  trainingComplete: boolean;
  interviewStatus: string;
  interviewOutcome: string | null;
  interviewPassed: boolean;
  baseReadinessComplete: boolean;
  canRequestOfferingApproval: boolean;
  legacyExemptOfferingCount: number;
  missingRequirements: MissingRequirement[];
  nextAction: NextAction;
};

const INSTRUCTOR_TOOLS_HREF = "/instructor-training";
const INSTRUCTOR_PUBLISH_HREF = "/instructor/class-settings";
const LESSON_DESIGN_STUDIO_HREF = "/instructor/lesson-design-studio?entry=training";
const TRACKABLE_REQUIRED_VIDEO_PROVIDERS = new Set(["YOUTUBE", "VIMEO", "CUSTOM"]);

/** True if the author has submitted or had approved any Lesson Design Studio package (v1 training capstone). */
export async function authorHasSubmittedOrApprovedStudioDraft(
  authorId: string
): Promise<boolean> {
  const draft = await prisma.curriculumDraft.findFirst({
    where: {
      authorId,
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
    select: { id: true },
  });
  return Boolean(draft);
}

export function buildFallbackInstructorReadiness(
  instructorId: string
): InstructorReadiness {
  return {
    instructorId,
    featureEnabled: false,
    requiredModulesCount: 0,
    completedRequiredModules: 0,
    academyModulesComplete: true,
    studioCapstoneComplete: true,
    trainingComplete: true,
    interviewStatus: "UNAVAILABLE",
    interviewOutcome: null,
    interviewPassed: true,
    baseReadinessComplete: true,
    canRequestOfferingApproval: true,
    legacyExemptOfferingCount: 0,
    missingRequirements: [],
    nextAction: {
      title: "Readiness checks unavailable",
      detail:
        "Training and interview readiness checks are temporarily unavailable.",
      href: INSTRUCTOR_TOOLS_HREF,
    },
  };
}

function envTrue(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

export function isNativeInstructorGateEnabled() {
  const raw = process.env.ENABLE_NATIVE_INSTRUCTOR_GATE;
  if (!raw) return true;
  return envTrue(raw);
}

export function isInterviewGateEnforced() {
  const raw = process.env.ENFORCE_PRE_OFFERING_INTERVIEW;
  if (!raw) return true;
  return envTrue(raw);
}

export async function getInstructorReadiness(instructorId: string): Promise<InstructorReadiness> {
  const featureEnabled = isNativeInstructorGateEnabled();
  const interviewRequired = isInterviewGateEnforced();

  const readinessData = await withPrismaFallback(
    "getInstructorReadiness:queries",
    () =>
      Promise.all([
        prisma.trainingModule.findMany({
          where: { required: true },
          select: {
            id: true,
            title: true,
            videoUrl: true,
            videoProvider: true,
            requiresQuiz: true,
            requiresEvidence: true,
            checkpoints: {
              where: { required: true },
              select: { id: true },
            },
            quizQuestions: {
              select: { id: true },
            },
          },
        }),
        prisma.trainingAssignment.findMany({
          where: { userId: instructorId },
          select: { moduleId: true, status: true },
        }),
        prisma.instructorInterviewGate.findUnique({
          where: { instructorId },
          select: {
            status: true,
            outcome: true,
          },
        }),
        prisma.classOffering.findMany({
          where: {
            instructorId,
          },
          select: {
            grandfatheredTrainingExemption: true,
          },
        }),
        prisma.curriculumDraft.findMany({
          where: { authorId: instructorId },
          orderBy: { updatedAt: "desc" },
          take: 24,
          select: { status: true },
        }),
      ]),
    null
  );

  if (!readinessData) {
    return buildFallbackInstructorReadiness(instructorId);
  }

  const [requiredModules, assignments, interviewGate, offerings, capstoneDrafts] = readinessData;

  const moduleConfigIssueById = new Map<string, string>();
  for (const trainingModule of requiredModules) {
    const requiredCheckpointCount = trainingModule.checkpoints.length;
    const hasActionablePath =
      Boolean(trainingModule.videoUrl) ||
      requiredCheckpointCount > 0 ||
      trainingModule.requiresQuiz ||
      trainingModule.requiresEvidence;

    if (!hasActionablePath) {
      moduleConfigIssueById.set(
        trainingModule.id,
        "This required module is missing all requirement paths."
      );
      continue;
    }

    if (
      trainingModule.requiresQuiz &&
      trainingModule.quizQuestions.length === 0
    ) {
      moduleConfigIssueById.set(
        trainingModule.id,
        "This required module has quiz enabled but no quiz questions."
      );
      continue;
    }

    if (trainingModule.videoUrl && !trainingModule.videoProvider) {
      moduleConfigIssueById.set(
        trainingModule.id,
        "This required module has video URL but no video provider selected."
      );
      continue;
    }

    if (
      trainingModule.videoUrl &&
      trainingModule.videoProvider &&
      !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(trainingModule.videoProvider)
    ) {
      moduleConfigIssueById.set(
        trainingModule.id,
        "This required module uses a non-trackable video provider."
      );
    }
  }

  const requiredModuleIds = new Set(
    requiredModules.map((trainingModule) => trainingModule.id)
  );
  const completedRequiredModules = assignments.filter(
    (assignment) =>
      requiredModuleIds.has(assignment.moduleId) &&
      assignment.status === "COMPLETE" &&
      !moduleConfigIssueById.has(assignment.moduleId)
  ).length;
  const academyModulesComplete =
    requiredModules.length === 0
      ? true
      : moduleConfigIssueById.size === 0 &&
        completedRequiredModules >= requiredModules.length;

  const studioCapstoneComplete = capstoneDrafts.some(
    (draft) => draft.status === "SUBMITTED" || draft.status === "APPROVED"
  );
  const trainingComplete = academyModulesComplete;

  const interviewStatus = interviewGate?.status ?? "REQUIRED";
  const interviewOutcome = interviewGate?.outcome ?? null;
  const interviewPassed =
    !interviewRequired || interviewStatus === "PASSED" || interviewStatus === "WAIVED";

  const remainingRequiredModules = Math.max(
    0,
    requiredModules.length - completedRequiredModules
  );

  const missingRequirements: MissingRequirement[] = [];
  if (moduleConfigIssueById.size > 0) {
    missingRequirements.push({
      code: "TRAINING_CONFIGURATION_REQUIRED",
      title: "Training module configuration is incomplete",
      detail:
        "One or more required modules are not fully configured. Contact an admin to finish setup before continuing.",
      href: INSTRUCTOR_TOOLS_HREF,
    });
  }
  if (!academyModulesComplete) {
    missingRequirements.push({
      code: "TRAINING_INCOMPLETE",
      title: "Complete required training modules",
      detail: `Finish ${remainingRequiredModules} remaining required module(s).`,
      href: INSTRUCTOR_TOOLS_HREF,
    });
  }
  if (interviewRequired && !interviewPassed) {
    missingRequirements.push({
      code: "INTERVIEW_REQUIRED",
      title: "Pass readiness interview",
      detail:
        interviewStatus === "FAILED" || interviewStatus === "HOLD"
          ? "Interview outcome requires follow-up before offering approval can be granted."
          : "Schedule and complete your readiness interview.",
      href: INSTRUCTOR_TOOLS_HREF,
    });
  }

  const baseReadinessComplete = !featureEnabled || missingRequirements.length === 0;
  const canRequestOfferingApproval = baseReadinessComplete;
  const legacyExemptOfferingCount = offerings.filter(
    (offering) => offering.grandfatheredTrainingExemption
  ).length;

  const nextAction =
    missingRequirements[0]
      ? {
          title: missingRequirements[0].title,
          detail: missingRequirements[0].detail,
          href: missingRequirements[0].href,
        }
      : {
          title: "Ready to request offering approval",
          detail:
            "Your training and interview requirements are complete. Request offering approval from class settings before publishing.",
          href: INSTRUCTOR_PUBLISH_HREF,
        };

  return {
    instructorId,
    featureEnabled,
    requiredModulesCount: requiredModules.length,
    completedRequiredModules,
    academyModulesComplete,
    studioCapstoneComplete,
    trainingComplete,
    interviewStatus,
    interviewOutcome,
    interviewPassed,
    baseReadinessComplete,
    canRequestOfferingApproval,
    legacyExemptOfferingCount,
    missingRequirements,
    nextAction,
  };
}

export function assertReadinessAllowsPublish(
  readiness: Pick<InstructorReadiness, "baseReadinessComplete">
): void {
  if (!readiness.baseReadinessComplete) {
    throw new Error(
      "Publishing blocked. Complete academy modules and interview readiness first."
    );
  }
}

export async function assertCanPublishOffering(
  instructorId: string,
  _templateId: string,
  offeringId?: string
): Promise<void> {
  if (!isNativeInstructorGateEnabled()) return;
  if (!offeringId) {
    throw new Error("Offering approval requires a saved offering.");
  }

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: {
      grandfatheredTrainingExemption: true,
      approval: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!offering) {
    throw new Error("Offering not found");
  }

  if (offering.grandfatheredTrainingExemption) {
    return;
  }

  const readiness = await getInstructorReadiness(instructorId);
  assertReadinessAllowsPublish(readiness);

  if (!offering.approval || offering.approval.status !== "APPROVED") {
    if (offering.approval?.status === "CHANGES_REQUESTED") {
      throw new Error(
        "Publishing blocked. Reviewers requested changes on this offering before it can be published."
      );
    }
    if (offering.approval?.status === "REJECTED") {
      throw new Error(
        "Publishing blocked. This offering was rejected and needs a new review before publishing."
      );
    }
    throw new Error(
      "Publishing blocked. Request and receive offering approval before publishing this class."
    );
  }
}

export async function assertCanPublishInstructorContent(
  instructorId: string
): Promise<void> {
  if (!isNativeInstructorGateEnabled()) return;

  const readiness = await getInstructorReadiness(instructorId);
  assertReadinessAllowsPublish(readiness);
}

export async function getNextRequiredAction(instructorId: string): Promise<NextAction> {
  const readiness = await getInstructorReadiness(instructorId);
  return readiness.nextAction;
}
