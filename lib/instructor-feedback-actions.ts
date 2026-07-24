"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { InstructorFeedbackSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  hasRole,
  requireSessionUser,
} from "@/lib/authorization";

const FeedbackSourceSchema = z.enum(["PARENT", "OFFICER", "STUDENT", "PARTNER"]);

const CreateReceivedFeedbackSchema = z.object({
  instructorId: z.string().min(1),
  source: FeedbackSourceSchema,
  feedbackDate: z.string().min(1),
  category: z.string().trim().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(5000).optional().nullable(),
});

const QuestionUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  prompt: z.string().trim().min(1).max(500),
  category: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(12),
});

const MentorshipNoteSchema = z.object({
  menteeId: z.string().min(1),
  body: z.string().trim().min(1).max(8000),
});

type SessionUser = Awaited<ReturnType<typeof requireSessionUser>>;

function isOfficerOrAdmin(session: SessionUser) {
  return (
    hasRole(session.roles, "ADMIN", session.primaryRole) ||
    hasRole(session.roles, "STAFF", session.primaryRole) ||
    hasRole(session.roles, "CHAPTER_PRESIDENT", session.primaryRole) ||
    hasRole(session.roles, "HIRING_CHAIR", session.primaryRole)
  );
}

async function isAssignedActiveMentor(menteeId: string, session: SessionUser) {
  if (session.id === menteeId) return false;
  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId, mentorId: session.id, status: "ACTIVE" },
    select: { id: true },
  });
  return Boolean(mentorship);
}

async function requireReceivedFeedbackLogger() {
  const session = await requireSessionUser();
  if (!isOfficerOrAdmin(session)) {
    throw new Error(
      "Unauthorized: only admins and officers can log parent or officer feedback."
    );
  }
  return session;
}

