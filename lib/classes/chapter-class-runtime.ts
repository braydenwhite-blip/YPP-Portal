import "server-only";

// Class Runtime OS (Phase 5) — chapter-level runtime + interventions. Loads
// every (non-cancelled) class in a chapter, maps each onto the pure runtime +
// student-signal models (reusing the cockpit mappers), and returns the live
// interventions + a stage distribution. The Chapter OS merges these into the
// Live Classes / Student Community rooms, Needs You, and the Action Tracker.

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  OFFERING_SELECT,
  toRuntimeInput,
  toStudentSignalInputs,
  openIssueCounts,
  type OfferingRow,
} from "@/lib/classes/instructor-cockpit";
import { computeClassRuntime, type ClassRuntimeStage } from "@/lib/classes/class-runtime";
import { deriveClassInterventions, type ClassIntervention } from "@/lib/classes/interventions";

export type ChapterClassRuntime = {
  interventions: ClassIntervention[];
  stageCounts: Partial<Record<ClassRuntimeStage, number>>;
  liveCount: number;
  interventionCount: number;
};

export async function loadChapterClassRuntime(chapterId: string, now: Date): Promise<ChapterClassRuntime> {
  const offerings = (await withPrismaFallback(
    "chapter-class-runtime:offerings",
    () =>
      prisma.classOffering.findMany({
        where: { chapterId, status: { not: "CANCELLED" } },
        take: 200,
        select: OFFERING_SELECT,
      }) as unknown as Promise<OfferingRow[]>,
    []
  )) as OfferingRow[];

  const issues = await openIssueCounts(offerings.map((o) => o.id));

  const interventions: ClassIntervention[] = [];
  const stageCounts: Partial<Record<ClassRuntimeStage, number>> = {};
  let liveCount = 0;

  for (const o of offerings) {
    const input = { ...toRuntimeInput(o), openIssueCount: issues.get(o.id) ?? 0 };
    const runtime = computeClassRuntime(input, now);
    stageCounts[runtime.stage] = (stageCounts[runtime.stage] ?? 0) + 1;
    if (runtime.isLive) liveCount += 1;
    interventions.push(...deriveClassInterventions(input, toStudentSignalInputs(o), now));
  }

  return { interventions, stageCounts, liveCount, interventionCount: interventions.length };
}
