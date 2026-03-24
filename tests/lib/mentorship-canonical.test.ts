import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCanonicalTrackIdentity,
  enforceFullProgramMentorCapacity,
  getAchievementAwardLevelForPoints,
  getGovernanceModeForProgramGroup,
  getMentorshipProgramGroupForRole,
  mentorshipRequiresChairApproval,
} from "@/lib/mentorship-canonical";
import { prisma } from "@/lib/prisma";

describe("mentorship-canonical", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.mentorship as any).count = vi.fn();
  });

  describe("program classification", () => {
    it("maps student and instructor roles directly and routes leadership roles to officer", () => {
      expect(getMentorshipProgramGroupForRole("STUDENT")).toBe("STUDENT");
      expect(getMentorshipProgramGroupForRole("INSTRUCTOR")).toBe("INSTRUCTOR");
      expect(getMentorshipProgramGroupForRole("CHAPTER_PRESIDENT")).toBe("OFFICER");
      expect(getMentorshipProgramGroupForRole("ADMIN")).toBe("OFFICER");
    });

    it("assigns connected governance only to students", () => {
      expect(getGovernanceModeForProgramGroup("STUDENT")).toBe(
        "CONNECTED_STUDENT"
      );
      expect(getGovernanceModeForProgramGroup("INSTRUCTOR")).toBe(
        "FULL_PROGRAM"
      );
      expect(getGovernanceModeForProgramGroup("OFFICER")).toBe("FULL_PROGRAM");
    });
  });

  describe("chair approval rules", () => {
    it("requires chair approval for full-program tracks", () => {
      expect(
        mentorshipRequiresChairApproval({
          programGroup: "OFFICER",
          governanceMode: "FULL_PROGRAM",
        })
      ).toBe(true);
    });

    it("skips chair approval for connected student tracks unless escalated", () => {
      expect(
        mentorshipRequiresChairApproval({
          programGroup: "STUDENT",
          governanceMode: "CONNECTED_STUDENT",
        })
      ).toBe(false);

      expect(
        mentorshipRequiresChairApproval({
          programGroup: "STUDENT",
          governanceMode: "CONNECTED_STUDENT",
          escalateToChair: true,
        })
      ).toBe(true);
    });
  });

  describe("track identity", () => {
    it("builds chapter-scoped identities for instructor tracks", () => {
      expect(
        buildCanonicalTrackIdentity({
          group: "INSTRUCTOR",
          chapterId: "chapter-1",
          chapterName: "Atlanta",
        })
      ).toEqual({
        slug: "instructor-mentorship-chapter-chapter-1",
        name: "Instructor Mentorship - Atlanta",
      });
    });

    it("keeps officer tracks global", () => {
      expect(buildCanonicalTrackIdentity({ group: "OFFICER" })).toEqual({
        slug: "officer-mentorship-global",
        name: "Officer Mentorship - Global",
      });
    });
  });

  describe("award thresholds", () => {
    it("returns the highest earned achievement level", () => {
      expect(getAchievementAwardLevelForPoints(120)).toBeNull();
      expect(getAchievementAwardLevelForPoints(175)).toBe("BRONZE");
      expect(getAchievementAwardLevelForPoints(700)).toBe("GOLD");
      expect(getAchievementAwardLevelForPoints(1900)).toBe("LIFETIME");
    });
  });

  describe("mentor capacity", () => {
    it("allows student-connected assignments to bypass the full-program cap", async () => {
      await expect(
        enforceFullProgramMentorCapacity({
          mentorId: "mentor-1",
          programGroup: "STUDENT",
          governanceMode: "CONNECTED_STUDENT",
        })
      ).resolves.toBeUndefined();

      expect((prisma.mentorship as any).count).not.toHaveBeenCalled();
    });

    it("blocks a fourth full-program officer/instructor mentee", async () => {
      vi.mocked((prisma.mentorship as any).count).mockResolvedValue(3);

      await expect(
        enforceFullProgramMentorCapacity({
          mentorId: "mentor-1",
          programGroup: "OFFICER",
          governanceMode: "FULL_PROGRAM",
        })
      ).rejects.toThrow("hard cap is 3");
    });
  });
});
