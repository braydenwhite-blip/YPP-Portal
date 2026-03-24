import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMentorshipAccessibleMenteeIds,
  hasMentorshipMenteeAccess,
} from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";

describe("mentorship-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.mentorship as any).findMany = vi.fn();
    (prisma as any).mentorshipCircleMember = {
      findMany: vi.fn(),
    };
  });

  it("keeps admin access global", async () => {
    const ids = await getMentorshipAccessibleMenteeIds("admin-1", ["ADMIN"]);

    expect(ids).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("scopes chapter presidents to users in their own chapter", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      chapterId: "chapter-1",
    } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "mentee-1" },
      { id: "mentee-2" },
    ] as any);

    const ids = await getMentorshipAccessibleMenteeIds("lead-1", [
      "CHAPTER_PRESIDENT",
    ]);

    expect(ids).toEqual(["mentee-1", "mentee-2"]);
  });

  it("combines direct mentorship and support-circle access for mentors", async () => {
    (prisma.mentorship as any).findMany.mockResolvedValue([
      { menteeId: "mentee-1" },
      { menteeId: "mentee-2" },
    ]);
    (prisma as any).mentorshipCircleMember.findMany.mockResolvedValue([
      { menteeId: "mentee-2" },
      { menteeId: "mentee-3" },
    ]);

    const ids = await getMentorshipAccessibleMenteeIds("mentor-1", ["MENTOR"]);

    expect(ids).toEqual(["mentee-1", "mentee-2", "mentee-3"]);
  });

  it("blocks chapter presidents from managing mentees outside their chapter", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      chapterId: "chapter-1",
    } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "mentee-1" }] as any);

    await expect(
      hasMentorshipMenteeAccess("lead-1", ["CHAPTER_PRESIDENT"], "mentee-2")
    ).resolves.toBe(false);
  });
});
