import { prisma } from "@/lib/prisma";
import { getUserTitle } from "@/lib/user-title";

/**
 * People Strategy — mentorship health for the Leadership People Dashboard (#12).
 *
 * Read-only roll-up over the existing Mentorship models so leadership can see,
 * at a glance: how many active pairings exist, which ones are going stale
 * (no recent check-in, or a stalled cycle stage), and which instructors have no
 * mentor (coverage gaps). No schema changes — surfaces what already exists.
 */

const STALE_CHECK_IN_DAYS = 21;
// Cycle stages that mean a pairing is stuck waiting on action.
const STALLED_STAGES = new Set(["KICKOFF_PENDING", "CHANGES_REQUESTED"]);

export type MentorshipHealthPair = {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  reason: string;
};

export type MentorshipHealthMember = {
  id: string;
  name: string;
  title: string;
};

export type MentorshipHealth = {
  activePairs: number;
  atRisk: MentorshipHealthPair[];
  unmatchedCount: number;
  unmatched: MentorshipHealthMember[];
};

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export async function loadMentorshipHealth(
  now: Date = new Date()
): Promise<MentorshipHealth> {
  const pairs = await prisma.mentorship.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      cycleStage: true,
      mentor: { select: { id: true, name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true } },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const atRisk: MentorshipHealthPair[] = [];
  for (const p of pairs) {
    const lastCheckIn = p.checkIns[0]?.createdAt ?? null;
    const days = daysSince(lastCheckIn, now);
    let reason: string | null = null;
    if (days === null) reason = "No check-ins logged yet";
    else if (days > STALE_CHECK_IN_DAYS) reason = `${days}d since last check-in`;
    else if (STALLED_STAGES.has(p.cycleStage))
      reason = `Stalled · ${p.cycleStage.replace(/_/g, " ").toLowerCase()}`;

    if (reason) {
      atRisk.push({
        id: p.id,
        mentorId: p.mentor.id,
        mentorName: p.mentor.name ?? p.mentor.email,
        menteeId: p.mentee.id,
        menteeName: p.mentee.name ?? p.mentee.email,
        reason,
      });
    }
  }

  // Coverage gaps: active instructors with no active mentor pairing.
  const unmatchedUsers = await prisma.user.findMany({
    where: {
      archivedAt: null,
      primaryRole: "INSTRUCTOR",
      menteePairs: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      primaryRole: true,
      adminSubtypes: { select: { subtype: true } },
    },
    orderBy: [{ name: "asc" }],
    take: 200,
  });

  const unmatched: MentorshipHealthMember[] = unmatchedUsers.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    title: getUserTitle({
      title: u.title,
      primaryRole: u.primaryRole,
      adminSubtypes: u.adminSubtypes.map((s) => s.subtype),
    }),
  }));

  return {
    activePairs: pairs.length,
    atRisk,
    unmatchedCount: unmatched.length,
    unmatched: unmatched.slice(0, 12),
  };
}
