import { NotificationType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEBOUNCE_WINDOW_MS,
  getNotificationPolicy,
  shouldSendAssignmentNotification,
  shouldSendPolicyEmail,
} from "@/lib/notification-policy";

describe("shouldSendAssignmentNotification — debounce key includes interviewerId", () => {
  // Use a unique appId per test so the shared in-memory store doesn't leak
  // across tests. Each test gets its own namespace; time control via fake timers.
  let appId: string;
  let testIndex = 0;

  const INTERVIEWER_A = "interviewer-a";
  const INTERVIEWER_B = "interviewer-b";
  const ROLE = "LEAD";

  beforeEach(() => {
    appId = `app-ws8-${testIndex++}`;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the first assignment notification for Interviewer A", () => {
    expect(
      shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_A, appId, ROLE)
    ).toBe(true);
  });

  it("debounces an immediate reassignment of the same interviewer + role", () => {
    shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_A, appId, ROLE);
    // Same person, same role → debounced
    expect(
      shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_A, appId, ROLE)
    ).toBe(false);
  });

  it("fires a fresh notification when a different interviewer is assigned the same role within 5 min", () => {
    shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_A, appId, ROLE);
    // Different person, same role → new key → should fire
    expect(
      shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_B, appId, ROLE)
    ).toBe(true);
  });

  it("fires again after the debounce window expires", () => {
    shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_A, appId, ROLE);
    // Advance past the 5-minute window
    vi.advanceTimersByTime(DEBOUNCE_WINDOW_MS + 1);
    expect(
      shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", INTERVIEWER_A, appId, ROLE)
    ).toBe(true);
  });

  it("debounces reviewer assignments by interviewerId without a role", () => {
    expect(
      shouldSendAssignmentNotification("REVIEWER_ASSIGNED", INTERVIEWER_A, appId)
    ).toBe(true);
    // Same person, same application → debounced
    expect(
      shouldSendAssignmentNotification("REVIEWER_ASSIGNED", INTERVIEWER_A, appId)
    ).toBe(false);
    // Different person → fires
    expect(
      shouldSendAssignmentNotification("REVIEWER_ASSIGNED", INTERVIEWER_B, appId)
    ).toBe(true);
  });
});

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
