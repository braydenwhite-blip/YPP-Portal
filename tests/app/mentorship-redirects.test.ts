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
import LegacyMyProgramGRPage from "@/app/(app)/my-program/gr/page";
import LegacyMyProgramReflectPage from "@/app/(app)/my-program/reflect/page";
import LegacyMyProgramSchedulePage from "@/app/(app)/my-program/schedule/page";
import LegacyMyProgramAwardsPage from "@/app/(app)/my-program/awards/page";
import LegacyGRTemplatesPage from "@/app/(app)/admin/mentorship-program/gr-templates/page";
import LegacyGRTemplateDetailPage from "@/app/(app)/admin/mentorship-program/gr-templates/[id]/page";
import LegacyGRAssignmentsPage from "@/app/(app)/admin/mentorship-program/gr-assignments/page";
import LegacyGRResourcesPage from "@/app/(app)/admin/mentorship-program/gr-resources/page";

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
    // /mentorship/dashboard was deleted outright — the hub at /mentorship is
    // the only front door now, so there is no redirect page left to test.
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

  it("redirects legacy /my-program mentee flows into the canonical /my-mentor home", () => {
    expect(() => LegacyMyProgramGRPage()).toThrow("redirect:/my-mentor/goals");
    expect(() => LegacyMyProgramReflectPage()).toThrow("redirect:/my-mentor/reflection");
    expect(() => LegacyMyProgramSchedulePage()).toThrow("redirect:/my-mentor/schedule");
    expect(() => LegacyMyProgramAwardsPage()).toThrow("redirect:/my-mentor/awards");
  });

  it("redirects legacy admin G&R routes to the canonical /admin/mentorship/gr area", async () => {
    expect(() => LegacyGRTemplatesPage()).toThrow(
      "redirect:/admin/mentorship/gr/templates"
    );
    expect(() => LegacyGRAssignmentsPage()).toThrow(
      "redirect:/admin/mentorship/gr/assignments"
    );
    expect(() => LegacyGRResourcesPage()).toThrow(
      "redirect:/admin/mentorship/gr/resources"
    );
    await expect(
      LegacyGRTemplateDetailPage({ params: Promise.resolve({ id: "tpl-1" }) })
    ).rejects.toThrow("redirect:/admin/mentorship/gr/templates/tpl-1");
  });
});
