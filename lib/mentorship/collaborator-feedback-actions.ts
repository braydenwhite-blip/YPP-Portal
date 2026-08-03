"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { InstructorFeedbackSource, Prisma } from "@prisma/client";

import { hasRole, requireSessionUser } from "@/lib/authorization";
import type { SessionUser } from "@/lib/auth-supabase";
import { createNotification } from "@/lib/notifications";
import { monthStart } from "@/lib/people-strategy/feedback-requests";
import { prisma } from "@/lib/prisma";

/** Marker stored on FeedbackRequest.contextItems for mentor-requested colleague feedback. */
const MENTORSHIP_COLLABORATOR_CONTEXT_TYPE = "mentorship-collaborator";

const RequestSchema = z.object({
  menteeId: z.string().min(1),
  collaboratorIds: z.array(z.string().min(1)).min(1).max(25),
  note: z.string().trim().max(2000).optional().nullable(),
});

const SearchSchema = z.object({
  menteeId: z.string().min(1),
  q: z.string().trim().max(80).optional().nullable(),
});

const SubmitSchema = z.object({
  requestId: z.string().min(1),
  comment: z.string().trim().min(1).max(5000),
  rating: z.coerce.number().int().min(1).max(5),
  category: z.string().trim().min(1).max(120).default("Colleague feedback"),
});

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

async function assertCanRequestForMentee(menteeId: string, session: SessionUser) {
  if (session.id === menteeId) {
    throw new Error("You cannot request feedback about yourself here.");
  }
  if (isOfficerOrAdmin(session)) return;
  if (await isAssignedActiveMentor(menteeId, session)) return;
  throw new Error("Only mentors and officers can request colleague feedback.");
}

function isMentorshipCollaboratorContext(raw: Prisma.JsonValue | null | undefined): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.some(
    (item) =>
      item != null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as { type?: unknown }).type === MENTORSHIP_COLLABORATOR_CONTEXT_TYPE,
  );
}

function sourceForCollaborator(primaryRole: string | null): InstructorFeedbackSource {
  if (
    primaryRole === "ADMIN" ||
    primaryRole === "STAFF" ||
    primaryRole === "CHAPTER_PRESIDENT" ||
    primaryRole === "HIRING_CHAIR"
  ) {
    return "OFFICER";
  }
  if (primaryRole === "MENTOR") return "MENTOR";
  if (primaryRole === "STUDENT") return "STUDENT";
  if (primaryRole === "PARENT") return "PARENT";
  return "PARTNER";
}

export type CollaboratorCandidate = {
  id: string;
  name: string;
  email: string | null;
  primaryRole: string | null;
};

export async function searchCollaboratorCandidates(
  input: unknown,
): Promise<CollaboratorCandidate[]> {
  const data = SearchSchema.parse(input);
  const session = await requireSessionUser();
  await assertCanRequestForMentee(data.menteeId, session);

  const q = data.q?.trim() ?? "";
  const where: Prisma.UserWhereInput = {
    id: { not: data.menteeId },
    archivedAt: null,
    primaryRole: {
      notIn: ["APPLICANT", "PARENT", "STUDENT"],
    },
  };
  if (q.length > 0) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
    take: q.length > 0 ? 20 : 40,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name?.trim() || row.email || "Unknown",
    email: row.email,
    primaryRole: row.primaryRole,
  }));
}

export type OutstandingCollaboratorRequest = {
  id: string;
  subjectUserId: string;
  subjectName: string;
  requestedByName: string | null;
  reason: string | null;
  monthISO: string;
  dueAtISO: string | null;
  personHref: string;
};

/** Outstanding mentor-requested colleague feedback for the signed-in recipient. */
export async function listMyPendingCollaboratorFeedback(): Promise<
  OutstandingCollaboratorRequest[]
