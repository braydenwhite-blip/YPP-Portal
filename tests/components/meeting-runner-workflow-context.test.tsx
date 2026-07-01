import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// meeting-runner.tsx transitively imports server actions that touch prisma at
// module scope (lib/weekly-meetings/meeting-actions.ts, lib/chapters/actions.ts).
// Neutralize prisma so those import cleanly under vitest.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { MeetingRunner } from "@/components/weekly-meetings/meeting-runner";
import type { MeetingDetail } from "@/lib/weekly-meetings/meetings";
import type { WorkflowMeetingContext } from "@/lib/workflow-engine/meeting-sync";

function meeting(overrides: Partial<MeetingDetail> = {}): MeetingDetail {
  return {
    id: "m1",
    type: "OFFICER",
    typeLabel: "Officer meeting",
    status: "SCHEDULED",
    title: "Weekly Officer Sync",
    purpose: null,
    scheduledISO: "2026-07-06T15:00:00.000Z",
    notes: null,
    facilitator: { id: "u1", name: "Brayden" },
    scopeLabel: null,
    weekKey: null,
    weekLabel: null,
    attendees: [],
    presentations: [],
    impactCoverage: null,
    officerTopics: [],
    decisions: [],
    followUps: [],
    boardRows: [],
    boardTopics: [],
    linkedActions: [],
    chapterContext: null,
    ...overrides,
  } as unknown as MeetingDetail;
}

function workflowContext(
  overrides: Partial<WorkflowMeetingContext> = {}
): WorkflowMeetingContext {
  return {
    instanceId: "wf1",
    instanceTitle: "New Chapter Launch — Riverside",
    templateName: "New Chapter Launch",
    stageKey: "onboarding",
    stageName: "Onboarding",
    stepExecutionId: "exec1",
    stepTitle: "Kickoff meeting with new CP",
    openActionsCount: 2,
    blockedStepsCount: 1,
    guidance: "Confirm the chapter's first cohort timeline with the new CP.",
    ...overrides,
  };
}

describe("MeetingRunner workflow context banner", () => {
  it("renders nothing workflow-related when workflowContext is null", () => {
    render(<MeetingRunner meeting={meeting()} people={[]} workflowContext={null} />);
    expect(screen.queryByText(/Part of:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Open workflow →")).not.toBeInTheDocument();
  });

  it("shows the template name, stage, guidance, and a link to the workflow instance", () => {
    render(
      <MeetingRunner meeting={meeting()} people={[]} workflowContext={workflowContext()} />
    );

    expect(screen.getByText(/Part of:/)).toBeInTheDocument();
    expect(screen.getByText(/New Chapter Launch/)).toBeInTheDocument();
    expect(screen.getByText(/Stage: Onboarding/)).toBeInTheDocument();
    expect(screen.getByText(/Kickoff meeting with new CP/)).toBeInTheDocument();
    expect(
      screen.getByText("Confirm the chapter's first cohort timeline with the new CP.")
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Open workflow →" });
    expect(link).toHaveAttribute("href", "/workflows/wf1");
  });

  it("surfaces open-actions and blocked-steps counts", () => {
    render(
      <MeetingRunner meeting={meeting()} people={[]} workflowContext={workflowContext()} />
    );
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/open action/)).toBeInTheDocument();
    expect(screen.getByText(/1 blocked step/)).toBeInTheDocument();
  });

  it("omits the counts line entirely when both counts are zero", () => {
    render(
      <MeetingRunner
        meeting={meeting()}
        people={[]}
        workflowContext={workflowContext({ openActionsCount: 0, blockedStepsCount: 0 })}
      />
    );
    expect(screen.queryByText(/open action/)).not.toBeInTheDocument();
    expect(screen.queryByText(/blocked step/)).not.toBeInTheDocument();
  });
});
