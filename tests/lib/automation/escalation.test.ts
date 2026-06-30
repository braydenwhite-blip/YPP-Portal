import { describe, it, expect } from "vitest";
import { buildChapterEscalations } from "@/lib/automation/escalation";
import { computeChapterReadiness } from "@/lib/automation/readiness";
import { interpretPlaybook } from "@/lib/automation/playbook";
import { facts, NOW } from "./_fixtures";
import { addDays, isoOrNull } from "@/lib/automation/date-helpers";

function escalationsFor(f: ReturnType<typeof facts>) {
  return buildChapterEscalations(f, computeChapterReadiness(f, NOW), interpretPlaybook(f), NOW);
}

describe("automation/escalation", () => {
  it("escalates no confirmed partner by Week 6", () => {
    const e = escalationsFor(facts({ weekNumber: 6, partnersConfirmed: 0, partnersContacted: 5 }));
    const noPartner = e.find((x) => x.id.includes("no-partner"));
    expect(noPartner).toBeTruthy();
    expect(noPartner?.severity).toBe("BLOCKING");
    expect(noPartner?.recommendedLeadershipAction).toBeTruthy();
  });

  it("escalates severely overdue curriculum reviews", () => {
    const e = escalationsFor(facts({ weekNumber: 5, curriculaCpReviewOverdue: 2, curriculaSubmitted: 3 }));
    expect(e.some((x) => x.id.includes("curriculum-overdue"))).toBe(true);
  });

  it("escalates launch risk when launch is near with blocking gaps", () => {
    const e = escalationsFor(
      facts({ weekNumber: 7, launchTargetISO: isoOrNull(addDays(NOW, 5)), partnersConfirmed: 0 })
    );
    expect(e.some((x) => x.id.includes("launch-risk"))).toBe(true);
  });

  it("a healthy early chapter has no escalations", () => {
    const e = escalationsFor(facts({ weekNumber: 2, partnersContacted: 5, instructorApplicants: 5 }));
    expect(e.length).toBe(0);
  });
});
