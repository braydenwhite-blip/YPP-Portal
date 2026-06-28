import "server-only";

// Class Runtime OS (Phase 5) — public class catalog loader. Returns only classes
// safe to advertise (reusing the canonical publicOfferingWhere filter, then the
// pure trust gate), shaped for the family-facing catalog + detail pages.

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { publicOfferingWhere } from "@/lib/class-visibility";
import { shortDate } from "@/lib/chapters/format";
import {
  isClassPubliclyAdvertisable,
  getSpotsRemaining,
  getSignupAvailability,
  type PublicClassInput,
  type SignupAvailability,
} from "@/lib/classes/public-catalog";

type CatalogRow = {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  meetingDays: string[];
  meetingTime: string | null;
  deliveryMode: string;
  locationName: string | null;
  room: string | null;
  capacity: number;
  enrollmentOpen: boolean;
  grandfatheredTrainingExemption: boolean;
  approval: { status: string } | null;
  chapter: { name: string | null } | null;
  template: { description: string | null; targetAgeGroup: string | null; learningOutcomes: string[] } | null;
  instructor: { name: string | null } | null;
  _count: { enrollments: number; sessions: number };
};

const CATALOG_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  meetingDays: true,
  meetingTime: true,
  deliveryMode: true,
  locationName: true,
  room: true,
  capacity: true,
  enrollmentOpen: true,
  grandfatheredTrainingExemption: true,
  approval: { select: { status: true } },
  chapter: { select: { name: true } },
  template: { select: { description: true, targetAgeGroup: true, learningOutcomes: true } },
  instructor: { select: { name: true } },
  _count: { select: { enrollments: true, sessions: true } },
};

function scheduleLabel(o: CatalogRow): string {
  if (o.meetingDays.length === 0 || !o.meetingTime) return "Schedule TBD";
  return `${o.meetingDays.join(", ")} · ${o.meetingTime}`;
}
function locationLabel(o: CatalogRow): string {
  if (o.deliveryMode === "VIRTUAL") return "Online";
  return o.room || o.locationName || "In person";
}
function shortDescription(text: string | null): string {
  if (!text) return "";
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 180 ? `${t.slice(0, 179)}…` : t;
}
function toPublicInput(o: CatalogRow): PublicClassInput {
  return {
    id: o.id,
    title: o.title,
    status: o.status,
    approvalStatus: o.approval?.status ?? null,
    grandfathered: o.grandfatheredTrainingExemption,
    enrollmentOpen: o.enrollmentOpen,
    capacity: o.capacity,
    enrolledCount: o._count.enrollments,
    startDate: o.startDate,
    hasDescription: !!o.template?.description && o.template.description.trim().length > 0,
    hasSchedule: o.meetingDays.length > 0 && !!o.meetingTime,
  };
}

export type PublicCatalogCard = {
  id: string;
  title: string;
  shortDescription: string;
  ageRange: string | null;
  scheduleLabel: string;
  locationLabel: string;
  startDateLabel: string;
  chapterName: string | null;
  sessionsCount: number;
  spotsRemaining: number | null;
  availability: SignupAvailability;
};

export async function getPublicCatalog(): Promise<PublicCatalogCard[]> {
  const rows = (await withPrismaFallback(
    "public-catalog:list",
    () =>
      prisma.classOffering.findMany({
        where: { ...publicOfferingWhere(), enrollmentOpen: true },
        orderBy: { startDate: "asc" },
        take: 200,
        select: CATALOG_SELECT,
      }) as unknown as Promise<CatalogRow[]>,
    []
  )) as CatalogRow[];

  return rows
    .filter((o) => isClassPubliclyAdvertisable(toPublicInput(o)))
    .map((o) => {
      const input = toPublicInput(o);
      return {
        id: o.id,
        title: o.title,
        shortDescription: shortDescription(o.template?.description ?? null),
        ageRange: o.template?.targetAgeGroup ?? null,
        scheduleLabel: scheduleLabel(o),
        locationLabel: locationLabel(o),
        startDateLabel: shortDate(o.startDate),
        chapterName: o.chapter?.name ?? null,
        sessionsCount: o._count.sessions,
        spotsRemaining: getSpotsRemaining(input),
        availability: getSignupAvailability(input),
      };
    });
}

export type PublicClassDetail = {
  id: string;
  title: string;
  description: string;
  learningOutcomes: string[];
  ageRange: string | null;
  scheduleLabel: string;
  locationLabel: string;
  startDateLabel: string;
  chapterName: string | null;
  instructorName: string | null;
  sessionsCount: number;
  spotsRemaining: number | null;
  availability: SignupAvailability;
};

export async function getPublicClassDetail(id: string): Promise<PublicClassDetail | null> {
  const o = (await withPrismaFallback(
    "public-catalog:detail",
    () =>
      prisma.classOffering.findFirst({
        where: { id, ...publicOfferingWhere() },
        select: CATALOG_SELECT,
      }) as unknown as Promise<CatalogRow | null>,
    null
  )) as CatalogRow | null;
  if (!o) return null;

  const input = toPublicInput(o);
  if (!isClassPubliclyAdvertisable(input)) return null;

  return {
    id: o.id,
    title: o.title,
    description: o.template?.description?.trim() ?? "",
    learningOutcomes: o.template?.learningOutcomes ?? [],
    ageRange: o.template?.targetAgeGroup ?? null,
    scheduleLabel: scheduleLabel(o),
    locationLabel: locationLabel(o),
    startDateLabel: shortDate(o.startDate),
    chapterName: o.chapter?.name ?? null,
    instructorName: o.instructor?.name ?? null,
    sessionsCount: o._count.sessions,
    spotsRemaining: getSpotsRemaining(input),
    availability: getSignupAvailability(input),
  };
}
