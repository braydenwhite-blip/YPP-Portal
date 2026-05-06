import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  evaluateLessonDesignStudioGateFromAssignment,
  READINESS_CHECK_MODULE_KEY,
  type LessonDesignStudioGateStatus,
} from "@/lib/lesson-design-studio-gate";
import type { InstructorSubtype } from "@prisma/client";

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
  /** Effective applicant subtype. STANDARD applicants finish with the LDS
   *  capstone; SUMMER_WORKSHOP applicants finish with a workshop submission.
   *  Defaults to STANDARD when no application row exists (pre-existing
   *  instructors approved before the subtype field was introduced). */
  instructorSubtype: InstructorSubtype;
  requiredModulesCount: number;
  completedRequiredModules: number;
  /** All required academy modules marked complete. */
  academyModulesComplete: boolean;
  /**
   * Capstone gate satisfied. The semantics depend on the subtype:
   *   * STANDARD       → Lesson Design Studio draft submitted or approved.
   *   * SUMMER_WORKSHOP → Workshop proposal submitted (any non-DRAFT status).
   * Renamed from a pure "studioCapstoneComplete" but kept stable so
   * downstream consumers don't break.
   */
  studioCapstoneComplete: boolean;
  /** Academy modules complete and the subtype-appropriate capstone done. */
  trainingComplete: boolean;
  interviewStatus: string;
  interviewOutcome: string | null;
  interviewPassed: boolean;
  baseReadinessComplete: boolean;
  canRequestOfferingApproval: boolean;
  legacyExemptOfferingCount: number;
  missingRequirements: MissingRequirement[];
  nextAction: NextAction;
  /** Whether this instructor can open the Lesson Design Studio capstone.
   *  For SUMMER_WORKSHOP subtype this is always returned as `unlocked: false`
   *  with a `WRONG_SUBTYPE`-style reason so existing UI shows them the
   *  workshop CTA instead. */
  lessonDesignStudioGate: LessonDesignStudioGateStatus;
};

const INSTRUCTOR_TOOLS_HREF = "/instructor-training";
const INSTRUCTOR_PUBLISH_HREF = "/instructor/class-settings";
const LESSON_DESIGN_STUDIO_HREF = "/instructor/lesson-design-studio?entry=training";
const TRACKABLE_REQUIRED_VIDEO_PROVIDERS = new Set(["YOUTUBE", "VIMEO", "CUSTOM"]);

type RequiredTrainingModule = {
  id: string;
  title: string;
  type: string;
  contentKey: string | null;
  videoUrl: string | null;
  videoProvider: string | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  checkpoints: { id: string }[];
  quizQuestions: { id: string }[];
  interactiveJourney: { id: string } | null;
};

type InstructorTrainingAssignment = {
  userId: string;
  moduleId: string;
  status: string;
};

type InstructorInterviewGateSnapshot = {
  instructorId: string;
  status: string;
  outcome: string | null;
};

