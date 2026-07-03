import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * recordCheckIn server-side authorization + write shaping. The action is the
 * security boundary (the UI `canRecordCheckIn` is only a convenience).
 */

const { mentorshipFindUnique, checkInCreate } = vi.hoisted(() => ({
  mentorshipFindUnique: vi.fn(),
  checkInCreate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mentorship: { findUnique: mentorshipFindUnique },
    mentorshipCheckIn: { create: checkInCreate },
    growthGoal: { findFirst: vi.fn() },
    growthAction: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

let currentViewer: { id: string; roles: string[]; name?: string };
vi.mock("@/lib/authorization", () => ({
  requireSessionUser: () => Promise.resolve(currentViewer),
}));
vi.mock("@/lib/feature-flags", () => ({ isGrowthOsEnabled: () => false }));
vi.mock("@/lib/growth/emit", () => ({ emitGrowthEvent: vi.fn(() => Promise.resolve({ recorded: false })) }));
vi.mock("@/lib/mentorship-program-actions", () => ({
  createMentorshipNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/mentorship/command-access", () => ({
  hasMentorshipCommandAccess: () => Promise.resolve(false),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { recordCheckIn } from "@/lib/mentorship/check-in-actions";

const ACTIVE = {
  id: "m1",
  status: "ACTIVE",
  mentorId: "mentor1",
  chairId: null as string | null,
  menteeId: "mentee1",
  mentee: { name: "Mentee One" },
  mentor: { name: "Mentor One" },
  chair: null,
};

beforeEach(() => {
  mentorshipFindUnique.mockReset();
  checkInCreate.mockReset();
  checkInCreate.mockResolvedValue({ id: "ci1" });
  currentViewer = { id: "mentor1", roles: [], name: "Mentor One" };
});

const baseInput = { subjectId: "mentee1", mentorshipId: "m1", discussion: "Talked" };

describe("recordCheckIn", () => {
  it("rejects a mentorship that is no longer active", async () => {
    mentorshipFindUnique.mockResolvedValue({ ...ACTIVE, status: "COMPLETED" });
    await expect(recordCheckIn(baseInput)).rejects.toThrow(/no longer active/i);
    expect(checkInCreate).not.toHaveBeenCalled();
  });

  it("rejects a viewer who is not the mentor, chair, subject, admin, or leadership", async () => {
    mentorshipFindUnique.mockResolvedValue(ACTIVE);
    currentViewer = { id: "stranger", roles: [] };
    await expect(recordCheckIn(baseInput)).rejects.toThrow(/access/i);
    expect(checkInCreate).not.toHaveBeenCalled();
  });

  it("lets the subject log their own check-in and never notifies themselves", async () => {
    const { createMentorshipNotification } = await import("@/lib/mentorship-program-actions");
    mentorshipFindUnique.mockResolvedValue(ACTIVE);
    currentViewer = { id: "mentee1", roles: [] };
    const res = await recordCheckIn({ ...baseInput, wins: "Shipped a class" });
    expect(res.ok).toBe(true);
    expect(checkInCreate).toHaveBeenCalledOnce();
    expect(createMentorshipNotification).not.toHaveBeenCalled();
    const data = checkInCreate.mock.calls[0][0].data;
    expect(data.subjectId).toBe("mentee1");
    expect(data.authorId).toBe("mentee1");
  });

  it("drops participants who are not members of the relationship", async () => {
    mentorshipFindUnique.mockResolvedValue(ACTIVE);
    currentViewer = { id: "mentor1", roles: [] };
    await recordCheckIn({
      ...baseInput,
      participantIds: ["mentee1", "mentor1", "outsider999"],
    });
    const data = checkInCreate.mock.calls[0][0].data;
    expect(data.participantIds).toContain("mentee1");
    expect(data.participantIds).toContain("mentor1");
    expect(data.participantIds).not.toContain("outsider999");
  });
});
