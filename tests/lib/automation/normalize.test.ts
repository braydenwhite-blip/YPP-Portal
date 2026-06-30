import { describe, it, expect } from "vitest";
import { blockerToAutomationItem } from "@/lib/automation/normalize/from-blockers";
import { studentNeedToAutomationItem } from "@/lib/automation/normalize/from-student-needs";
import { blocker, studentNeed, NOW } from "./_fixtures";

describe("automation/normalize from-blockers", () => {
  it("projects a partner follow-up blocker into a canonical item, preserving the key", () => {
    const item = blockerToAutomationItem(blocker(), "chap_1", NOW);
    expect(item.type).toBe("PARTNER_FOLLOW_UP_DUE");
    expect(item.workflow).toBe("PARTNERS");
    expect(item.severity).toBe("ATTENTION"); // warning → ATTENTION
    expect(item.entityType).toBe("PARTNER");
    expect(item.entityId).toBe("p1");
    expect(item.primaryActionHref).toBe("/partners/p1");
    expect(item.id).toContain("partner-followup:p1"); // engine key preserved
    expect(item.sourceData.sourceKey).toBe("partner-followup:p1");
  });

  it("upgrades critical decision blockers to URGENT", () => {
    const item = blockerToAutomationItem(
      blocker({
        key: "applicant-decision:a1",
        lane: "instructors",
        severity: "critical",
        entityType: "INSTRUCTOR_APPLICATION",
        entityId: "a1",
        href: "/chapter/recruiting?tab=candidates",
        suggestedAction: "Decide on a1",
      }),
      "chap_1",
      NOW
    );
    expect(item.type).toBe("INSTRUCTOR_INTERVIEW_DECISION_DUE");
    expect(item.severity).toBe("URGENT");
  });

  it("falls back to a lane type for unknown keys (e.g. class interventions)", () => {
    const item = blockerToAutomationItem(
      blocker({ key: "class-intervention-foo:c1", lane: "classes", severity: "warning", entityType: "CLASS_OFFERING", entityId: "c1" }),
      "chap_1",
      NOW
    );
    expect(item.workflow).toBe("CLASSES");
    expect(item.type).toBe("CLASS_MISSING_INSTRUCTOR"); // lane fallback
  });
});

describe("automation/normalize from-student-needs", () => {
  it("projects an absence streak into an ATTENDANCE item", () => {
    const item = studentNeedToAutomationItem(studentNeed(), "chap_1", NOW);
    expect(item.type).toBe("STUDENT_ABSENCE_STREAK");
    expect(item.workflow).toBe("ATTENDANCE");
    expect(item.severity).toBe("URGENT"); // critical → URGENT
    expect(item.entityType).toBe("CLASS_OFFERING");
  });
});
