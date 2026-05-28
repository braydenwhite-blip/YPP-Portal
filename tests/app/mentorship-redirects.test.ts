import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect, permanentRedirect } from "next/navigation";

import LegacyMentorshipProgramPage from "@/app/(app)/mentorship-program/page";
import LegacyMentorshipReviewsPage from "@/app/(app)/mentorship-program/reviews/page";
import LegacyMentorshipSchedulePage from "@/app/(app)/mentorship-program/schedule/page";
import LegacyMentorshipAwardsPage from "@/app/(app)/mentorship-program/awards/page";
import LegacyMentorshipChairPage from "@/app/(app)/mentorship-program/chair/page";
import LegacyQuarterlyReviewPage from "@/app/(app)/mentorship-program/quarterly/[reviewId]/page";
import LegacyPrepPacketPage from "@/app/(app)/mentorship-program/chair/prep-packet/page";
import LegacyAskMentorPage from "@/app/(app)/mentor/ask/page";
import LegacyMentorResourcesPage from "@/app/(app)/mentor/resources/page";
import LegacyMentorFeedbackPage from "@/app/(app)/mentor/feedback/page";

class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

function makeRedirectsThrow() {
  vi.mocked(redirect).mockImplementation((to: string) => {
    throw new RedirectError(to);
  });
  vi.mocked(permanentRedirect).mockImplementation((to: string) => {
    throw new RedirectError(to);
  });
}

describe("mentorship legacy route redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeRedirectsThrow();
  });

  it("redirects legacy mentor program roots to canonical mentor workspace routes", async () => {
    await expect(async () => LegacyMentorshipProgramPage()).rejects.toThrow("redirect:/mentorship");
    await expect(async () => LegacyMentorshipReviewsPage()).rejects.toThrow("redirect:/mentorship/reviews");
    await expect(async () => LegacyMentorshipSchedulePage()).rejects.toThrow("redirect:/mentorship/schedule");
    await expect(async () => LegacyMentorshipAwardsPage()).rejects.toThrow("redirect:/mentorship/awards");
    await expect(async () => LegacyMentorshipChairPage()).rejects.toThrow("redirect:/mentorship/chair");
  });

  it("preserves quarterly and prep packet intent", async () => {
    await expect(
      LegacyQuarterlyReviewPage({ params: Promise.resolve({ reviewId: "rev-1" }) })
    ).rejects.toThrow("redirect:/mentorship/quarterly/rev-1");

    await expect(
      LegacyPrepPacketPage({
        searchParams: Promise.resolve({ mentorshipId: "ms-1" }),
      })
    ).rejects.toThrow("redirect:/mentorship/chair/prep-packet?mentorshipId=ms-1");
  });

  it("redirects legacy mentor utility pages under /mentorship", () => {
    expect(() => LegacyAskMentorPage()).toThrow("redirect:/mentorship/ask");
    expect(() => LegacyMentorResourcesPage()).toThrow("redirect:/mentorship/resources");
    expect(() => LegacyMentorFeedbackPage()).toThrow("redirect:/mentorship/feedback");
  });
});
