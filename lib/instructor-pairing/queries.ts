// Instructor Pairing cockpit — server data loader.
//
// Loads class-offering coverage + the accepted-applicant placement queue in a
// few batched queries, computes deterministic match suggestions over one shared
// candidate pool, and returns a fully-built cockpit plus the instructor picker
// pool the pair drawer needs. Read-only.

import { prisma } from "@/lib/prisma";
import { getInstructorReadinessMany } from "@/lib/instructor-readiness";
import { buildInstructorMatchSuggestions, type PairingCandidate } from "./suggestions";
import { buildInstructorPairingCockpit } from "./cockpit";
import type {
  AcceptedUnplacedInstructor,
  PairingCockpit,
  PairingUnit,
} from "./types";

/** Assignment statuses that count as "covering" the offering (in-flight or confirmed). */
const ACTIVE_COVERAGE = [
  "OFFERED",
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
] as const;

export type InstructorPickOption = {
  id: string;
  name: string;
  chapterName: string | null;
  trained: boolean;
  activeLoad: number;
};

export type PairingCockpitViewer = {
  id: string;
  roles: string[];
  chapterId?: string | null;
};

export type PairingCockpitData = {
  cockpit: PairingCockpit;
  instructorPool: InstructorPickOption[];
};

function chapterScoped(viewer: PairingCockpitViewer): string | null {
  const orgWide = viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF");
  if (orgWide) return null;
  if (viewer.roles.includes("CHAPTER_PRESIDENT") && viewer.chapterId) return viewer.chapterId;
  return null;
}

export async function loadInstructorPairingCockpitData(
  viewer: PairingCockpitViewer,
  now: Date = new Date(),
): Promise<PairingCockpitData> {
  const scopeChapterId = chapterScoped(viewer);

  const [offerings, instructorUsers] = await Promise.all([
    prisma.classOffering.findMany({
      where: {
        status: { in: ["DRAFT", "PUBLISHED", "IN_PROGRESS"] },
        ...(scopeChapterId ? { chapterId: scopeChapterId } : {}),
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        title: true,
        startDate: true,
        status: true,
        template: { select: { interestArea: true, targetAgeGroup: true } },
        instructor: { select: { id: true, name: true } },
        partner: {
          select: {
            id: true,
            name: true,
            relationshipLeadId: true,
            relationshipLead: { select: { name: true } },
          },
        },
        chapter: { select: { id: true, name: true } },
        regularInstructorAssignments: {
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            role: true,
            status: true,
            instructor: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { archivedAt: null, roles: { some: { role: "INSTRUCTOR" } } },
      select: {
        id: true,
        name: true,
        chapterId: true,
        chapter: { select: { name: true } },
        profile: { select: { interests: true } },
      },
      orderBy: { name: "asc" },
      take: 600,
    }),
  ]);

  const instructorIds = instructorUsers.map((i) => i.id);
  const [readinessMap, loadCounts] = await Promise.all([
    getInstructorReadinessMany(instructorIds),
    prisma.regularInstructorAssignment.groupBy({
      by: ["instructorId"],
      where: { instructorId: { in: instructorIds }, status: { in: [...ACTIVE_COVERAGE] } },
      _count: { _all: true },
    }),
  ]);

  const loadById = new Map<string, number>();
  for (const row of loadCounts) loadById.set(row.instructorId, row._count?._all ?? 0);

  const candidates: PairingCandidate[] = instructorUsers.map((u) => {
    const r = readinessMap.get(u.id);
    return {
      id: u.id,
      name: u.name,
      chapterId: u.chapterId,
      interests: u.profile?.interests ?? [],
      baseReady: Boolean(r?.baseReadinessComplete),
      trained: Boolean(r?.trainingComplete),
      activeLoad: loadById.get(u.id) ?? 0,
    };
  });

  const legacyLeadIds = new Set(offerings.map((o) => o.instructor?.id).filter(Boolean) as string[]);

  const units: PairingUnit[] = offerings.map((o) => {
    const assignments = o.regularInstructorAssignments.map((a) => ({
      id: a.id,
      instructorId: a.instructor.id,
      instructorName: a.instructor.name,
      role: a.role,
      status: a.status as string,
    }));
    const subject = o.template?.interestArea ?? null;
    const suggestions = buildInstructorMatchSuggestions(
      { subject, chapterId: o.chapter?.id ?? null },
      candidates,
      3,
    );
    return {
      offeringId: o.id,
      title: o.title,
      subject,
      ageGroup: o.template?.targetAgeGroup ?? null,
      partnerId: o.partner?.id ?? null,
      partnerName: o.partner?.name ?? null,
      chapterId: o.chapter?.id ?? null,
      chapterName: o.chapter?.name ?? null,
      ownerId: o.partner?.relationshipLeadId ?? null,
      ownerName: o.partner?.relationshipLead?.name ?? null,
      startDate: o.startDate,
      offeringStatus: o.status as string,
      slotsNeeded: 1,
      legacyLeadId: o.instructor?.id ?? null,
      legacyLeadName: o.instructor?.name ?? null,
      assignments,
      suggestions,
    };
  });

  // Accepted but unplaced: placeable instructors not leading or assigned to any
  // active class. We surface trained/ready idle instructors (the actionable set).
  const acceptedUnplaced: AcceptedUnplacedInstructor[] = candidates
    .filter((c) => c.activeLoad === 0 && !legacyLeadIds.has(c.id) && (c.trained || c.baseReady))
    .map((c) => ({
      instructorId: c.id,
      name: c.name,
      chapterName: instructorUsers.find((u) => u.id === c.id)?.chapter?.name ?? null,
      readinessLabel: c.baseReady ? "Ready instructor" : "Training complete",
      trained: c.trained || c.baseReady,
      waitingDays: 0,
    }))
    .slice(0, 24);

  const cockpit = buildInstructorPairingCockpit({ units, acceptedUnplaced }, now);

  const instructorPool: InstructorPickOption[] = candidates
    .map((c) => ({
      id: c.id,
      name: c.name,
      chapterName: instructorUsers.find((u) => u.id === c.id)?.chapter?.name ?? null,
      trained: c.trained || c.baseReady,
      activeLoad: c.activeLoad,
    }))
    .sort((a, b) => {
      if (a.activeLoad !== b.activeLoad) return a.activeLoad - b.activeLoad;
      return a.name.localeCompare(b.name);
    });

  return { cockpit, instructorPool };
}
