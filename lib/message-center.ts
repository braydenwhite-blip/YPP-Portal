import { ConversationContextType } from "@prisma/client";

export type MessageCenterTab = "all" | "direct" | "parent";

export function normalizeMessageCenterTab(value: string | null | undefined): MessageCenterTab {
  if (value === "direct" || value === "parent") {
    return value;
  }

  return "all";
}

export function normalizeConversationContextType(
  contextType: ConversationContextType | null | undefined,
  isGroup: boolean
): ConversationContextType | null {
  if (isGroup) return null;
  return contextType ?? ConversationContextType.DIRECT;
}

export function isParentConversation(
  contextType: ConversationContextType | null | undefined
): boolean {
  return contextType === ConversationContextType.PARENT;
}

export function matchesMessageCenterTab(
  contextType: ConversationContextType | null | undefined,
  tab: MessageCenterTab
): boolean {
  if (tab === "all") return true;
  if (tab === "parent") return isParentConversation(contextType);
  return !isParentConversation(contextType);
}

export function buildMessageCenterBackHref(
  contextType: ConversationContextType | null | undefined,
  requestedTab?: string | null
): string {
  const tab = normalizeMessageCenterTab(requestedTab);

  if (tab !== "all") {
    return `/messages?tab=${tab}`;
  }

  if (isParentConversation(contextType)) {
    return "/messages?tab=parent";
  }

  return "/messages";
}
