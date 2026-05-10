import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import AdminMentorMatchPage from "@/app/(app)/admin/mentor-match/page";
import AdminMentorshipRelationshipDetailPage from "@/app/(app)/admin/mentorship/relationships/[mentorshipId]/page";
import { ADMIN_MENTORSHIP_PAGE_TITLE } from "@/app/(app)/admin/mentorship/page";
import { prisma } from "@/lib/prisma";

function installRelationshipDetailStubs() {
  (prisma as any).mentorship = {
    findUnique: vi.fn(),
  };
  (prisma as any).user = (prisma as any).user ?? {};
  (prisma as any).user.findMany = vi.fn().mockResolvedValue([]);
}

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
      "Instructor Mentorship Oversight"
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
      "/admin/mentorship-program?focus=matching"
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
      "redirect:/admin/mentorship-program?focus=matching"
    );
  });
});

describe("/admin/mentorship/relationships/[mentorshipId] admin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installRelationshipDetailStubs();
    makeRedirectThrow();
  });

  it("redirects non-admin sessions before fetching the relationship", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u-1", roles: ["INSTRUCTOR"] },
    } as any);

    await expect(
      AdminMentorshipRelationshipDetailPage({
        params: { mentorshipId: "ms-1" },
      })
    ).rejects.toThrow("redirect:/");

    expect((prisma as any).mentorship.findUnique).not.toHaveBeenCalled();
  });

  it("redirects mentor-only callers", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "m-1", roles: ["MENTOR"] },
    } as any);

    await expect(
      AdminMentorshipRelationshipDetailPage({
        params: { mentorshipId: "ms-1" },
      })
    ).rejects.toThrow("redirect:/");

    expect((prisma as any).mentorship.findUnique).not.toHaveBeenCalled();
  });

  it("loads the relationship when the caller is an admin", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);

    (prisma as any).mentorship.findUnique.mockResolvedValue({
      id: "ms-1",
      mentorId: "mentor-1",
      menteeId: "mentee-1",
      status: "ACTIVE",
      mentor: {
        id: "mentor-1",
        name: "Mentor One",
        email: "m@example.com",
        primaryRole: "INSTRUCTOR",
      },
      mentee: {
        id: "mentee-1",
        name: "Mentee One",
        email: "n@example.com",
        primaryRole: "INSTRUCTOR",
        chapter: null,
      },
      track: null,
      chair: null,
      sessions: [],
      checkIns: [],
      goalReviews: [],
      grDocuments: [],
      circleMembers: [],
    });

    await AdminMentorshipRelationshipDetailPage({
      params: { mentorshipId: "ms-1" },
    });

    expect((prisma as any).mentorship.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ms-1" } })
    );
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });
});
