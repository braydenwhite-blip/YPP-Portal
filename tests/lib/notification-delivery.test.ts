import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotificationEmail = vi.fn();
const isEmailConfigured = vi.fn();
const sendSmsNotification = vi.fn();
const isSmsConfigured = vi.fn();
let mockUserRecord: any = null;
let deliverySequence = 1;
const deliveryStore = new Map<string, any>();

vi.mock("@/lib/email", () => ({
  sendNotificationEmail,
  isEmailConfigured,
}));

vi.mock("@/lib/sms", () => ({
  sendSmsNotification,
  isSmsConfigured,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    notificationDelivery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("notification delivery", () => {
  beforeEach(() => {
    vi.resetModules();
    sendNotificationEmail.mockReset();
    isEmailConfigured.mockReset();
    sendSmsNotification.mockReset();
    isSmsConfigured.mockReset();
    mockUserRecord = null;
    deliverySequence = 1;
    deliveryStore.clear();
  });

  async function configureDeliveryMocks() {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    prismaMock.user.findUnique.mockImplementation(async () => mockUserRecord);
    prismaMock.notificationDelivery.create.mockImplementation(async ({ data }: any) => {
      const id = `delivery-${deliverySequence++}`;
      const record = { id, ...data };
      deliveryStore.set(id, record);
      return { id };
    });
    prismaMock.notificationDelivery.findUnique.mockImplementation(async ({ where, include, select }: any) => {
      let record = null;

      if (where?.id) {
        record = deliveryStore.get(where.id) ?? null;
      } else if (where?.providerMessageId) {
        record =
          Array.from(deliveryStore.values()).find(
            (delivery) => delivery.providerMessageId === where.providerMessageId
          ) ?? null;
      }

      if (!record) {
        return null;
      }

      const enriched = {
        ...record,
        user: include?.user || select?.user
          ? {
              email: mockUserRecord?.email ?? null,
              name: mockUserRecord?.name ?? null,
            }
          : undefined,
        fallbackDeliveries: include?.fallbackDeliveries ? [] : undefined,
      };

      if (select) {
        return Object.fromEntries(
          Object.keys(select).map((key) => [key, enriched[key]])
        );
      }

      return enriched;
    });
    prismaMock.notificationDelivery.update.mockImplementation(async ({ where, data }: any) => {
      const existing = deliveryStore.get(where.id);
      const updated = { ...existing, ...data };
      deliveryStore.set(where.id, updated);
      return updated;
    });
    prismaMock.notificationDelivery.findMany.mockResolvedValue([]);
  }

  it("keeps legacy behavior when no policy key is passed", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    mockUserRecord = {
      id: "user-1",
      email: "user@example.com",
      name: "Jordan",
      notificationPreference: {
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: true,
        smsPhoneE164: "+14155552671",
        announcements: true,
        mentorUpdates: true,
        goalReminders: true,
        courseUpdates: true,
        reflectionReminders: true,
        eventUpdates: true,
        eventReminders: true,
      },
    };
    await configureDeliveryMocks();
    prismaMock.notification.create.mockResolvedValue({ id: "notification-1" });
    isEmailConfigured.mockReturnValue(true);
    isSmsConfigured.mockReturnValue(true);
    sendNotificationEmail.mockResolvedValue({ success: true });
    sendSmsNotification.mockResolvedValue({ success: true });

    const { deliverNotification } = await import("@/lib/notification-delivery");
    await deliverNotification({
      userId: "user-1",
      type: "SYSTEM",
      title: "System alert",
      body: "Check the portal.",
      link: "/notifications",
    });

    expect(sendNotificationEmail).toHaveBeenCalled();
    expect(sendSmsNotification).not.toHaveBeenCalled();
  });

  it("does not send SMS when the user has not opted in", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    mockUserRecord = {
      id: "user-1",
      email: "user@example.com",
      name: "Jordan",
      notificationPreference: {
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
        smsPhoneE164: "+14155552671",
        announcements: true,
        mentorUpdates: true,
        goalReminders: true,
        courseUpdates: true,
        reflectionReminders: true,
        eventUpdates: true,
        eventReminders: true,
      },
    };
    await configureDeliveryMocks();
    prismaMock.notification.create.mockResolvedValue({ id: "notification-1" });
    isEmailConfigured.mockReturnValue(true);
    isSmsConfigured.mockReturnValue(true);
    sendNotificationEmail.mockResolvedValue({ success: true });

    const { deliverNotification } = await import("@/lib/notification-delivery");
    await deliverNotification({
      userId: "user-1",
      type: "SYSTEM",
      title: "Application decision",
      body: "A decision is ready.",
      link: "/applications/app-1",
      policyKey: "APPLICATION_DECISIONS",
    });

    expect(sendSmsNotification).not.toHaveBeenCalled();
  });

  it("sends SMS for an allowed policy when the user opted in", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    mockUserRecord = {
      id: "user-1",
      email: "user@example.com",
      name: "Jordan",
      notificationPreference: {
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: true,
        smsPhoneE164: "+14155552671",
        announcements: true,
        mentorUpdates: true,
        goalReminders: true,
        courseUpdates: true,
        reflectionReminders: true,
        eventUpdates: true,
        eventReminders: true,
      },
    };
    await configureDeliveryMocks();
    prismaMock.notification.create.mockResolvedValue({ id: "notification-1" });
    isEmailConfigured.mockReturnValue(true);
    isSmsConfigured.mockReturnValue(true);
    sendNotificationEmail.mockResolvedValue({ success: true });
    sendSmsNotification.mockResolvedValue({ success: true });

    const { deliverNotification } = await import("@/lib/notification-delivery");
    await deliverNotification({
      userId: "user-1",
      type: "SYSTEM",
      title: "Interview reminder",
      body: "Your interview starts soon.",
      link: "/interviews/schedule",
      policyKey: "INTERVIEW_UPDATES",
    });

    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(sendSmsNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+14155552671",
        title: "Interview reminder",
      })
    );
  });

  it("keeps routine event updates out of SMS", async () => {
    const { prisma } = await import("@/lib/prisma");
    const prismaMock = prisma as any;

    mockUserRecord = {
      id: "user-1",
      email: "user@example.com",
      name: "Jordan",
      notificationPreference: {
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: true,
        smsPhoneE164: "+14155552671",
        announcements: true,
        mentorUpdates: true,
        goalReminders: true,
        courseUpdates: true,
        reflectionReminders: true,
        eventUpdates: true,
        eventReminders: true,
      },
    };
    await configureDeliveryMocks();
    prismaMock.notification.create.mockResolvedValue({ id: "notification-1" });
    isEmailConfigured.mockReturnValue(true);
    isSmsConfigured.mockReturnValue(true);

    const { deliverNotification } = await import("@/lib/notification-delivery");
    await deliverNotification({
      userId: "user-1",
      type: "EVENT_UPDATE",
      title: "Chapter event update",
      body: "The event description changed.",
      link: "/my-chapter/calendar",
      policyKey: "EVENT_UPDATES",
    });

    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(sendSmsNotification).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });
});
