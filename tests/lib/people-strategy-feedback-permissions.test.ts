import { describe, expect, it } from "vitest";

import type { AdminSubtypeValue } from "@/lib/admin-subtypes";
import {
  canReadFeedbackResponses,
  feedbackResponseAccess,
  isFeedbackLeadership,
  isSuperAdmin,
  redactFeedbackResponseBody,
  type FeedbackViewer,
} from "@/lib/people-strategy/feedback-permissions";

function viewer(
  id: string,
  roles: string[],
  adminSubtypes: AdminSubtypeValue[] = []
): FeedbackViewer {
  return { id, roles, primaryRole: roles[0] ?? "STUDENT", adminSubtypes };
}

const SUBJECT = "subject-user";

const superAdmin = viewer("sa", ["ADMIN"], ["SUPER_ADMIN"]);
const leadership = viewer("lead", ["ADMIN"], ["LEADERSHIP"]);
const hiringAdmin = viewer("hire", ["ADMIN"], ["HIRING_ADMIN"]);
const member = viewer("m", ["INSTRUCTOR"], []);
const subjectMember = viewer(SUBJECT, ["INSTRUCTOR"], []);

describe("feedback confidentiality — canReadFeedbackResponses", () => {
  it("SUPER_ADMIN can read all feedback responses", () => {
    expect(canReadFeedbackResponses(superAdmin, SUBJECT)).toBe(true);
    expect(canReadFeedbackResponses(superAdmin, "anyone-else")).toBe(true);
    expect(feedbackResponseAccess(superAdmin, SUBJECT)).toEqual({
      canRead: true,
      scope: "SUPER_ADMIN",
    });
  });

  it("authorized Leadership can read permitted feedback", () => {
    expect(canReadFeedbackResponses(leadership, SUBJECT)).toBe(true);
    expect(feedbackResponseAccess(leadership, SUBJECT)).toEqual({
      canRead: true,
      scope: "LEADERSHIP",
    });
  });

  it("the subject CANNOT read their own confidential feedback responses", () => {
    expect(canReadFeedbackResponses(subjectMember, SUBJECT)).toBe(false);
    expect(feedbackResponseAccess(subjectMember, SUBJECT)).toEqual({
      canRead: false,
      reason: "SUBJECT_CONFIDENTIAL",
    });
  });

  it("a normal member cannot read feedback about others", () => {
    expect(canReadFeedbackResponses(member, SUBJECT)).toBe(false);
    expect(feedbackResponseAccess(member, SUBJECT)).toEqual({
      canRead: false,
      reason: "NOT_AUTHORIZED",
    });
  });

  it("a non-Leadership admin subtype cannot read confidential feedback", () => {
    expect(canReadFeedbackResponses(hiringAdmin, SUBJECT)).toBe(false);
    expect(feedbackResponseAccess(hiringAdmin, SUBJECT)).toEqual({
      canRead: false,
      reason: "NOT_AUTHORIZED",
    });
  });

  it("a SUPER_ADMIN who is also the subject still reads their own feedback", () => {
    const selfSuperAdmin = viewer(SUBJECT, ["ADMIN"], ["SUPER_ADMIN"]);
    expect(canReadFeedbackResponses(selfSuperAdmin, SUBJECT)).toBe(true);
  });
});

describe("tier predicates", () => {
  it("isSuperAdmin only for ADMIN + SUPER_ADMIN subtype", () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(leadership)).toBe(false);
    expect(isSuperAdmin(member)).toBe(false);
  });

  it("isFeedbackLeadership for ADMIN + (LEADERSHIP or SUPER_ADMIN)", () => {
    expect(isFeedbackLeadership(superAdmin)).toBe(true);
    expect(isFeedbackLeadership(leadership)).toBe(true);
    expect(isFeedbackLeadership(hiringAdmin)).toBe(false);
    expect(isFeedbackLeadership(member)).toBe(false);
  });
});

describe("redactFeedbackResponseBody", () => {
  const response = { id: "r1", month: "2026-06", responseBody: "great collaborator" };

  it("preserves the body for an authorized reader", () => {
    expect(redactFeedbackResponseBody(leadership, SUBJECT, response).responseBody).toBe(
      "great collaborator"
    );
    expect(redactFeedbackResponseBody(superAdmin, SUBJECT, response).responseBody).toBe(
      "great collaborator"
    );
  });

  it("nulls the body for the subject and for unauthorized viewers, keeping metadata", () => {
    const redactedForSubject = redactFeedbackResponseBody(subjectMember, SUBJECT, response);
    expect(redactedForSubject.responseBody).toBeNull();
    expect(redactedForSubject.month).toBe("2026-06");

    expect(redactFeedbackResponseBody(member, SUBJECT, response).responseBody).toBeNull();
  });
});
