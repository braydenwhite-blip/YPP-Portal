import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { notFound, redirect } from "next/navigation";

vi.mock("@/lib/mentorship-2/recommendations/queries", () => ({
  getApplicationsQueue: vi.fn(async () => []),
}));

import MentorshipApplicationsPage from "@/app/(app)/admin/mentorship/applications/page";
import { getApplicationsQueue } from "@/lib/mentorship-2/recommendations/queries";

// notFound()/redirect() are vi.fn() in the global setup (they silently return),
// so make them throw a sentinel to assert the gate fires before any real work.
class HaltError extends Error {}

function makeGatesThrow() {
  vi.mocked(notFound).mockImplementation(() => {
    throw new HaltError("notFound");
  });
  vi.mocked(redirect).mockImplementation((to: string) => {
    throw new HaltError(`redirect:${to}`);
  });
}

describe("/admin/mentorship/applications — Mentorship 2 gates", () => {
  const prevFlag = process.env.ENABLE_MENTORSHIP_2;

  beforeEach(() => {
    vi.clearAllMocks();
    makeGatesThrow();
  });

  afterEach(() => {
    process.env.ENABLE_MENTORSHIP_2 = prevFlag;
  });

  it("returns notFound when the Mentorship 2 flag is off", async () => {
    process.env.ENABLE_MENTORSHIP_2 = "false";

    await expect(MentorshipApplicationsPage()).rejects.toThrow("notFound");
    expect(getApplicationsQueue).not.toHaveBeenCalled();
  });

  it("redirects a non-officer caller even when the flag is on", async () => {
    process.env.ENABLE_MENTORSHIP_2 = "true";
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u-1", roles: ["STUDENT"] },
    } as any);

    await expect(MentorshipApplicationsPage()).rejects.toThrow("redirect:/");
    expect(getApplicationsQueue).not.toHaveBeenCalled();
  });

  it("loads the queue for an officer when the flag is on", async () => {
    process.env.ENABLE_MENTORSHIP_2 = "true";
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);

    await MentorshipApplicationsPage();

    expect(getApplicationsQueue).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });
});
