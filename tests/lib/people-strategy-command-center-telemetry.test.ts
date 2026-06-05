import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn().mockResolvedValue({ id: "evt" });
vi.mock("@/lib/prisma", () => ({
  prisma: { analyticsEvent: { create: (a: unknown) => create(a) } },
}));

const getSession = vi.fn();
vi.mock("@/lib/auth-supabase", () => ({
  getSession: () => getSession(),
}));

import { recordCommandCenterEvent } from "@/lib/people-strategy/command-center-telemetry";
import { COMMAND_CENTER_EVENTS } from "@/lib/people-strategy/command-center-events";

beforeEach(() => {
  create.mockClear();
  create.mockResolvedValue({ id: "evt" });
  getSession.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("recordCommandCenterEvent", () => {
  it("writes one AnalyticsEvent for the signed-in viewer", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    await recordCommandCenterEvent(COMMAND_CENTER_EVENTS.briefingCopied);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      data: {
        userId: "u1",
        eventType: "command_center_briefing_copied",
        eventData: undefined,
      },
    });
  });

  it("forwards structured event data", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    await recordCommandCenterEvent(COMMAND_CENTER_EVENTS.attentionItemOpened, {
      actionItemId: "a1",
      reason: "Overdue 4 days",
    });

    expect(create.mock.calls[0][0].data.eventData).toEqual({
      actionItemId: "a1",
      reason: "Overdue 4 days",
    });
  });

  it("is a no-op when there is no session", async () => {
    getSession.mockResolvedValue(null);
    await recordCommandCenterEvent(COMMAND_CENTER_EVENTS.briefingCopied);
    expect(create).not.toHaveBeenCalled();
  });

  it("swallows write failures so telemetry never breaks the interaction", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    create.mockRejectedValueOnce(new Error("db down"));

    await expect(
      recordCommandCenterEvent(COMMAND_CENTER_EVENTS.briefingCopied)
    ).resolves.toBeUndefined();
  });

  it("uses stable, namespaced event names", () => {
    expect(COMMAND_CENTER_EVENTS.briefingCopied).toBe("command_center_briefing_copied");
    expect(COMMAND_CENTER_EVENTS.attentionItemOpened).toBe(
      "command_center_attention_item_opened"
    );
  });
});
