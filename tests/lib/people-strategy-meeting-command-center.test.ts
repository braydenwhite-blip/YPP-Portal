import { describe, expect, it } from "vitest";

import {
  computeWrapUpState,
  meetingNextAction,
  needsWrapUp,
  selectPrimaryMeeting,
  type MeetingWorkflowInput,
} from "@/lib/people-strategy/meeting-command-center";

// Fri Jun 12 2026, 2:00pm — a fixed clock so every assertion is deterministic.
const NOW = new Date("2026-06-12T14:00:00.000Z");

function meeting(overrides: Partial<MeetingWorkflowInput> = {}): MeetingWorkflowInput {
  return {
    id: "m1",
    title: "Leadership Sync",
    startISO: "2026-06-12T18:00:00.000Z",
    effectiveStatus: "upcoming",
    agendaCount: 0,
    decisionCount: 0,
    linkedActionCount: 0,
    followUpCount: 0,
    openFollowUps: 0,
    overdueFollowUps: 0,
    followUpsNeedingOwner: 0,
    followUpsNeedingDueDate: 0,
    hasNotes: false,
    hasRelatedEntity: false,
    ...overrides,
  };
}

describe("selectPrimaryMeeting", () => {
  it("returns null when there are no meetings", () => {
    expect(selectPrimaryMeeting([], NOW)).toBeNull();
  });

  it("prefers a live meeting as the current meeting", () => {
    const live = meeting({ id: "live", effectiveStatus: "in_progress" });
    const upcoming = meeting({ id: "soon", startISO: "2026-06-12T15:00:00.000Z" });
    const sel = selectPrimaryMeeting([upcoming, live], NOW);
    expect(sel).not.toBeNull();
    expect(sel?.mode).toBe("current");
    expect(sel?.meeting.id).toBe("live");
  });

  it("picks the earliest live meeting when several are in progress", () => {
    const a = meeting({ id: "a", effectiveStatus: "in_progress", startISO: "2026-06-12T13:30:00.000Z" });
    const b = meeting({ id: "b", effectiveStatus: "in_progress", startISO: "2026-06-12T13:00:00.000Z" });
    expect(selectPrimaryMeeting([a, b], NOW)?.meeting.id).toBe("b");
  });

  it("falls back to the soonest future meeting as next", () => {
    const later = meeting({ id: "later", startISO: "2026-06-12T20:00:00.000Z" });
    const sooner = meeting({ id: "sooner", startISO: "2026-06-12T16:00:00.000Z" });
    const past = meeting({ id: "past", startISO: "2026-06-12T10:00:00.000Z", effectiveStatus: "completed", hasNotes: true, decisionCount: 1, linkedActionCount: 1 });
    const sel = selectPrimaryMeeting([later, sooner, past], NOW);
    expect(sel?.mode).toBe("next");
    expect(sel?.meeting.id).toBe("sooner");
  });

  it("does not treat a meeting that already started today as next", () => {
    const started = meeting({ id: "started", effectiveStatus: "today", startISO: "2026-06-12T09:00:00.000Z" });
    expect(selectPrimaryMeeting([started], NOW)).toBeNull();
  });

  it("surfaces the most urgent wrap-up meeting when nothing is live or upcoming", () => {
    const clean = meeting({
      id: "clean",
      effectiveStatus: "completed",
      startISO: "2026-06-11T18:00:00.000Z",
      hasNotes: true,
      decisionCount: 2,
      linkedActionCount: 1,
    });
    const messy = meeting({
      id: "messy",
      effectiveStatus: "needs_follow_up",
      startISO: "2026-06-10T18:00:00.000Z",
      hasNotes: false,
      overdueFollowUps: 2,
      followUpCount: 2,
    });
    const sel = selectPrimaryMeeting([clean, messy], NOW);
    expect(sel?.mode).toBe("wrap_up");
    // `messy` has overdue follow-ups, so it wins over the older-but-clean one.
    expect(sel?.meeting.id).toBe("messy");
  });

  it("returns null when every meeting is fully wrapped up", () => {
    const done = meeting({
      id: "done",
      effectiveStatus: "completed",
      startISO: "2026-06-10T18:00:00.000Z",
      hasNotes: true,
      decisionCount: 1,
      linkedActionCount: 1,
    });
    expect(selectPrimaryMeeting([done], NOW)).toBeNull();
  });
});

