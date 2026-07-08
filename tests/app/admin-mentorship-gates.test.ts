import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import AdminMentorMatchPage from "@/app/(app)/admin/mentor-match/page";
import { ADMIN_MENTORSHIP_PAGE_TITLE } from "@/app/(app)/admin/mentorship/page";

// The /admin/mentorship/relationships/[mentorshipId] admin gate now lives
// downstream, at the unified workspace itself (resolveWorkspaceAccess) —
// this route is a pure redirect for any caller. See
// tests/app/admin-mentorship-relationship-detail-page.test.tsx.

// In production Next's redirect() throws to halt the request. Our test
// setup mocks it as vi.fn() which silently returns, so non-admin paths
// would continue executing and crash on later code. Make redirect()
// throw a sentinel so tests can assert the gate fires before any real
// work is done.
class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

function makeRedirectThrow() {
  vi.mocked(redirect).mockImplementation((to: string) => {
    throw new RedirectError(to);
  });
}

describe("/admin/mentorship heading", () => {
  it("exposes a stable title for nightly smoke tests to assert", () => {
    expect(ADMIN_MENTORSHIP_PAGE_TITLE).toBe(
      "Mentorship Admin"
    );
  });
});

describe("/admin/mentor-match admin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeRedirectThrow();
  });

  it("redirects to / for non-admin sessions", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u-1", roles: ["INSTRUCTOR"] },
    } as any);

    await expect(AdminMentorMatchPage()).rejects.toThrow("redirect:/");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/");
    expect(vi.mocked(redirect)).not.toHaveBeenCalledWith(
      "/mentorship?view=admin&tab=assignments"
    );
  });

  it("redirects unauthenticated callers to /", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);

    await expect(AdminMentorMatchPage()).rejects.toThrow("redirect:/");
  });

  it("redirects admins to the matching focus on the command center", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);

    await expect(AdminMentorMatchPage()).rejects.toThrow(
      "redirect:/mentorship?view=admin&tab=assignments"
    );
  });
});

