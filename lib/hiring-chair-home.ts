import { prisma } from "@/lib/prisma";
import { InstructorApplicationStatus } from "@prisma/client";

const PENDING_LIMIT = 5;
const RECENT_DECISIONS_LIMIT = 5;
const RECENT_WINDOW_DAYS = 14;

export interface HiringChairPendingApplication {
  id: string;
  displayName: string;
  chapterName: string | null;
  chairQueuedAt: Date | null;
  daysInQueue: number | null;
}

export interface HiringChairRecentDecision {
  id: string;
  applicationId: string;
  displayName: string;
  chapterName: string | null;
  action: string;
  decidedAt: Date;
  chairName: string | null;
  isMine: boolean;
}

export interface HiringChairHomeData {
  pendingTotal: number;
  oldestWaiting: HiringChairPendingApplication | null;
  pending: HiringChairPendingApplication[];
  decisionsThisWeek: number;
  myDecisionsThisWeek: number;
  recentDecisions: HiringChairRecentDecision[];
}

function deriveDisplayName(app: {
  preferredFirstName: string | null;
  legalName: string | null;
  applicant: { name: string | null } | null;
}): string {
  return (
    app.preferredFirstName ??
    app.legalName ??
    app.applicant?.name ??
    "Applicant"
  );
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0..6, Sun..Sat
  // Monday-start week: subtract (day === 0 ? 6 : day - 1) days.
  const back = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - back);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the data the Hiring Chair home view renders. Falls back gracefully
 * to a zero-filled object if the underlying tables are missing (P2021), so
 * a fresh / partially-migrated DB still renders the chair shell instead of
 * 500-ing the home page.
 */
export async function getHiringChairHomeData(actorId: string): Promise<HiringChairHomeData> {
  try {
    const weekStart = startOfWeek();
    const recentSince = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000);

    const [pendingRows, pendingTotal, decisionsThisWeek, myDecisionsThisWeek, recentDecisionRows] =
      await Promise.all([
        prisma.instructorApplication.findMany({
          where: { status: InstructorApplicationStatus.CHAIR_REVIEW },
          orderBy: [{ chairQueuedAt: "asc" }, { createdAt: "asc" }],
          take: PENDING_LIMIT,
          select: {
            id: true,
            preferredFirstName: true,
            legalName: true,
            chairQueuedAt: true,
            applicant: {
              select: { name: true, chapter: { select: { name: true } } },
            },
          },
        }),
        prisma.instructorApplication.count({
          where: { status: InstructorApplicationStatus.CHAIR_REVIEW },
        }),
        prisma.instructorApplicationChairDecision.count({
          where: { supersededAt: null, decidedAt: { gte: weekStart } },
        }),
        prisma.instructorApplicationChairDecision.count({
          where: {
            supersededAt: null,
            decidedAt: { gte: weekStart },
            chairId: actorId,
          },
        }),
        prisma.instructorApplicationChairDecision.findMany({
          where: { supersededAt: null, decidedAt: { gte: recentSince } },
          orderBy: { decidedAt: "desc" },
          take: RECENT_DECISIONS_LIMIT,
          select: {
            id: true,
            applicationId: true,
            action: true,
            decidedAt: true,
            chairId: true,
            chair: { select: { name: true } },
            application: {
              select: {
                preferredFirstName: true,
                legalName: true,
                applicant: {
                  select: { name: true, chapter: { select: { name: true } } },
                },
              },
            },
          },
        }),
      ]);

    const pending: HiringChairPendingApplication[] = pendingRows.map((row) => ({
      id: row.id,
      displayName: deriveDisplayName(row),
      chapterName: row.applicant?.chapter?.name ?? null,
      chairQueuedAt: row.chairQueuedAt,
      daysInQueue: daysSince(row.chairQueuedAt),
    }));

    const recentDecisions: HiringChairRecentDecision[] = recentDecisionRows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      displayName: deriveDisplayName(row.application),
      chapterName: row.application.applicant?.chapter?.name ?? null,
      action: row.action,
      decidedAt: row.decidedAt,
      chairName: row.chair?.name ?? null,
      isMine: row.chairId === actorId,
    }));

    return {
      pendingTotal,
      oldestWaiting: pending[0] ?? null,
      pending,
      decisionsThisWeek,
      myDecisionsThisWeek,
      recentDecisions,
    };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2021" || code === "P2022") {
      return {
        pendingTotal: 0,
        oldestWaiting: null,
        pending: [],
        decisionsThisWeek: 0,
        myDecisionsThisWeek: 0,
        recentDecisions: [],
      };
    }
    throw error;
  }
}
