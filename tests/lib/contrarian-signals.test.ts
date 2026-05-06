import { describe, expect, it } from "vitest";
import { detectContrarianSignals } from "@/lib/contrarian-signals";

describe("detectContrarianSignals", () => {
  it("returns no signals when the action aligns with reviewer feedback", () => {
    expect(
      detectContrarianSignals({
        action: "APPROVE",
        hasSubmittedInterviewReviews: true,
        recommendations: ["ACCEPT", "ACCEPT_WITH_SUPPORT"],
        redFlagCount: 0,
      })
    ).toEqual([]);
  });

  it("flags APPROVE_WITH_RED_FLAG when any red flag is present and action is approve", () => {
    const signals = detectContrarianSignals({
      action: "APPROVE",
      hasSubmittedInterviewReviews: true,
      recommendations: ["ACCEPT"],
      redFlagCount: 2,
      redFlagSources: ["Alex Chen", "Pat Kim"],
    });
    expect(signals[0]?.kind).toBe("APPROVE_WITH_RED_FLAG");
    expect(signals[0]?.detail).toContain("Alex Chen");
  });

  it("flags APPROVE_WITH_MAJORITY_REJECT when most reviews recommend reject", () => {
    const signals = detectContrarianSignals({
      action: "APPROVE",
      hasSubmittedInterviewReviews: true,
      recommendations: ["REJECT", "REJECT", "ACCEPT"],
      redFlagCount: 0,
    });
    expect(signals.some((s) => s.kind === "APPROVE_WITH_MAJORITY_REJECT")).toBe(true);
  });

  it("flags APPROVE_WITHOUT_INTERVIEWS when zero submitted reviews exist", () => {
    const signals = detectContrarianSignals({
      action: "APPROVE",
      hasSubmittedInterviewReviews: false,
      recommendations: [],
      redFlagCount: 0,
    });
    expect(signals.map((s) => s.kind)).toContain("APPROVE_WITHOUT_INTERVIEWS");
  });

  it("flags REJECT_WITH_MAJORITY_ACCEPT when chair rejects despite accept majority", () => {
    const signals = detectContrarianSignals({
      action: "REJECT",
      hasSubmittedInterviewReviews: true,
      recommendations: ["ACCEPT", "ACCEPT_WITH_SUPPORT"],
      redFlagCount: 0,
    });
    expect(signals.map((s) => s.kind)).toContain("REJECT_WITH_MAJORITY_ACCEPT");
  });

  it("flags REJECT_REVERSING_PRIOR_APPROVAL when prior approval is being undone", () => {
    const signals = detectContrarianSignals({
      action: "REJECT",
      hasSubmittedInterviewReviews: true,
      recommendations: ["ACCEPT"],
      redFlagCount: 0,
      priorDecisionAction: "APPROVE",
    });
    expect(signals.map((s) => s.kind)).toContain("REJECT_REVERSING_PRIOR_APPROVAL");
  });

  it("emits multiple signals when several conditions trigger at once", () => {
    const signals = detectContrarianSignals({
      action: "APPROVE",
      hasSubmittedInterviewReviews: false,
      recommendations: [],
      redFlagCount: 1,
    });
    const kinds = signals.map((s) => s.kind);
    expect(kinds).toContain("APPROVE_WITH_RED_FLAG");
    expect(kinds).toContain("APPROVE_WITHOUT_INTERVIEWS");
  });

  it("does not flag for non-approve / non-reject actions", () => {
    expect(
      detectContrarianSignals({
        action: "HOLD",
        hasSubmittedInterviewReviews: true,
        recommendations: ["REJECT", "REJECT"],
        redFlagCount: 5,
      })
    ).toEqual([]);
  });
});
