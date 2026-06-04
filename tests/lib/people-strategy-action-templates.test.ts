import { describe, expect, it } from "vitest";
import type { ActionTemplate } from "@prisma/client";

import {
  templateDescription,
  templateToFormInitial,
} from "@/lib/people-strategy/action-templates";

function template(overrides: Partial<ActionTemplate>): ActionTemplate {
  return {
    id: "t1",
    name: "Onboard new instructor",
    description: "Get a new instructor set up.",
    category: "Instruction",
    titleTemplate: "Onboard new instructor: [name]",
    descriptionTemplate: "Run onboarding end to end.",
    goalCategory: null,
    defaultPriority: "HIGH",
    defaultVisibility: "ALL_LEADERSHIP",
    deadlineOffsetDays: 14,
    checklist: ["Send welcome", "Assign a mentor"],
    isStandard: true,
    archivedAt: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ActionTemplate;
}

describe("templateDescription", () => {
  it("appends the checklist as markdown tasks", () => {
    const out = templateDescription(template({}));
    expect(out).toContain("Run onboarding end to end.");
    expect(out).toContain("- [ ] Send welcome");
    expect(out).toContain("- [ ] Assign a mentor");
  });

  it("omits the checklist heading when there are no steps", () => {
    expect(templateDescription(template({ checklist: [] }))).not.toContain("Checklist:");
  });
});

describe("templateToFormInitial", () => {
  const NOW = new Date("2026-06-04T00:00:00");

  it("maps priority/visibility/title and seeds the deadline from the offset", () => {
    const initial = templateToFormInitial(template({}), NOW);
    expect(initial.title).toBe("Onboard new instructor: [name]");
    expect(initial.priority).toBe("HIGH");
    expect(initial.visibility).toBe("ALL_LEADERSHIP");
    expect(initial.status).toBe("NOT_STARTED");
    expect(initial.deadlineStart).toEqual(new Date("2026-06-18T00:00:00"));
  });

  it("leaves the deadline blank when the template has no offset", () => {
    const initial = templateToFormInitial(template({ deadlineOffsetDays: null }), NOW);
    expect(initial.deadlineStart).toBeNull();
  });
});
