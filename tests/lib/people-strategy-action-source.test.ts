import { describe, expect, it } from "vitest";

import {
  ACTION_COMPLETION_OUTCOME_VALUES,
  ACTION_SOURCE_TYPE_VALUES,
  deriveActionSource,
  deriveActionSourceLabel,
  deriveActionStrategicLinkage,
  isActionCompletionOutcome,
  isActionSourceType,
  parseActionCompletionOutcome,
  parseActionSourceType,
  parseStrategicLink,
  parseStrategicLinkUpdate,
} from "@/lib/people-strategy/action-source";

// Real registry ids (lib/people-strategy/strategic-projects.ts /
// strategic-initiatives.ts) so the contract is tested against actual config.
const INITIATIVE = "summer-camps-2026";
const PROJECT = "beth-el-pilot"; // belongs to summer-camps-2026
const OTHER_INITIATIVE = "instructor-growth";

describe("action source vocabulary", () => {
  it("recognizes every shipped source type", () => {
    for (const v of ACTION_SOURCE_TYPE_VALUES) expect(isActionSourceType(v)).toBe(true);
    expect(isActionSourceType("NONSENSE")).toBe(false);
    expect(isActionSourceType(null)).toBe(false);
  });
});

describe("parseActionSourceType", () => {
  it("treats empty/null as no source", () => {
    expect(parseActionSourceType(null)).toEqual({ ok: true, value: null });
    expect(parseActionSourceType("  ")).toEqual({ ok: true, value: null });
  });
  it("accepts a known source and trims", () => {
    expect(parseActionSourceType(" MEETING_DECISION ")).toEqual({
      ok: true,
      value: "MEETING_DECISION",
    });
  });
  it("rejects an unknown source", () => {
    const res = parseActionSourceType("ROBOT");
    expect(res.ok).toBe(false);
  });
});

