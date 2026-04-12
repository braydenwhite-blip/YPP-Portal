import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/auth-supabase";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

describe("notification actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue({
      user: {
        id: "user-1",
        roles: ["STUDENT"],
      },
    } as any);

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).notificationPreference = {
      upsert: vi.fn(),
    };
  });

  it("enables SMS consent with a normalized phone number", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T15:00:00.000Z"));

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).notificationPreference.upsert
      .mockResolvedValueOnce({
        userId: "user-1",
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
        smsPhoneE164: null,
        smsConsentAt: null,
        smsOptOutAt: null,
        announcements: true,
        mentorUpdates: true,
        goalReminders: true,
        courseUpdates: true,
        reflectionReminders: true,
        eventUpdates: true,
        eventReminders: true,
      })
      .mockResolvedValueOnce({ id: "pref-1" });

    const { updateNotificationPreferences } = await import("@/lib/notification-actions");
    const formData = new FormData();
    formData.set("formScope", "sms");
    formData.set("smsPhone", "(415) 555-2671");
    formData.set("smsEnabled", "on");

    await updateNotificationPreferences(formData);

    expect((prisma as any).notificationPreference.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        update: expect.objectContaining({
          smsEnabled: true,
          smsPhoneE164: "+14155552671",
          smsConsentAt: expect.any(Date),
          smsOptOutAt: null,
        }),
      })
    );

    vi.useRealTimers();
  });

  it("returns a friendly error when the SMS number is invalid", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma as any).notificationPreference.upsert.mockResolvedValue({
      userId: "user-1",
      emailEnabled: true,
      inAppEnabled: true,
      smsEnabled: false,
      smsPhoneE164: null,
      smsConsentAt: null,
      smsOptOutAt: null,
      announcements: true,
      mentorUpdates: true,
      goalReminders: true,
      courseUpdates: true,
      reflectionReminders: true,
      eventUpdates: true,
      eventReminders: true,
    });

    const { updateNotificationPreferencesAction } = await import("@/lib/notification-actions");
    const formData = new FormData();
    formData.set("formScope", "sms");
    formData.set("smsPhone", "123");
    formData.set("smsEnabled", "on");

    const state = await updateNotificationPreferencesAction(
      { status: "idle", message: "" },
      formData
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("valid phone number");
  });

  it("disables SMS when the number is removed", async () => {
    const currentPreference = {
      userId: "user-1",
      emailEnabled: true,
      inAppEnabled: true,
      smsEnabled: true,
      smsPhoneE164: "+14155552671",
      smsConsentAt: new Date("2026-04-01T10:00:00.000Z"),
      smsOptOutAt: null,
      announcements: true,
      mentorUpdates: true,
      goalReminders: true,
      courseUpdates: true,
      reflectionReminders: true,
      eventUpdates: true,
      eventReminders: true,
    };

    const { prisma } = await import("@/lib/prisma");
    (prisma as any).notificationPreference.upsert
      .mockResolvedValueOnce(currentPreference)
      .mockResolvedValueOnce({ id: "pref-1" });

    const { updateNotificationPreferences } = await import("@/lib/notification-actions");
    const formData = new FormData();
    formData.set("formScope", "sms");
    formData.set("smsPhone", "");

    await updateNotificationPreferences(formData);

    expect((prisma as any).notificationPreference.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        update: expect.objectContaining({
          smsEnabled: false,
          smsPhoneE164: null,
        }),
      })
    );
  });
});
