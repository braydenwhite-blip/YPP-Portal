import "server-only";

import { prisma } from "@/lib/prisma";
import { listInstructorScopedParentFeedback } from "@/lib/parent-feedback-service";

export type AutoCollectedFeedbackRow = {
  id: string;
  source: "PARENT" | "STUDENT";
  feedbackDate: string;
  category: string;
  rating: number;
  comment: string | null;
  origin: "parent_survey" | "class_feedback";
  authorLabel: string;
};

/**
 * Feedback that arrives without manual mentor/officer logging —
 * parent chapter surveys + student class ratings for this instructor.
 */
export async function loadAutoCollectedInstructorFeedback(
  instructorId: string
): Promise<AutoCollectedFeedbackRow[]> {
  const [parentRows, classRows] = await Promise.all([
    listInstructorScopedParentFeedback(instructorId),
    prisma.classFeedback.findMany({
      where: {
        offering: { instructorId },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        rating: true,
        liked: true,
        improve: true,
        wouldRecommend: true,
        createdAt: true,
        offering: { select: { title: true } },
      },
    }),
  ]);

  const fromParents: AutoCollectedFeedbackRow[] = parentRows.map((row) => ({
    id: `auto-parent-${row.id}`,
    source: "PARENT" as const,
    feedbackDate: row.createdAt.toISOString(),
    category:
      row.type === "INSTRUCTOR_FEEDBACK"
        ? "Parent survey · instructor"
        : row.type.replaceAll("_", " ").toLowerCase(),
    rating: row.rating,
    comment: row.comments?.trim() || null,
    origin: "parent_survey" as const,
    authorLabel: row.isAnonymous
      ? "Parent (anonymous)"
      : row.parent?.name?.trim() || "Parent",
  }));

  const fromStudents: AutoCollectedFeedbackRow[] = classRows.map((row) => {
    const bits = [
      row.liked?.trim() ? `Liked: ${row.liked.trim()}` : null,
      row.improve?.trim() ? `Improve: ${row.improve.trim()}` : null,
      row.wouldRecommend == null
        ? null
        : row.wouldRecommend
          ? "Would recommend"
          : "Would not recommend",
    ].filter(Boolean);
    return {
      id: `auto-class-${row.id}`,
      source: "STUDENT" as const,
      feedbackDate: row.createdAt.toISOString(),
      category: `Class feedback · ${row.offering.title}`,
      rating: row.rating,
      comment: bits.length > 0 ? bits.join(" · ") : null,
      origin: "class_feedback" as const,
      authorLabel: "Student",
    };
  });

  return [...fromParents, ...fromStudents].sort(
    (a, b) =>
      new Date(b.feedbackDate).getTime() - new Date(a.feedbackDate).getTime()
  );
}
