import { describe, expect, it } from "vitest";

import {
  actionPrefillFromQuery,
  actionPrefillToQuery,
  buildActionPrefillFromDecision,
  buildActionPrefillFromEntity,
  buildActionPrefillFromFollowUp,
  buildActionPrefillFromMeeting,
} from "@/lib/people-strategy/action-prefill";
import { buildInitiativeActionPrefill } from "@/lib/people-strategy/strategic-recommendations";
import { buildProjectActionPrefill } from "@/lib/people-strategy/strategic-project-summary";
import { getInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";
import { getProjectDef, getParentInitiative } from "@/lib/people-strategy/strategic-project-registry";

describe("action prefill 4.0 round-trip", () => {
  it("serializes and re-parses the honest context params", () => {
    const href = actionPrefillToQuery({
      title: "Email Beth El coordinator",
      dueDate: "2026-06-07",
      sourceType: "PROJECT",
      sourceId: "dec_1",
      sourceActionId: "act_parent",
      strategicInitiativeId: "summer-camps-2026",
      strategicProjectId: "beth-el-pilot",
      suggestedOwnerId: "user_1",
      successDefinition: "Reply received",
    });
    const qs = href.split("?")[1];
    const parsed = actionPrefillFromQuery(new URLSearchParams(qs));
    expect(parsed.sourceType).toBe("PROJECT");
    expect(parsed.sourceId).toBe("dec_1");
    expect(parsed.sourceActionId).toBe("act_parent");
    expect(parsed.strategicInitiativeId).toBe("summer-camps-2026");
    expect(parsed.strategicProjectId).toBe("beth-el-pilot");
    expect(parsed.suggestedOwnerId).toBe("user_1");
    expect(parsed.successDefinition).toBe("Reply received");
    expect(parsed.dueDate).toBe("2026-06-07");
  });

  it("clamps dueInDays and validates related-entity membership on parse", () => {
    const parsed = actionPrefillFromQuery({
      dueInDays: "999",
      relatedType: "NONSENSE",
      relatedId: "x",
    });
    expect(parsed.dueInDays).toBe(365);
    expect(parsed.relatedType).toBeUndefined();
  });
});

describe("source-tagged builders", () => {
  it("tags a decision-sourced action as MEETING_DECISION with id, owner, success", () => {
    const p = buildActionPrefillFromDecision({
      decision: "Lock the Beth El dates",
      meetingId: "mtg_1",
      decisionId: "dec_9",
      suggestedOwnerId: "user_7",
    });
    expect(p.sourceType).toBe("MEETING_DECISION");
    expect(p.sourceId).toBe("dec_9");
    expect(p.suggestedOwnerId).toBe("user_7");
    expect(p.successDefinition).toBeTruthy();
    expect(p.sourceMeetingId).toBe("mtg_1");
  });

  it("tags an entity-sourced action as ENTITY", () => {
    const p = buildActionPrefillFromEntity({ type: "PARTNER", id: "p_1" });
    expect(p.sourceType).toBe("ENTITY");
    expect(p.relatedType).toBe("PARTNER");
  });

  it("tags a meeting-sourced action as MEETING", () => {
    const p = buildActionPrefillFromMeeting({ meetingId: "mtg_2" });
    expect(p.sourceType).toBe("MEETING");
  });

  it("tags a follow-up with the parent action id", () => {
    const p = buildActionPrefillFromFollowUp({ parentActionId: "act_1", parentTitle: "Call vendor" });
    expect(p.sourceType).toBe("FOLLOW_UP");
    expect(p.sourceActionId).toBe("act_1");
    expect(p.title).toBe("Follow-up: Call vendor");
  });
});

describe("strategic CTAs now carry an explicit, registry-valid link", () => {
  it("initiative CTA stores the initiative id + INITIATIVE source", () => {
    const def = getInitiativeDef("summer-camps-2026")!;
    const href = buildInitiativeActionPrefill(def);
    const parsed = actionPrefillFromQuery(new URLSearchParams(href.split("?")[1]));
    expect(parsed.strategicInitiativeId).toBe("summer-camps-2026");
    expect(parsed.sourceType).toBe("INITIATIVE");
  });

  it("project CTA stores the project + parent-initiative ids + PROJECT source", () => {
    const project = getProjectDef("beth-el-pilot")!;
    const initiative = getParentInitiative(project)!;
    const href = buildProjectActionPrefill(project, initiative);
    const parsed = actionPrefillFromQuery(new URLSearchParams(href.split("?")[1]));
    expect(parsed.strategicProjectId).toBe("beth-el-pilot");
    expect(parsed.strategicInitiativeId).toBe(initiative.id);
    expect(parsed.sourceType).toBe("PROJECT");
  });
});
