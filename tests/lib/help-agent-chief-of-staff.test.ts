import { describe, expect, it } from "vitest";

import {
  buildChiefOfStaffInsights,
  pageAwarePrompts,
  routeIntent,
} from "@/lib/help-agent/chief-of-staff";
import type { Data360Payload } from "@/lib/operations/data-360-queries";

describe("Chief of Staff intent routing", () => {
  it("routes attention questions to the needs-attention block", () => {
    const r = routeIntent("What needs attention today?");
    expect(r.kinds).toContain("needs_attention");
    expect(r.focused).toBe(true);
  });

  it("routes decision questions to decisions-needing-action", () => {
    expect(routeIntent("What did we decide recently?").kinds).toContain("decisions_needing_action");
  });

  it("routes follow-up questions to unresolved follow-ups", () => {
    expect(routeIntent("Which follow-ups still need to become actions?").kinds).toContain(
      "unresolved_followups"
    );
  });

  it("routes weekly questions to the weekly summary", () => {
    expect(routeIntent("What changed this week?").kinds).toContain("weekly_summary");
  });

  it("routes meeting-without-action questions to meeting follow-through", () => {
    expect(routeIntent("Which meetings ended without next actions?").kinds).toContain(
      "meetings_need_followthrough"
    );
  });

  it("falls back to the default brief for unmatched questions", () => {
    const r = routeIntent("tell me about the universe");
    expect(r.focused).toBe(false);
    expect(r.kinds).toContain("needs_attention");
    expect(r.kinds).toContain("suggested_next_steps");
  });
});

describe("Chief of Staff page-aware prompts", () => {
  it("offers person prompts on a person page", () => {
    const prompts = pageAwarePrompts("/people/u_42");
    expect(prompts.some((p) => /summarize this person/i.test(p.question))).toBe(true);
  });

  it("falls back to global prompts off entity pages", () => {
    const prompts = pageAwarePrompts("/work");
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.some((p) => /needs attention/i.test(p.question))).toBe(true);
  });
});

describe("Chief of Staff proactive insights", () => {
  // Minimal stub carrying only the fields buildChiefOfStaffInsights reads.
  function stub(over: Partial<Data360Payload["digest"]> = {}): Data360Payload {
    const digest = {
      counts: { recentlyCompletedActions: 0 },
      meetingsNeedingFollowThrough: [],
      decisionsNeedingAction: [],
      unresolvedMeetingFollowUps: [],
      ...over,
    };
    return { digest, explorer: [], initiatives: [] } as unknown as Data360Payload;
  }

  it("returns no insights when everything is clear", () => {
    expect(buildChiefOfStaffInsights(stub())).toEqual([]);
  });

  it("surfaces unconverted meeting follow-through, worst first", () => {
    const insights = buildChiefOfStaffInsights(
      stub({
        meetingsNeedingFollowThrough: [{ id: "m1" }, { id: "m2" }] as unknown as Data360Payload["digest"]["meetingsNeedingFollowThrough"],
      })
    );
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights[0].text).toMatch(/meetings? have follow-ups or decisions/i);
    expect(insights[0].href).toContain("/work");
  });

  it("flags completed work as a positive (success) insight", () => {
    const insights = buildChiefOfStaffInsights(
      stub({ counts: { recentlyCompletedActions: 5 } as unknown as Data360Payload["digest"]["counts"] })
    );
    const completed = insights.find((i) => i.tone === "success");
    expect(completed?.text).toMatch(/completed this week/i);
  });
});
