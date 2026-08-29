import "server-only";

import { applicantDetailHref } from "@/lib/applicant-board-kind";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { prisma } from "@/lib/prisma";

import {
  getHiringWaitlistOrder,
  mergeWaitlistOrder,
  setHiringWaitlistOrder,
} from "./order-store";
import {
  type HiringWaitlistEntry,
  type HiringWaitlistKind,
  waitlistKey,
} from "./types";

/**
 * Hire-queue pool: everyone who applied and is still waiting to be pulled
 * into interviews. Once selected, status moves into the interview pipeline
 * and they drop off this list automatically.
 */
const INSTRUCTOR_POOL = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "ON_HOLD",
  "WAITLISTED",
] as const;

const CP_POOL = [
  "SUBMITTED",
  "INITIAL_REVIEW",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "INFO_REQUESTED",
  "WAITLISTED",
] as const;

function toIso(d: Date | string | null | undefined): string {
  if (!d) return new Date(0).toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function roleLabelForInstructor(track: string | null | undefined): string {
  if (track === "SUMMER_WORKSHOP_INSTRUCTOR") return "Summer workshop instructor";
  return "Instructor";
}

async function loadInstructorPool(): Promise<HiringWaitlistEntry[]> {
  const rows = await prisma.instructorApplication.findMany({
    where: {
      status: { in: [...INSTRUCTOR_POOL] },
      archivedAt: null,
    },
    select: {
      id: true,
      subjectsOfInterest: true,
      applicationTrack: true,
      createdAt: true,
      updatedAt: true,
      legalName: true,
      preferredFirstName: true,
      lastName: true,
      applicant: {
        select: {
          name: true,
          email: true,
          chapter: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => {
    const kind: HiringWaitlistKind = "instructor";
    return {
      key: waitlistKey(kind, row.id),
      kind,
      id: row.id,
      name: formatApplicantDisplayName(row),
      email: row.applicant.email,
      roleLabel: roleLabelForInstructor(row.applicationTrack),
      subjects: row.subjectsOfInterest?.trim() || null,
      chapterName: row.applicant.chapter?.name ?? null,
      waitlistedAt: toIso(row.createdAt ?? row.updatedAt),
      href: applicantDetailHref(kind, row.id),
      reviewHref: `/admin/instructor-applicants/${row.id}`,
    };
  });
}

async function loadCpPool(): Promise<HiringWaitlistEntry[]> {
  const rows = await prisma.chapterPresidentApplication.findMany({
    where: {
      status: { in: [...CP_POOL] },
      archivedAt: null,
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      legalName: true,
      preferredFirstName: true,
      lastName: true,
      instructorApplicantPosition: true,
      chapter: { select: { name: true } },
      applicant: {
        select: {
          name: true,
          email: true,
          chapter: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => {
    const kind: HiringWaitlistKind = "cp";
    const interest = row.instructorApplicantPosition?.trim();
    const roleLabel =
      interest === "Both"
        ? "Chapter president + instructor"
        : interest === "Instructor Only"
          ? "Instructor (via CP app)"
          : "Chapter president";
    return {
      key: waitlistKey(kind, row.id),
      kind,
      id: row.id,
      name: formatApplicantDisplayName(row),
      email: row.applicant.email,
      roleLabel,
      subjects: interest || null,
      chapterName: row.chapter?.name ?? row.applicant.chapter?.name ?? null,
      waitlistedAt: toIso(row.createdAt ?? row.updatedAt),
      href: applicantDetailHref(kind, row.id),
      reviewHref: `/admin/chapter-president-applicants/${row.id}`,
    };
  });
}

/** Staff / tech pool — raw SQL so WAITLISTED works with a stale Prisma client. */
async function loadStaffPool(): Promise<HiringWaitlistEntry[]> {
  type StaffRow = {
    id: string;
    updatedAt: Date;
    submittedAt: Date;
    coverLetter: string | null;
    positionTitle: string;
    chapterName: string | null;
    applicantChapterName: string | null;
    applicantName: string | null;
    applicantEmail: string;
  };

  const rows = await prisma.$queryRaw<StaffRow[]>`
    SELECT
      a.id,
      a."updatedAt",
      a."submittedAt",
      a."coverLetter",
      p.title AS "positionTitle",
      pc.name AS "chapterName",
      uc.name AS "applicantChapterName",
      u.name AS "applicantName",
      u.email AS "applicantEmail"
    FROM "Application" a
    INNER JOIN "Position" p ON p.id = a."positionId"
    LEFT JOIN "Chapter" pc ON pc.id = p."chapterId"
    INNER JOIN "User" u ON u.id = a."applicantId"
    LEFT JOIN "Chapter" uc ON uc.id = u."chapterId"
    WHERE a."archivedAt" IS NULL
      AND p.type IN ('STAFF', 'MENTOR', 'GLOBAL_ADMIN')
      AND CAST(a.status AS TEXT) IN ('SUBMITTED', 'UNDER_REVIEW', 'WAITLISTED')
    ORDER BY a."submittedAt" ASC
  `;

  return rows.map((row) => {
    const kind: HiringWaitlistKind = "staff";
    return {
      key: waitlistKey(kind, row.id),
      kind,
      id: row.id,
      name: formatApplicantDisplayName({
        applicant: { name: row.applicantName, email: row.applicantEmail },
        fallback: row.applicantName ?? undefined,
      }),
      email: row.applicantEmail,
      roleLabel: row.positionTitle,
      subjects: row.coverLetter?.trim().slice(0, 160) || null,
      chapterName: row.chapterName ?? row.applicantChapterName ?? null,
      waitlistedAt: toIso(row.submittedAt ?? row.updatedAt),
      href: applicantDetailHref(kind, row.id),
      reviewHref: `/applications/${row.id}`,
    };
  });
}

export async function loadHiringWaitlist(): Promise<HiringWaitlistEntry[]> {
  const [instructor, cp, staff, savedOrder] = await Promise.all([
    loadInstructorPool(),
    loadCpPool(),
    loadStaffPool(),
    getHiringWaitlistOrder(),
  ]);

  const all = [...instructor, ...cp, ...staff];
  const byKey = new Map(all.map((e) => [e.key, e]));
  const merged = mergeWaitlistOrder(
    savedOrder,
    all.map((e) => ({ key: e.key, waitlistedAt: e.waitlistedAt }))
  );

  if (merged.join("\0") !== savedOrder.join("\0")) {
    await setHiringWaitlistOrder(merged);
  }

  return merged
    .map((key) => byKey.get(key))
    .filter((e): e is HiringWaitlistEntry => Boolean(e));
}
