import { describe, expect, it } from "vitest";

import {
  deriveMentorshipTypeFromRole,
  getMentorshipRoleFlags,
  scoreSupportMatch,
} from "@/lib/mentorship-hub";

describe("mentorship-hub", () => {
  describe("getMentorshipRoleFlags", () => {
    it("marks students separately from supporters", () => {
      expect(getMentorshipRoleFlags(["STUDENT"])).toEqual({
        isAdmin: false,
        isChapterLead: false,
        isStudent: true,
        isMentor: false,
        canSupport: false,
      });
    });

    it("treats chapter leads and admins as supporters", () => {
      expect(getMentorshipRoleFlags(["CHAPTER_LEAD"])).toMatchObject({
        isChapterLead: true,
        isMentor: true,
        canSupport: true,
      });
      expect(getMentorshipRoleFlags(["ADMIN"])).toMatchObject({
        isAdmin: true,
        isMentor: true,
        canSupport: true,
      });
    });
  });

  describe("deriveMentorshipTypeFromRole", () => {
    it("keeps student mentorships on the student track", () => {
      expect(deriveMentorshipTypeFromRole("STUDENT")).toBe("STUDENT");
    });

    it("maps non-student roles to the instructor mentorship track", () => {
      expect(deriveMentorshipTypeFromRole("INSTRUCTOR")).toBe("INSTRUCTOR");
      expect(deriveMentorshipTypeFromRole("CHAPTER_LEAD")).toBe("INSTRUCTOR");
    });
  });

  describe("scoreSupportMatch", () => {
    it("rewards shared interests, chapter affinity, and capacity", () => {
      const result = scoreSupportMatch({
        supportRole: "PRIMARY_MENTOR",
        mentorInterests: ["Coding", "Music"],
        menteeInterests: ["coding", "design"],
        sameChapter: true,
        currentLoad: 1,
        capacity: 4,
        availability: "Weeknights",
        hasProfile: true,
      });

      expect(result.score).toBeGreaterThan(50);
      expect(result.reasons).toContain("Same chapter");
      expect(result.reasons).toContain("Availability noted");
    });

    it("penalizes overloaded mentors and boosts future-planning roles", () => {
      const overloaded = scoreSupportMatch({
        supportRole: "PRIMARY_MENTOR",
        mentorInterests: [],
        menteeInterests: [],
        sameChapter: false,
        currentLoad: 5,
        capacity: 2,
        availability: null,
        hasProfile: false,
      });

      const advisor = scoreSupportMatch({
        supportRole: "COLLEGE_ADVISOR",
        mentorInterests: [],
        menteeInterests: [],
        sameChapter: false,
        currentLoad: 1,
        capacity: null,
        availability: "Saturdays",
        hasProfile: true,
      });

      expect(overloaded.score).toBeLessThan(advisor.score);
      expect(advisor.reasons).toContain("Future-planning support role");
    });
  });
});
