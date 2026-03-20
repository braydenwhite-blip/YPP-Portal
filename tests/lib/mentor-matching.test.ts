import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasInstructorPathwaySpecTable } from "@/lib/instructor-pathway-spec-compat";
import { getSuggestedMentorsForPathway } from "@/lib/mentor-matching";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/instructor-pathway-spec-compat", () => ({
  hasInstructorPathwaySpecTable: vi.fn(),
}));

describe("mentor-matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).instructorPathwaySpec = {
      findMany: vi.fn(),
    };
  });

  it("keeps specialists first, then same-chapter instructors, then fallback instructors", async () => {
    vi.mocked(hasInstructorPathwaySpecTable).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      chapterId: "chapter-1",
    } as any);
    (prisma as any).instructorPathwaySpec.findMany.mockResolvedValue([
      {
        user: {
          id: "specialist-1",
          name: "Specialist",
          chapterId: "chapter-2",
          chapter: { name: "Other Chapter" },
          profile: { bio: null },
          menteePairs: [{ id: "pair-1" }],
        },
      },
    ]);
    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce([
        {
          id: "same-chapter-1",
          name: "Same Chapter",
          chapterId: "chapter-1",
          chapter: { name: "Home Chapter" },
          profile: { bio: null },
          menteePairs: [{ id: "pair-2" }, { id: "pair-3" }],
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          id: "fallback-1",
          name: "Fallback",
          chapterId: "chapter-3",
          chapter: { name: "Far Chapter" },
          profile: { bio: null },
          menteePairs: [],
        },
      ] as any);

    const mentors = await getSuggestedMentorsForPathway(
      "student-1",
      "pathway-1"
    );

    expect(mentors.map((mentor) => mentor.id)).toEqual([
      "specialist-1",
      "same-chapter-1",
      "fallback-1",
    ]);
  });
});
