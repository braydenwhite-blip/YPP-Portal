"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { emitGrowthEvent } from "@/lib/growth/emit";
import {
  parseSuggestedActions,
  type SuggestPerson,
} from "@/lib/people-strategy/notes-to-actions";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

import { hasMentorshipCommandAccess } from "./command-access";
import {
  RecordCheckInSchema,
  composeNotesSummary,
  kindLabel,
  type RecordCheckInInput,
} from "./check-in-schema";

/**
 * Record a conversation record inside Mentorship — the single write path for a
 * logged check-in / meeting / conversation between a leader and a person, and
 * for a mentee's own progress check-in.
 *
 * Writes the structured MentorshipCheckIn (person-anchored), emits a durable
 * timeline event (dark until ENABLE_GROWTH_OS), and turns the SUBJECT's own
 * commitments into follow-up GrowthActions — so nothing needs duplicate entry.
 * Isolated from the monthly review/points/award pipeline: it never touches
 * MentorGoalReview, AchievementPointLog, or AwardNomination.
 */

/**
 * Commitments → follow-up GrowthActions for the SUBJECT. Best-effort, idempotent
 * per (checkInId, index), Growth-OS-gated, attached to the person's mentorship
 * development goal. Only the subject's own (or unassigned) commitments become
 * their development actions — a "Mentor will…" commitment is skipped, never
 * mis-filed as the mentee's action. A failure here never fails the check-in.
 */
async function maybeCreateCommitmentActions(
  userId: string,
  checkInId: string,
  commitments: string | null | undefined,
  occurredAt: Date,
  people: SuggestPerson[]
): Promise<void> {
  if (!isGrowthOsEnabled() || !commitments) return;
  try {
    const suggested = parseSuggestedActions({
      notes: commitments,
      people,
      meetingDateISO: occurredAt.toISOString(),
    });
    if (suggested.length === 0) return;

    const goal = await prisma.growthGoal.findFirst({
      where: { userId, track: "MENTORSHIP", status: "ACTIVE" },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!goal) return;

    for (const [index, suggestion] of suggested.entries()) {
      // Only the subject's own (or unassigned) commitments are their actions.
      if (suggestion.ownerId && suggestion.ownerId !== userId) continue;
      const sourceRef = `${checkInId}:${index}`;
      const existing = await prisma.growthAction.findFirst({
        where: { userId, source: "mentorship-checkin", sourceRef },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.growthAction.create({
        data: {
          userId,
          goalId: goal.id,
          title: suggestion.title,
          source: "mentorship-checkin",
          sourceRef,
          dueDate: suggestion.dueDateISO ? new Date(suggestion.dueDateISO) : null,
        },
      });
    }
  } catch (error) {
    console.error("[recordCheckIn] commitment follow-ups failed:", error);
  }
}

export async function recordCheckIn(input: RecordCheckInInput) {
  const viewer = await requireSessionUser();
  const data = RecordCheckInSchema.parse(input);

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: data.mentorshipId },
    select: {
      id: true,
      status: true,
      mentorId: true,
      chairId: true,
      menteeId: true,
      mentee: { select: { name: true } },
      mentor: { select: { name: true } },
      chair: { select: { name: true } },
    },
  });
  if (!mentorship) throw new Error("Mentorship not found.");
  if (mentorship.status !== "ACTIVE") {
    throw new Error("This mentorship is no longer active.");
  }
  if (mentorship.menteeId !== data.subjectId) {
    throw new Error("This check-in does not belong to that person.");
  }

  const isAdmin = viewer.roles.includes("ADMIN");
  const isRelationshipOwner =
    viewer.id === mentorship.mentorId || viewer.id === mentorship.chairId;
  const isSubject = viewer.id === mentorship.menteeId;
  const canRecord =
    isAdmin || isRelationshipOwner || isSubject || (await hasMentorshipCommandAccess(viewer));
  if (!canRecord) {
    throw new Error("You don't have access to record a check-in for this person.");
  }

  // Participants are restricted to the relationship's members + the author, so a
  // conversation record can never surface content to a non-participant.
  const allowedParticipants = new Set(
    [mentorship.mentorId, mentorship.menteeId, mentorship.chairId, viewer.id].filter(
      (id): id is string => Boolean(id)
    )
  );
  const participantIds = Array.from(
    new Set(data.participantIds.filter((id) => allowedParticipants.has(id)))
  );

  const occurredAt = data.occurredAt ?? new Date();

  const checkIn = await prisma.mentorshipCheckIn.create({
    data: {
      subjectId: data.subjectId,
      mentorshipId: data.mentorshipId,
      authorId: viewer.id,
      kind: data.kind,
      notes: composeNotesSummary(data),
      rating: data.rating ?? null,
      wins: data.wins ?? null,
      challenges: data.challenges ?? null,
      discussion: data.discussion ?? null,
      decisions: data.decisions ?? null,
      commitments: data.commitments ?? null,
      participantIds,
      followUpDate: data.followUpDate ?? null,
      occurredAt,
    },
    select: { id: true },
  });

  // Durable per-person activity log (no-op unless ENABLE_GROWTH_OS). Idempotent
  // on (subject, "MENTORSHIP_CHECK_IN:<checkInId>").
  await emitGrowthEvent({
    userId: data.subjectId,
    type: "MENTORSHIP_CHECK_IN",
    title: `${kindLabel(data.kind)} logged`,
    sourceType: "mentorship-checkin",
    sourceId: checkIn.id,
    occurredAt,
  });

  // Owner resolution for commitment → action (so "Mentor will…" isn't mis-filed).
  const people: SuggestPerson[] = [
    { id: mentorship.menteeId, name: mentorship.mentee?.name ?? "" },
    { id: mentorship.mentorId, name: mentorship.mentor?.name ?? "" },
    ...(mentorship.chairId
      ? [{ id: mentorship.chairId, name: mentorship.chair?.name ?? "" }]
      : []),
  ].filter((p) => p.name.length > 0);

  await maybeCreateCommitmentActions(
    data.subjectId,
    checkIn.id,
    data.commitments,
    occurredAt,
    people
  );

  // Let the mentee know their leader logged a check-in (never for self-authored).
  if (viewer.id !== mentorship.menteeId) {
    await createMentorshipNotification({
      userId: mentorship.menteeId,
      title: `New ${kindLabel(data.kind).toLowerCase()} logged`,
      body: `${viewer.name ?? "Your mentor"} logged a ${kindLabel(
        data.kind
      ).toLowerCase()} for you.`,
      link: `/mentorship/people/${data.subjectId}?section=check-ins`,
    }).catch(() => {});
  }

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/people/${data.subjectId}`);
  return { ok: true as const, checkInId: checkIn.id };
}
