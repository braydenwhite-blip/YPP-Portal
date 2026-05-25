/**
 * Server-side resolver that produces a complete "leadership context" for
 * the current user. Combines:
 *   - the user's identity & primary role
 *   - their instructor subtype (Standard vs. Summer Workshop)
 *   - mentorship membership (mentee + mentor counts)
 *   - whether they chair a committee or hold an admin/org role
 *   - their current and next leadership stage
 *   - their primary mentor (if any) and the instructors they currently mentor
 *
 * Used by the My Mentor page, profile page, G&R page, and the Leadership
 * Pathway page so role visibility stays consistent across the portal.
 */

import { prisma } from "@/lib/prisma";
import {
  LEADERSHIP_STAGES,
  LeadershipStage,
  LeadershipStageId,
  MENTORSHIP_PATTERN,
  getNextStage,
  inferLeadershipStage,
} from "@/lib/leadership-pathway";

export interface LeadershipMentorView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  primaryRole: string;
  chapterName: string | null;
  stage: LeadershipStage | null;
  /** Role description shown next to mentor name ("Senior Instructor", "Chapter President"). */
  roleLabel: string;
  /** Mentorship relationship id, for follow-up actions. */
  mentorshipId: string;
  status: string;
  trackName: string | null;
  kickoffCompletedAt: string | null;
  /** Last completed session, for the "last connected" warmth indicator. */
  lastSessionAt: string | null;
}

export interface LeadershipMenteeView {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  chapterName: string | null;
  stage: LeadershipStage | null;
  roleLabel: string;
  mentorshipId: string;
  kickoffCompletedAt: string | null;
}

export interface LeadershipContext {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    chapterName: string | null;
    primaryRole: string;
    instructorSubtype: "STANDARD" | "SUMMER_WORKSHOP" | null;
  };
  signals: {
    isMentee: boolean;
    isMentor: boolean;
    menteeCount: number;
    isCommitteeChair: boolean;
    isOrgLeader: boolean;
  };
  /** Full stage record (color tokens, mission, focus areas). */
  stage: LeadershipStage | null;
  /** Stage id — convenience for callers that only need the discriminator. */
  stageId: LeadershipStageId | null;
  /** Full next-stage record (if applicable). */
  nextStage: LeadershipStage | null;
  /** Next stage id — convenience for callers that only need the discriminator. */
  nextStageId: LeadershipStageId | null;
  mentorshipPattern: string | null;
  /** The primary mentor for this user (if they're being mentored). */
  primaryMentor: LeadershipMentorView | null;
  /** Instructors this user mentors (if they mentor anyone). */
  mentees: LeadershipMenteeView[];
}

function roleLabelFor(stage: LeadershipStage | null, primaryRole: string): string {
  if (stage) return stage.label;
  if (primaryRole === "CHAPTER_PRESIDENT") return "Chapter President";
  if (primaryRole === "ADMIN") return "Admin";
  if (primaryRole === "STAFF") return "Staff";
  if (primaryRole === "INSTRUCTOR") return "Instructor";
  return primaryRole.charAt(0) + primaryRole.slice(1).toLowerCase();
}

async function lookupInstructorSubtype(
  userId: string
): Promise<"STANDARD" | "SUMMER_WORKSHOP" | null> {
  try {
    const app = await prisma.instructorApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      select: { instructorSubtype: true },
    });
    return app?.instructorSubtype ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the leadership context for a given user.
 * Safe to call from any RSC; performs at most a handful of small queries.
 */