type GrandfatheredOfferingCount = {
  instructorId: string;
  _count: { _all: number };
};

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
    instructorSubtype: "STANDARD",
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
    // When readiness data is unavailable we don't lock the user out of the
    // capstone — same fallback posture the rest of this struct takes.
    lessonDesignStudioGate: {
      unlocked: true,
      reason: "READINESS_CHECK_NOT_IMPORTED",
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

export function buildInstructorReadinessFromSnapshot({
  instructorId,
  featureEnabled,
  interviewRequired,
  requiredModules,
  assignments,
  interviewGate,
  legacyExemptOfferingCount,
  studioCapstoneComplete,
  instructorSubtype = "STANDARD",
  roles = [],
}: {
  instructorId: string;
  featureEnabled: boolean;
  interviewRequired: boolean;
  requiredModules: RequiredTrainingModule[];
  assignments: InstructorTrainingAssignment[];
  interviewGate: InstructorInterviewGateSnapshot | null;
  legacyExemptOfferingCount: number;
  /**
   * Combined subtype-aware capstone signal:
   *   * STANDARD applicants — true once a CurriculumDraft is SUBMITTED or
   *     APPROVED.
   *   * SUMMER_WORKSHOP applicants — true once their WorkshopProposalSubmission
   *     leaves DRAFT (i.e. they've clicked Submit at least once).
   * Caller (getInstructorReadinessMany) is responsible for computing this
   * from the right table per applicant.
   */
  studioCapstoneComplete: boolean;
  instructorSubtype?: InstructorSubtype;
  /** Roles for THIS instructor (drives the LDS reviewer-bypass branch). */
  roles?: string[];
}): InstructorReadiness {
  const isSummerWorkshop = instructorSubtype === "SUMMER_WORKSHOP";
  const moduleConfigIssueById = new Map<string, string>();
  for (const trainingModule of requiredModules) {
    const requiredCheckpointCount = trainingModule.checkpoints.length;
    const hasActionablePath =
      Boolean(trainingModule.videoUrl) ||
      requiredCheckpointCount > 0 ||
      trainingModule.requiresQuiz ||
      trainingModule.requiresEvidence ||
      (trainingModule.type === "INTERACTIVE_JOURNEY" &&
        Boolean(trainingModule.interactiveJourney));

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

  const trainingComplete = academyModulesComplete && studioCapstoneComplete;

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
  if (!studioCapstoneComplete) {
    if (isSummerWorkshop) {
      missingRequirements.push({
        code: "WORKSHOP_SUBMISSION_REQUIRED",
        title: "Submit your workshop",
        detail:
          "Design or pick a workshop in the Workshop Design Studio and submit it for review.",
        href: "/instructor/workshop-design-studio",
      });
    } else {
      missingRequirements.push({
        code: "STUDIO_CAPSTONE_REQUIRED",
        title: "Submit Lesson Design Studio capstone",
        detail:
          "Submit or receive approval for a Lesson Design Studio package before requesting offering approval.",
        href: LESSON_DESIGN_STUDIO_HREF,
      });
    }
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

  // Lesson Design Studio capstone gate. Single source of truth — the LDS
  // server pages and the hub kanban card both read this through the gate
  // helper, which delegates back to this readiness aggregate.
  const readinessCheckModule = requiredModules.find(
    (m) => m.contentKey === READINESS_CHECK_MODULE_KEY
  );
  const readinessCheckAssignment = readinessCheckModule
    ? assignments.find((a) => a.moduleId === readinessCheckModule.id)
    : undefined;
  const lessonDesignStudioGate = evaluateLessonDesignStudioGateFromAssignment({
    roles,
    readinessCheckModuleId: readinessCheckModule?.id ?? null,
    readinessCheckAssignmentStatus: readinessCheckAssignment?.status ?? null,
    instructorSubtype,
  });
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
    instructorSubtype,
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
    lessonDesignStudioGate,
  };
}

export async function getInstructorReadinessMany(
  instructorIds: string[]
): Promise<Map<string, InstructorReadiness>> {
  const uniqueInstructorIds = Array.from(new Set(instructorIds)).filter(Boolean);
  const readinessByInstructor = new Map<string, InstructorReadiness>();

  if (uniqueInstructorIds.length === 0) {
    return readinessByInstructor;
  }

  const featureEnabled = isNativeInstructorGateEnabled();
  const interviewRequired = isInterviewGateEnforced();

  const readinessData = await withPrismaFallback(
    "getInstructorReadinessMany:queries",
    () =>
      Promise.all([
        prisma.trainingModule.findMany({
          where: { required: true },
          select: {
            id: true,
            title: true,
            type: true,
            contentKey: true,
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
            interactiveJourney: {
              select: { id: true },
            },
          },
        }),
        prisma.trainingAssignment.findMany({
          where: { userId: { in: uniqueInstructorIds } },
          select: { userId: true, moduleId: true, status: true },
        }),
        prisma.instructorInterviewGate.findMany({
          where: { instructorId: { in: uniqueInstructorIds } },
          select: {
            instructorId: true,
            status: true,
            outcome: true,
          },
        }),
        prisma.classOffering.groupBy({
          by: ["instructorId"],
          where: {
            instructorId: { in: uniqueInstructorIds },
            grandfatheredTrainingExemption: true,
          },
          _count: { _all: true },
        }),
        prisma.curriculumDraft.findMany({
          where: {
            authorId: { in: uniqueInstructorIds },
            status: { in: ["SUBMITTED", "APPROVED"] },
          },
          select: { authorId: true },
        }),
        prisma.userRole.findMany({
          where: { userId: { in: uniqueInstructorIds } },
          select: { userId: true, role: true },
        }),
        // Subtype lookup — read from the InstructorApplication row. Default
        // to STANDARD when no application exists (e.g. legacy instructors).
        prisma.instructorApplication.findMany({
          where: { applicantId: { in: uniqueInstructorIds } },
          select: { applicantId: true, instructorSubtype: true },
        }),
        // Workshop proposal submission — counts as the SUMMER_WORKSHOP capstone
        // once the applicant has submitted at least once (any non-DRAFT status).
        prisma.workshopProposalSubmission.findMany({
          where: {
            authorId: { in: uniqueInstructorIds },
            status: { not: "DRAFT" },
          },
          select: { authorId: true },
        }),
      ]),
    null
  );

  if (!readinessData) {
    for (const instructorId of uniqueInstructorIds) {
      readinessByInstructor.set(instructorId, buildFallbackInstructorReadiness(instructorId));
    }
    return readinessByInstructor;
  }

  const [
    requiredModules,
    assignments,
    interviewGates,
    grandfatheredOfferingCounts,
    submittedOrApprovedDrafts,
    userRoles,
    applicationSubtypes,
    workshopSubmittedAuthors,
  ] = readinessData;

  const assignmentsByInstructor = new Map<string, InstructorTrainingAssignment[]>();
  for (const assignment of assignments) {
    const current = assignmentsByInstructor.get(assignment.userId);
    if (current) {
      current.push(assignment);
    } else {
      assignmentsByInstructor.set(assignment.userId, [assignment]);
    }
  }

  const interviewGateByInstructor = new Map(
    interviewGates.map((gate) => [gate.instructorId, gate] as const)
  );

  const legacyExemptOfferingCountByInstructor = new Map(
    (grandfatheredOfferingCounts as GrandfatheredOfferingCount[]).map((entry) => [
      entry.instructorId,
      entry._count._all,
    ] as const)
  );

  const instructorsWithSubmittedCapstone = new Set(
    submittedOrApprovedDrafts.map((draft) => draft.authorId)
  );
  const instructorsWithSubmittedWorkshop = new Set(
    workshopSubmittedAuthors.map((row) => row.authorId)
  );
  const subtypeByInstructor = new Map<string, InstructorSubtype>(
    applicationSubtypes.map((row) => [row.applicantId, row.instructorSubtype])
  );

  const rolesByInstructor = new Map<string, string[]>();
  for (const row of userRoles) {
    const current = rolesByInstructor.get(row.userId);
    if (current) {
      current.push(row.role);
    } else {
      rolesByInstructor.set(row.userId, [row.role]);
    }
  }

  for (const instructorId of uniqueInstructorIds) {
    const subtype = subtypeByInstructor.get(instructorId) ?? "STANDARD";
    // Subtype-aware capstone: SW applicants finish via the workshop
    // submission table; STANDARD applicants finish via CurriculumDraft.
    const capstoneDone =
      subtype === "SUMMER_WORKSHOP"
        ? instructorsWithSubmittedWorkshop.has(instructorId)
        : instructorsWithSubmittedCapstone.has(instructorId);

    readinessByInstructor.set(
      instructorId,
      buildInstructorReadinessFromSnapshot({
        instructorId,
        featureEnabled,
        interviewRequired,
        requiredModules,
        assignments: assignmentsByInstructor.get(instructorId) ?? [],
        interviewGate: interviewGateByInstructor.get(instructorId) ?? null,
        legacyExemptOfferingCount:
          legacyExemptOfferingCountByInstructor.get(instructorId) ?? 0,
        studioCapstoneComplete: capstoneDone,
        instructorSubtype: subtype,
        roles: rolesByInstructor.get(instructorId) ?? [],
      })
    );
  }

  return readinessByInstructor;
}

export async function getInstructorReadiness(instructorId: string): Promise<InstructorReadiness> {
  const readinessByInstructor = await getInstructorReadinessMany([instructorId]);
  return readinessByInstructor.get(instructorId) ?? buildFallbackInstructorReadiness(instructorId);
}

export function assertReadinessAllowsPublish(
  readiness: Pick<InstructorReadiness, "baseReadinessComplete">
): void {
  if (!readiness.baseReadinessComplete) {
    throw new Error(
      "Publishing blocked. Complete academy modules, Lesson Design Studio capstone, and interview readiness first."
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
