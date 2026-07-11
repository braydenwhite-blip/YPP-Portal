import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canAccessMentorship,
  canAccessMentorshipHub,
  getInstructorMentorshipMembership,
  getMentorshipAccessibleMenteeIds,
  hasMentorshipMenteeAccess,
} from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";

describe("canAccessMentorship", () => {
  it("allows admin, staff, chapter president, and mentor roles", () => {
    expect(canAccessMentorship("ADMIN")).toBe(true);
    expect(canAccessMentorship("STAFF")).toBe(true);
    expect(canAccessMentorship("CHAPTER_PRESIDENT")).toBe(true);
    expect(canAccessMentorship("MENTOR")).toBe(true);
  });

  it("allows MENTOR as a secondary role", () => {
    expect(canAccessMentorship("INSTRUCTOR", ["INSTRUCTOR", "MENTOR"])).toBe(
      true
    );
  });

  it("denies mentee-only instructors and other roles", () => {
    expect(canAccessMentorship("INSTRUCTOR")).toBe(false);
    expect(canAccessMentorship("INSTRUCTOR", ["INSTRUCTOR"])).toBe(false);
    expect(canAccessMentorship("HIRING_CHAIR")).toBe(false);
    expect(canAccessMentorship("STUDENT")).toBe(false);
  });
});

describe("canAccessMentorshipHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.mentorship as any).findFirst = vi.fn();
    (prisma.mentorship as any).count = vi.fn();
  });

  it("allows instructors who currently mentor someone", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue(null);
    (prisma.mentorship as any).count.mockResolvedValue(1);

    await expect(
      canAccessMentorshipHub("instructor-1", "INSTRUCTOR", ["INSTRUCTOR"])
    ).resolves.toBe(true);
  });

  it("allows mentee-only instructors with an active pairing", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue({ id: "m-1" });
    (prisma.mentorship as any).count.mockResolvedValue(0);

    await expect(
      canAccessMentorshipHub("instructor-2", "INSTRUCTOR", ["INSTRUCTOR"])
    ).resolves.toBe(true);
  });

  it("denies instructors with no mentorship pairing either way", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue(null);
    (prisma.mentorship as any).count.mockResolvedValue(0);

    await expect(
      canAccessMentorshipHub("instructor-3", "INSTRUCTOR", ["INSTRUCTOR"])
    ).resolves.toBe(false);
  });
});

describe("mentorship-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.mentorship as any).findMany = vi.fn();
    (prisma.mentorship as any).count = vi.fn();
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

describe("getInstructorMentorshipMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.mentorship as any).findFirst = vi.fn();
    (prisma.mentorship as any).count = vi.fn();
  });

  it("reports mentee-only when user has an active mentee pairing and no mentor pairings", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue({ id: "m-1" });
    (prisma.mentorship as any).count.mockResolvedValue(0);

    const result = await getInstructorMentorshipMembership("user-1");

    expect(result).toEqual({ isMentee: true, isMentor: false, menteeCount: 0 });
  });

  it("reports mentor-only when user mentors others but has no mentor of their own", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue(null);
    (prisma.mentorship as any).count.mockResolvedValue(2);

    const result = await getInstructorMentorshipMembership("user-2");

    expect(result).toEqual({ isMentee: false, isMentor: true, menteeCount: 2 });
  });

  it("reports both when user is a mentee and also mentors others", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue({ id: "m-2" });
    (prisma.mentorship as any).count.mockResolvedValue(3);

    const result = await getInstructorMentorshipMembership("user-3");

    expect(result.isMentee).toBe(true);
    expect(result.isMentor).toBe(true);
    expect(result.menteeCount).toBe(3);
  });

  it("reports neither when there is no relationship in either direction", async () => {
    (prisma.mentorship as any).findFirst.mockResolvedValue(null);
    (prisma.mentorship as any).count.mockResolvedValue(0);

    const result = await getInstructorMentorshipMembership("user-4");

    expect(result).toEqual({ isMentee: false, isMentor: false, menteeCount: 0 });
  });

  it("does not consider role array — derives mentor membership purely from DB", async () => {
    // Simulates an INSTRUCTOR-only role user who is assigned as a mentor on a
    // pairing. Old role-based check would have hidden the mentor view.
    (prisma.mentorship as any).findFirst.mockResolvedValue(null);
    (prisma.mentorship as any).count.mockResolvedValue(1);

    const result = await getInstructorMentorshipMembership("instructor-mentor");

    expect(result.isMentor).toBe(true);
  });
});