> {
  const session = await requireSessionUser();
  const rows = await prisma.feedbackRequest.findMany({
    where: {
      collaboratorId: session.id,
      submittedAt: null,
      cancelledAt: null,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      subjectUserId: true,
      reason: true,
      month: true,
      dueAt: true,
      contextItems: true,
      subjectUser: { select: { name: true, email: true } },
      requestedBy: { select: { name: true } },
    },
  });

  return rows
    .filter((row) => isMentorshipCollaboratorContext(row.contextItems))
    .map((row) => ({
      id: row.id,
      subjectUserId: row.subjectUserId,
      subjectName: row.subjectUser.name?.trim() || row.subjectUser.email || "Colleague",
      requestedByName: row.requestedBy?.name?.trim() || null,
      reason: row.reason,
      monthISO: row.month.toISOString(),
      dueAtISO: row.dueAt?.toISOString() ?? null,
      personHref: `/people/${row.subjectUserId}?giveFeedback=1`,
    }));
}

export type MenteeOutstandingRequest = {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  reason: string | null;
  createdAtISO: string;
};

/** Outstanding requests a mentor/officer sent about this mentee. */
export async function listOutstandingRequestsForMentee(
  menteeId: string,
): Promise<MenteeOutstandingRequest[]> {
  const session = await requireSessionUser();
  await assertCanRequestForMentee(menteeId, session);

  const rows = await prisma.feedbackRequest.findMany({
    where: {
      subjectUserId: menteeId,
      submittedAt: null,
      cancelledAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      collaboratorId: true,
      reason: true,
      createdAt: true,
      contextItems: true,
      collaborator: { select: { name: true, email: true } },
    },
  });

  return rows
    .filter((row) => isMentorshipCollaboratorContext(row.contextItems))
    .map((row) => ({
      id: row.id,
      collaboratorId: row.collaboratorId,
      collaboratorName:
        row.collaborator.name?.trim() || row.collaborator.email || "Colleague",
      reason: row.reason,
      createdAtISO: row.createdAt.toISOString(),
    }));
}

export async function getMyOutstandingRequestForSubject(
  subjectUserId: string,
): Promise<OutstandingCollaboratorRequest | null> {
  const session = await requireSessionUser();
  const row = await prisma.feedbackRequest.findFirst({
    where: {
      subjectUserId,
      collaboratorId: session.id,
      submittedAt: null,
      cancelledAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subjectUserId: true,
      reason: true,
      month: true,
      dueAt: true,
      contextItems: true,
      subjectUser: { select: { name: true, email: true } },
      requestedBy: { select: { name: true } },
    },
  });
  if (!row || !isMentorshipCollaboratorContext(row.contextItems)) return null;

  return {
    id: row.id,
    subjectUserId: row.subjectUserId,
    subjectName: row.subjectUser.name?.trim() || row.subjectUser.email || "Colleague",
    requestedByName: row.requestedBy?.name?.trim() || null,
    reason: row.reason,
    monthISO: row.month.toISOString(),
    dueAtISO: row.dueAt?.toISOString() ?? null,
    personHref: `/people/${row.subjectUserId}?giveFeedback=1`,
  };
}

