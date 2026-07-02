import { describe, expect, it } from "vitest";

import {
  buildMentorConsoleRows,
  countWaitingOnMe,
  defaultHubView,
  deriveMentorNextStep,
  parseHubView,
  resolveHubViews,
  type MentorRowInput,
} from "@/lib/development/hub";
import {
  deriveDevelopmentSignals,
  EMPTY_DEVELOPMENT_FACTS,
  type DevelopmentPersonFacts,
} from "@/lib/development/signals";

function facts(
  overrides: Partial<DevelopmentPersonFacts> = {}
): DevelopmentPersonFacts {
  return {
    ...EMPTY_DEVELOPMENT_FACTS,
    id: "mentee-1",
    name: "Maya Chen",
    email: "maya@ypp.org",
    population: "instructor",
    mentorName: "Jordan Lee",
    mentorEligible: true,
    daysSinceLastCheckIn: 5,
    ...overrides,
  };
}

function row(overrides: Partial<MentorRowInput> = {}): MentorRowInput {
  return {
    menteeId: "mentee-1",
    menteeName: "Maya Chen",
    contextLabel: "Instructor · Scarsdale",
    signals: deriveDevelopmentSignals(facts()),
    cycle: null,
    program: null,
    ...overrides,
  };
}

describe("hub perspectives", () => {
  it("everyone gets My development; mentors get the console; leadership gets oversight", () => {
    expect(
      resolveHubViews({ isLeadership: false, mentorsInProgram: false, reviewsCycles: false })
    ).toEqual(["me"]);
    expect(
      resolveHubViews({ isLeadership: false, mentorsInProgram: true, reviewsCycles: false })
    ).toEqual(["me", "mentees"]);
    expect(
      resolveHubViews({ isLeadership: false, mentorsInProgram: false, reviewsCycles: true })
    ).toEqual(["me", "mentees"]);
    expect(
      resolveHubViews({ isLeadership: true, mentorsInProgram: false, reviewsCycles: false })
    ).toEqual(["me", "mentees", "admin"]);
  });

  it("defaults to the widest responsibility: oversight, then console, then me", () => {
    expect(defaultHubView(["me", "mentees", "admin"])).toBe("admin");
    expect(defaultHubView(["me", "mentees"])).toBe("mentees");
    expect(defaultHubView(["me"])).toBe("me");
  });

  it("rejects views the viewer doesn't have", () => {
    expect(parseHubView("admin", ["me"])).toBe("me");
    expect(parseHubView("mentees", ["me", "mentees"])).toBe("mentees");
    expect(parseHubView("nonsense", ["me", "mentees", "admin"])).toBe("admin");
  });
});

describe("deriveMentorNextStep", () => {
  it("a pending kickoff beats everything", () => {
    const step = deriveMentorNextStep(
      row({
        program: { mentorshipId: "m1", kickoffPending: true, cycleStage: "KICKOFF_PENDING" },
        cycle: { id: "c1", displayState: "ready-for-synthesis" },
      })
    );
    expect(step.label).toBe("Hold the kickoff meeting");
    expect(step.href).toBe("/mentorship/mentees/mentee-1");
  });

  it("an overdue review follow-up outranks a submitted reflection", () => {
    const step = deriveMentorNextStep(
      row({
        cycle: { id: "c1", displayState: "follow-up-overdue" },
        program: { mentorshipId: "m1", kickoffPending: false, cycleStage: "REFLECTION_SUBMITTED" },
      })
    );
    expect(step.label).toBe("Hold the overdue follow-up");
    expect(step.tone).toBe("danger");
  });

  it("a submitted monthly reflection routes to the review inbox", () => {
    const step = deriveMentorNextStep(
      row({
        program: { mentorshipId: "m1", kickoffPending: false, cycleStage: "REFLECTION_SUBMITTED" },
      })
    );
    expect(step.label).toBe("Write their monthly review");
    expect(step.href).toBe("/mentorship/reviews");
  });

  it("a concern beats routine cycle nudges", () => {
    const step = deriveMentorNextStep(
      row({
        signals: deriveDevelopmentSignals(
          facts({ growthTags: ["AT_RISK_OF_DISENGAGING"] })
        ),
        cycle: { id: "c1", displayState: "waiting-self-input" },
      })
    );
    expect(step.label).toBe("Check in about the concern");
  });

  it("waiting cycle states become nudges", () => {
    expect(
      deriveMentorNextStep(row({ cycle: { id: "c1", displayState: "waiting-input" } }))
        .label
    ).toBe("Nudge their self-reflection");
    expect(
      deriveMentorNextStep(row({ cycle: { id: "c1", displayState: "waiting-feedback" } }))
        .label
    ).toBe("Chase contributor feedback");
  });

  it("no recent check-in asks for a check-in; readiness plans the next step; steady is calm", () => {
    expect(
      deriveMentorNextStep(
        row({ signals: deriveDevelopmentSignals(facts({ daysSinceLastCheckIn: 60 })) })
      ).label
    ).toBe("Hold a check-in");
    expect(
      deriveMentorNextStep(
        row({ signals: deriveDevelopmentSignals(facts({ growthTags: ["READY_FOR_MORE"] })) })
      ).label
    ).toBe("Plan their next responsibility");
    expect(deriveMentorNextStep(row()).label).toBe("Nothing pressing — steady");
  });
});

describe("buildMentorConsoleRows", () => {
  it("orders the console most-urgent-first, then by name", () => {
    const rows = buildMentorConsoleRows([
      row({ menteeId: "steady", menteeName: "Zed" }),
      row({
        menteeId: "kickoff",
        menteeName: "Ana",
        program: { mentorshipId: "m1", kickoffPending: true, cycleStage: "KICKOFF_PENDING" },
      }),
      row({
        menteeId: "synth",
        menteeName: "Bo",
        cycle: { id: "c1", displayState: "ready-for-synthesis" },
      }),
    ]);
    expect(rows.map((r) => r.menteeId)).toEqual(["kickoff", "synth", "steady"]);
  });
});

describe("countWaitingOnMe", () => {
  it("counts only unsubmitted duties", () => {
    expect(
      countWaitingOnMe({
        selfInputs: [{ submitted: false }, { submitted: true }],
        feedbackRequests: [{ submitted: false }, { submitted: false }],
      })
    ).toBe(3);
    expect(countWaitingOnMe({ selfInputs: [], feedbackRequests: [] })).toBe(0);
  });
});
