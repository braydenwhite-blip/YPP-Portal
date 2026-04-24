import { describe, it, expect } from "vitest";
import { computeModuleUnlockState } from "@/lib/training-journey/progress";
import type {
  ModuleForUnlock,
  AssignmentForUnlock,
} from "@/lib/training-journey/progress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(
  id: string,
  sortOrder: number,
  required: boolean,
  contentKey: string | null = null
): ModuleForUnlock {
  return { id, contentKey, sortOrder, required };
}

function makeAssignment(
  moduleId: string,
  status: AssignmentForUnlock["status"]
): AssignmentForUnlock {
  return { moduleId, status };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeModuleUnlockState", () => {
  it("single required module with no assignment is UNLOCKED (first is always unlocked)", () => {
    const modules = [makeModule("m1", 1, true)];
    const result = computeModuleUnlockState(modules, []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ moduleId: "m1", status: "UNLOCKED" });
  });

  it("second required module is UNLOCKED when the first is COMPLETE", () => {
    const modules = [makeModule("m1", 1, true), makeModule("m2", 2, true)];
    const assignments = [makeAssignment("m1", "COMPLETE")];
    const result = computeModuleUnlockState(modules, assignments);
    const m2 = result.find((r) => r.moduleId === "m2")!;
    expect(m2.status).toBe("UNLOCKED");
  });

  it("second required module is LOCKED when the first is IN_PROGRESS", () => {
    const modules = [makeModule("m1", 1, true), makeModule("m2", 2, true)];
    const assignments = [makeAssignment("m1", "IN_PROGRESS")];
    const result = computeModuleUnlockState(modules, assignments);
    const m2 = result.find((r) => r.moduleId === "m2")!;
    expect(m2.status).toBe("LOCKED");
  });

  it("second required module is LOCKED when neither module has been started", () => {
    const modules = [makeModule("m1", 1, true), makeModule("m2", 2, true)];
    const result = computeModuleUnlockState(modules, []);
    const m1 = result.find((r) => r.moduleId === "m1")!;
    const m2 = result.find((r) => r.moduleId === "m2")!;
    expect(m1.status).toBe("UNLOCKED");
    expect(m2.status).toBe("LOCKED");
  });

  it("a required module with an IN_PROGRESS assignment gets status IN_PROGRESS (still accessible)", () => {
    const modules = [makeModule("m1", 1, true)];
    const assignments = [makeAssignment("m1", "IN_PROGRESS")];
    const result = computeModuleUnlockState(modules, assignments);
    expect(result[0]!.status).toBe("IN_PROGRESS");
  });

  it("a required module with a COMPLETE assignment gets status COMPLETE", () => {
    const modules = [makeModule("m1", 1, true)];
    const assignments = [makeAssignment("m1", "COMPLETE")];
    const result = computeModuleUnlockState(modules, assignments);
    expect(result[0]!.status).toBe("COMPLETE");
  });

  it("non-required modules are always UNLOCKED regardless of prior state", () => {
    const modules = [
      makeModule("m1", 1, true),
      makeModule("opt", 2, false), // non-required
      makeModule("m2", 3, true),
    ];
    // m1 not started → m2 would be LOCKED, but opt is non-required so UNLOCKED
    const result = computeModuleUnlockState(modules, []);
    const opt = result.find((r) => r.moduleId === "opt")!;
    expect(opt.status).toBe("UNLOCKED");
    // m2 is still LOCKED because m1 is not complete
    const m2 = result.find((r) => r.moduleId === "m2")!;
    expect(m2.status).toBe("LOCKED");
  });

  it("required modules after an INCOMPLETE required module stay LOCKED even if an earlier module is COMPLETE", () => {
    // Arrange: m1 COMPLETE, m2 IN_PROGRESS (not complete), m3 not started
    // Expected: m1 COMPLETE, m2 IN_PROGRESS (was unlocked by m1), m3 LOCKED
    const modules = [
      makeModule("m1", 1, true),
      makeModule("m2", 2, true),
      makeModule("m3", 3, true),
    ];
    const assignments = [
      makeAssignment("m1", "COMPLETE"),
      makeAssignment("m2", "IN_PROGRESS"),
    ];
    const result = computeModuleUnlockState(modules, assignments);
    const m1 = result.find((r) => r.moduleId === "m1")!;
    const m2 = result.find((r) => r.moduleId === "m2")!;
    const m3 = result.find((r) => r.moduleId === "m3")!;
    expect(m1.status).toBe("COMPLETE");
    expect(m2.status).toBe("IN_PROGRESS");
    expect(m3.status).toBe("LOCKED"); // m2 is not COMPLETE, so m3 stays locked
  });

  it("output is sorted by sortOrder ascending regardless of input order", () => {
    const modules = [
      makeModule("m3", 3, true),
      makeModule("m1", 1, true),
      makeModule("m2", 2, true),
    ];
    const result = computeModuleUnlockState(modules, []);
    expect(result.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
  });

  it("preserves contentKey and sortOrder in the output", () => {
    const modules = [makeModule("m1", 10, true, "academy_ypp_standard_001")];
    const result = computeModuleUnlockState(modules, []);
    expect(result[0]).toMatchObject({
      moduleId: "m1",
      contentKey: "academy_ypp_standard_001",
      sortOrder: 10,
    });
  });

  it("handles a mix of required and non-required modules with complete chain", () => {
    const modules = [
      makeModule("m1", 1, true),
      makeModule("opt1", 2, false),
      makeModule("m2", 3, true),
      makeModule("opt2", 4, false),
      makeModule("m3", 5, true),
    ];
    const assignments = [
      makeAssignment("m1", "COMPLETE"),
      makeAssignment("m2", "COMPLETE"),
    ];
    const result = computeModuleUnlockState(modules, assignments);
    expect(result.find((r) => r.moduleId === "m1")!.status).toBe("COMPLETE");
    expect(result.find((r) => r.moduleId === "opt1")!.status).toBe("UNLOCKED");
    expect(result.find((r) => r.moduleId === "m2")!.status).toBe("COMPLETE");
    expect(result.find((r) => r.moduleId === "opt2")!.status).toBe("UNLOCKED");
    expect(result.find((r) => r.moduleId === "m3")!.status).toBe("UNLOCKED");
  });
});
