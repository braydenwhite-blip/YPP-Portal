import { describe, it, expect } from "vitest";

import {
  buildWorkflowData360Overview,
  buildWorkflowHealthDistribution,
  buildWorkflowLinkedWorkSummary,
  buildWorkflowStepAnalytics,
  groupWorkflowsByChapter,
  groupWorkflowsByEntityType,
  groupWorkflowsByTemplate,
  isActiveHealth,
  workflowData360DrilldownHref,
  type WorkflowAnalyticsInstance,
} from "@/lib/data-360/workflow-analytics-core";
import type { WorkflowHealthStatus } from "@/lib/workflow-engine/health";

let seq = 0;
function inst(over: Partial<WorkflowAnalyticsInstance> = {}): WorkflowAnalyticsInstance {
  seq += 1;
  return {
    id: over.id ?? `wf-${seq}`,
    title: over.title ?? `Workflow ${seq}`,
    status: over.status ?? "ACTIVE",
    health: over.health ?? "ON_TRACK",
    healthReasons: over.healthReasons ?? [],
    chapterId: over.chapterId ?? null,
    chapterName: over.chapterName ?? null,
    entityType: over.entityType ?? null,
    entityId: over.entityId ?? null,
    templateId: over.templateId ?? "tpl-1",
    templateName: over.templateName ?? "Template One",
    templateKey: over.templateKey ?? "template-one",
    ownerId: over.ownerId ?? null,
    ownerName: over.ownerName ?? null,
    startedAtISO: over.startedAtISO ?? "2026-06-01T00:00:00.000Z",
    dueAtISO: over.dueAtISO ?? null,
    currentStageName: over.currentStageName ?? null,
    completionPercent: over.completionPercent ?? 0,
    ageDays: over.ageDays ?? 5,
    nextStepTitle: over.nextStepTitle ?? null,
    nextStepDueISO: over.nextStepDueISO ?? null,
    stepCounts: over.stepCounts ?? { total: 4, complete: 1, blocked: 0, overdue: 0, pending: 3 },
    linkedActionCount: over.linkedActionCount ?? 0,
    linkedMeetingCount: over.linkedMeetingCount ?? 0,
    attachmentCount: over.attachmentCount ?? 0,
  };
}

const sample: WorkflowAnalyticsInstance[] = [
  inst({ health: "ON_TRACK", chapterId: "c1", chapterName: "Alpha", entityType: "PARTNER", linkedActionCount: 2 }),
  inst({ health: "BLOCKED", chapterId: "c1", chapterName: "Alpha", entityType: "PARTNER", attachmentCount: 1 }),
  inst({ health: "OVERDUE", chapterId: "c2", chapterName: "Beta", entityType: "CLASS_OFFERING", linkedMeetingCount: 1 }),
  inst({ health: "COMPLETE", chapterId: "c2", chapterName: "Beta", entityType: "CLASS_OFFERING", templateId: "tpl-2", templateName: "Template Two" }),
  inst({ health: "STALLED", chapterId: null, entityType: null }),
];

describe("isActiveHealth", () => {
  it("treats the five live statuses as active, terminal ones as not", () => {
    const active: WorkflowHealthStatus[] = ["BLOCKED", "OVERDUE", "STALLED", "NEEDS_ATTENTION", "ON_TRACK"];
    active.forEach((h) => expect(isActiveHealth(h)).toBe(true));
    expect(isActiveHealth("COMPLETE")).toBe(false);
    expect(isActiveHealth("ARCHIVED")).toBe(false);
  });
});

describe("buildWorkflowHealthDistribution", () => {
  it("counts by status and sums needs-attention (not on-track/terminal)", () => {
    const d = buildWorkflowHealthDistribution(sample);
    expect(d.total).toBe(5);
    expect(d.counts.BLOCKED).toBe(1);
    expect(d.counts.OVERDUE).toBe(1);
    expect(d.counts.STALLED).toBe(1);
    expect(d.counts.ON_TRACK).toBe(1);
    expect(d.counts.COMPLETE).toBe(1);
    expect(d.needsAttention).toBe(3); // blocked + overdue + stalled
  });
});

describe("buildWorkflowStepAnalytics", () => {
  it("sums step rollups across instances", () => {
    const s = buildWorkflowStepAnalytics(sample);
    expect(s.total).toBe(5 * 4);
    expect(s.complete).toBe(5 * 1);
    expect(s.pending).toBe(5 * 3);
  });
});

describe("buildWorkflowLinkedWorkSummary", () => {
  it("counts created actions/meetings and workflows carrying them", () => {
    const l = buildWorkflowLinkedWorkSummary(sample);
    expect(l.actionsCreated).toBe(2);
    expect(l.meetingsCreated).toBe(1);
    expect(l.workflowsWithActions).toBe(1);
    expect(l.workflowsWithMeetings).toBe(1);
    expect(l.workflowsWithAttachments).toBe(1);
    expect(l.attachmentsTotal).toBe(1);
  });
});

describe("groupWorkflowsByChapter", () => {
  it("groups by chapter and buckets chapterless workflows under 'No chapter'", () => {
    const rows = groupWorkflowsByChapter(sample);
    const alpha = rows.find((r) => r.key === "c1");
    const noChapter = rows.find((r) => r.key === "__unassigned__");
    expect(alpha?.total).toBe(2);
    expect(alpha?.blocked).toBe(1);
    expect(alpha?.label).toBe("Alpha");
    expect(noChapter?.label).toBe("No chapter");
    expect(noChapter?.total).toBe(1);
  });
});

describe("groupWorkflowsByEntityType", () => {
  it("groups by entity type with a human label", () => {
    const rows = groupWorkflowsByEntityType(sample);
    const partner = rows.find((r) => r.key === "PARTNER");
    expect(partner?.total).toBe(2);
    expect(partner?.label.toLowerCase()).toContain("partner");
  });
});

describe("groupWorkflowsByTemplate", () => {
  it("counts completed and distinct chapters per template", () => {
    const rows = groupWorkflowsByTemplate(sample);
    const t2 = rows.find((r) => r.key === "tpl-2");
    expect(t2?.completed).toBe(1);
    const t1 = rows.find((r) => r.key === "tpl-1");
    expect(t1?.chaptersUsing).toBe(2); // c1 and c2
  });
});

describe("buildWorkflowData360Overview", () => {
  it("rolls up totals, active count, and chapters-with-workflows", () => {
    const o = buildWorkflowData360Overview(sample);
    expect(o.total).toBe(5);
    expect(o.active).toBe(4); // all but COMPLETE
    expect(o.chaptersWithWorkflows).toBe(2);
  });
});

describe("workflowData360DrilldownHref", () => {
  it("builds filtered workflow links with no dead params", () => {
    expect(workflowData360DrilldownHref({})).toBe("/workflows");
    expect(workflowData360DrilldownHref({ health: "BLOCKED" })).toBe("/workflows?health=BLOCKED");
    expect(workflowData360DrilldownHref({ chapterId: "c1", templateId: "t1" })).toBe(
      "/workflows?chapterId=c1&templateId=t1"
    );
    expect(workflowData360DrilldownHref({ status: "COMPLETED", entityType: "PARTNER" })).toBe(
      "/workflows?status=COMPLETED&entityType=PARTNER"
    );
  });
});
