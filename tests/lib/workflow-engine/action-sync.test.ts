import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, completeStep, blockStep, reassignStep } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  completeStep: vi.fn(),
  blockStep: vi.fn(),
  reassignStep: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflowStepExecution: { findFirst },
  },
}));

vi.mock("@/lib/workflow-engine/engine", () => ({
  completeStep,
  blockStep,
  reassignStep,
}));

import {
  onActionItemCompleted,
  onActionItemBlocked,
  onActionItemReassigned,
} from "@/lib/workflow-engine/action-sync";

const ACTION_ITEM_ID = "action-1";

function execution(over: Partial<{ id: string; state: string }> = {}) {
  return { id: "exec-1", state: "PENDING", ...over };
}

describe("onActionItemCompleted", () => {
  beforeEach(() => {
    findFirst.mockReset();
    completeStep.mockReset();
  });

  it("calls completeStep exactly once with the found execution's id", async () => {
    findFirst.mockResolvedValue(execution());
    await onActionItemCompleted(ACTION_ITEM_ID, "user-1");
    expect(completeStep).toHaveBeenCalledTimes(1);
    expect(completeStep).toHaveBeenCalledWith("exec-1", { actorId: "user-1", now: undefined });
  });

  it("does nothing when no execution is linked", async () => {
    findFirst.mockResolvedValue(null);
    await onActionItemCompleted(ACTION_ITEM_ID, "user-1");
    expect(completeStep).not.toHaveBeenCalled();
  });

  it("does nothing when the linked execution is already COMPLETE", async () => {
    findFirst.mockResolvedValue(execution({ state: "COMPLETE" }));
    await onActionItemCompleted(ACTION_ITEM_ID, "user-1");
    expect(completeStep).not.toHaveBeenCalled();
  });

  it("does nothing when the linked execution is already SKIPPED", async () => {
    findFirst.mockResolvedValue(execution({ state: "SKIPPED" }));
    await onActionItemCompleted(ACTION_ITEM_ID, "user-1");
    expect(completeStep).not.toHaveBeenCalled();
  });

  it("swallows a thrown error inside completeStep (best-effort)", async () => {
    findFirst.mockResolvedValue(execution());
    completeStep.mockRejectedValue(new Error("boom"));
    await expect(onActionItemCompleted(ACTION_ITEM_ID, "user-1")).resolves.toBeUndefined();
  });
});

describe("onActionItemBlocked", () => {
  beforeEach(() => {
    findFirst.mockReset();
    blockStep.mockReset();
  });

  it("calls blockStep exactly once with the found execution's id and reason", async () => {
    findFirst.mockResolvedValue(execution());
    await onActionItemBlocked(ACTION_ITEM_ID, "waiting on partner", "user-1");
    expect(blockStep).toHaveBeenCalledTimes(1);
    expect(blockStep).toHaveBeenCalledWith("exec-1", "waiting on partner", {
      actorId: "user-1",
      now: undefined,
    });
  });

  it("does nothing when no execution is linked", async () => {
    findFirst.mockResolvedValue(null);
    await onActionItemBlocked(ACTION_ITEM_ID, "reason", "user-1");
    expect(blockStep).not.toHaveBeenCalled();
  });

  it("does nothing when the linked execution is already COMPLETE/SKIPPED", async () => {
    findFirst.mockResolvedValue(execution({ state: "COMPLETE" }));
    await onActionItemBlocked(ACTION_ITEM_ID, "reason", "user-1");
    expect(blockStep).not.toHaveBeenCalled();

    findFirst.mockResolvedValue(execution({ state: "SKIPPED" }));
    await onActionItemBlocked(ACTION_ITEM_ID, "reason", "user-1");
    expect(blockStep).not.toHaveBeenCalled();
  });

  it("swallows a thrown error inside blockStep (best-effort)", async () => {
    findFirst.mockResolvedValue(execution());
    blockStep.mockRejectedValue(new Error("boom"));
    await expect(
      onActionItemBlocked(ACTION_ITEM_ID, "reason", "user-1")
    ).resolves.toBeUndefined();
  });
});

describe("onActionItemReassigned", () => {
  beforeEach(() => {
    findFirst.mockReset();
    reassignStep.mockReset();
  });

  it("calls reassignStep exactly once with the found execution's id and new owner", async () => {
    findFirst.mockResolvedValue(execution());
    await onActionItemReassigned(ACTION_ITEM_ID, "user-2");
    expect(reassignStep).toHaveBeenCalledTimes(1);
    expect(reassignStep).toHaveBeenCalledWith("exec-1", "user-2");
  });

  it("does nothing when no execution is linked", async () => {
    findFirst.mockResolvedValue(null);
    await onActionItemReassigned(ACTION_ITEM_ID, "user-2");
    expect(reassignStep).not.toHaveBeenCalled();
  });

  it("still reassigns even when the linked execution is COMPLETE/SKIPPED (no terminal guard)", async () => {
    findFirst.mockResolvedValue(execution({ state: "COMPLETE" }));
    await onActionItemReassigned(ACTION_ITEM_ID, "user-2");
    expect(reassignStep).toHaveBeenCalledTimes(1);
  });

  it("swallows a thrown error inside reassignStep (best-effort)", async () => {
    findFirst.mockResolvedValue(execution());
    reassignStep.mockRejectedValue(new Error("boom"));
    await expect(
      onActionItemReassigned(ACTION_ITEM_ID, "user-2")
    ).resolves.toBeUndefined();
  });
});
