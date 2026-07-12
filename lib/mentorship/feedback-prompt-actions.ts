"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import {
  ensureCurrentMonthForm,
  readMonthlyFeedbackStore,
  type MonthlyFeedbackForm,
  type MonthlyFeedbackStore,
} from "@/lib/mentorship/feedback-prompts";
import { prisma } from "@/lib/prisma";

async function loadMentorshipForViewer(
  mentorshipId: string,
  userId: string,
  roles: string[]
) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      status: true,
      customPromptsJson: true,
    },
  });
  if (!mentorship || mentorship.status !== "ACTIVE") {
    throw new Error("Mentorship not found.");
  }
  const isAdmin = roles.includes("ADMIN");
  const isParty =
    mentorship.mentorId === userId || mentorship.menteeId === userId;
  if (!isParty && !isAdmin) throw new Error("Not allowed.");
  return mentorship;
}

function revalidateMentorship(menteeId: string) {
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/people/${menteeId}`);
}

function isMentorOf(
  mentorship: { mentorId: string },
  viewerId: string,
  roles: string[]
) {
  return mentorship.mentorId === viewerId || roles.includes("ADMIN");
}

async function saveStore(
  mentorshipId: string,
  menteeId: string,
  store: MonthlyFeedbackStore
) {
  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: { customPromptsJson: store as unknown as Prisma.InputJsonValue },
  });
  revalidateMentorship(menteeId);
}

function replaceForm(
  store: MonthlyFeedbackStore,
  form: MonthlyFeedbackForm
): MonthlyFeedbackStore {
  return {
    version: 2,
    forms: store.forms.map((f) => (f.id === form.id ? form : f)),
  };
}

function newQuestionId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const MentorshipIdSchema = z.object({ mentorshipId: z.string().min(1) });

/** Ensure a draft exists for this month (mentor opens Feedback). */
export async function ensureMonthlyFeedbackDraft(input: unknown) {
  const viewer = await requireSessionUser();
  const data = MentorshipIdSchema.parse(input);
  const mentorship = await loadMentorshipForViewer(
    data.mentorshipId,
    viewer.id,
    viewer.roles ?? []
  );
  if (!isMentorOf(mentorship, viewer.id, viewer.roles ?? [])) {
    throw new Error("Only the mentor can prepare the monthly form.");
  }

  const raw = readMonthlyFeedbackStore(mentorship.customPromptsJson);
  const { store, current } = ensureCurrentMonthForm(raw);
  if (store !== raw || !raw.forms.some((f) => f.id === current.id)) {
    await saveStore(mentorship.id, mentorship.menteeId, store);
  }
  return { ok: true as const, formId: current.id };
}

const AddQuestionSchema = z.object({
  mentorshipId: z.string().min(1),
  question: z.string().trim().min(1).max(500),
});

/** Mentor adds a question to this month’s draft (or sent form before answers). */
export async function addMonthlyFeedbackQuestion(input: unknown) {
  const viewer = await requireSessionUser();
  const data = AddQuestionSchema.parse(input);
  const mentorship = await loadMentorshipForViewer(
    data.mentorshipId,
    viewer.id,
    viewer.roles ?? []
  );
  if (!isMentorOf(mentorship, viewer.id, viewer.roles ?? [])) {
    throw new Error("Only the mentor can add questions.");
  }

  const { store, current } = ensureCurrentMonthForm(
    readMonthlyFeedbackStore(mentorship.customPromptsJson)
  );
  if (current.status === "ANSWERED") {
    throw new Error("This month’s answers are already in — start next month’s form later.");
  }
  if (current.status === "SENT") {
    throw new Error("This month’s form was already sent. Wait for answers, or use next month.");
  }

  current.questions.push({
    id: newQuestionId(),
    text: data.question,
    kind: "custom",
    answer: null,
  });

  await saveStore(mentorship.id, mentorship.menteeId, replaceForm(store, current));
  return { ok: true as const };
}

const RemoveQuestionSchema = z.object({
  mentorshipId: z.string().min(1),
  questionId: z.string().min(1),
});

export async function removeMonthlyFeedbackQuestion(input: unknown) {
  const viewer = await requireSessionUser();
  const data = RemoveQuestionSchema.parse(input);
  const mentorship = await loadMentorshipForViewer(
    data.mentorshipId,
    viewer.id,
    viewer.roles ?? []
  );
  if (!isMentorOf(mentorship, viewer.id, viewer.roles ?? [])) {
    throw new Error("Only the mentor can remove questions.");
  }

  const { store, current } = ensureCurrentMonthForm(
    readMonthlyFeedbackStore(mentorship.customPromptsJson)
  );
  if (current.status !== "DRAFT") {
    throw new Error("Questions can only be removed before you send the form.");
  }
  if (current.questions.length <= 1) {
    throw new Error("Keep at least one question.");
  }

  current.questions = current.questions.filter((q) => q.id !== data.questionId);
  await saveStore(mentorship.id, mentorship.menteeId, replaceForm(store, current));
  return { ok: true as const };
}

/** Mentor sends this month’s question list to the mentee. */
export async function sendMonthlyFeedbackForm(input: unknown) {
  const viewer = await requireSessionUser();
  const data = MentorshipIdSchema.parse(input);
  const mentorship = await loadMentorshipForViewer(
    data.mentorshipId,
    viewer.id,
    viewer.roles ?? []
  );
  if (!isMentorOf(mentorship, viewer.id, viewer.roles ?? [])) {
    throw new Error("Only the mentor can send the form.");
  }

  const { store, current } = ensureCurrentMonthForm(
    readMonthlyFeedbackStore(mentorship.customPromptsJson)
  );
  if (current.status !== "DRAFT") {
    throw new Error("This month’s form was already sent.");
  }
  if (current.questions.length === 0) {
    throw new Error("Add at least one question before sending.");
  }

  current.status = "SENT";
  current.sentAt = new Date().toISOString();
  await saveStore(mentorship.id, mentorship.menteeId, replaceForm(store, current));
  return { ok: true as const };
}

const SubmitAnswersSchema = z.object({
  mentorshipId: z.string().min(1),
  answers: z.record(z.string(), z.string().trim().min(1).max(4000)),
});

/** Mentee submits answers for the sent monthly form. */
export async function submitMonthlyFeedbackAnswers(input: unknown) {
  const viewer = await requireSessionUser();
  const data = SubmitAnswersSchema.parse(input);
  const mentorship = await loadMentorshipForViewer(
    data.mentorshipId,
    viewer.id,
    viewer.roles ?? []
  );
  if (mentorship.menteeId !== viewer.id) {
    throw new Error("Only the mentee can answer this form.");
  }

  const store = readMonthlyFeedbackStore(mentorship.customPromptsJson);
  const { store: withCurrent, current } = ensureCurrentMonthForm(store);
  if (current.status !== "SENT") {
    throw new Error(
      current.status === "DRAFT"
        ? "Your mentor hasn’t sent this month’s questions yet."
        : "You already answered this month."
    );
  }

  for (const q of current.questions) {
    const answer = data.answers[q.id]?.trim();
    if (!answer) throw new Error(`Please answer: ${q.text}`);
    q.answer = answer;
  }
  current.status = "ANSWERED";
  current.answeredAt = new Date().toISOString();

  await saveStore(
    mentorship.id,
    mentorship.menteeId,
    replaceForm(withCurrent, current)
  );
  return { ok: true as const };
}

/** @deprecated — use addMonthlyFeedbackQuestion */
export async function addMentorshipCustomPrompt(input: unknown) {
  return addMonthlyFeedbackQuestion(input);
}

/** @deprecated */
export async function answerMentorshipCustomPrompt(_input: unknown) {
  throw new Error("Use the monthly form to send all answers at once.");
}