describe("meetingNextAction priority order (spec §10)", () => {
  it("1. live meeting → Open meeting", () => {
    expect(meetingNextAction(meeting({ effectiveStatus: "in_progress" })).key).toBe("open");
  });

  it("2. upcoming with no agenda → Add agenda", () => {
    expect(meetingNextAction(meeting({ effectiveStatus: "upcoming", agendaCount: 0 })).key).toBe(
      "add_agenda"
    );
  });

  it("3. upcoming with agenda + connected context → Prepare", () => {
    const a = meetingNextAction(
      meeting({ effectiveStatus: "upcoming", agendaCount: 3, hasRelatedEntity: true })
    );
    expect(a.key).toBe("prepare");
  });

  it("3. upcoming with agenda but no context → View meeting", () => {
    expect(
      meetingNextAction(meeting({ effectiveStatus: "upcoming", agendaCount: 3 })).key
    ).toBe("view");
  });

  it("4. completed with no notes → Add notes", () => {
    expect(
      meetingNextAction(meeting({ effectiveStatus: "completed", hasNotes: false })).key
    ).toBe("add_notes");
  });

  it("5. completed with notes but no decisions → Add decisions", () => {
    expect(
      meetingNextAction(
        meeting({ effectiveStatus: "completed", hasNotes: true, decisionCount: 0 })
      ).key
    ).toBe("add_decisions");
  });

  it("6. completed with decisions but no actions → Create actions", () => {
    expect(
      meetingNextAction(
        meeting({
          effectiveStatus: "completed",
          hasNotes: true,
          decisionCount: 2,
          linkedActionCount: 0,
          followUpCount: 0,
        })
      ).key
    ).toBe("create_actions");
  });

  it("7. actions without an owner → Assign owners", () => {
    expect(
      meetingNextAction(
        meeting({
          effectiveStatus: "completed",
          hasNotes: true,
          decisionCount: 1,
          followUpCount: 2,
          followUpsNeedingOwner: 1,
        })
      ).key
    ).toBe("assign_owners");
  });

  it("8. actions without a due date → Set due dates", () => {
    expect(
      meetingNextAction(
        meeting({
          effectiveStatus: "completed",
          hasNotes: true,
          decisionCount: 1,
          followUpCount: 2,
          followUpsNeedingOwner: 0,
          followUpsNeedingDueDate: 2,
        })
      ).key
    ).toBe("set_due_dates");
  });

  it("9. overdue actions → Review actions", () => {
    expect(
      meetingNextAction(
        meeting({
          effectiveStatus: "needs_follow_up",
          hasNotes: true,
          decisionCount: 1,
          linkedActionCount: 1,
          followUpCount: 1,
          overdueFollowUps: 1,
        })
      ).key
    ).toBe("review_actions");
  });

  it("10. everything current → View meeting", () => {
    expect(
      meetingNextAction(
        meeting({
          effectiveStatus: "completed",
          hasNotes: true,
          decisionCount: 1,
          linkedActionCount: 1,
          followUpCount: 1,
          overdueFollowUps: 0,
        })
      ).key
    ).toBe("view");
  });

  it("points at the right workspace section via the href focus", () => {
    expect(meetingNextAction(meeting({ effectiveStatus: "completed", hasNotes: false })).href).toBe(
      "/actions/meetings/m1#notes"
    );
    expect(meetingNextAction(meeting({ effectiveStatus: "upcoming", agendaCount: 0 })).href).toBe(
      "/actions/meetings/m1#agenda"
    );
    expect(meetingNextAction(meeting({ effectiveStatus: "in_progress" })).href).toBe(
      "/actions/meetings/m1"
    );
  });
});

describe("computeWrapUpState (spec §5)", () => {
  it("names notes as missing in plain English", () => {
    const state = computeWrapUpState(meeting({ effectiveStatus: "completed", hasNotes: false }));
    const notes = state.items.find((i) => i.key === "notes");
    expect(notes?.ok).toBe(false);
    expect(notes?.label).toBe("Notes missing");
    expect(state.readyToWrapUp).toBe(false);
    expect(state.summaryLine).toContain("Notes missing");
  });

  it("counts decisions and actions when present", () => {
    const state = computeWrapUpState(
      meeting({
        effectiveStatus: "completed",
        hasNotes: true,
        decisionCount: 2,
        linkedActionCount: 3,
      })
    );
    expect(state.items.find((i) => i.key === "decisions")?.label).toBe("2 decisions recorded");
    expect(state.items.find((i) => i.key === "actions")?.label).toBe("3 actions created");
  });

  it("flags actions that need an owner", () => {
    const state = computeWrapUpState(
      meeting({
        effectiveStatus: "completed",
        hasNotes: true,
        decisionCount: 1,
        followUpCount: 1,
        followUpsNeedingOwner: 1,
      })
    );
    const owners = state.items.find((i) => i.key === "owners");
    expect(owners?.ok).toBe(false);
    expect(owners?.label).toBe("1 action needs owner");
    expect(state.readyToWrapUp).toBe(false);
  });

  it("flags actions that need a due date", () => {
    const state = computeWrapUpState(
      meeting({
        effectiveStatus: "completed",
        hasNotes: true,
        decisionCount: 1,
        followUpCount: 2,
        followUpsNeedingDueDate: 2,
      })
    );
    const due = state.items.find((i) => i.key === "due_dates");
    expect(due?.ok).toBe(false);
    expect(due?.label).toBe("2 actions need due date");
  });

  it("omits owner/due checks when no actions exist yet", () => {
    const state = computeWrapUpState(
      meeting({ effectiveStatus: "completed", hasNotes: true, decisionCount: 1 })
    );
    expect(state.items.some((i) => i.key === "owners")).toBe(false);
    expect(state.items.some((i) => i.key === "due_dates")).toBe(false);
  });

  it("reads 'Ready to wrap up' when nothing is missing", () => {
    const state = computeWrapUpState(
      meeting({
        effectiveStatus: "completed",
        hasNotes: true,
        decisionCount: 1,
        linkedActionCount: 1,
      })
    );
    expect(state.readyToWrapUp).toBe(true);
    expect(state.summaryLine).toBe("Ready to wrap up");
  });
});

describe("needsWrapUp", () => {
  it("is false for upcoming, live, and canceled meetings", () => {
    expect(needsWrapUp(meeting({ effectiveStatus: "upcoming" }))).toBe(false);
    expect(needsWrapUp(meeting({ effectiveStatus: "in_progress" }))).toBe(false);
    expect(needsWrapUp(meeting({ effectiveStatus: "canceled" }))).toBe(false);
  });

  it("is true for a finished meeting with gaps and false once closed out", () => {
    expect(needsWrapUp(meeting({ effectiveStatus: "completed", hasNotes: false }))).toBe(true);
    expect(
      needsWrapUp(
        meeting({
          effectiveStatus: "completed",
          hasNotes: true,
          decisionCount: 1,
          linkedActionCount: 1,
        })
      )
    ).toBe(false);
  });
});
