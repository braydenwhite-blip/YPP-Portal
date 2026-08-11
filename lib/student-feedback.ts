import { prisma } from "@/lib/prisma";

export type StudentFeedbackEntry = {
  id: string;
  offeringId: string;
  offeringTitle: string;
  instructorName: string;
  body: string;
  strengths: string | null;
  growthAreas: string | null;
  releasedToFamilyAt: Date;
};

/**
 * Feedback an instructor has written and released to the family for this
 * student. Feedback with `releasedToFamilyAt` still null is a draft and is
 * never returned here — students only see feedback once an instructor has
 * explicitly released it.
 */
export async function getMyFeedback(studentId: string): Promise<StudentFeedbackEntry[]> {
  const records = await prisma.instructorStudentFeedback.findMany({
    where: {
      studentId,
      releasedToFamilyAt: { not: null },
    },
    include: {
      offering: { select: { id: true, title: true } },
      instructor: { select: { name: true } },
    },
    orderBy: { releasedToFamilyAt: "desc" },
  });

  return records.map((record) => ({
    id: record.id,
    offeringId: record.offering.id,
    offeringTitle: record.offering.title,
    instructorName: record.instructor.name,
    body: record.body,
    strengths: record.strengths,
    growthAreas: record.growthAreas,
    // Safe: filtered to non-null above.
    releasedToFamilyAt: record.releasedToFamilyAt as Date,
  }));
}