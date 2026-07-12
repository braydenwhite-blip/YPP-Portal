import { createHash } from "node:crypto";

type PreparationFingerprintInput = {
  lessonPlanId: string | null;
  notesUrl: string | null;
  description: string | null;
  learningOutcomes: string[];
  materialsUrl: string | null;
  classMaterials: string[];
  deliveryMode: string;
  zoomLink: string | null;
  locationName: string | null;
  locationAddress: string | null;
  room: string | null;
  students: {
    studentId: string;
    signupGoal: string | null;
    signupNote: string | null;
    instructorNotes: string | null;
  }[];
};

/**
 * A preparation review is valid only for the exact teaching facts the
 * instructor reviewed. Sorting student rows makes the fingerprint stable when
 * the database returns the same roster in a different order.
 */
export function preparationReviewFingerprint(input: PreparationFingerprintInput) {
  const stable = {
    ...input,
    students: [...input.students].sort((a, b) => a.studentId.localeCompare(b.studentId)),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
