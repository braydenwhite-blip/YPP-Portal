import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import LegacyMyMentorRedirect from "@/app/(app)/my-mentor/page";
import LegacyDevelopRedirect from "@/app/(app)/people/develop/page";
import LegacyDevelopRecordRedirect from "@/app/(app)/people/develop/[id]/page";
import LegacyPeopleMentorshipRedirect from "@/app/(app)/people/mentorship/page";

class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

describe("mentorship hub consolidation redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((to: string) => {
      throw new RedirectError(to);
    });
  });

  it("sends /my-mentor to the hub's mentee POV", async () => {
    await expect(LegacyMyMentorRedirect({})).rejects.toThrow(
      "redirect:/mentorship?view=me"
    );
  });

  it("sends /people/develop to the hub's command center, carrying filters", async () => {
    await expect(LegacyDevelopRedirect({})).rejects.toThrow(
      "redirect:/mentorship?view=admin"
    );
    await expect(
      LegacyDevelopRedirect({
        searchParams: Promise.resolve({ who: "officers", lane: "review-due" }),
      })
    ).rejects.toThrow("redirect:/mentorship?view=admin&who=officers&lane=review-due");
  });

  it("sends /people/develop/[id] straight to the canonical person page", async () => {
    await expect(
      LegacyDevelopRecordRedirect({ params: { id: "user-9" } })
    ).rejects.toThrow("redirect:/people/user-9");
  });

  it("sends /people/mentorship to the hub's command center", async () => {
    await expect(LegacyPeopleMentorshipRedirect({})).rejects.toThrow(
      "redirect:/mentorship?view=admin"
    );
  });
});
