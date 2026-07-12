import { describe, it, expect } from "vitest";
import { SubmitReflectionSchema, reflectionRaisesConcern } from "@/lib/classes/reflection";

describe("SubmitReflectionSchema", () => {
  it("rejects an empty recap and accepts one useful note", () => {
    expect(SubmitReflectionSchema.safeParse({ offeringId: "o1", sessionId: "s1" }).success).toBe(false);
    expect(
      SubmitReflectionSchema.safeParse({
        offeringId: "o1",
        sessionId: "s1",
        wentWell: "Students completed the first prototype.",
      }).success
    ).toBe(true);
  });
  it("accepts a full reflection and bounds confidence to 1–5", () => {
    expect(
      SubmitReflectionSchema.safeParse({
        offeringId: "o1",
        sessionId: "s1",
        wentWell: "Great energy",
        struggled: "Pacing",
        needsCpHelp: true,
        confidence: 4,
      }).success
    ).toBe(true);
    expect(SubmitReflectionSchema.safeParse({ offeringId: "o1", sessionId: "s1", confidence: 9 }).success).toBe(false);
  });
  it("requires a reason when a student is selected for follow-up", () => {
    expect(
      SubmitReflectionSchema.safeParse({
        offeringId: "o1",
        sessionId: "s1",
        followUpStudentId: "student-1",
        wentWell: "Students completed the activity.",
      }).success
    ).toBe(false);
  });
});

describe("reflectionRaisesConcern", () => {
  it("is true when help is requested or a logistics issue is noted", () => {
    expect(reflectionRaisesConcern({ needsCpHelp: true })).toBe(true);
    expect(reflectionRaisesConcern({ logisticsIssue: "Room was double-booked" })).toBe(true);
  });
  it("is false for a clean reflection", () => {
    expect(reflectionRaisesConcern({ needsCpHelp: false, logisticsIssue: "  " })).toBe(false);
    expect(reflectionRaisesConcern({})).toBe(false);
  });
});
