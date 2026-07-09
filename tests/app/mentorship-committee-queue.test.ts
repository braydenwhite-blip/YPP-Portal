import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";

vi.mock("@/lib/mentorship/command-access", () => ({
  hasMentorshipCommandAccess: vi.fn(),
}));
vi.mock("@/lib/mentorship-chair-access", () => ({
  getLanesForChair: vi.fn(),
}));
vi.mock("@/lib/mentorship/quarterly-review", () => ({
  loadQuarterlyCommitteeQueue: vi.fn().mockResolvedValue([]),
}));

import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";
import { getLanesForChair } from "@/lib/mentorship-chair-access";
import { loadQuarterlyCommitteeQueue } from "@/lib/mentorship/quarterly-review";
import RoleCommitteeQueuePage from "@/app/(app)/mentorship/committee/page";

class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

describe("/mentorship/committee — Role Committee queue access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((to: string) => {
      throw new RedirectError(to);
    });
    vi.mocked(loadQuarterlyCommitteeQueue).mockResolvedValue([]);
  });

  it("sends a signed-out visitor to login", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    await expect(RoleCommitteeQueuePage()).rejects.toThrow("redirect:/login");
  });

  it("turns away a signed-in user with no committee/mentor standing", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "student-1", roles: ["STUDENT"], adminSubtypes: [] },
    } as any);
    vi.mocked(hasMentorshipCommandAccess).mockResolvedValue(false);
    vi.mocked(getLanesForChair).mockResolvedValue([]);

    await expect(RoleCommitteeQueuePage()).rejects.toThrow("redirect:/mentorship");
  });

  it("admits a lane chair even without the MENTOR/CHAPTER_PRESIDENT role", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "chair-1", roles: ["STAFF"], adminSubtypes: [] },
    } as any);
    vi.mocked(hasMentorshipCommandAccess).mockResolvedValue(false);
    vi.mocked(getLanesForChair).mockResolvedValue(["INSTRUCTOR"] as any);

    // Should render (not redirect) — no RedirectError thrown.
    const result = await RoleCommitteeQueuePage();
    expect(result).toBeTruthy();
  });

  it("admits leadership regardless of chair assignments", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "lead-1", roles: ["STAFF"], adminSubtypes: ["LEADERSHIP"] },
    } as any);
    vi.mocked(hasMentorshipCommandAccess).mockResolvedValue(true);
    vi.mocked(getLanesForChair).mockResolvedValue([]);

    const result = await RoleCommitteeQueuePage();
    expect(result).toBeTruthy();
  });
});
