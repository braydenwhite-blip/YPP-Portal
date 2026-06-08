/**
 * Student Operating System / Growth Engine (Phase N1) — domain emit hooks.
 *
 * One-line, flag-gated, best-effort hooks the rest of the platform calls so a
 * call site never has to know the event vocabulary. Each just forwards to
 * emitGrowthEvent (a no-op unless ENABLE_GROWTH_OS). Wire more sites over time;
 * the engine consumes whatever is emitted.
 */

import { emitGrowthEvent } from "./emit";

export { onMentorMatched, seedGrowthFromMentorship } from "./mentorship-integration";

/** A completed mentorship → MENTORSHIP_COMPLETED (graduation). */
export async function onMentorshipCompleted(
  menteeUserId: string,
  mentorshipId: string
): Promise<void> {
  await emitGrowthEvent({
    userId: menteeUserId,
    type: "MENTORSHIP_COMPLETED",
    sourceType: "mentorship",
    sourceId: mentorshipId,
  });
}

/** A class was published by its instructor → CLASS_PUBLISHED. */
export async function onClassPublished(
  instructorId: string,
  offeringId: string,
  title?: string
): Promise<void> {
  await emitGrowthEvent({
    userId: instructorId,
    type: "CLASS_PUBLISHED",
    sourceType: "classOffering",
    sourceId: offeringId,
    title: title ? `Published "${title}"` : undefined,
  });
}

/** A class wrapped up → CLASS_COMPLETED. */
export async function onClassCompleted(
  instructorId: string,
  offeringId: string,
  title?: string
): Promise<void> {
  await emitGrowthEvent({
    userId: instructorId,
    type: "CLASS_COMPLETED",
    sourceType: "classOffering",
    sourceId: offeringId,
    title: title ? `Completed teaching "${title}"` : undefined,
  });
}

/** A certificate was earned → CERTIFICATE_EARNED. */
export async function onCertificateEarned(
  userId: string,
  certificateId: string,
  title?: string
): Promise<void> {
  await emitGrowthEvent({
    userId,
    type: "CERTIFICATE_EARNED",
    sourceType: "certificate",
    sourceId: certificateId,
    title: title ? `Earned "${title}"` : undefined,
  });
}

/** Someone joined a chapter → CHAPTER_JOINED. */
export async function onChapterJoined(
  userId: string,
  chapterId: string
): Promise<void> {
  await emitGrowthEvent({
    userId,
    type: "CHAPTER_JOINED",
    sourceType: "chapter",
    sourceId: chapterId,
  });
}

/** A chapter event was hosted → CHAPTER_EVENT_HOSTED (per host). */
export async function onChapterEventHosted(
  hostUserId: string,
  eventId: string,
  title?: string
): Promise<void> {
  await emitGrowthEvent({
    userId: hostUserId,
    type: "CHAPTER_EVENT_HOSTED",
    sourceType: "event",
    sourceId: eventId,
    title: title ? `Hosted "${title}"` : undefined,
  });
}

/** A leadership role was earned → LEADERSHIP_ROLE_EARNED. */
export async function onLeadershipRoleEarned(
  userId: string,
  roleKey: string,
  title?: string
): Promise<void> {
  await emitGrowthEvent({
    userId,
    type: "LEADERSHIP_ROLE_EARNED",
    sourceType: "role",
    sourceId: roleKey,
    title: title ? `Became ${title}` : undefined,
  });
}
