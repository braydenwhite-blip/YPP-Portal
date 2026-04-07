import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import CommunityChatPage from "@/app/(app)/community/chat/page";
import ParentMessagesPage from "@/app/(app)/parent/messages/page";
import InstructorParentMessagesPage from "@/app/(app)/instructor/parent-messages/page";
import ParentStudentMessagesPage from "@/app/(app)/parent/[studentId]/messages/page";
import { getSession } from "@/lib/auth-supabase";
import { getOrCreateParentConversation } from "@/lib/parent-message-actions";

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/parent-message-actions", () => ({
  getOrCreateParentConversation: vi.fn(),
}));

describe("legacy message redirects", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  it("redirects the removed community chat page to the shared inbox", () => {
    CommunityChatPage();
    expect(redirect).toHaveBeenCalledWith("/messages");
  });

  it("redirects the old parent inbox page to the parent tab", () => {
    ParentMessagesPage();
    expect(redirect).toHaveBeenCalledWith("/messages?tab=parent");
  });

  it("redirects the old instructor parent inbox page to the parent tab", () => {
    InstructorParentMessagesPage();
    expect(redirect).toHaveBeenCalledWith("/messages?tab=parent");
  });

  it("redirects the old student-specific parent thread page to the shared inbox detail", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "parent-1",
        roles: ["PARENT"],
        primaryRole: "PARENT",
      },
    } as Awaited<ReturnType<typeof getSession>>);
    vi.mocked(getOrCreateParentConversation).mockResolvedValue({
      id: "conversation-123",
    } as Awaited<ReturnType<typeof getOrCreateParentConversation>>);

    await ParentStudentMessagesPage({
      params: Promise.resolve({ studentId: "student-1" }),
    });

    expect(redirect).toHaveBeenCalledWith("/messages/conversation-123?tab=parent");
  });
});
