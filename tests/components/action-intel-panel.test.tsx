import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionIntelPanel } from "@/components/people-strategy/action-intel-panel";
import type { ActionNextMove, ActionUrgency } from "@/lib/people-strategy/action-intel";
import type {
  ActionSourceDescriptor,
  ActionStrategicLinkage,
} from "@/lib/people-strategy/action-source";

const urgency: ActionUrgency = {
  level: "due_soon",
  label: "Due soon",
  daysOverdue: 0,
  daysUntilDue: 3,
};

function nextMove(over: Partial<ActionNextMove> = {}): ActionNextMove {
  return {
    kind: "advance",
    move: "Keep it moving",
    why: "It's owned and on track.",
    ifIgnored: "Stays healthy.",
    ctaLabel: "Open action",
    ...over,
  };
}

function source(over: Partial<ActionSourceDescriptor> = {}): ActionSourceDescriptor {
  return {
    type: "MEETING_DECISION",
    explicit: true,
    label: "Meeting decision",
    header: "Action from a meeting decision",
    why: "This carries out a decision that was made.",
    sourceId: "dec_1",
    meetingId: "mtg_1",
    parentActionId: null,
    ...over,
  };
}

const linkedLinkage: ActionStrategicLinkage = {
  hasExplicitLink: true,
  initiativeId: "summer-camps-2026",
  initiativeTitle: "Summer Camps 2026",
  initiativeHref: "/operations/initiatives/summer-camps-2026",
  projectId: "beth-el-pilot",
  projectTitle: "Beth El Pilot",
  projectHref: "/operations/projects/beth-el-pilot",
};

const noLinkage: ActionStrategicLinkage = {
  hasExplicitLink: false,
  initiativeId: null,
  initiativeTitle: null,
  initiativeHref: null,
  projectId: null,
  projectTitle: null,
  projectHref: null,
};

describe("ActionIntelPanel", () => {
  it("renders what-matters-now with the move + CTA + explicit strategic link", () => {
    render(
      <ActionIntelPanel
        nextMove={nextMove({ move: "Assign a real owner", ctaLabel: "Assign action", kind: "assign" })}
        labels={[{ key: "needs_owner", text: "Needs owner", tone: "danger" }]}
        source={source()}
        linkage={linkedLinkage}
        urgency={urgency}
        ctaHref="/actions/a1/edit"
        meetingHref="/meetings/mtg_1"
      />
    );
    expect(screen.getByText("What matters now")).toBeInTheDocument();
    expect(screen.getByText("Assign a real owner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assign action" })).toHaveAttribute(
      "href",
      "/actions/a1/edit"
    );
    expect(screen.getByText("Needs owner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Summer Camps 2026" })).toHaveAttribute(
      "href",
      "/operations/initiatives/summer-camps-2026"
    );
    expect(screen.getByRole("link", { name: "Back to meeting" })).toBeInTheDocument();
  });

  it("marks an inferred source and an unlinked strategic state honestly", () => {
    render(
      <ActionIntelPanel
        nextMove={nextMove({ move: "Clear the blocker or escalate it", ctaLabel: "Escalate blocker", kind: "escalate" })}
        labels={[]}
        source={source({ explicit: false, type: "MEETING", label: "Meeting" })}
        linkage={noLinkage}
        urgency={urgency}
        ctaHref="/actions/a1"
      />
    );
    expect(screen.getByText(/inferred/)).toBeInTheDocument();
    expect(
      screen.getByText(/Not linked to a project or initiative/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escalate blocker" })).toBeInTheDocument();
  });
});
