import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { registerForPathwayEvent } from "@/lib/pathway-event-actions";
import { prisma } from "@/lib/prisma";

describe("pathway-event-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "student-1",
        roles: ["STUDENT"],
      },
    } as any);
    (prisma as any).pathwayEvent = {
      findUnique: vi.fn(),
    };
    (prisma as any).pathwayEventRegistration = {
      create: vi.fn(),
      deleteMany: vi.fn(),
    };
    (prisma as any).enrollment = {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    };
  });

  it("blocks registration when the required pathway step is not complete", async () => {
    (prisma as any).pathwayEvent.findUnique.mockResolvedValue({
      id: "event-1",
      eventDate: new Date("2099-05-01T10:00:00.000Z"),
      maxAttendees: 20,
      requiredStepOrder: 2,
      registrations: [],
      pathway: {
        steps: [
          {
            id: "step-1",
            stepOrder: 1,
            courseId: "course-1",
            title: null,
          },
          {
            id: "step-2",
            stepOrder: 2,
            courseId: null,
            title: "Milestone",
          },
        ],
      },
    });
    (prisma as any).enrollment.findMany.mockResolvedValue([]);

    await expect(registerForPathwayEvent("event-1")).resolves.toEqual({
      error: "Complete the required pathway step before registering.",
    });
    expect((prisma as any).pathwayEventRegistration.create).not.toHaveBeenCalled();
  });

  it("blocks registration when the event is already full", async () => {
    (prisma as any).pathwayEvent.findUnique.mockResolvedValue({
      id: "event-1",
      eventDate: new Date("2099-05-01T10:00:00.000Z"),
      maxAttendees: 1,
      requiredStepOrder: null,
      registrations: [{ userId: "student-2" }],
      pathway: {
        steps: [],
      },
    });

    await expect(registerForPathwayEvent("event-1")).resolves.toEqual({
      error: "This event is already full.",
    });
    expect((prisma as any).pathwayEventRegistration.create).not.toHaveBeenCalled();
  });
});