export async function getLeadershipContext(
  userId: string
): Promise<LeadershipContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      primaryRole: true,
      chapter: { select: { name: true } },
    },
  });
  if (!user) return null;

  // Run lightweight checks in parallel to keep the page snappy.
  const [
    instructorSubtype,
    menteeMentorship,
    mentorPairings,
    committeeChairCount,
  ] = await Promise.all([
    lookupInstructorSubtype(userId),
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        id: true,
        status: true,
        kickoffCompletedAt: true,
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            primaryRole: true,
            chapter: { select: { name: true } },
          },
        },
        track: { select: { name: true } },
        sessions: {
          where: { completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    }),
    prisma.mentorship.findMany({
      where: { mentorId: userId, status: "ACTIVE" },
      select: {
        id: true,
        kickoffCompletedAt: true,
        mentee: {
          select: {
            id: true,
            name: true,
            email: true,
            primaryRole: true,
            chapter: { select: { name: true } },
          },
        },
      },
      take: 50,
    }),
    prisma.mentorCommittee
      .count({ where: { chairUserId: userId } })
      .catch(() => 0),
  ]);

  // Resolve mentor's own stage so we can show "Sarah Lin — Senior Instructor"
  // wherever the mentor's name appears.
  let primaryMentor: LeadershipMentorView | null = null;
  if (menteeMentorship?.mentor) {
    const mentorSignals = await resolveStageSignals(menteeMentorship.mentor.id, {
      primaryRole: menteeMentorship.mentor.primaryRole,
    });
    const mentorStage = inferLeadershipStage(mentorSignals);
    const mentorStageObj = mentorStage ? LEADERSHIP_STAGES[mentorStage] : null;
    primaryMentor = {
      id: menteeMentorship.mentor.id,
      name: menteeMentorship.mentor.name,
      email: menteeMentorship.mentor.email,
      phone: menteeMentorship.mentor.phone,
      primaryRole: menteeMentorship.mentor.primaryRole,
      chapterName: menteeMentorship.mentor.chapter?.name ?? null,
      stage: mentorStageObj,
      roleLabel: roleLabelFor(mentorStageObj, menteeMentorship.mentor.primaryRole),
      mentorshipId: menteeMentorship.id,
      status: menteeMentorship.status,
      trackName: menteeMentorship.track?.name ?? null,
      kickoffCompletedAt:
        menteeMentorship.kickoffCompletedAt?.toISOString() ?? null,
      lastSessionAt:
        menteeMentorship.sessions[0]?.completedAt?.toISOString() ?? null,
    };
  }

  // Resolve mentee stages in batch — keeps the My Mentor page warm without
  // turning the request into a fan-out.
  const mentees: LeadershipMenteeView[] = await Promise.all(
    mentorPairings.map(async (pair) => {
      const sig = await resolveStageSignals(pair.mentee.id, {
        primaryRole: pair.mentee.primaryRole,
      });
      const stageId = inferLeadershipStage(sig);
      const stageObj = stageId ? LEADERSHIP_STAGES[stageId] : null;
      return {
        id: pair.mentee.id,
        name: pair.mentee.name,
        email: pair.mentee.email,
        primaryRole: pair.mentee.primaryRole,
        chapterName: pair.mentee.chapter?.name ?? null,
        stage: stageObj,
        roleLabel: roleLabelFor(stageObj, pair.mentee.primaryRole),
        mentorshipId: pair.id,
        kickoffCompletedAt: pair.kickoffCompletedAt?.toISOString() ?? null,
      };
    })
  );

  const signals = {
    isMentee: !!menteeMentorship,
    isMentor: mentorPairings.length > 0,
    menteeCount: mentorPairings.length,
    isCommitteeChair: committeeChairCount > 0,
    isOrgLeader: user.primaryRole === "ADMIN" || user.primaryRole === "STAFF",
  };
  const stageId = inferLeadershipStage({
    primaryRole: user.primaryRole,
    instructorSubtype,
    ...signals,
  });
  const stage = stageId ? LEADERSHIP_STAGES[stageId] : null;
  const nextStage = getNextStage(stageId);
  const nextStageId = nextStage?.id ?? null;
  const mentorshipPattern = stageId ? MENTORSHIP_PATTERN[stageId] : null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      chapterName: user.chapter?.name ?? null,
      primaryRole: user.primaryRole,
      instructorSubtype,
    },
    signals,
    stage,
    stageId,
    nextStage,
    nextStageId,
    mentorshipPattern,
    primaryMentor,
    mentees,
  };
}

interface StageSignalSeed {
  primaryRole: string;
}

/**
 * Lighter-weight stage signal resolver used when we only need to label a
 * single other user (e.g. the current user's mentor). Avoids loading the
 * full LeadershipContext for that user.
 */
async function resolveStageSignals(
  userId: string,
  seed: StageSignalSeed
): Promise<{
  primaryRole: string;
  instructorSubtype: "STANDARD" | "SUMMER_WORKSHOP" | null;
  isMentor: boolean;
  isCommitteeChair: boolean;
  isOrgLeader: boolean;
}> {
  const [subtype, mentorCount, chairCount] = await Promise.all([
    lookupInstructorSubtype(userId),
    prisma.mentorship.count({
      where: { mentorId: userId, status: "ACTIVE" },
    }),
    prisma.mentorCommittee
      .count({ where: { chairUserId: userId } })
      .catch(() => 0),
  ]);
  return {
    primaryRole: seed.primaryRole,
    instructorSubtype: subtype,
    isMentor: mentorCount > 0,
    isCommitteeChair: chairCount > 0,
    isOrgLeader: seed.primaryRole === "ADMIN" || seed.primaryRole === "STAFF",
  };
}

/**
 * Compact serializer for passing the context to a client component.
 * Stages are referenced by id so the client can re-resolve copy from
 * the leadership-pathway config without prop bloat.
 */
export interface SerializedLeadershipContext {
  user: LeadershipContext["user"];
  signals: LeadershipContext["signals"];
  stageId: LeadershipStageId | null;
  nextStageId: LeadershipStageId | null;
  mentorshipPattern: string | null;
  primaryMentor: LeadershipMentorView | null;
  mentees: LeadershipMenteeView[];
}

export function serializeLeadershipContext(
  ctx: LeadershipContext
): SerializedLeadershipContext {
  return {
    user: ctx.user,
    signals: ctx.signals,
    stageId: ctx.stage?.id ?? null,
    nextStageId: ctx.nextStage?.id ?? null,
    mentorshipPattern: ctx.mentorshipPattern,
    primaryMentor: ctx.primaryMentor,
    mentees: ctx.mentees,
  };
}