async function requireMentorshipNoteAuthor() {
  const session = await requireSessionUser();
  if (
    isOfficerOrAdmin(session) ||
    hasRole(session.roles, "MENTOR", session.primaryRole)
  ) {
    return session;
  }
  const assigned = await prisma.mentorship.findFirst({
    where: { mentorId: session.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assigned) {
    throw new Error("Unauthorized: only mentors and officers can add notes.");
  }
  return session;
}

async function requireQuestionAdmin() {
  const session = await requireSessionUser();
  if (!hasRole(session.roles, "ADMIN", session.primaryRole)) {
    throw new Error("Unauthorized: only admins can edit review questions.");
  }
  return session;
}

/** Mentors of this person, officers, and admins may view feedback/notes. Mentees may not. */
async function assertCanViewMenteeContext(menteeId: string, session: SessionUser) {
  if (isOfficerOrAdmin(session)) return;
  if (session.id === menteeId) {
    throw new Error("Unauthorized: mentees cannot view this feedback workspace.");
  }
  if (await isAssignedActiveMentor(menteeId, session)) return;
  throw new Error("Unauthorized: you can only view feedback for your mentees.");
}

async function assertCanEditMenteeContext(menteeId: string, session: SessionUser) {
  if (session.id === menteeId) {
    throw new Error("Unauthorized: mentees cannot edit feedback or notes.");
  }
  await assertCanViewMenteeContext(menteeId, session);
}

export type InstructorReceivedFeedbackRow = {
  id: string;
  source: InstructorFeedbackSource;
  feedbackDate: string;
  category: string;
  rating: number;
  comment: string | null;
  createdByName: string;
  createdAt: string;
};

export async function listInstructorReceivedFeedback(
  instructorId: string
): Promise<InstructorReceivedFeedbackRow[]> {
  const session = await requireSessionUser();
  await assertCanViewMenteeContext(instructorId, session);
  const rows = await prisma.instructorReceivedFeedback.findMany({
    where: { instructorId },
    orderBy: [{ feedbackDate: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    feedbackDate: row.feedbackDate.toISOString(),
    category: row.category,
    rating: row.rating,
    comment: row.comment,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createInstructorReceivedFeedback(input: unknown) {
  const session = await requireReceivedFeedbackLogger();
  const data = CreateReceivedFeedbackSchema.parse(input);
  await assertCanEditMenteeContext(data.instructorId, session);

  const feedbackDate = new Date(data.feedbackDate);
  if (Number.isNaN(feedbackDate.getTime())) {
    throw new Error("Invalid feedback date.");
  }

  const instructor = await prisma.user.findUnique({
    where: { id: data.instructorId },
    select: { id: true },
  });
  if (!instructor) throw new Error("Person not found.");

  await prisma.instructorReceivedFeedback.create({
    data: {
      instructorId: data.instructorId,
      source: data.source,
      feedbackDate,
      category: data.category,
      rating: data.rating,
      comment: data.comment?.trim() || null,
      createdById: session.id,
    },
  });

  revalidatePath(`/people/${data.instructorId}`);
  revalidatePath(`/mentorship/people/${data.instructorId}`);
  return { ok: true as const };
}

export type InstructorReviewQuestionRow = {
  id: string;
  prompt: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  options: string[];
};

function parseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export async function listInstructorReviewQuestions(opts?: {
  activeOnly?: boolean;
}): Promise<InstructorReviewQuestionRow[]> {
  await requireSessionUser();
  const rows = await prisma.instructorReviewQuestion.findMany({
    where: opts?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    category: row.category,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    options: parseOptions(row.optionsJson),
  }));
}

export async function upsertInstructorReviewQuestion(input: unknown) {
  const session = await requireQuestionAdmin();
  const data = QuestionUpsertSchema.parse(input);
  const optionsJson = JSON.stringify(data.options);

  if (data.id) {
    await prisma.instructorReviewQuestion.update({
      where: { id: data.id },
      data: {
        prompt: data.prompt,
        category: data.category?.trim() || null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        optionsJson,
        updatedById: session.id,
      },
    });
  } else {
    await prisma.instructorReviewQuestion.create({
      data: {
        prompt: data.prompt,
        category: data.category?.trim() || null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        optionsJson,
        updatedById: session.id,
      },
    });
  }

  revalidatePath("/admin/instructor-review-questions");
  return { ok: true as const };
}

export async function deleteInstructorReviewQuestion(questionId: string) {
  await requireQuestionAdmin();
  await prisma.instructorReviewQuestion.delete({ where: { id: questionId } });
  revalidatePath("/admin/instructor-review-questions");
  return { ok: true as const };
}

export async function reorderInstructorReviewQuestions(input: unknown) {
  await requireQuestionAdmin();
  const data = z
    .object({
      orderedIds: z.array(z.string().min(1)).min(1).max(100),
    })
    .parse(input);

  await prisma.$transaction(
    data.orderedIds.map((id, index) =>
      prisma.instructorReviewQuestion.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      })
    )
  );

  revalidatePath("/admin/instructor-review-questions");
  return { ok: true as const };
}

export async function saveInstructorReviewAnswers(input: unknown) {
  const session = await requireMentorshipNoteAuthor();
  const data = z
    .object({
      reviewId: z.string().min(1),
      instructorId: z.string().min(1),
      answers: z
        .array(
          z.object({
            questionId: z.string().min(1),
            answer: z.string().trim().min(1).max(200),
            rating: z.number().int().min(1).max(5).optional().nullable(),
          })
        )
        .max(40),
    })
    .parse(input);

  await assertCanEditMenteeContext(data.instructorId, session);

  const review = await prisma.mentorGoalReview.findUnique({
    where: { id: data.reviewId },
    select: { id: true, menteeId: true },
  });
  if (!review || review.menteeId !== data.instructorId) {
    throw new Error("Review not found for this person.");
  }

  await prisma.$transaction(
    data.answers.map((answer) =>
      prisma.instructorReviewAnswer.upsert({
        where: {
          reviewId_questionId: {
            reviewId: data.reviewId,
            questionId: answer.questionId,
          },
        },
        create: {
          reviewId: data.reviewId,
          questionId: answer.questionId,
          instructorId: data.instructorId,
          answer: answer.answer,
          rating: answer.rating ?? null,
          authorId: session.id,
        },
        update: {
          answer: answer.answer,
          rating: answer.rating ?? null,
          authorId: session.id,
        },
      })
    )
  );

  revalidatePath(`/mentorship/people/${data.instructorId}`);
  return { ok: true as const };
}

export type MentorshipNoteRow = {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
};

export async function listMentorshipNotes(menteeId: string): Promise<MentorshipNoteRow[]> {
  const session = await requireSessionUser();
  await assertCanViewMenteeContext(menteeId, session);
  const rows = await prisma.mentorshipNote.findMany({
    where: { menteeId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { author: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    authorName: row.author.name,
    authorId: row.authorId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createMentorshipNote(input: unknown) {
  const session = await requireMentorshipNoteAuthor();
  const data = MentorshipNoteSchema.parse(input);
  await assertCanEditMenteeContext(data.menteeId, session);

  await prisma.mentorshipNote.create({
    data: {
      menteeId: data.menteeId,
      authorId: session.id,
      body: data.body,
    },
  });

  revalidatePath(`/mentorship/people/${data.menteeId}`);
  revalidatePath(`/people/${data.menteeId}`);
  return { ok: true as const };
}

export type InstructorReviewNoteRow = {
  id: string;
  cycleMonth: string;
  cycleNumber: number;
  overallReflection: string;
  workingWell: string;
  supportNeeded: string;
};

export type InstructorReviewCheckInRow = {
  id: string;
  occurredAt: string;
  notes: string;
  wins: string | null;
  challenges: string | null;
  authorName: string | null;
};

export type PriorMentorReviewRow = {
  id: string;
  cycleMonth: string;
  overallRating: string;
  overallComments: string;
  planOfAction: string;
  status: string;
  mentorName: string;
};

export type FeedbackTimelineEntry = {
  id: string;
  date: string;
  source: "PARENT" | "OFFICER" | "STUDENT" | "PARTNER" | "MENTOR";
  category: string;
  rating: string;
  comment: string | null;
};

export type InstructorReviewContext = {
  received: InstructorReceivedFeedbackRow[];
  priorMentorReviews: PriorMentorReviewRow[];
  questions: InstructorReviewQuestionRow[];
  notes: InstructorReviewNoteRow[];
  recentCheckIns: InstructorReviewCheckInRow[];
  mentorshipNotes: MentorshipNoteRow[];
  timeline: FeedbackTimelineEntry[];
  /** Mentors/officers may add mentorship notes. */
  canEditFeedback: boolean;
  /** Admins/officers may log parent/officer/student/partner feedback. */
  canLogReceivedFeedback: boolean;
  existingAnswers: Array<{
    questionId: string;
    answer: string;
    rating: number | null;
  }>;
};

/** Everything a mentor needs inline while writing a monthly Goal Review. */
export async function loadInstructorReviewContext(
  menteeId: string,
  opts?: { reviewId?: string | null }
): Promise<InstructorReviewContext> {
  const session = await requireSessionUser();
  await assertCanViewMenteeContext(menteeId, session);

  const canEditFeedback =
    isOfficerOrAdmin(session) || (await isAssignedActiveMentor(menteeId, session));
  const canLogReceivedFeedback = isOfficerOrAdmin(session);

  const [
    received,
    priorMentorReviews,
    questions,
    notes,
    recentCheckIns,
    mentorshipNotes,
    existingAnswers,
  ] = await Promise.all([
    listInstructorReceivedFeedback(menteeId),
    prisma.mentorGoalReview.findMany({
      where: {
        menteeId,
        status: { in: ["APPROVED", "PENDING_CHAIR_APPROVAL"] },
        ...(opts?.reviewId ? { id: { not: opts.reviewId } } : {}),
      },
      orderBy: { cycleMonth: "desc" },
      take: 12,
      select: {
        id: true,
        cycleMonth: true,
        overallRating: true,
        overallComments: true,
        planOfAction: true,
        status: true,
        mentor: { select: { name: true } },
      },
    }),
    listInstructorReviewQuestions({ activeOnly: true }),
    prisma.monthlySelfReflection.findMany({
      where: { menteeId },
      orderBy: { cycleNumber: "desc" },
      take: 8,
      select: {
        id: true,
        cycleMonth: true,
        cycleNumber: true,
        overallReflection: true,
        workingWell: true,
        supportNeeded: true,
      },
    }),
    prisma.mentorshipCheckIn.findMany({
      where: { subjectId: menteeId },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true,
        occurredAt: true,
        notes: true,
        wins: true,
        challenges: true,
        author: { select: { name: true } },
      },
    }),
    listMentorshipNotes(menteeId),
    opts?.reviewId
      ? prisma.instructorReviewAnswer.findMany({
          where: { reviewId: opts.reviewId },
          select: { questionId: true, answer: true, rating: true },
        })
      : Promise.resolve([]),
  ]);

  const priorMapped: PriorMentorReviewRow[] = priorMentorReviews.map((row) => ({
    id: row.id,
    cycleMonth: row.cycleMonth.toISOString(),
    overallRating: row.overallRating,
    overallComments: row.overallComments,
    planOfAction: row.planOfAction,
    status: row.status,
    mentorName: row.mentor.name,
  }));

  const timeline: FeedbackTimelineEntry[] = [
    ...received.map((row) => ({
      id: `fb-${row.id}`,
      date: row.feedbackDate,
      source: row.source as FeedbackTimelineEntry["source"],
      category: row.category,
      rating: `${row.rating}/5`,
      comment: row.comment,
    })),
    ...priorMapped.map((row) => ({
      id: `rev-${row.id}`,
      date: row.cycleMonth,
      source: "MENTOR" as const,
      category: "Monthly review",
      rating: row.overallRating,
      comment: row.overallComments,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    received,
    priorMentorReviews: priorMapped,
    questions,
    notes: notes.map((row) => ({
      id: row.id,
      cycleMonth: row.cycleMonth.toISOString(),
      cycleNumber: row.cycleNumber,
      overallReflection: row.overallReflection,
      workingWell: row.workingWell,
      supportNeeded: row.supportNeeded,
    })),
    recentCheckIns: recentCheckIns.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      notes: row.notes,
      wins: row.wins,
      challenges: row.challenges,
      authorName: row.author?.name ?? null,
    })),
    mentorshipNotes,
    timeline,
    canEditFeedback,
    canLogReceivedFeedback,
    existingAnswers,
  };
}
