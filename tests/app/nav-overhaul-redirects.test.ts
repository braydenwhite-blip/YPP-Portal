import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import LegacyWorkRedirect from "@/app/(app)/work/page";
import LegacyWorkQueueRedirect from "@/app/(app)/work/queue/page";
import LegacyCommandCenterRedirect from "@/app/(app)/command-center/page";

class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

function makeRedirectsThrow() {
  vi.mocked(redirect).mockImplementation((to: string) => {
    throw new RedirectError(to);
  });
}

describe("retired Work hub & Command Center redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeRedirectsThrow();
  });

  it("redirects the old Work hub to Home", async () => {
    await expect(
      LegacyWorkRedirect({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("redirect:/");
  });

  it("redirects the old Command Center to Home", async () => {
    await expect(
      LegacyCommandCenterRedirect({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("redirect:/");
  });

  it("redirects the old Work queue runner to my Actions", async () => {
    await expect(
      LegacyWorkQueueRedirect({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("redirect:/actions?who=me");
  });

  it("preserves extra query params when redirecting the Work hub", async () => {
    await expect(
      LegacyWorkRedirect({ searchParams: Promise.resolve({ ref: "email" }) })
    ).rejects.toThrow("redirect:/?ref=email");
  });
});
