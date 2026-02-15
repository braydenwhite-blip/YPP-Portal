import { CourseLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  trainingComplete: boolean;
  interviewStatus: string;
  interviewOutcome: string | null;
  interviewPassed: boolean;
  approvedLevels: CourseLevel[];
  teachingPermissionLevels: CourseLevel[];
  hasPublishedOffering: boolean;
  grandfatheredOfferingCount: number;
  canPublishFirstOffering: boolean;
  missingRequirements: MissingRequirement[];
  nextAction: NextAction;
};

const INSTRUCTOR_TOOLS_HREF = "/instructor/training-progress";
const INSTRUCTOR_PUBLISH_HREF = "/instructor/class-settings";

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

function levelRank(level: CourseLevel): number {
  switch (level) {
    case "LEVEL_101":
      return 101;
    case "LEVEL_201":
      return 201;
    case "LEVEL_301":
      return 301;
    case "LEVEL_401":
      return 401;
    default:
      return 999;
  }
}

export async function getInstructorReadiness(instructorId: string): Promise<InstructorReadiness> {
  const featureEnabled = isNativeInstructorGateEnabled();
  const interviewRequired = isInterviewGateEnforced();

  const [
    requiredModules,
    assignments,
    interviewGate,
    teachingPermissions,
    approvals,
    offerings,
  ] = await Promise.all([
    prisma.trainingModule.findMany({
      where: { required: true },
      select: { id: true, title: true },
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
    prisma.instructorTeachingPermission.findMany({
      where: { instructorId },
      select: { level: true },
    }),
    prisma.instructorApproval.findMany({
      where: { instructorId },
      select: {
        levels: { select: { level: true } },
      },
    }),
    prisma.classOffering.findMany({
      where: {
        instructorId,
        status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
      },
      select: {
        id: true,
        grandfatheredTrainingExemption: true,
      },
    }),
  ]);

  const requiredModuleIds = new Set(requiredModules.map((module) => module.id));
  const completedRequiredModules = assignments.filter(
    (assignment) =>
      requiredModuleIds.has(assignment.moduleId) && assignment.status === "COMPLETE"
  ).length;
  const trainingComplete =
    requiredModules.length === 0 || completedRequiredModules >= requiredModules.length;

  const interviewStatus = interviewGate?.status ?? "REQUIRED";
  const interviewOutcome = interviewGate?.outcome ?? null;
  const interviewPassed =
    !interviewRequired || interviewStatus === "PASSED" || interviewStatus === "WAIVED";

  const approvedLevels = Array.from(
    new Set(approvals.flatMap((approval) => approval.levels.map((level) => level.level)))
  );
  const teachingPermissionLevels = Array.from(
    new Set(teachingPermissions.map((permission) => permission.level))
  );

  const hasPublishedOffering = offerings.length > 0;
  const grandfatheredOfferingCount = offerings.filter(
    (offering) => offering.grandfatheredTrainingExemption
  ).length;
  const isFirstPublish = !hasPublishedOffering;

  const canPublishFirstOffering =
    !featureEnabled || !isFirstPublish || (trainingComplete && interviewPassed);

  const missingRequirements: MissingRequirement[] = [];
  if (!trainingComplete) {
    missingRequirements.push({
      code: "TRAINING_INCOMPLETE",
      title: "Complete required training modules",
      detail: `Finish ${requiredModules.length - completedRequiredModules} remaining required module(s).`,
      href: INSTRUCTOR_TOOLS_HREF,
    });
  }
  if (interviewRequired && !interviewPassed) {
    missingRequirements.push({
      code: "INTERVIEW_REQUIRED",
      title: "Pass readiness interview",
      detail:
        interviewStatus === "FAILED" || interviewStatus === "HOLD"
          ? "Interview outcome requires follow-up before first class publish."
          : "Schedule and complete your readiness interview.",
      href: INSTRUCTOR_TOOLS_HREF,
    });
  }

  const nextAction =
    missingRequirements[0]
      ? {
          title: missingRequirements[0].title,
          detail: missingRequirements[0].detail,
          href: missingRequirements[0].href,
        }
      : {
          title: "Readiness complete for first publish",
          detail: "You can publish your first class offering.",
          href: INSTRUCTOR_PUBLISH_HREF,
        };

  return {
    instructorId,
    featureEnabled,
    requiredModulesCount: requiredModules.length,
    completedRequiredModules,
    trainingComplete,
    interviewStatus,
    interviewOutcome,
    interviewPassed,
    approvedLevels,
    teachingPermissionLevels,
    hasPublishedOffering,
    grandfatheredOfferingCount,
    canPublishFirstOffering,
    missingRequirements,
    nextAction,
  };
}

export async function canTeachLevel(
  instructorId: string,
  level: CourseLevel
): Promise<boolean> {
  if (!isNativeInstructorGateEnabled()) {
    const legacyApproval = await prisma.instructorApprovalLevel.findFirst({
      where: {
        level,
        approval: { instructorId },
      },
      select: { id: true },
    });
    return Boolean(legacyApproval);
  }

  const permission = await prisma.instructorTeachingPermission.findUnique({
    where: {
      instructorId_level: { instructorId, level },
    },
    select: { id: true },
  });
  if (permission) return true;

  // Backward compatibility: honor legacy approval levels if explicit permissions have not been granted yet.
  const legacyApproval = await prisma.instructorApprovalLevel.findFirst({
    where: {
      level,
      approval: { instructorId },
    },
    select: { id: true },
  });
  return Boolean(legacyApproval);
}

export async function canPublishFirstOffering(instructorId: string): Promise<boolean> {
  const readiness = await getInstructorReadiness(instructorId);
  return readiness.canPublishFirstOffering;
}

export async function assertCanPublishOffering(
  instructorId: string,
  templateId: string,
  offeringId?: string
): Promise<void> {
  if (!isNativeInstructorGateEnabled()) return;

  const template = await prisma.classTemplate.findUnique({
    where: { id: templateId },
    select: { difficultyLevel: true },
  });
  if (!template) {
    throw new Error("Class template not found");
  }

  if (offeringId) {
    const offering = await prisma.classOffering.findUnique({
      where: { id: offeringId },
      select: { grandfatheredTrainingExemption: true },
    });
    if (offering?.grandfatheredTrainingExemption) {
      return;
    }
  }

  const readiness = await getInstructorReadiness(instructorId);
  if (!readiness.canPublishFirstOffering) {
    throw new Error(
      "Publishing blocked. Complete required training modules and pass interview readiness first."
    );
  }

  const templateLevel = template.difficultyLevel as CourseLevel;
  if (levelRank(templateLevel) > 101) {
    const canTeach = await canTeachLevel(instructorId, templateLevel);
    if (!canTeach) {
      throw new Error(
        `Publishing blocked. You are not approved to teach ${templateLevel.replace(
          "LEVEL_",
          ""
        )} classes yet.`
      );
    }
  }
}

export async function getNextRequiredAction(instructorId: string): Promise<NextAction> {
  const readiness = await getInstructorReadiness(instructorId);
  return readiness.nextAction;
}
