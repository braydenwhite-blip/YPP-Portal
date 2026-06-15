import { describe, expect, it } from "vitest";

import {
  generateAgendaText,
  generateMeetingSummary,
  type AgendaActionInput,
} from "@/lib/people-strategy/meeting-agenda-summary";

const action = (o: Partial<AgendaActionInput> = {}): AgendaActionInput => ({
  id: "a",
  title: "Action",
  status: "IN_PROGRESS",
  priority: "MEDIUM",
  ownerName: "Riya",
  deadlineISO: "2026-07-01T00:00:00Z",
  blocked: false,
  overdue: false,
  dueSoon: false,
  ...o,
});

describe("generateAgendaText", () => {
  it("groups actions into urgent / blocked / due-soon / updates", () => {
    const text = generateAgendaText({
      title: "Weekly sync",
      dateISO: "2026-06-15T00:00:00Z",
      actions: [
        action({ id: "u", title: "Sign partnership", priority: "URGENT" }),
        action({ id: "b", title: "Unblock venue", blocked: true }),
        action({ id: "d", title: "Confirm roster", overdue: true }),
        action({ id: "n", title: "Update website" }),
      ],
      agendaItems: [{ title: "Budget review", status: "OPEN", ownerName: null }],
      openFollowUps: [],
    });

    expect(text).toContain("## Urgent decisions");
    expect(text).toContain("Sign partnership");
    expect(text).toContain("## Blocked actions");
    expect(text).toContain("Unblock venue");
    expect(text).toContain("## Due soon / overdue");
    expect(text).toContain("Confirm roster");
    expect(text).toContain("## Updates");
    expect(text).toContain("## New / misc");
    expect(text).toContain("Budget review");
  });

  it("does not list an urgent action twice under updates", () => {
    const text = generateAgendaText({
      title: "Sync",
      dateISO: "2026-06-15T00:00:00Z",
      actions: [action({ id: "u", title: "Sign partnership", priority: "HIGH" })],
      agendaItems: [],
      openFollowUps: [],
    });
    expect(text.match(/Sign partnership/g)?.length).toBe(1);
  });

  it("surfaces carry-forward from deferred items and open follow-ups", () => {
    const text = generateAgendaText({
      title: "Sync",
      dateISO: "2026-06-15T00:00:00Z",
      actions: [],
      agendaItems: [{ title: "Tabled hiring topic", status: "DEFERRED", ownerName: "Sam" }],
      openFollowUps: [{ title: "Send vendor email", ownerName: "Lee", dueISO: null }],
    });
    expect(text).toContain("## Carry-forward");
    expect(text).toContain("Tabled hiring topic");
    expect(text).toContain("Send vendor email");
  });

  it("returns a scaffold when the meeting has nothing linked", () => {
    const text = generateAgendaText({
      title: "Empty",
      dateISO: "2026-06-15T00:00:00Z",
      actions: [],
      agendaItems: [],
      openFollowUps: [],
    });
    expect(text).toContain("No linked actions yet");
  });
});

describe("generateMeetingSummary", () => {
  it("groups decisions, follow-ups, blockers, and carry-forward", () => {
    const result = generateMeetingSummary({
      title: "Weekly sync",
      dateISO: "2026-06-15T00:00:00Z",
      decisions: [{ decision: "Approve summer budget", decidedByName: "Board" }],
      actions: [action({ id: "b", title: "Unblock venue", blocked: true })],
      followUps: [{ title: "Email families", ownerName: "Riya", dueISO: null, status: "OPEN" }],
      deferredAgendaItems: [{ title: "Hiring plan" }],
      notesText: "Good discussion.",
    });

    expect(result.text).toContain("## Decisions made");
    expect(result.text).toContain("Approve summer budget");
    expect(result.text).toContain("## New follow-ups");
    expect(result.text).toContain("Email families");
    expect(result.text).toContain("## Blockers / escalations");
    expect(result.text).toContain("## Deferred items");
    expect(result.text).toContain("## Next-meeting carry-forward");
    expect(result.text).toContain("## Notes");
    expect(result.missingNotes).toBe(false);
  });

  it("warns when decisions were made but nothing was assigned", () => {
    const result = generateMeetingSummary({
      title: "Sync",
      dateISO: "2026-06-15T00:00:00Z",
      decisions: [{ decision: "Pick a date", decidedByName: null }],
      actions: [],
      followUps: [],
      deferredAgendaItems: [],
      notesText: null,
    });
    expect(result.warnings.some((w) => w.includes("no action"))).toBe(true);
  });

  it("flags a meeting that logged nothing at all", () => {
    const result = generateMeetingSummary({
      title: "Empty",
      dateISO: "2026-06-15T00:00:00Z",
      decisions: [],
      actions: [],
      followUps: [],
      deferredAgendaItems: [],
      notesText: null,
    });
    expect(result.missingNotes).toBe(true);
  });
});
