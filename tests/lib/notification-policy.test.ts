import { NotificationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getNotificationPolicy, shouldSendPolicyEmail } from "@/lib/notification-policy";

describe("notification policy", () => {
  it("marks urgent alerts for email and future sms delivery", () => {
    for (const type of [
      NotificationType.MESSAGE,
      NotificationType.ATTENDANCE,
      NotificationType.CLASS_REMINDER,
      NotificationType.SYSTEM,
    ]) {
      const policy = getNotificationPolicy(type);
      expect(policy.bucket).toBe("email_and_sms_later");
      expect(policy.email).toBe(true);
      expect(policy.smsPlanned).toBe(true);
    }
  });

  it("keeps reminder-only alerts inside the portal", () => {
    for (const type of [
      NotificationType.GOAL_DEADLINE,
      NotificationType.REFLECTION_REMINDER,
    ]) {
      const policy = getNotificationPolicy(type);
      expect(policy.bucket).toBe("portal_only");
      expect(policy.email).toBe(false);
      expect(shouldSendPolicyEmail(type)).toBe(false);
    }
  });

  it("sends update-style alerts by email without sms", () => {
    for (const type of [
      NotificationType.ANNOUNCEMENT,
      NotificationType.MENTOR_FEEDBACK,
      NotificationType.COURSE_UPDATE,
      NotificationType.EVENT_UPDATE,
      NotificationType.EVENT_REMINDER,
    ]) {
      const policy = getNotificationPolicy(type);
      expect(policy.bucket).toBe("email_only");
      expect(policy.email).toBe(true);
      expect(policy.smsPlanned).toBe(false);
    }
  });
});
