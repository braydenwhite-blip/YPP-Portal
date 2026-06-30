import { describe, it, expect } from "vitest";
import {
  interpretPlaybook,
  playbookWindowForWeek,
  factKpiValue,
} from "@/lib/automation/playbook";
import { facts } from "./_fixtures";

describe("automation/playbook interpreter", () => {
  it("maps weeks to windows", () => {
    expect(playbookWindowForWeek(1).id).toBe("weeks_1_2");
    expect(playbookWindowForWeek(6).id).toBe("weeks_5_6");
    expect(playbookWindowForWeek(8).id).toBe("weeks_7_8");
    expect(playbookWindowForWeek(13).id).toBe("weeks_11_12"); // last window absorbs >12
  });

  it("week 1, nothing done → all expected missing, on pace, low confidence (undated)", () => {
    const p = interpretPlaybook(facts({ weekNumber: 1 }));
    expect(p.currentWindow.id).toBe("weeks_1_2");
    expect(p.expected.length).toBe(3);
    expect(p.completed.length).toBe(0);
    expect(p.missing.length).toBe(3);
    expect(p.overdue.length).toBe(0);
    expect(p.paceLabel).toBe("On pace");
    expect(p.confidence).toBe("low"); // cycleStartISO null
    expect(p.recommendedNextAction).toContain("Week 1");
    // canonical targets are reused, not invented
    expect(p.kpiTargets.some((t) => t.key === "partnersContacted" && t.target === 5)).toBe(true);
  });

  it("week 1 foundations met → completed, high confidence when dated", () => {
    const p = interpretPlaybook(
      facts({
        weekNumber: 1,
        cycleStartISO: "2026-06-22T00:00:00.000Z",
        partnersTotal: 5,
        partnersContacted: 5,
        instructorApplicants: 5,
      })
    );
    expect(p.completed.length).toBe(3);
    expect(p.missing.length).toBe(0);
    expect(p.paceLabel).toBe("On pace");
    expect(p.confidence).toBe("high");
  });

  it("week 7 with no confirmed partner → BEHIND with confirmed_partner overdue", () => {
    const p = interpretPlaybook(
      facts({
        weekNumber: 7,
        cycleStartISO: "2026-05-05T00:00:00.000Z",
        partnersContacted: 6,
        partnersMeetingsCompleted: 1,
        instructorApplicants: 25,
        interviewsCompleted: 2,
        partnersConfirmed: 0,
      })
    );
    expect(p.paceLabel).toBe("Behind");
    expect(p.overdue.some((r) => r.id === "confirmed_partner")).toBe(true);
    expect(p.recommendedNextAction.toLowerCase()).toContain("behind");
  });

  it("maps KPI keys onto chapter facts", () => {
    const f = facts({ partnersConfirmed: 2, instructorsHired: 3, enrollmentTotal: 11 });
    expect(factKpiValue(f, "confirmedPartners")).toBe(2);
    expect(factKpiValue(f, "instructorsHired")).toBe(3);
    expect(factKpiValue(f, "studentsEnrolled")).toBe(11);
  });
});
