/**
 * Subtype-aware access gates for the Workshop Design Studio + Library.
 *
 * Mirrors `lib/lesson-design-studio-gate.ts` but for the SUMMER_WORKSHOP
 * pathway. The two gates are mutually exclusive at the applicant layer:
 *
 *   * STANDARD applicants     → Lesson Design Studio (LDS)
 *   * SUMMER_WORKSHOP applicants → Workshop Design Studio (WDS)
 *
 * Reviewer roles (ADMIN, CHAPTER_PRESIDENT) bypass both gates so they can
 * preview either flow regardless of their own subtype.
 *
 * Server-only.
 */

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { READINESS_CHECK_MODULE_KEY } from "@/lib/training-constants";

type RoleLike = string | null | undefined;

export type WorkshopStudioGateReason =
  | "READY"
  | "REVIEWER_BYPASS"
  | "WRONG_SUBTYPE" // user is a STANDARD applicant, not summer workshop
  | "READINESS_CHECK_REQUIRED" // training not yet complete
  | "READINESS_CHECK_NOT_IMPORTED"; // M5 not seeded yet — open access for back-compat

export type WorkshopStudioGateStatus =
  | { unlocked: true; reason: Exclude<WorkshopStudioGateReason, "WRONG_SUBTYPE" | "READINESS_CHECK_REQUIRED"> }
  | { unlocked: false; reason: "WRONG_SUBTYPE" }
  | {
      unlocked: false;
      reason: "READINESS_CHECK_REQUIRED";
      readinessCheckModuleId: string;
    };

function isReviewer(roles: RoleLike[]): boolean {
  return roles.some((r) => r === "ADMIN" || r === "CHAPTER_PRESIDENT");
}

/**
 * Look up the applicant's track/subtype from their InstructorApplication. The
 * subtype lives on the application row, not on the User, so this requires a
 * tiny extra hop. Returns `null` if the user has no application (e.g., a
 * direct INSTRUCTOR who skipped the application flow); callers should treat
 * `null` as STANDARD by convention.
 */
export async function getApplicantSubtypeForUser(userId: string) {
  // Re-application: a user can have multiple rows; the subtype is always
  // defined by the most recent application. Wrapped in a fallback so a
  // transient DB blip degrades gracefully to "no subtype known" rather than
  // crashing the workshop studio render.
  const app = await withPrismaFallback(
    "workshop-access:applicant-subtype",
    () =>
      prisma.instructorApplication.findFirst({
        where: { applicantId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          applicationTrack: true,
          instructorSubtype: true,
        },
      }),
    null
  );
  return app
    ? {
        applicationTrack: app.applicationTrack,
        instructorSubtype: app.instructorSubtype,
      }
    : null;
}

/**
 * Whether the user is on the Summer Workshop path. Source of truth is the
 * post-acceptance `instructorSubtype` field — the application track is the
 * applicant-time signal, but subtype is what determines what the user sees
 * after they're approved (and after a possible promotion to STANDARD).
 *
 * Falls back to `false` (i.e. STANDARD) if the user has no application row.
 */
export async function isSummerWorkshopApplicant(userId: string): Promise<boolean> {
  const subtype = await getApplicantSubtypeForUser(userId);
  return subtype?.instructorSubtype === "SUMMER_WORKSHOP";
}

/**
 * Gate the Workshop Design Studio for a given user.
 *
 * Locks if:
 *   * User is on the STANDARD track (they should be using LDS instead)
 *   * Required training (Readiness Check M5) not complete
 *
 * Reviewers bypass everything.
 */
export async function getWorkshopStudioGateStatus(
  userId: string,
  roles: RoleLike[]
): Promise<WorkshopStudioGateStatus> {
  if (isReviewer(roles)) {
    return { unlocked: true, reason: "REVIEWER_BYPASS" };
  }

  const isSW = await isSummerWorkshopApplicant(userId);
  if (!isSW) {
    return { unlocked: false, reason: "WRONG_SUBTYPE" };
  }

  // Training gate — same M5 check as LDS, since both are "after training"
  // capstones. Both reads are wrapped in fallbacks: if either DB call is
  // transiently broken, we open the gate (the action layer re-validates
  // before any write, so a stale "unlocked" can never elevate privileges).
  const readinessModule = await withPrismaFallback(
    "workshop-access:readiness-module",
    () =>
      prisma.trainingModule.findFirst({
        where: { contentKey: READINESS_CHECK_MODULE_KEY },
        select: { id: true },
      }),
    null
  );

  if (!readinessModule) {
    // M5 not imported yet (seed in progress / fresh env). Don't lock the user out.
    return { unlocked: true, reason: "READINESS_CHECK_NOT_IMPORTED" };
  }

  const assignment = await withPrismaFallback(
    "workshop-access:readiness-assignment",
    () =>
      prisma.trainingAssignment.findUnique({
        where: {
          userId_moduleId: { userId, moduleId: readinessModule.id },
        },
        select: { status: true },
      }),
    null
  );

  if (assignment?.status === "COMPLETE") {
    return { unlocked: true, reason: "READY" };
  }

  return {
    unlocked: false,
    reason: "READINESS_CHECK_REQUIRED",
    readinessCheckModuleId: readinessModule.id,
  };
}
