/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — mentor dashboard read model.
 *
 * Aggregates a mentor's assigned mentees, their goals, status, a suggested next
 * action, plus the mentor's own capacity and expertise summary. Read-only (plain
 * async, not `"use server"`). Answers: who am I mentoring, what do they need,
 * what's next, am I at capacity, is my profile complete.
 *
 * @deprecated Orphaned (zero consumers) — the live hub uses `getSimplifiedMentorKanban`.
 * Superseded by the unified Mentorship workspace (`lib/mentorship/workspace.ts`).
 * Scheduled for removal in the consolidation V2 cleanup; do not add new callers.
 */

import { prisma } from "@/lib/prisma";
import { EXPERTISE_PROFICIENCY_LABELS, isExpertiseProficiency } from "./constants";

export interface MentorNextAction {
  label: string;
  detail: string;
}

export interface MentorDashboardMentee {
  mentorshipId: string;
  menteeId: string;
  menteeName: string | null;
  menteeEmail: string;
  status: string;
  cycleStage: string;
  goals: string | null;
  careerGoal: string | null;
  leadershipGoal: string | null;
  interests: string[];
  preferredExpertise: string[];
  kickoffCompletedAt: string | null;
  lastActivityAt: string | null;
  isComplete: boolean;
  nextAction: MentorNextAction;
}

export interface MentorDashboard {
  capacity: {
    activeLoad: number;
    capacity: number | null;
    openSlots: number | null;
    atCapacity: boolean;
  };
  expertise: { slug: string; name: string; proficiencyLabel: string | null }[];
  hasAvailability: boolean;
  mentees: MentorDashboardMentee[];
}

const STALE_AFTER_DAYS = 30;

/** Suggested next responsibility for a mentee, from the mentorship's state. */
export function deriveMentorNextAction(input: {
  status: string;
  kickoffCompletedAt: Date | null;
  lastActivityAt: Date | null;
  now?: Date;
}): MentorNextAction {
  const now = input.now ?? new Date();
  if (input.status === "COMPLETE") {
    return {
      label: "Graduate to Alumni",
      detail: "Wrap up and move this mentee into the Alumni network.",
    };
  }
  if (input.status === "PAUSED") {
    return {
      label: "Resume or close",
      detail: "This mentorship is paused — restart it or complete it.",
    };
  }
  if (!input.kickoffCompletedAt) {
    return {
      label: "Hold the kickoff",
      detail: "Schedule and complete your first kickoff meeting.",
    };
  }
  const stale =
    !input.lastActivityAt ||
    now.getTime() - input.lastActivityAt.getTime() >
      STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  if (stale) {
    return {
      label: "Check in",
      detail: "It's been a while — log a session or leave a note.",
    };
  }
  return {
    label: "Keep momentum",
    detail: "Review their goals and plan the next session.",
  };
}

function maxDate(...dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  }
  return best;
}

/** Build the full mentor dashboard read model for a user. */
export async function getMentorDashboard(userId: string): Promise<MentorDashboard> {
  const [mentorships, profile, expertise] = await Promise.all([
    prisma.mentorship.findMany({
      where: { mentorId: userId, status: { in: ["ACTIVE", "PAUSED", "COMPLETE"] } },
      select: {
        id: true,
        status: true,
        cycleStage: true,
        kickoffCompletedAt: true,
        endDate: true,
        mentee: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: { select: { careerGoal: true, leadershipGoal: true } },
            mentorshipApplicationsSubmitted: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { goals: true, interests: true, preferredExpertise: true },
            },
          },
        },
        sessions: {
          orderBy: { scheduledAt: "desc" },
          take: 1,
          select: { scheduledAt: true, completedAt: true },
        },
        checkIns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: { mentorCapacity: true, mentorAvailability: true },
    }),
    prisma.mentorExpertise.findMany({
      where: { userId },
      include: { expertiseArea: { select: { slug: true, name: true, isActive: true } } },
      orderBy: { expertiseArea: { sortOrder: "asc" } },
    }),
  ]);

  const activeLoad = mentorships.filter((m) => m.status === "ACTIVE").length;
  const capacity = profile?.mentorCapacity ?? null;

  const mentees: MentorDashboardMentee[] = mentorships.map((m) => {
    const latestSession = m.sessions[0];
    const lastActivityAt = maxDate(
      latestSession?.completedAt,
      latestSession?.scheduledAt,
      m.checkIns[0]?.createdAt
    );
    const application = m.mentee?.mentorshipApplicationsSubmitted[0] ?? null;
    return {
      mentorshipId: m.id,
      menteeId: m.mentee?.id ?? "",
      menteeName: m.mentee?.name ?? null,
      menteeEmail: m.mentee?.email ?? "",
      status: m.status,
      cycleStage: m.cycleStage,
      goals: application?.goals ?? null,
      careerGoal: m.mentee?.profile?.careerGoal ?? null,
      leadershipGoal: m.mentee?.profile?.leadershipGoal ?? null,
      interests: application?.interests ?? [],
      preferredExpertise: application?.preferredExpertise ?? [],
      kickoffCompletedAt: m.kickoffCompletedAt
        ? m.kickoffCompletedAt.toISOString()
        : null,
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      isComplete: m.status === "COMPLETE",
      nextAction: deriveMentorNextAction({
        status: m.status,
        kickoffCompletedAt: m.kickoffCompletedAt,
        lastActivityAt,
      }),
    };
  });

  return {
    capacity: {
      activeLoad,
      capacity,
      openSlots: capacity != null ? capacity - activeLoad : null,
      atCapacity: capacity != null ? activeLoad >= capacity : false,
    },
    expertise: expertise
      .filter((e) => e.expertiseArea.isActive)
      .map((e) => ({
        slug: e.expertiseArea.slug,
        name: e.expertiseArea.name,
        proficiencyLabel:
          e.proficiency && isExpertiseProficiency(e.proficiency)
            ? EXPERTISE_PROFICIENCY_LABELS[e.proficiency]
            : null,
      })),
    hasAvailability: Boolean(
      profile?.mentorAvailability && profile.mentorAvailability.trim()
    ),
    mentees,
  };
}