export async function requestCollaboratorFeedback(input: unknown) {
  const data = RequestSchema.parse(input);
  const session = await requireSessionUser();
  await assertCanRequestForMentee(data.menteeId, session);

  const uniqueIds = [...new Set(data.collaboratorIds)].filter(
    (id) => id !== data.menteeId && id !== session.id,
  );
  if (uniqueIds.length === 0) {
    throw new Error("Pick at least one person to ask.");
  }

  const [mentee, collaborators] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.menteeId },
      select: { id: true, name: true, archivedAt: true },
    }),
    prisma.user.findMany({
      where: { id: { in: uniqueIds }, archivedAt: null },
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!mentee || mentee.archivedAt) throw new Error("Person not found.");
  if (collaborators.length === 0) throw new Error("No valid recipients found.");

  const month = monthStart(new Date());
  const dueAt = new Date(Date.now() + 14 * 86_400_000);
  const note = data.note?.trim() || null;
  const menteeName = mentee.name?.trim() || "your colleague";
  const requesterName = session.name?.trim() || "A mentor";
  const contextItems: Prisma.InputJsonValue = [
    {
      type: MENTORSHIP_COLLABORATOR_CONTEXT_TYPE,
      id: data.menteeId,
      title: "Mentor-requested colleague feedback",
      detail: note,
    },
  ];

  let created = 0;
  let refreshed = 0;
  let alreadySubmitted = 0;

  for (const collab of collaborators) {
    const existing = await prisma.feedbackRequest.findUnique({
      where: {
        subjectUserId_collaboratorId_month: {
          subjectUserId: data.menteeId,
          collaboratorId: collab.id,
          month,
        },
      },
      select: { id: true, submittedAt: true, cancelledAt: true },
    });

    if (existing?.submittedAt) {
      alreadySubmitted += 1;
      continue;
    }

    if (existing) {
      await prisma.feedbackRequest.update({
        where: { id: existing.id },
        data: {
          cancelledAt: null,
          requestedById: session.id,
          reason: note,
          contextItems,
          dueAt,
        },
      });
      refreshed += 1;
    } else {
      await prisma.feedbackRequest.create({
        data: {
          subjectUserId: data.menteeId,
          collaboratorId: collab.id,
          month,
          requestedById: session.id,
          reason: note,
          contextItems,
          dueAt,
        },
      });
      created += 1;
    }

    await createNotification({
      userId: collab.id,
      type: "MENTOR_FEEDBACK",
      title: `Feedback requested for ${menteeName}`,
      body: `${requesterName} asked for your notes on ${menteeName}. Open People → tap their name to write.`,
      link: `/people/${data.menteeId}?giveFeedback=1`,
    });
  }

  revalidatePath(`/mentorship/people/${data.menteeId}`);
  revalidatePath(`/people/${data.menteeId}`);
  revalidatePath("/people/directory");
  revalidatePath("/mentorship");

  return {
    ok: true as const,
    created,
    refreshed,
    alreadySubmitted,
    notified: created + refreshed,
  };
}

export async function submitCollaboratorFeedback(input: unknown) {
  const data = SubmitSchema.parse(input);
  const session = await requireSessionUser();

  const request = await prisma.feedbackRequest.findUnique({
    where: { id: data.requestId },
    select: {
      id: true,
      subjectUserId: true,
      collaboratorId: true,
      requestedById: true,
      submittedAt: true,
      cancelledAt: true,
      contextItems: true,
      subjectUser: { select: { name: true } },
    },
  });

  if (!request || request.collaboratorId !== session.id) {
    throw new Error("Feedback request not found.");
  }
  if (request.cancelledAt) {
    throw new Error("This request was withdrawn.");
  }
  if (request.submittedAt) {
    throw new Error("You already submitted feedback for this request.");
  }
  if (!isMentorshipCollaboratorContext(request.contextItems)) {
    throw new Error("This request cannot be answered here.");
  }

  const source = sourceForCollaborator(session.primaryRole);
  const now = new Date();

  await prisma.$transaction([
    prisma.feedbackRequest.update({
      where: { id: request.id },
      data: {
        responseBody: data.comment,
        submittedAt: now,
      },
    }),
    prisma.instructorReceivedFeedback.create({
      data: {
        instructorId: request.subjectUserId,
        source,
        feedbackDate: now,
        category: data.category,
        rating: data.rating,
        comment: data.comment,
        createdById: session.id,
      },
    }),
  ]);

  const subjectName = request.subjectUser.name?.trim() || "them";
  if (request.requestedById && request.requestedById !== session.id) {
    await createNotification({
      userId: request.requestedById,
      type: "MENTOR_FEEDBACK",
      title: `Feedback received for ${subjectName}`,
      body: `${session.name?.trim() || "A colleague"} shared notes about ${subjectName}.`,
      link: `/mentorship/people/${request.subjectUserId}?section=feedback`,
    });
  }

  revalidatePath(`/people/${request.subjectUserId}`);
  revalidatePath(`/mentorship/people/${request.subjectUserId}`);
  revalidatePath("/people/directory");
  revalidatePath("/mentorship");

  return { ok: true as const };
}
