import { beforeEach, describe, expect, it, vi } from "vitest";

const deliverNotification = vi.fn();

vi.mock("@/lib/notification-delivery", () => ({
  deliverNotification,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventReminder: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("event reminder route", () => {
  beforeEach(() => {
    vi.resetModules();
    deliverNotification.mockReset();
    process.env.CRON_SECRET = "cron-secret";
  });

  it("marks event reminder sends with the SMS-enabled event policy", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    prismaMock.eventReminder.findMany.mockResolvedValue([
      {
        id: "reminder-1",
        userId: "user-1",
        subject: "Event tomorrow",
        body: "Your event starts soon.",
        eventId: "event-1",
        event: {},
        user: { id: "user-1" },
      },
    ]);
    prismaMock.eventReminder.update.mockResolvedValue({});
    deliverNotification.mockResolvedValue({});

    const { POST } = await import("@/app/api/event-reminders/route");
    const response = await POST(
      new Request("http://localhost:3000/api/event-reminders", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret",
        },
      }) as any
    );

    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        policyKey: "EVENT_REMINDERS_AND_CHANGES",
      })
    );
    expect(response.status).toBe(200);
  });
});
