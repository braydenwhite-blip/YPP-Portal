import { describe, expect, it } from "vitest";

import { preparationReviewFingerprint } from "@/lib/classes/preparation-fingerprint";

function facts() {
  return {
    lessonPlanId: "lesson-1",
    notesUrl: "https://example.org/slides",
    description: "Build a prototype.",
    learningOutcomes: ["Explain one design choice"],
    materialsUrl: "https://example.org/worksheet",
    classMaterials: ["Notebook"],
    deliveryMode: "IN_PERSON",
    zoomLink: null,
    locationName: "YPP Lab",
    locationAddress: "100 Main Street",
    room: "201",
    students: [
      {
        studentId: "student-2",
        signupGoal: null,
        signupNote: null,
        instructorNotes: null,
      },
      {
        studentId: "student-1",
        signupGoal: "Build confidence",
        signupNote: null,
        instructorNotes: "Provide written steps",
      },
    ],
  };
}

describe("preparationReviewFingerprint", () => {
  it("is stable when the same roster arrives in a different order", () => {
    const first = facts();
    const second = facts();
    second.students.reverse();

    expect(preparationReviewFingerprint(first)).toBe(preparationReviewFingerprint(second));
  });

  it("changes when a lesson, location, roster, or permitted teaching note changes", () => {
    const original = preparationReviewFingerprint(facts());
    const changedLesson = facts();
    changedLesson.lessonPlanId = "lesson-2";
    const changedLocation = facts();
    changedLocation.room = "202";
    const changedRoster = facts();
    changedRoster.students.pop();
    const changedContext = facts();
    changedContext.students[1].instructorNotes = "Offer a quiet work area";

    expect(preparationReviewFingerprint(changedLesson)).not.toBe(original);
    expect(preparationReviewFingerprint(changedLocation)).not.toBe(original);
    expect(preparationReviewFingerprint(changedRoster)).not.toBe(original);
    expect(preparationReviewFingerprint(changedContext)).not.toBe(original);
  });
});
