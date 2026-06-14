import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/leadership-action-center/dates";
import {
  actionHasDeadline,
  actionHasNextStep,
  actionHasOwner,
  deriveActionNextCta,
} from "@/lib/people-strategy/action-next-cta";

import { NOW, actionItem, assignment } from "./people-strategy-action-fixtures";

describe("action ownership / deadline / next-step predicates", () => {
  it("treats a lead or an executor as an owner", () => {
    expect(actionHasOwner(actionItem({ leadId: "lead-1", assignments: [] }))).toBe(true);
    expect(
      actionHasOwner(actionItem({ leadId: null, assignments: [assignment("o", "EXECUTING")] }))
    ).toBe(true);
  });

  it("treats no lead and no executor as ownerless", () => {
    expect(
      actionHasOwner(actionItem({ leadId: null, assignments: [assignment("i", "INPUT")] }))
    ).toBe(false);
  });

  it("reads the deadline and the next step (definition of done)", () => {
    expect(actionHasDeadline(actionItem({ deadlineStart: NOW }))).toBe(true);
    expect(actionHasDeadline(actionItem({ deadlineStart: null as never }))).toBe(false);
    expect(actionHasNextStep(actionItem({ successDefinition: "ship it" }))).toBe(true);
    expect(actionHasNextStep(actionItem({ successDefinition: "  " }))).toBe(false);
  });
});

describe("deriveActionNextCta — the §7 precedence ladder", () => {
  it("1. settled actions point to View details", () => {
    expect(deriveActionNextCta(actionItem({ status: "COMPLETE" }), NOW).key).toBe("view");
    expect(deriveActionNextCta(actionItem({ status: "DROPPED" }), NOW).key).toBe("view");
  });

  it("2. ownerless actions ask to Assign owner first", () => {
    const cta = deriveActionNextCta(
      actionItem({ leadId: null, assignments: [] }),
      NOW
    );
    expect(cta.key).toBe("assign_owner");
    expect(cta.behavior).toBe("edit");
  });

  it("3. owned actions with no deadline ask to Set deadline", () => {
    const cta = deriveActionNextCta(
      actionItem({ leadId: "lead-1", deadlineStart: null as never }),
      NOW
    );
    expect(cta.key).toBe("set_deadline");
  });

  it("4. blocked actions ask to Unblock and surface the reason", () => {
    const cta = deriveActionNextCta(
      actionItem({ status: "BLOCKED", blockedReason: "missing partner response" }),
      NOW
    );
    expect(cta.key).toBe("unblock");
    expect(cta.reason).toContain("missing partner response");
  });

  it("5. overdue actions ask to Update status with a day count", () => {
    const cta = deriveActionNextCta(
      actionItem({ status: "IN_PROGRESS", deadlineStart: addDays(NOW, -3) }),
      NOW
    );
    expect(cta.key).toBe("update_status");
    expect(cta.reason).toBe("It's 3 days overdue.");
  });

  it("6. due-today and due-soon actions offer Mark done", () => {
    expect(
      deriveActionNextCta(actionItem({ deadlineStart: NOW }), NOW).key
    ).toBe("mark_done");
    expect(
      deriveActionNextCta(actionItem({ deadlineStart: addDays(NOW, 3) }), NOW).key
    ).toBe("mark_done");
  });

  it("7. on-track actions with no next step ask to Add next step", () => {
    const cta = deriveActionNextCta(
      actionItem({ deadlineStart: addDays(NOW, 20), successDefinition: null }),
      NOW
    );
    expect(cta.key).toBe("add_next_step");
  });

  it("8. otherwise just Open details", () => {
    const cta = deriveActionNextCta(
      actionItem({ deadlineStart: addDays(NOW, 20), successDefinition: "done means X" }),
      NOW
    );
    expect(cta.key).toBe("open");
  });

  it("respects precedence: ownerless beats overdue", () => {
    const cta = deriveActionNextCta(
      actionItem({ leadId: null, assignments: [], deadlineStart: addDays(NOW, -5) }),
      NOW
    );
    expect(cta.key).toBe("assign_owner");
  });

  it("respects precedence: blocked beats overdue", () => {
    const cta = deriveActionNextCta(
      actionItem({ status: "BLOCKED", deadlineStart: addDays(NOW, -5) }),
      NOW
    );
    expect(cta.key).toBe("unblock");
  });
});
