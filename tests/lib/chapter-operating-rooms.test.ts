import { describe, it, expect } from "vitest";
import {
  OPERATING_DOMAINS,
  DOMAIN_LIST,
  DOMAIN_META,
  isOperatingDomain,
  deriveRoomHealth,
  blockerToNeedsYou,
  rankNeedsYou,
  toRoomSummary,
  summarizeBuildingHealth,
  type NeedsYouItem,
  type OperatingRoomCore,
  type RoomSummary,
} from "@/lib/chapters/operating-rooms";
import type { ChapterBlocker } from "@/lib/chapters/needs-attention-rules";

function need(o: Partial<NeedsYouItem> = {}): NeedsYouItem {
  return {
    key: "k",
    severity: "warning",
    title: "Something needs doing",
    detail: null,
    href: null,
    entityType: null,
    entityId: null,
    suggestedAction: "Do it",
    ...o,
  };
}

describe("domain catalog", () => {
  it("has six domains, each with a mission and question", () => {
    expect(OPERATING_DOMAINS).toHaveLength(6);
    expect(DOMAIN_LIST).toHaveLength(6);
    for (const d of DOMAIN_LIST) {
      expect(d.mission.length).toBeGreaterThan(0);
      expect(d.question.endsWith("?")).toBe(true);
      expect(DOMAIN_META[d.slug]).toBe(d);
    }
  });
  it("guards domain slugs", () => {
    expect(isOperatingDomain("partner-network")).toBe(true);
    expect(isOperatingDomain("growth")).toBe(true);
    expect(isOperatingDomain("nope")).toBe(false);
  });
});

describe("deriveRoomHealth", () => {
  it("is strong with no items", () => {
    const h = deriveRoomHealth([], "All clear");
    expect(h.status).toBe("strong");
    expect(h.headline).toBe("All clear");
    expect(h.reasons).toEqual([]);
  });
  it("needs attention on warnings, with the reasons", () => {
    const h = deriveRoomHealth([need({ title: "Follow up with Library" })], "ok");
    expect(h.status).toBe("needs_attention");
    expect(h.headline).toMatch(/1 item need/);
    expect(h.reasons).toContain("Follow up with Library");
  });
  it("is critical when any item is critical", () => {
    const h = deriveRoomHealth(
      [need({ severity: "critical", title: "Decision overdue" }), need({ severity: "warning" })],
      "ok"
    );
    expect(h.status).toBe("critical");
    expect(h.reasons).toEqual(["Decision overdue"]);
  });
});

describe("blockerToNeedsYou", () => {
  it("maps a blocker onto the uniform item", () => {
    const b: ChapterBlocker = {
      key: "partner-followup:p1",
      lane: "partners",
      severity: "warning",
      title: "Library: Follow-up overdue",
      detail: "Log a touchpoint.",
      href: "/partners/p1",
      suggestedAction: "Follow up with Library",
      entityType: "PARTNER",
      entityId: "p1",
    };
    expect(blockerToNeedsYou(b)).toEqual({
      key: "partner-followup:p1",
      severity: "warning",
      title: "Library: Follow-up overdue",
      detail: "Log a touchpoint.",
      href: "/partners/p1",
      entityType: "PARTNER",
      entityId: "p1",
      suggestedAction: "Follow up with Library",
    });
  });
});

describe("rankNeedsYou", () => {
  it("orders critical → warning → info, stably", () => {
    const ranked = rankNeedsYou([
      need({ key: "a", severity: "info" }),
      need({ key: "b", severity: "critical" }),
      need({ key: "c", severity: "warning" }),
    ]);
    expect(ranked.map((r) => r.key)).toEqual(["b", "c", "a"]);
  });
});

describe("toRoomSummary + summarizeBuildingHealth", () => {
  function room(o: Partial<OperatingRoomCore> = {}): OperatingRoomCore {
    return {
      slug: "partner-network",
      title: "Partner Network",
      mission: "m",
      question: "q?",
      icon: "🤝",
      health: deriveRoomHealth([], "Strong"),
      metrics: [],
      needsYou: [],
      recentActivity: [],
      insights: [],
      nextAction: { text: "Do the thing", cta: "Go", href: "/x" },
      ...o,
    };
  }
  it("collapses a room to its summary", () => {
    const s = toRoomSummary(room({ needsYou: [need(), need({ key: "k2", title: "Top thing" })] }));
    expect(s.needsYouCount).toBe(2);
    expect(s.topNeedsYou).toBe("Something needs doing");
    expect(s.nextAction).toBe("Do the thing");
    expect(s.short).toBe("Partners");
  });
  it("rolls building health to the worst room", () => {
    const summaries: RoomSummary[] = [
      toRoomSummary(room({ slug: "teaching", health: deriveRoomHealth([], "ok") })),
      toRoomSummary(room({ slug: "classes", health: deriveRoomHealth([need({ severity: "critical" })], "ok") })),
    ];
    const b = summarizeBuildingHealth(summaries);
    expect(b.status).toBe("critical");
    expect(b.critical).toBe(1);
    expect(b.strong).toBe(1);
  });
});
