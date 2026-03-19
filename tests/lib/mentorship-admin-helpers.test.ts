import { describe, expect, it } from "vitest";

import {
  getAdminMentorshipLaneForUser,
  getMentorshipTypeForAdminLane,
  getRemainingGapLabelsAfterAssignment,
  getSupportRoleGapLabels,
  getSupportRolesPresent,
  parseAdminMentorshipLane,
} from "@/lib/mentorship-admin-helpers";

describe("mentorship-admin-helpers", () => {
  describe("parseAdminMentorshipLane", () => {
    it("accepts known lane query values", () => {
      expect(parseAdminMentorshipLane("students")).toBe("STUDENTS");
      expect(parseAdminMentorshipLane("instructors")).toBe("INSTRUCTORS");
      expect(parseAdminMentorshipLane("leadership")).toBe("LEADERSHIP");
    });

    it("falls back to students for unknown values", () => {
      expect(parseAdminMentorshipLane("something-else")).toBe("STUDENTS");
      expect(parseAdminMentorshipLane(undefined)).toBe("STUDENTS");
    });
  });

  describe("getAdminMentorshipLaneForUser", () => {
    it("maps students, instructors, and leadership separately", () => {
      expect(
        getAdminMentorshipLaneForUser({
          primaryRole: "STUDENT",
          roles: ["STUDENT"],
        })
      ).toBe("STUDENTS");

      expect(
        getAdminMentorshipLaneForUser({
          primaryRole: "INSTRUCTOR",
          roles: ["INSTRUCTOR"],
        })
      ).toBe("INSTRUCTORS");

      expect(
        getAdminMentorshipLaneForUser({
          primaryRole: "CHAPTER_LEAD",
          roles: ["CHAPTER_LEAD"],
        })
      ).toBe("LEADERSHIP");
    });
  });

  describe("getMentorshipTypeForAdminLane", () => {
    it("keeps students on the student mentorship type", () => {
      expect(getMentorshipTypeForAdminLane("STUDENTS")).toBe("STUDENT");
    });

    it("routes instructors and leadership through the instructor mentorship type", () => {
      expect(getMentorshipTypeForAdminLane("INSTRUCTORS")).toBe("INSTRUCTOR");
      expect(getMentorshipTypeForAdminLane("LEADERSHIP")).toBe("INSTRUCTOR");
    });
  });

  describe("support role coverage helpers", () => {
    it("shows missing chair and specialist coverage when only a mentor exists", () => {
      const rolesPresent = getSupportRolesPresent({
        mentorAssigned: true,
        chairAssigned: false,
        circleRoles: [],
      });

      expect(getSupportRoleGapLabels(rolesPresent)).toEqual([
        "Committee chair",
        "Specialist or advisor",
      ]);
    });

    it("removes the specialist gap once a specialist mentor is added", () => {
      const rolesPresent = getSupportRolesPresent({
        mentorAssigned: true,
        chairAssigned: true,
        circleRoles: [],
      });

      expect(
        getRemainingGapLabelsAfterAssignment({
          rolesPresent,
          supportRole: "SPECIALIST_MENTOR",
        })
      ).toEqual([]);
    });
  });
});
