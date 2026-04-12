import { describe, expect, it } from "vitest";
import { MessagePriority } from "@prisma/client";
import {
  getNotificationScenarioDefinition,
  messagePriorityToNotificationUrgency,
  NOTIFICATION_MATRIX,
  NOTIFICATION_MATRIX_SECTIONS,
} from "@/lib/notification-matrix";

describe("notification matrix", () => {
  it("defines channels, urgency, and fallback behavior for every scenario", () => {
    for (const [scenarioKey, scenario] of Object.entries(NOTIFICATION_MATRIX)) {
      expect(scenario.key).toBe(scenarioKey);
      expect(scenario.type).toBeTruthy();
      expect(scenario.urgency).toBeTruthy();
      expect(typeof scenario.channels.portal).toBe("boolean");
      expect(typeof scenario.channels.email).toBe("boolean");
      expect(typeof scenario.channels.sms).toBe("boolean");
      expect(["BYPASS", "QUEUE"]).toContain(scenario.quietHours);
      expect(["NONE", "EMAIL_ACTION_REQUIRED"]).toContain(scenario.smsFallback);
    }
  });

  it("covers every matrix scenario in the UI section list except compatibility helpers", () => {
    const sectionScenarioKeys = new Set(
      NOTIFICATION_MATRIX_SECTIONS.flatMap((section) => section.scenarios)
    );

    for (const scenarioKey of Object.keys(NOTIFICATION_MATRIX)) {
      if (scenarioKey === "LEGACY_GENERIC" || scenarioKey === "SYSTEM_SMS_TEST") {
        continue;
      }

      expect(sectionScenarioKeys.has(scenarioKey)).toBe(true);
    }
  });

  it("derives sender-selected message channels from urgency", () => {
    expect(messagePriorityToNotificationUrgency(MessagePriority.URGENT)).toBe("P0");
    expect(messagePriorityToNotificationUrgency(MessagePriority.HIGH)).toBe("P1");
    expect(messagePriorityToNotificationUrgency(MessagePriority.NORMAL)).toBe("P2");
    expect(messagePriorityToNotificationUrgency(MessagePriority.LOW)).toBe("P3");

    expect(getNotificationScenarioDefinition("SYSTEM_NEW_MESSAGE", "P0").channels.sms).toBe(true);
    expect(getNotificationScenarioDefinition("SYSTEM_NEW_MESSAGE", "P3").channels.email).toBe(false);
  });
});
