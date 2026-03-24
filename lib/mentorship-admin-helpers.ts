import { type MentorshipType, type SupportRole } from "@prisma/client";

import { SUPPORT_ROLE_META } from "@/lib/mentorship-hub";

export type AdminMentorshipLane = "STUDENTS" | "INSTRUCTORS" | "LEADERSHIP";

export const ADMIN_MENTORSHIP_LANE_META: Record<
  AdminMentorshipLane,
  {
    queryValue: string;
    label: string;
    shortLabel: string;
    description: string;
    staffingExpectation: string;
  }
> = {
  STUDENTS: {
    queryValue: "students",
    label: "Students",
    shortLabel: "Students",
    description:
      "Students usually need a primary mentor, a chair for monthly review routing, and at least one extra support role for accountability or specialized coaching.",
    staffingExpectation:
      "Primary mentor, chair, and one extra support role are the default staffing pattern.",
  },
  INSTRUCTORS: {
    queryValue: "instructors",
    label: "Instructors",
    shortLabel: "Instructors",
    description:
      "Instructor circles focus on teaching growth, review quality, and monthly momentum. The chair and mentor should make the review path feel predictable.",
    staffingExpectation:
      "Primary mentor and chair are essential, with specialist support added when workload or subject matter calls for it.",
  },
  LEADERSHIP: {
    queryValue: "leadership",
    label: "Leadership",
    shortLabel: "Leadership",
    description:
      "Leadership circles support chapter presidents, staff, and global leaders. These circles lean more heavily on governance clarity and escalation coverage.",
    staffingExpectation:
      "Primary mentor and chair keep leadership circles operational; advisor roles help when strategy or long-range planning is needed.",
  },
};

export const ADMIN_MENTORSHIP_LANES = Object.keys(
  ADMIN_MENTORSHIP_LANE_META
) as AdminMentorshipLane[];

export function parseAdminMentorshipLane(
  raw?: string | null
): AdminMentorshipLane {
  const normalized = (raw ?? "").trim().toLowerCase();

  for (const lane of ADMIN_MENTORSHIP_LANES) {
    if (ADMIN_MENTORSHIP_LANE_META[lane].queryValue === normalized) {
      return lane;
    }
  }

  return "STUDENTS";
}

export function getAdminMentorshipLaneForUser(params: {
  primaryRole?: string | null;
  roles?: string[];
}): AdminMentorshipLane {
  const roles = params.roles ?? [];
  const primaryRole = params.primaryRole ?? null;

  if (roles.includes("STUDENT") || primaryRole === "STUDENT") {
    return "STUDENTS";
  }

  if (roles.includes("INSTRUCTOR") || primaryRole === "INSTRUCTOR") {
    return "INSTRUCTORS";
  }

  return "LEADERSHIP";
}

export function getMentorshipTypeForAdminLane(
  lane: AdminMentorshipLane
): MentorshipType {
  return lane === "STUDENTS" ? "STUDENT" : "INSTRUCTOR";
}

export function getSupportRolesPresent(params: {
  mentorAssigned?: boolean;
  chairAssigned?: boolean;
  circleRoles: SupportRole[];
}) {
  const roles = new Set<SupportRole>(params.circleRoles);

  if (params.mentorAssigned) {
    roles.add("PRIMARY_MENTOR");
  }

  if (params.chairAssigned) {
    roles.add("CHAIR");
  }

  return Array.from(roles);
}

export function getSupportRoleGapLabels(rolesPresent: SupportRole[]) {
  const roles = new Set(rolesPresent);
  const missing: string[] = [];

  if (!roles.has("PRIMARY_MENTOR")) {
    missing.push("Primary mentor");
  }

  if (!roles.has("CHAIR")) {
    missing.push("Committee chair");
  }

  if (
    !roles.has("SPECIALIST_MENTOR") &&
    !roles.has("COLLEGE_ADVISOR") &&
    !roles.has("ALUMNI_ADVISOR")
  ) {
    missing.push("Specialist or advisor");
  }

  return missing;
}

export function getRemainingGapLabelsAfterAssignment(params: {
  rolesPresent: SupportRole[];
  supportRole: SupportRole;
}) {
  return getSupportRoleGapLabels([
    ...params.rolesPresent,
    params.supportRole,
  ]);
}

export function getSupportRoleLabel(role: SupportRole) {
  return SUPPORT_ROLE_META[role]?.label ?? role.replace(/_/g, " ").toLowerCase();
}

export function toLaneQueryValue(lane: AdminMentorshipLane) {
  return ADMIN_MENTORSHIP_LANE_META[lane].queryValue;
}
