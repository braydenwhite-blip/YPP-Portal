import { describe, it, expect } from "vitest";
import {
  automationItemId,
  automationItemIdFromKey,
  parseAutomationItemId,
  AUTOMATION_TYPE_SLUG,
} from "@/lib/automation/item-identity";
import { AUTOMATION_TYPE_META } from "@/lib/automation/types";

describe("automation/item-identity", () => {
  it("builds deterministic ids from type + chapter + entity", () => {
    const id = automationItemId("PARTNER_FOLLOW_UP_DUE", "chap_1", { entityId: "p1" });
    expect(id).toBe("partner-follow-up-due:chap_1:p1");
    // same inputs → same id
    expect(automationItemId("PARTNER_FOLLOW_UP_DUE", "chap_1", { entityId: "p1" })).toBe(id);
  });

  it("includes a window discriminator at day precision", () => {
    const id = automationItemId("PARTNER_FOLLOW_UP_DUE", "chap_1", {
      entityId: "p1",
      window: new Date("2026-06-20T09:30:00Z"),
    });
    expect(id).toBe("partner-follow-up-due:chap_1:p1:2026-06-20");
  });

  it("namespaces an existing engine key while preserving it", () => {
    const id = automationItemIdFromKey("PARTNER_FOLLOW_UP_DUE", "chap_1", "partner-followup:p1");
    expect(id).toBe("partner-follow-up-due:chap_1:partner-followup:p1");
  });

  it("parses an id back into parts", () => {
    const parsed = parseAutomationItemId("partner-follow-up-due:chap_1:p1");
    expect(parsed.slug).toBe("partner-follow-up-due");
    expect(parsed.chapterId).toBe("chap_1");
    expect(parsed.rest).toEqual(["p1"]);
  });

  it("has a slug for every automation type", () => {
    for (const type of Object.keys(AUTOMATION_TYPE_META) as (keyof typeof AUTOMATION_TYPE_META)[]) {
      expect(AUTOMATION_TYPE_SLUG[type]).toBeTruthy();
    }
  });
});
