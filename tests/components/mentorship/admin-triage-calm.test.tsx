import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AdminMentorshipTriage,
  deriveTriageFocus,
  toTriageItems,
} from "@/app/(app)/admin/mentorship/_components/admin-triage-calm";
import type {
  AdminActionItem,
  InstructorMentorshipOpsSummary,
} from "@/lib/instructor-mentorship-ops";

function summary(
  overrides: Partial<InstructorMentorshipOpsSummary> = {}
): InstructorMentorshipOpsSummary {
  return {
    activeRelationships: 0,
    unassignedInstructors: 0,
    mentorsAtOrOverCapacity: 0,
    mentorsOverCapacity: 0,
    overdueCheckIns: 0,
    stalledGoals: 0,
    pendingReviews: 0,
    relationshipsWithoutGoals: 0,
    recentlyActive: 0,
    ...overrides,
  };
}

function actionItem(overrides: Partial<AdminActionItem> = {}): AdminActionItem {
  return {
    id: "a1",
    kind: "UNASSIGNED_INSTRUCTOR",
    title: "Someone needs a mentor",
    detail: "INSTRUCTOR · Atlanta",
    emphasis: "Assign mentor",
    href: "/mentorship?view=admin&tab=assignments",
    priority: 0,
    ...overrides,
  };
}

describe("deriveTriageFocus", () => {
  it("leads with unstaffed mentees above everything else", () => {
    const focus = deriveTriageFocus(
      summary({ unassignedInstructors: 3, pendingReviews: 5, overdueCheckIns: 9 })
    );
    expect(focus.title).toContain("3 mentees need a mentor");
    expect(focus.ctaHref).toBe("/mentorship?view=admin&tab=assignments");
    expect(focus.tone).toBe("brand");
  });

  it("falls to approvals when nobody is unstaffed", () => {
    const focus = deriveTriageFocus(
      summary({ pendingReviews: 1, overdueCheckIns: 4 })
    );
    expect(focus.title).toContain("1 review waiting");
    expect(focus.ctaHref).toBe("/mentorship?view=admin&tab=approvals");
  });

  it("falls to quiet relationships, then missing G&R, then stalled goals", () => {
    expect(deriveTriageFocus(summary({ overdueCheckIns: 2 })).ctaHref).toBe(
      "/mentorship?view=admin&tab=needs-attention"
    );
    expect(
      deriveTriageFocus(summary({ relationshipsWithoutGoals: 2 })).title
    ).toContain("no active G&R");
    expect(deriveTriageFocus(summary({ stalledGoals: 7 })).title).toContain(
      "7 goals are stalled"
    );
  });

  it("celebrates a healthy program when every count is zero", () => {
    const focus = deriveTriageFocus(summary());
    expect(focus.eyebrow).toBe("All clear");
    expect(focus.tone).toBe("success");
    expect(focus.ctaHref).toBe("/mentorship?view=admin&tab=overview");
  });
});

describe("toTriageItems", () => {
  it("sorts by priority and caps the list", () => {
    const items = toTriageItems(
      [
        actionItem({ id: "low", priority: 5 }),
        actionItem({ id: "high", priority: 0 }),
        actionItem({ id: "mid", priority: 2 }),
      ],
      2
    );
    expect(items.map((i) => i.id)).toEqual(["high", "mid"]);
  });

  it("maps each kind to plain-language badge + tone", () => {
    const [review] = toTriageItems([
      actionItem({ id: "r", kind: "PENDING_REVIEW" }),
    ]);
    expect(review.badge).toBe("Approval");
    expect(review.tone).toBe("info");
  });
});

describe("AdminMentorshipTriage", () => {
  it("renders the focus CTA and a short list of flagged items", () => {
    render(
      <AdminMentorshipTriage
        focus={deriveTriageFocus(summary({ unassignedInstructors: 2 }))}
        items={toTriageItems([
          actionItem({ id: "x", title: "Dana needs a mentor" }),
        ])}
        openCount={1}
      />
    );

    expect(
      screen.getByRole("link", { name: /Open assignments/ })
    ).toHaveAttribute("href", "/mentorship?view=admin&tab=assignments");
    expect(screen.getByText("Dana needs a mentor")).toBeInTheDocument();
    expect(screen.getByText("Needs attention (1)")).toBeInTheDocument();
  });

  it("shows a supportive empty state when nothing is flagged", () => {
    render(
      <AdminMentorshipTriage
        focus={deriveTriageFocus(summary())}
        items={[]}
        openCount={0}
      />
    );
    expect(screen.getByText(/the queues are clear/i)).toBeInTheDocument();
  });
});
