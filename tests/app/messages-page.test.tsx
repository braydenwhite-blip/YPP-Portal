import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessagesPage from "@/app/(app)/messages/page";
import { getSession } from "@/lib/auth-supabase";
import { getConversations } from "@/lib/messaging-actions";

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/messaging-actions", () => ({
  getConversations: vi.fn(),
  getMessageableUsers: vi.fn(),
  startConversation: vi.fn(),
}));

describe("MessagesPage", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "viewer",
        roles: ["PARENT"],
        primaryRole: "PARENT",
      },
    } as Awaited<ReturnType<typeof getSession>>);

    vi.mocked(getConversations).mockResolvedValue([
      {
        id: "direct-1",
        subject: "Direct Thread",
        contextType: "DIRECT",
        updatedAt: new Date("2026-04-05T10:00:00.000Z"),
        participants: [{ id: "other-1", name: "Jordan" }],
        lastMessage: {
          content: "Direct hello",
          senderName: "Jordan",
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
        },
        unreadCount: 1,
      },
      {
        id: "parent-1",
        subject: "Maya — Parent Updates",
        contextType: "PARENT",
        updatedAt: new Date("2026-04-05T11:00:00.000Z"),
        participants: [{ id: "other-2", name: "Instructor Lee" }],
        lastMessage: {
          content: "Parent update",
          senderName: "Instructor Lee",
          createdAt: new Date("2026-04-05T11:00:00.000Z"),
        },
        unreadCount: 0,
      },
    ] as Awaited<ReturnType<typeof getConversations>>);
  });

  it("shows only parent threads on the parent tab", async () => {
    render(await MessagesPage({ searchParams: Promise.resolve({ tab: "parent" }) }));

    expect(screen.getByText("Maya — Parent Updates")).toBeInTheDocument();
    expect(screen.queryByText("Direct Thread")).not.toBeInTheDocument();
  });

  it("shows non-parent threads on the direct tab", async () => {
    render(await MessagesPage({ searchParams: Promise.resolve({ tab: "direct" }) }));

    expect(screen.getByText("Direct Thread")).toBeInTheDocument();
    expect(screen.queryByText("Maya — Parent Updates")).not.toBeInTheDocument();
  });
});
