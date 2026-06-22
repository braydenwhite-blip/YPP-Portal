import { describe, expect, it } from "vitest";

import { MEETING_TEMPLATES, findMeetingTemplate } from "@/lib/people-strategy/meeting-templates";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import {
  inferMeetingType,
  isMeetingType,
} from "@/lib/people-strategy/meeting-operating-model";

describe("MEETING_TEMPLATES", () => {
  it("has unique ids and valid categories", () => {
    const ids = MEETING_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of MEETING_TEMPLATES) {
      expect(isMeetingType(t.meetingType)).toBe(true);
      expect(isMeetingCategory(t.category)).toBe(true);
      expect(t.durationMinutes).toBeGreaterThan(0);
      expect(Array.isArray(t.agenda)).toBe(true);
    }
  });

  it("includes a blank template with an empty agenda", () => {
    const blank = findMeetingTemplate("t_blank");
    expect(blank).toBeTruthy();
    expect(blank?.agenda).toHaveLength(0);
  });

  it("pre-fills agenda items for the leadership sync", () => {
    const lead = findMeetingTemplate("t_officer");
    expect(lead?.meetingType).toBe("OFFICER_MEETING");
    expect(lead?.category).toBe("LEADERSHIP");
    expect(lead?.agenda.length).toBeGreaterThanOrEqual(4);
  });

  it("uses the current impact teams in the global impact template", () => {
    const impact = findMeetingTemplate("t_global_impact");
    expect(impact?.meetingType).toBe("GLOBAL_OPERATIONS_IMPACT_PRESENTATION");
    expect(impact?.agenda.join(" ")).toContain("Tech");
    expect(impact?.agenda.join(" ")).toContain("Fundraising");
    expect(impact?.agenda.join(" ")).toContain("Expansion");
    expect(impact?.agenda.join(" ")).toContain("Socials");
  });

  it("includes mentorship and applicant workflow templates", () => {
    expect(findMeetingTemplate("t_mentor_kickoff")?.meetingType).toBe("MENTOR_KICKOFF_MEETING");
    expect(findMeetingTemplate("t_monthly_checkin")?.meetingType).toBe("MONTHLY_CHECK_IN");
    expect(findMeetingTemplate("t_quarterly_mentor_review")?.meetingType).toBe(
      "QUARTERLY_MENTOR_COMMITTEE_REVIEW"
    );
    expect(findMeetingTemplate("t_instructor_applicant_interview")?.meetingType).toBe(
      "INSTRUCTOR_APPLICANT_INTERVIEW"
    );
  });

  it("infers connected meeting workflow types from title and related entity", () => {
    expect(inferMeetingType({ title: "Mentor kickoff: Maya", category: "MENTORSHIP" })).toBe(
      "MENTOR_KICKOFF_MEETING"
    );
    expect(inferMeetingType({ title: "Monthly check-in: Maya", category: "MENTORSHIP" })).toBe(
      "MONTHLY_CHECK_IN"
    );
    expect(
      inferMeetingType({
        title: "Instructor applicant interview: Maya",
        category: "APPLICATIONS",
        relatedEntityType: "INSTRUCTOR_APPLICATION",
      })
    ).toBe("INSTRUCTOR_APPLICANT_INTERVIEW");
  });

  it("returns undefined for an unknown id", () => {
    expect(findMeetingTemplate("nope")).toBeUndefined();
  });
});
