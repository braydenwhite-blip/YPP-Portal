import { describe, expect, it } from "vitest";

import {
  buildEntitySummaryAnswer,
  shouldScopeAnswerToEntity,
} from "@/lib/help-agent/chief-of-staff";
import type { Entity360 } from "@/lib/operations/entity-360";

const NOW = new Date("2026-07-02T12:00:00.000Z");

function entity(overrides: Partial<Entity360> = {}): Entity360 {
  return {
    type: "partner",
    id: "p1",
    title: "Lincoln Community Center",
    subtitle: "School partner",
    typeLabel: "Partner",
    status: null,
    meta: null,
    initials: "LC",
    avatarUrl: null,
    pageHref: "/partners/p1",
    facts: [],
    people: [],
    classes: [],
    workItems: [],
    meetings: [],
    timeline: [],
    nextStep: null,
    risks: [],
    footnote: null,
    ...overrides,
  };
}

describe("shouldScopeAnswerToEntity", () => {
  it("scopes entity-shaped questions ('this', 'blocking', 'status', 'workflow')", () => {
    expect(shouldScopeAnswerToEntity("Summarize this partner.")).toBe(true);
    expect(shouldScopeAnswerToEntity("What is blocking the launch?")).toBe(true);
    expect(shouldScopeAnswerToEntity("What's the status?")).toBe(true);
    expect(shouldScopeAnswerToEntity("Any workflow stuck here?")).toBe(true);
  });

  it("scopes a question that names the record's own title", () => {
    expect(
      shouldScopeAnswerToEntity(
        "How are things with Lincoln Community Center?",
        "Lincoln Community Center"
      )
    ).toBe(true);
  });

  it("keeps clearly global questions on the global brief", () => {
    expect(shouldScopeAnswerToEntity("What needs attention across chapters?")).toBe(false);
    expect(
      shouldScopeAnswerToEntity("What needs attention across chapters?", "Lincoln Community Center")
    ).toBe(false);
  });
});

describe("buildEntitySummaryAnswer workflows block", () => {
  it("includes a workflows_in_flight block when workflows are attached", () => {
    const answer = buildEntitySummaryAnswer(
      "Summarize this partner.",
      entity({
        workflows: [
          {
            id: "wf1",
            title: "Partner acquisition — Lincoln",
            templateName: "Partner acquisition",
            healthStatus: "BLOCKED",
            healthLabel: "Blocked",
            tone: "overdue",
            reasons: ['"Site visit" is blocked: waiting on facilities'],
            stageName: "Logistics",
            progressLabel: "60% complete",
            ownerName: "Maya",
            dueISO: null,
            nextStepTitle: "Confirm the site visit",
            href: "/workflows/wf1",
          },
        ],
      }),
      { now: NOW }
    );
    const block = answer.blocks.find((b) => b.kind === "workflows_in_flight");
    expect(block).toBeTruthy();
    expect(block?.items[0].label).toBe("Partner acquisition — Lincoln");
    expect(block?.items[0].signal).toBe("Blocked");
    expect(block?.items[0].detail).toContain("waiting on facilities");
    expect(block?.items[0].href).toBe("/workflows/wf1");
  });

  it("omits the block when no workflows touch the record", () => {
    const answer = buildEntitySummaryAnswer("Summarize this partner.", entity(), { now: NOW });
    expect(answer.blocks.some((b) => b.kind === "workflows_in_flight")).toBe(false);
  });
});
