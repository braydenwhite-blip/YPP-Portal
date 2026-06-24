import { describe, expect, it } from "vitest";

import { deriveActionContextLabel } from "@/lib/people-strategy/action-context-label";

import { actionItem } from "./people-strategy-action-fixtures";

describe("deriveActionContextLabel — where the action came from", () => {
  it("labels the related entity by its plain noun", () => {
    const cases: Array<[string, string]> = [
      ["CLASS_OFFERING", "Related class"],
      ["PARTNER", "Related partner"],
      ["USER", "Related person"],
      ["INSTRUCTOR_APPLICATION", "Related applicant"],
      ["MENTORSHIP", "Related mentorship"],
    ];
    for (const [type, expected] of cases) {
      const ctx = deriveActionContextLabel(
        actionItem({ relatedEntityType: type, relatedEntityId: "x" })
      );
      expect(ctx?.text).toBe(expected);
    }
  });

  it("returns null for a free-standing action with no links", () => {
    expect(
      deriveActionContextLabel(
        actionItem({
          relatedEntityType: null,
          relatedEntityId: null,
          strategicInitiativeId: null,
          strategicProjectId: null,
        })
      )
    ).toBeNull();
  });

  it("degrades gracefully when a strategic id is unknown to the registry", () => {
    const ctx = deriveActionContextLabel(
      actionItem({ strategicInitiativeId: "not-a-real-initiative" })
    );
    expect(ctx).toBeNull();
  });
});
