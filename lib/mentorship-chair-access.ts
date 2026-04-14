/**
 * Chair authorization helpers for the mentorship system.
 *
 * Treats MentorCommitteeChair as a first-class authorization root, parallel to
 * but independent of the MENTORSHIP_ADMIN subtype.
 *
 * All helpers bypass via SUPER_ADMIN or MENTORSHIP_ADMIN so existing admin
 * workflows are never broken. New code should call these helpers rather than
 * checking chairReviewerId directly.
 */

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { isSuperAdmin, hasAdminSubtype } from "@/lib/admin-subtypes";
import { RoleType, type MenteeRoleType, type MentorGoalReview } from "@prisma/client";

// ─── Type helpers ────────────────────────────────────────────────────────────

function isAdminBypass(adminSubtypes: string[]): boolean {
  return (
    isSuperAdmin(adminSubtypes) ||
    hasAdminSubtype(adminSubtypes, "MENTORSHIP_ADMIN")
  );
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the given user is an active MentorCommitteeChair for the
 * specified lane, OR if they are a SUPER_ADMIN / MENTORSHIP_ADMIN.
 */
export async function isChairForLane(
  userId: string,
  laneRoleType: MenteeRoleType,
  adminSubtypes: string[] = []
): Promise<boolean> {
  if (isAdminBypass(adminSubtypes)) return true;

  const chair = await prisma.mentorCommitteeChair.findUnique({
    where: { userId_roleType: { userId, roleType: laneRoleType } },
    select: { isActive: true },
  });

  return chair?.isActive === true;
}

/**
 * Returns the list of MenteeRoleType lanes that userId actively chairs.
 * SUPER_ADMIN / MENTORSHIP_ADMIN receive all distinct lane types that have
 * at least one active chair row (so their inboxes show every lane).
 */
export async function getLanesForChair(
  userId: string,
  adminSubtypes: string[] = []
): Promise<MenteeRoleType[]> {
  if (isAdminBypass(adminSubtypes)) {
    // Return every lane that has any active chair (so admins see all lanes)
    const rows = await prisma.mentorCommitteeChair.findMany({
      where: { isActive: true },
      select: { roleType: true },
      distinct: ["roleType"],
    });
    return rows.map((r) => r.roleType);
  }

  const rows = await prisma.mentorCommitteeChair.findMany({
    where: { userId, isActive: true },
    select: { roleType: true },
  });

  return rows.map((r) => r.roleType);
}

/**
 * Returns all MentorGoalReview records in PENDING_CHAIR_APPROVAL status for
 * the lanes this user chairs. For SUPER_ADMIN / MENTORSHIP_ADMIN, returns ALL
 * pending-chair reviews regardless of lane.
 *
 * Includes: mentee, mentor, mentorship, and selfReflection for display.
 */
export async function getApprovableGoalReviewsForUser(
  userId: string,
  adminSubtypes: string[] = []
): Promise<MentorGoalReview[]> {
  if (isAdminBypass(adminSubtypes)) {
    return prisma.mentorGoalReview.findMany({
      where: { status: "PENDING_CHAIR_APPROVAL" },
      include: {
        mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
        mentor: { select: { id: true, name: true, email: true } },
        mentorship: { select: { id: true } },
        selfReflection: { select: { id: true, cycleNumber: true, cycleMonth: true } },
        pointLog: { select: { id: true, points: true } },
      },
      orderBy: { createdAt: "asc" },
    }) as unknown as MentorGoalReview[];
  }

  const lanes = await getLanesForChair(userId, adminSubtypes);
  if (lanes.length === 0) return [];

  // Find mentees in lanes this user chairs
  const menteesInLanes = await prisma.user.findMany({
    where: {
      primaryRole: {
        in: lanes
          .map((lane) => laneRoleTypeToRoleString(lane))
          .filter((role): role is RoleType => role !== null),
      },
    },
    select: { id: true },
  });

  const menteeIds = menteesInLanes.map((u) => u.id);

  // Also include reviews explicitly assigned to this chair via chairReviewerId
  // (soft fallback for in-flight manually-assigned reviews)
  return prisma.mentorGoalReview.findMany({
    where: {
      status: "PENDING_CHAIR_APPROVAL",
      OR: [
        { menteeId: { in: menteeIds } },
        { chairReviewerId: userId },
      ],
    },
    include: {
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      mentor: { select: { id: true, name: true, email: true } },
      mentorship: { select: { id: true } },
      selfReflection: { select: { id: true, cycleNumber: true, cycleMonth: true } },
      pointLog: { select: { id: true, points: true } },
    },
    orderBy: { createdAt: "asc" },
  }) as unknown as MentorGoalReview[];
}

/**
 * Returns all users who are active MentorCommitteeChairs for a given lane.
 * Used when routing REVIEW_SUBMITTED_FOR_APPROVAL notifications.
 */
export async function getChairsForLane(laneRoleType: MenteeRoleType): Promise<{ id: string; name: string | null; email: string }[]> {
  const chairs = await prisma.mentorCommitteeChair.findMany({
    where: { roleType: laneRoleType, isActive: true },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return chairs.map((c) => c.user);
}

// ─── Server-action guard ──────────────────────────────────────────────────────

/**
 * Server-action guard: throws Unauthorized unless the calling user is an
 * active chair for the specified lane, a SUPER_ADMIN, or a MENTORSHIP_ADMIN.
 *
 * Usage:
 *   const sessionUser = await requireChairForLane("INSTRUCTOR");
 */
export async function requireChairForLane(laneRoleType: MenteeRoleType) {
  const sessionUser = await requireSessionUser();
  const allowed = await isChairForLane(
    sessionUser.id,
    laneRoleType,
    sessionUser.adminSubtypes
  );
  if (!allowed) {
    throw new Error(
      `Unauthorized: You are not a committee chair for the ${laneRoleType} lane.`
    );
  }
  return sessionUser;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Maps a MenteeRoleType enum value to the corresponding RoleType enum used
 * on User.primaryRole, so we can filter mentees by lane.
 */
function laneRoleTypeToRoleString(lane: MenteeRoleType): RoleType | null {
  const map: Partial<Record<MenteeRoleType, RoleType>> = {
    INSTRUCTOR: RoleType.INSTRUCTOR,
    CHAPTER_PRESIDENT: RoleType.CHAPTER_PRESIDENT,
    GLOBAL_LEADERSHIP: RoleType.STAFF, // STAFF covers global leadership in the current schema
    STAFF: RoleType.STAFF,
    STUDENT: RoleType.STUDENT,
  };
  return map[lane] ?? null;
}
