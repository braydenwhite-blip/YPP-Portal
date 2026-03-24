import {
  MenteeRoleType,
  MentorshipAwardPolicy,
  MentorshipAwardLevel,
  MentorshipCommitteeScope,
  MentorshipGovernanceMode,
  MentorshipPointCategory,
  MentorshipProgramGroup,
  MentorshipType,
  RoleType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const FULL_PROGRAM_MENTOR_CAP = 3;
export const ACHIEVEMENT_LADDER_THRESHOLDS: Array<{
  level: MentorshipAwardLevel;
  minPoints: number;
}> = [
  { level: MentorshipAwardLevel.LIFETIME, minPoints: 1800 },
  { level: MentorshipAwardLevel.GOLD, minPoints: 700 },
  { level: MentorshipAwardLevel.SILVER, minPoints: 350 },
  { level: MentorshipAwardLevel.BRONZE, minPoints: 175 },
];

export function getMentorshipProgramGroupForRole(
  primaryRole?: RoleType | string | null
): MentorshipProgramGroup {
  if (primaryRole === "STUDENT") return MentorshipProgramGroup.STUDENT;
  if (primaryRole === "INSTRUCTOR") return MentorshipProgramGroup.INSTRUCTOR;
  return MentorshipProgramGroup.OFFICER;
}

export function getLegacyMenteeRoleTypeForRole(
  primaryRole?: RoleType | string | null
): MenteeRoleType {
  if (primaryRole === "INSTRUCTOR") {
    return MenteeRoleType.INSTRUCTOR;
  }
  if (primaryRole === "CHAPTER_PRESIDENT") {
    return MenteeRoleType.CHAPTER_PRESIDENT;
  }
  return MenteeRoleType.GLOBAL_LEADERSHIP;
}

export function getGovernanceModeForProgramGroup(
  group: MentorshipProgramGroup
): MentorshipGovernanceMode {
  return group === MentorshipProgramGroup.STUDENT
    ? MentorshipGovernanceMode.CONNECTED_STUDENT
    : MentorshipGovernanceMode.FULL_PROGRAM;
}

export function getCommitteeScopeForProgramGroup(
  group: MentorshipProgramGroup
): MentorshipCommitteeScope {
  return group === MentorshipProgramGroup.INSTRUCTOR
    ? MentorshipCommitteeScope.CHAPTER
    : MentorshipCommitteeScope.GLOBAL;
}

export function getAwardPolicyForProgramGroup(
  group: MentorshipProgramGroup
): MentorshipAwardPolicy {
  return group === MentorshipProgramGroup.STUDENT
    ? MentorshipAwardPolicy.STUDENT_RECOGNITION
    : MentorshipAwardPolicy.ACHIEVEMENT_LADDER;
}

export function getPointCategoryForProgramGroup(
  group: MentorshipProgramGroup
): MentorshipPointCategory {
  if (group === MentorshipProgramGroup.STUDENT) {
    return MentorshipPointCategory.STUDENT;
  }
  if (group === MentorshipProgramGroup.INSTRUCTOR) {
    return MentorshipPointCategory.INSTRUCTOR;
  }
  return MentorshipPointCategory.GLOBAL_LEADERSHIP;
}

export function getMentorshipTypeForProgramGroup(
  group: MentorshipProgramGroup
): MentorshipType {
  return group === MentorshipProgramGroup.STUDENT
    ? MentorshipType.STUDENT
    : MentorshipType.INSTRUCTOR;
}

export function getDefaultMentorCapForProgramGroup(
  group: MentorshipProgramGroup
): number {
  return group === MentorshipProgramGroup.STUDENT ? 6 : FULL_PROGRAM_MENTOR_CAP;
}

export function getAchievementAwardLevelForPoints(
  totalPoints: number
): MentorshipAwardLevel | null {
  for (const threshold of ACHIEVEMENT_LADDER_THRESHOLDS) {
    if (totalPoints >= threshold.minPoints) {
      return threshold.level;
    }
  }
  return null;
}

export function mentorshipRequiresChairApproval(params: {
  governanceMode?: MentorshipGovernanceMode | null;
  programGroup?: MentorshipProgramGroup | null;
  escalateToChair?: boolean | null;
}) {
  const { governanceMode, programGroup, escalateToChair } = params;
  if (escalateToChair) return true;
  if (governanceMode === MentorshipGovernanceMode.CONNECTED_STUDENT) return false;
  if (programGroup === MentorshipProgramGroup.STUDENT) return false;
  return true;
}

export function mentorshipRequiresMonthlyReflection(params: {
  governanceMode?: MentorshipGovernanceMode | null;
  programGroup?: MentorshipProgramGroup | null;
}) {
  return mentorshipRequiresChairApproval(params);
}

export function mentorshipRequiresKickoff(params: {
  governanceMode?: MentorshipGovernanceMode | null;
  programGroup?: MentorshipProgramGroup | null;
}) {
  return params.programGroup !== MentorshipProgramGroup.STUDENT;
}

export async function enforceFullProgramMentorCapacity(params: {
  mentorId: string;
  programGroup: MentorshipProgramGroup;
  governanceMode: MentorshipGovernanceMode;
  excludeMentorshipId?: string | null;
}) {
  const { mentorId, programGroup, governanceMode, excludeMentorshipId = null } = params;
  if (
    governanceMode !== MentorshipGovernanceMode.FULL_PROGRAM ||
    programGroup === MentorshipProgramGroup.STUDENT
  ) {
    return;
  }

  const activeCount = await prisma.mentorship.count({
    where: {
      mentorId,
      status: "ACTIVE",
      governanceMode: MentorshipGovernanceMode.FULL_PROGRAM,
      programGroup: {
        in: [MentorshipProgramGroup.OFFICER, MentorshipProgramGroup.INSTRUCTOR],
      },
      ...(excludeMentorshipId ? { id: { not: excludeMentorshipId } } : {}),
    },
  });

  if (activeCount >= FULL_PROGRAM_MENTOR_CAP) {
    throw new Error(
      `This mentor already has ${activeCount} active officer/instructor mentees. The hard cap is ${FULL_PROGRAM_MENTOR_CAP}.`
    );
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildCanonicalTrackIdentity(params: {
  group: MentorshipProgramGroup;
  chapterId?: string | null;
  chapterName?: string | null;
}) {
  const { group, chapterId = null, chapterName = null } = params;
  const base =
    group === MentorshipProgramGroup.OFFICER
      ? "Officer Mentorship"
      : group === MentorshipProgramGroup.INSTRUCTOR
      ? "Instructor Mentorship"
      : "Student Mentorship";

  if (group === MentorshipProgramGroup.INSTRUCTOR || group === MentorshipProgramGroup.STUDENT) {
    if (chapterId) {
      return {
        slug: `${slugify(base)}-chapter-${chapterId}`,
        name: chapterName ? `${base} - ${chapterName}` : `${base} - Chapter`,
      };
    }
  }

  return {
    slug: `${slugify(base)}-global`,
    name: `${base} - Global`,
  };
}

export async function ensureCanonicalTrack(params: {
  group: MentorshipProgramGroup;
  chapterId?: string | null;
  chapterName?: string | null;
}) {
  const { group, chapterId = null, chapterName = null } = params;
  const identity = buildCanonicalTrackIdentity({ group, chapterId, chapterName });

  const existing = await prisma.mentorshipTrack.findUnique({
    where: { slug: identity.slug },
  });

  if (existing) {
    return existing;
  }

  return prisma.mentorshipTrack.create({
    data: {
      slug: identity.slug,
      name: identity.name,
      description: `${identity.name} canonical track`,
      scope:
        getCommitteeScopeForProgramGroup(group) === MentorshipCommitteeScope.CHAPTER
          ? "CHAPTER"
          : "GLOBAL",
      chapterId,
      programGroup: group,
      governanceMode: getGovernanceModeForProgramGroup(group),
      committeeScope: getCommitteeScopeForProgramGroup(group),
      mentorCap: getDefaultMentorCapForProgramGroup(group),
      awardPolicy: getAwardPolicyForProgramGroup(group),
      requiresQuarterlyReview: group !== MentorshipProgramGroup.STUDENT,
      pointCategory: getPointCategoryForProgramGroup(group),
    },
  });
}
