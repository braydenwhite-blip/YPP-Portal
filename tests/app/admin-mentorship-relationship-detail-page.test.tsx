import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

// The relationship-management controls (reassign mentor, status,
// mentorship-workflow card) now live in the unified workspace's
// leadership-only "Manage relationship" disclosure — see
// components/mentorship/workspace/manage-relationship.tsx and its coverage.
// This admin-only route is a pure redirect into that workspace.

class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mentorship: {
      findUnique: vi.fn(async () => ({ menteeId: "mentee-1" })),
    },
  },
}));

import AdminMentorshipRelationshipDetailPage from "@/app/(app)/admin/mentorship/relationships/[mentorshipId]/page";

describe("AdminMentorshipRelationshipDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((to: string) => {
      throw new RedirectError(to);
    });
  });

  it("redirects into the unified workspace for the mentorship's mentee", async () => {
    await expect(
      AdminMentorshipRelationshipDetailPage({
        params: Promise.resolve({ mentorshipId: "ms-1" }),
      })
    ).rejects.toThrow("redirect:/people/mentee-1");
  });
});
