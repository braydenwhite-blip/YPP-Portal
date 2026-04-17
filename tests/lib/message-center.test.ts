import { ConversationContextType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildMessageCenterBackHref,
  matchesMessageCenterTab,
  normalizeConversationContextType,
  normalizeMessageCenterTab,
} from "@/lib/message-center";

describe("message-center helpers", () => {
  it("normalizes tabs and conversation contexts", () => {
    expect(normalizeMessageCenterTab(undefined)).toBe("all");
    expect(normalizeMessageCenterTab("parent")).toBe("parent");
    expect(normalizeConversationContextType(null, false)).toBe(ConversationContextType.DIRECT);
    expect(normalizeConversationContextType(ConversationContextType.INTERVIEW, false)).toBe(
      ConversationContextType.INTERVIEW
    );
  });

  it("matches tabs correctly", () => {
    expect(matchesMessageCenterTab(ConversationContextType.PARENT, "parent")).toBe(true);
    expect(matchesMessageCenterTab(ConversationContextType.PARENT, "direct")).toBe(false);
    expect(matchesMessageCenterTab(ConversationContextType.DIRECT, "direct")).toBe(true);
    expect(matchesMessageCenterTab(ConversationContextType.INTERVIEW, "direct")).toBe(true);
  });

  it("builds back links that preserve the right inbox tab", () => {
    expect(buildMessageCenterBackHref(ConversationContextType.PARENT)).toBe("/messages?tab=parent");
    expect(buildMessageCenterBackHref(ConversationContextType.DIRECT)).toBe("/messages");
    expect(buildMessageCenterBackHref(ConversationContextType.DIRECT, "direct")).toBe(
      "/messages?tab=direct"
    );
  });
});