describe("parseStrategicLink", () => {
  it("returns a null link when nothing is supplied", () => {
    expect(parseStrategicLink({})).toEqual({
      ok: true,
      link: { initiativeId: null, projectId: null },
    });
  });

  it("resolves a project's parent initiative authoritatively", () => {
    const res = parseStrategicLink({ strategicProjectId: PROJECT });
    expect(res).toEqual({
      ok: true,
      link: { initiativeId: INITIATIVE, projectId: PROJECT },
    });
  });

  it("accepts a project + its matching initiative", () => {
    const res = parseStrategicLink({
      strategicProjectId: PROJECT,
      strategicInitiativeId: INITIATIVE,
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a project paired with the wrong initiative", () => {
    const res = parseStrategicLink({
      strategicProjectId: PROJECT,
      strategicInitiativeId: OTHER_INITIATIVE,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown project", () => {
    expect(parseStrategicLink({ strategicProjectId: "ghost-project" }).ok).toBe(false);
  });

  it("accepts an initiative-only link", () => {
    expect(parseStrategicLink({ strategicInitiativeId: INITIATIVE })).toEqual({
      ok: true,
      link: { initiativeId: INITIATIVE, projectId: null },
    });
  });

  it("rejects an unknown initiative", () => {
    expect(parseStrategicLink({ strategicInitiativeId: "ghost" }).ok).toBe(false);
  });
});

describe("parseStrategicLinkUpdate", () => {
  it("is unchanged when both fields are omitted", () => {
    expect(parseStrategicLinkUpdate({})).toEqual({ kind: "unchanged" });
  });
  it("clears when sent empty", () => {
    expect(
      parseStrategicLinkUpdate({ strategicInitiativeId: "", strategicProjectId: "" })
    ).toEqual({ kind: "clear" });
  });
  it("sets when a valid id is sent", () => {
    expect(parseStrategicLinkUpdate({ strategicProjectId: PROJECT })).toEqual({
      kind: "set",
      link: { initiativeId: INITIATIVE, projectId: PROJECT },
    });
  });
  it("errors on an invalid pair", () => {
    const res = parseStrategicLinkUpdate({
      strategicProjectId: PROJECT,
      strategicInitiativeId: OTHER_INITIATIVE,
    });
    expect(res.kind).toBe("error");
  });
});

describe("completion outcome", () => {
  it("guards membership", () => {
    for (const v of ACTION_COMPLETION_OUTCOME_VALUES) {
      expect(isActionCompletionOutcome(v)).toBe(true);
    }
    expect(isActionCompletionOutcome("MAYBE")).toBe(false);
  });
  it("parses empty → null and rejects unknown", () => {
    expect(parseActionCompletionOutcome("")).toEqual({ ok: true, value: null });
    expect(parseActionCompletionOutcome("DELIVERED")).toEqual({
      ok: true,
      value: "DELIVERED",
    });
    expect(parseActionCompletionOutcome("XYZ").ok).toBe(false);
  });
});

describe("deriveActionSource", () => {
  it("uses an explicit stored source type", () => {
    const src = deriveActionSource({ sourceType: "PROJECT", sourceId: "beth-el-pilot" });
    expect(src.type).toBe("PROJECT");
    expect(src.explicit).toBe(true);
    expect(src.sourceId).toBe("beth-el-pilot");
  });

  it("infers FOLLOW_UP from a parent action on a legacy row", () => {
    const src = deriveActionSource({ sourceActionId: "act_1" });
    expect(src.type).toBe("FOLLOW_UP");
    expect(src.explicit).toBe(false);
    expect(src.parentActionId).toBe("act_1");
  });

  it("infers MEETING from officerMeetingId on a legacy row", () => {
    const src = deriveActionSource({ officerMeetingId: "mtg_1" });
    expect(src.type).toBe("MEETING");
    expect(src.explicit).toBe(false);
    expect(src.meetingId).toBe("mtg_1");
  });

  it("infers ENTITY from a related entity on a legacy row", () => {
    const src = deriveActionSource({
      relatedEntityType: "PARTNER",
      relatedEntityId: "p_1",
    });
    expect(src.type).toBe("ENTITY");
    expect(src.explicit).toBe(false);
  });

  it("falls back to MANUAL for a bare legacy row", () => {
    const src = deriveActionSource({});
    expect(src.type).toBe("MANUAL");
    expect(src.explicit).toBe(false);
  });

  it("prefers explicit over inferred signals", () => {
    const src = deriveActionSource({
      sourceType: "WEEKLY_REVIEW",
      officerMeetingId: "mtg_1",
    });
    expect(src.type).toBe("WEEKLY_REVIEW");
    expect(src.explicit).toBe(true);
  });
});

describe("deriveActionSourceLabel", () => {
  it("phrases explicit vs inferred honestly", () => {
    expect(deriveActionSourceLabel({ sourceType: "MEETING_DECISION" })).toBe(
      "From a meeting decision"
    );
    expect(deriveActionSourceLabel({ officerMeetingId: "m1" })).toBe("Looks like a meeting");
    expect(deriveActionSourceLabel({})).toBe("Manual");
  });
});

describe("deriveActionStrategicLinkage", () => {
  it("returns an empty linkage with no stored ids", () => {
    const link = deriveActionStrategicLinkage({});
    expect(link.hasExplicitLink).toBe(false);
    expect(link.initiativeId).toBeNull();
  });

  it("resolves an explicit project to titles + hrefs and backfills the initiative", () => {
    const link = deriveActionStrategicLinkage({ strategicProjectId: PROJECT });
    expect(link.hasExplicitLink).toBe(true);
    expect(link.projectId).toBe(PROJECT);
    expect(link.initiativeId).toBe(INITIATIVE);
    expect(link.initiativeTitle).toBeTruthy();
    expect(link.projectHref).toBe(`/operations/projects/${PROJECT}`);
    expect(link.initiativeHref).toBe(`/operations/initiatives/${INITIATIVE}`);
  });

  it("resolves an initiative-only link", () => {
    const link = deriveActionStrategicLinkage({ strategicInitiativeId: INITIATIVE });
    expect(link.hasExplicitLink).toBe(true);
    expect(link.initiativeId).toBe(INITIATIVE);
    expect(link.projectId).toBeNull();
  });

  it("degrades gracefully on an unknown stored id", () => {
    const link = deriveActionStrategicLinkage({ strategicInitiativeId: "ghost" });
    expect(link.hasExplicitLink).toBe(false);
    expect(link.initiativeId).toBeNull();
  });
});
