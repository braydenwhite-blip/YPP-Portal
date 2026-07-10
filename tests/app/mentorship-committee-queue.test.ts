import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import RoleCommitteeQueuePage from "@/app/(app)/mentorship/committee/page";
import {
  scopeQuarterlyQueueForViewer,
  type QuarterlyQueueEntry,
} from "@/lib/mentorship/quarterly-review";

class RedirectError extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

function entry(overrides: Partial<QuarterlyQueueEntry>): QuarterlyQueueEntry {
  return {
    mentorshipId: "m-1",
    menteeId: "mentee-1",
    menteeName: "Mentee One",
    menteeRole: "INSTRUCTOR",
    mentorId: "mentor-1",
    mentorName: "Mentor One",
    quarter: "Q3 2026",
    status: null,
    ...overrides,
  };
}

describe("/mentorship/committee — folded into the Mentorship home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((to: string) => {
      throw new RedirectError(to);
    });
  });

  it("redirects to the Mentorship home, where the quarterly queue now renders", () => {
    expect(() => RoleCommitteeQueuePage()).toThrow("redirect:/mentorship?view=mentor");
  });
});

describe("scopeQuarterlyQueueForViewer — the queue's visibility rules", () => {
  const queue: QuarterlyQueueEntry[] = [
    entry({ mentorshipId: "m-1", menteeId: "a", menteeRole: "INSTRUCTOR", mentorId: "mentor-1" }),
    entry({
      mentorshipId: "m-2",
      menteeId: "b",
      menteeRole: "CHAPTER_PRESIDENT",
      mentorId: "mentor-2",
    }),
    entry({ mentorshipId: "m-3", menteeId: "c", menteeRole: "STAFF", mentorId: "mentor-3" }),
  ];

  it("shows admins/leadership everything", () => {
    const visible = scopeQuarterlyQueueForViewer(queue, {
      viewerId: "anyone",
      isAdminOrLeadership: true,
      chairedLanes: [],
    });
    expect(visible).toHaveLength(3);
  });

  it("shows a lane chair their lane's mentees", () => {
    const visible = scopeQuarterlyQueueForViewer(queue, {
      viewerId: "chair-1",
      isAdminOrLeadership: false,
      chairedLanes: ["INSTRUCTOR"],
    });
    expect(visible.map((e) => e.mentorshipId)).toEqual(["m-1"]);
  });

  it("shows a mentor their own mentees regardless of chair status", () => {
    const visible = scopeQuarterlyQueueForViewer(queue, {
      viewerId: "mentor-2",
      isAdminOrLeadership: false,
      chairedLanes: [],
    });
    expect(visible.map((e) => e.mentorshipId)).toEqual(["m-2"]);
  });

  it("unions lane-chair and own-mentee visibility", () => {
    const visible = scopeQuarterlyQueueForViewer(queue, {
      viewerId: "mentor-2",
      isAdminOrLeadership: false,
      chairedLanes: ["INSTRUCTOR"],
    });
    expect(visible.map((e) => e.mentorshipId)).toEqual(["m-1", "m-2"]);
  });

  it("hides everything from a viewer with no standing (incl. unmappable lanes)", () => {
    const visible = scopeQuarterlyQueueForViewer(queue, {
      viewerId: "stranger",
      isAdminOrLeadership: false,
      chairedLanes: [],
    });
    expect(visible).toHaveLength(0);
  });
});
