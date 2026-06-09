import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveWorkstreams } from "@/lib/people-strategy/strategic-workstreams";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

import { action, NOW } from "./strategic-helpers";

const def: StrategicInitiativeDef = {
  id: "summer",
  title: "Summer Camps",
  description: "",
  area: "CLASSES",
  status: "active",
  priority: "flagship",
  match: { keywords: ["camp"] },
  workstreams: [
    { id: "partners", title: "Partnership Development", order: 1, match: { keywords: ["partner"] } },
    { id: "curriculum", title: "Curriculum Development", order: 2, match: { keywords: ["curriculum"] } },
  ],
  milestones: [
    { id: "secure", title: "Secure partners", order: 1, workstreamId: "partners", match: { keywords: ["partner"] } },
  ],
};

const partnerDone = () =>
  action({ title: "Secure camp partner", status: "COMPLETE", completedAt: new Date("2026-06-02") });
const curriculumOpen = () =>
  action({ title: "Write curriculum draft", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-12") });

describe("deriveWorkstreams", () => {
  it("classifies the initiative's work into each workstream by its own match", () => {
    const ws = deriveWorkstreams({
      def,
      actions: [partnerDone(), curriculumOpen()],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
    });
    expect(ws.map((w) => w.id)).toEqual(["partners", "curriculum"]); // sorted by order

    const partners = ws[0];
    expect(partners.totalActions).toBe(1);
    expect(partners.completedActions).toBe(1);
    expect(partners.openActions).toBe(0);

    const curriculum = ws[1];
    expect(curriculum.openActions).toBe(1);
    expect(curriculum.completedActions).toBe(0);
  });

  it("attaches milestones to their workstream via workstreamId", () => {
    const ws = deriveWorkstreams({
      def,
      actions: [partnerDone()],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
    });
    const partners = ws.find((w) => w.id === "partners")!;
    expect(partners.milestones.map((m) => m.id)).toEqual(["secure"]);
    expect(partners.milestonesComplete).toBe(1);
    // curriculum has no milestones tagged to it.
    expect(ws.find((w) => w.id === "curriculum")!.milestones).toEqual([]);
  });

  it("derives a workstream health from its slice of work", () => {
    const ws = deriveWorkstreams({
      def,
      actions: [action({ title: "Secure camp partner", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-01") })],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
    });
    const partners = ws.find((w) => w.id === "partners")!;
    expect(partners.overdueActions).toBe(1);
    expect(["at_risk", "critical"]).toContain(partners.health.level);
  });

  it("returns nothing when the initiative declares no workstreams", () => {
    const ws = deriveWorkstreams({
      def: { ...def, workstreams: undefined },
      actions: [partnerDone()],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
    });
    expect(ws).toEqual([]);
  });
});
