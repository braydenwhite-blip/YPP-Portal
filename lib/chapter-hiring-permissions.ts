import { PositionType } from "@prisma/client";
import { getEnabledFeatureKeysForUser } from "@/lib/feature-gates";
import { prisma } from "@/lib/prisma";

// ─── Application permission context ─────────────────────────────────────────
// Minimal projection of InstructorApplication used for authorization checks.
// Build via a Prisma query that selects these fields before calling assert helpers.
export type ApplicationContext = {
  id: string;
  applicantId: string;
  reviewerId: string | null;
  /** chapterId of the applicant (not the application itself) */
  applicantChapterId: string | null;
  interviewerAssignments: Array<{
    interviewerId: string;
    removedAt: Date | null;
  }>;
};

export type HiringActor = {
  id: string;
  chapterId: string | null;
  roles: string[];
  featureKeys: Set<string>;
};

export async function getHiringActor(userId: string): Promise<HiringActor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      chapterId: true,
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const roles = user.roles.map((role) => role.role);
  const featureKeys = new Set(
    await getEnabledFeatureKeysForUser({
      userId: user.id,
      chapterId: user.chapterId,
      roles,
      primaryRole: null,
    })
  );

  return {
    id: user.id,
    chapterId: user.chapterId,
    roles,
    featureKeys,
  };
}

export function isAdmin(actor: HiringActor): boolean {
  return actor.roles.includes("ADMIN");
}

export function isChapterLead(actor: HiringActor): boolean {
  return actor.roles.includes("CHAPTER_PRESIDENT");
}

export function isDesignatedInterviewer(actor: HiringActor): boolean {
  return actor.featureKeys.has("INTERVIEWER");
}

export function assertAdminOrChapterLead(actor: HiringActor) {
  if (!isAdmin(actor) && !isChapterLead(actor)) {
    throw new Error("Unauthorized - Admin or Chapter President access required");
  }
}

export function assertCanManagePosition(actor: HiringActor, chapterId: string | null) {
  if (isAdmin(actor)) {
    return;
  }

  if (!isChapterLead(actor)) {
    throw new Error("Unauthorized");
  }

  if (!actor.chapterId) {
    throw new Error("Chapter President account is missing chapter assignment.");
  }

  if (!chapterId || chapterId !== actor.chapterId) {
    throw new Error("Chapter Presidents can only manage hiring for their own chapter.");
  }
}

export function canChapterLeadDecidePositionType(type: PositionType): boolean {
  return ["INSTRUCTOR", "MENTOR", "STAFF", "CHAPTER_PRESIDENT"].includes(type);
}

export function assertCanManageHiringInterviews(actor: HiringActor, chapterId: string | null) {
  if (isAdmin(actor)) {
    return;
  }

  if (!actor.chapterId || !chapterId || actor.chapterId !== chapterId) {
    throw new Error("Interview access is limited to your own chapter.");
  }

  if (isChapterLead(actor) || isDesignatedInterviewer(actor)) {
    return;
  }

  throw new Error("Unauthorized");
}

export function assertCanMakeChapterDecision(
  actor: HiringActor,
  type: PositionType,
  chapterId: string | null
) {
  if (isAdmin(actor)) {
    return;
  }

  if (!actor.chapterId || !chapterId || actor.chapterId !== chapterId) {
    throw new Error("Chapter reviewers can only decide hiring outcomes in their own chapter.");
  }

  if (!isChapterLead(actor) && !isDesignatedInterviewer(actor)) {
    throw new Error("Unauthorized");
  }

  if (!canChapterLeadDecidePositionType(type)) {
    throw new Error("This reviewer cannot decide this position type.");
  }
}

// ─── Instructor Applicant Workflow V1 helpers ────────────────────────────────

export function isHiringChair(actor: HiringActor): boolean {
  return actor.roles.includes("HIRING_CHAIR");
}

export function isAssignedReviewer(actor: HiringActor, application: ApplicationContext): boolean {
  return application.reviewerId === actor.id;
}

export function isAssignedInterviewer(actor: HiringActor, application: ApplicationContext): boolean {
  return application.interviewerAssignments.some(
    (a) => a.interviewerId === actor.id && !a.removedAt
  );
}

/**
 * ADMIN, chapter-scoped CHAPTER_PRESIDENT, or assigned LEAD reviewer adding a SECOND.
 * targetRole = the role being assigned ("LEAD" | "SECOND").
 */
export function assertCanAssignInterviewers(
  actor: HiringActor,
  application: ApplicationContext,
  targetRole: "LEAD" | "SECOND"
): void {
  if (isAdmin(actor)) return;

  if (
    isChapterLead(actor) &&
    actor.chapterId &&
    actor.chapterId === application.applicantChapterId
  ) {
    return;
  }

  if (isAssignedReviewer(actor, application) && targetRole === "SECOND") return;

  throw new Error("Unauthorized: you cannot assign interviewers for this application.");
}

/** ADMIN or HIRING_CHAIR. Chapter Presidents are explicitly NOT chairs per product decision. */
export function assertCanActAsChair(actor: HiringActor): void {
  if (isAdmin(actor) || isHiringChair(actor)) return;
  throw new Error("Only Admins or Hiring Chairs can make chair decisions.");
}

/** Role-based view permission per Part 2.B.1 of the implementation plan. */
export function assertCanViewApplicant(
  actor: HiringActor,
  application: ApplicationContext
): void {
  if (isAdmin(actor) || isHiringChair(actor)) return;

  if (isChapterLead(actor)) {
    if (actor.chapterId && actor.chapterId === application.applicantChapterId) return;
    throw new Error("Chapter Presidents can only view applicants in their own chapter.");
  }

  if (isAssignedReviewer(actor, application)) return;
  if (isAssignedInterviewer(actor, application)) return;
  if (actor.id === application.applicantId) return;

  throw new Error("You do not have permission to view this application.");
}

/** Whether this actor can see the Chair Queue nav item / page. */
export function canSeeChairQueue(actor: HiringActor): boolean {
  return isAdmin(actor) || isHiringChair(actor);
}
