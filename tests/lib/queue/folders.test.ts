import { describe, expect, it } from "vitest";

import { queueItemFromAttentionItem } from "@/lib/queue/from-attention";
import {
  initiativeNeedsCleanup,
  queueItemFromDecision,
  queueItemFromInitiativeCard,
} from "@/lib/queue/from-initiatives";
import { queueItemFromWorkHubRow } from "@/lib/queue/from-work-hub";

import {
  makeAttentionItem,
  makeDecision,
  makeInitiativeCard,
  makeWorkHubRow,
} from "./fixtures";

const NOW = new Date("2026-06-15T12:00:00.000Z");

describe("queueItemFromWorkHubRow", () => {
  it("translates row flags into deterministic signals and a reason string", () => {
    const item = queueItemFromWorkHubRow(
      makeWorkHubRow({
        id: "action:7",
        overdue: true,
        blocked: true,
        unassigned: true,
        mine: true,
        tone: "danger",
      }),
      NOW
    );
    expect(item.id).toBe("wh:action:7");
    expect(item.signals.overdue).toBe(true);
    expect(item.signals.blocking).toBe(true);
    expect(item.signals.missingOwner).toBe(true);
    expect(item.signals.mine).toBe(true);
    expect(item.severity).toBe("critical");
    expect(item.reason).toContain("overdue");
    expect(item.reason).toContain("unowned");
  });

  it("offers all four resolutions and leads an owner-less loop with Delegate", () => {
    const item = queueItemFromWorkHubRow(
      makeWorkHubRow({ unassigned: true, ownerName: null }),
      NOW
    );
    expect(item.resolutions).toEqual(["resolve", "delegate", "discuss", "defer"]);
    expect(item.primaryAction.resolution).toBe("delegate");
  });

  it("classifies an upcoming meeting row as meeting prep", () => {
    const item = queueItemFromWorkHubRow(
      makeWorkHubRow({
        id: "meeting:9",
        kind: "meeting",
        kindLabel: "Meeting",
        status: "Starts Jun 20",
        previewId: "9",
        previewType: "meeting",
      }),
      NOW
    );
    expect(item.type).toBe("meeting_prep");
    expect(item.relatedMeeting?.id).toBe("9");
  });

  it("marks a single-step, on-track follow-up as a quick win", () => {
    const item = queueItemFromWorkHubRow(
      makeWorkHubRow({ kind: "follow_up", kindLabel: "Meeting follow-up" }),
      NOW
    );
    expect(item.signals.quickWin).toBe(true);
  });
});

describe("queueItemFromAttentionItem", () => {
  it("maps the attention category onto ranking signals", () => {
    const ownerItem = queueItemFromAttentionItem(
      makeAttentionItem({ id: "x:1", category: "missing_owner", severity: "warning" })
    );
    expect(ownerItem.id).toBe("att:x:1");
    expect(ownerItem.signals.missingOwner).toBe(true);
    expect(ownerItem.severity).toBe("high");

    const decisionItem = queueItemFromAttentionItem(
      makeAttentionItem({ id: "x:2", kind: "decision", category: "missing_next_step" })
    );
    expect(decisionItem.signals.needsDecision).toBe(true);
    expect(decisionItem.type).toBe("decision");
  });
});

describe("initiative + decision folders", () => {
  it("only turns initiatives with a real problem into cleanup loops", () => {
    const healthy = makeInitiativeCard({
      healthTone: "success",
      owner: "Mia",
      nextStep: "Ship it",
      overdueActions: 0,
      pastTargetDate: false,
    });
    expect(initiativeNeedsCleanup(healthy)).toBe(false);
    expect(queueItemFromInitiativeCard(healthy)).toBeNull();

    const drifting = makeInitiativeCard({ owner: null, nextStep: null });
    const item = queueItemFromInitiativeCard(drifting);
    expect(item).not.toBeNull();
    expect(item!.signals.missingOwner).toBe(true);
    expect(item!.signals.missingNextStep).toBe(true);
  });

  it("flags a flagship initiative", () => {
    const item = queueItemFromInitiativeCard(
      makeInitiativeCard({ flagship: true, healthTone: "danger" })
    );
    expect(item!.signals.flagshipInitiative).toBe(true);
    expect(item!.signals.needsDecision).toBe(true);
  });

  it("turns an unconverted decision into a 'convert to action' loop", () => {
    const item = queueItemFromDecision(makeDecision());
    expect(item.type).toBe("decision");
    expect(item.signals.missingNextStep).toBe(true);
    expect(item.signals.connectedToMeeting).toBe(true);
    expect(item.primaryAction.label).toBe("Convert to action");
    expect(item.relatedMeeting?.id).toBe("meeting-1");
  });
});
