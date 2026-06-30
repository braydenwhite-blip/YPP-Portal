import { describe, it, expect } from "vitest";

import {
  computeCompletionPercent,
  computeRuntimeState,
  evaluateExitCriteria,
  resolveAdvanceTarget,
} from "@/lib/workflow-engine/runtime";
import { NOW, exec, instance, twoStageTemplate } from "./_fixtures";

describe("workflow-engine runtime", () => {
  it("a fresh instance points at the first required step", () => {
    const template = twoStageTemplate();
    const execs = [
      exec({ stageKey: "a", stepKey: "a1", isRequired: true }),
      exec({ stageKey: "a", stepKey: "a2", isRequired: false }),
    ];
    const state = computeRuntimeState({ template, instance: instance(), executions: execs, now: NOW });

    expect(state.currentStageKey).toBe("a");
    expect(state.completionPercent).toBe(0);
    expect(state.canAdvance).toBe(false);
    expect(state.nextAction.kind).toBe("COMPLETE_STEP");
    expect(state.nextAction.stepKey).toBe("a1");
    expect(state.exitCriteria.met).toBe(false);
    expect(state.exitCriteria.missing).toContain("a1");
  });

  it("completing the required step lets the stage advance (optional step ignored)", () => {
    const template = twoStageTemplate();
    const execs = [
      exec({ stageKey: "a", stepKey: "a1", isRequired: true, state: "COMPLETE" }),
      exec({ stageKey: "a", stepKey: "a2", isRequired: false, state: "PENDING" }),
    ];
    const state = computeRuntimeState({ template, instance: instance(), executions: execs, now: NOW });

    expect(state.exitCriteria.met).toBe(true);
    expect(state.canAdvance).toBe(true);
    expect(state.advanceTargetStageKey).toBe("b");
    expect(state.nextAction.kind).toBe("ADVANCE_STAGE");
    // 1 of 2 required steps across the whole template are done.
    expect(state.completionPercent).toBe(50);
  });

  it("a blocked step blocks the instance and recommends unblocking", () => {
    const template = twoStageTemplate();
    const execs = [exec({ stageKey: "a", stepKey: "a1", state: "BLOCKED", blockedReason: "stuck" })];
    const state = computeRuntimeState({ template, instance: instance(), executions: execs, now: NOW });

    expect(state.isBlocked).toBe(true);
    expect(state.nextAction.kind).toBe("UNBLOCK");
    expect(state.blockedExecutionIds).toContain("a.a1");
  });

  it("marks an instance overdue when its due date has passed", () => {
    const template = twoStageTemplate();
    const past = "2026-06-01T00:00:00.000Z";
    const execs = [exec({ stageKey: "a", stepKey: "a1" })];
    const state = computeRuntimeState({
      template,
      instance: instance({ dueAt: past }),
      executions: execs,
      now: NOW,
    });
    expect(state.isOverdue).toBe(true);
  });

  it("a satisfied terminal stage recommends completing the workflow", () => {
    const template = twoStageTemplate();
    const execs = [
      exec({ stageKey: "a", stepKey: "a1", state: "COMPLETE" }),
      exec({ stageKey: "b", stepKey: "b1", state: "COMPLETE" }),
    ];
    const state = computeRuntimeState({
      template,
      instance: instance({ currentStageKey: "b" }),
      executions: execs,
      now: NOW,
    });
    expect(state.completionPercent).toBe(100);
    expect(state.canAdvance).toBe(false); // terminal — there is nothing after it
    expect(state.nextAction.kind).toBe("DONE");
    expect(state.completedStageKeys).toContain("a");
  });

  it("evaluateExitCriteria flags required steps with no execution yet", () => {
    const template = twoStageTemplate();
    const stageA = template.stages.find((s) => s.key === "a")!;
    const { met, missing } = evaluateExitCriteria(stageA, []); // no executions materialized
    expect(met).toBe(false);
    expect(missing).toContain("a1");
  });

  it("resolveAdvanceTarget follows transitions then falls back to order", () => {
    const template = twoStageTemplate();
    expect(resolveAdvanceTarget(template, "a")).toBe("b");
    // No transition out of the linear-fallback path returns null at the end.
    expect(resolveAdvanceTarget(template, "b")).toBeNull();
  });

  it("completion falls back to stage coverage when no required steps exist", () => {
    const template = twoStageTemplate({
      stages: [
        { ...twoStageTemplate().stages[0], steps: [], isInitial: true },
        { ...twoStageTemplate().stages[1], steps: [], isTerminal: true },
      ],
    });
    const pct = computeCompletionPercent(template, instance({ currentStageKey: "b" }), []);
    expect(pct).toBe(50); // 1 of 2 stages passed
  });
});
