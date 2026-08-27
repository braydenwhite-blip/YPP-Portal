import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TECHNOLOGY_MANAGER_POSITION_TITLE } from "@/lib/technology-manager-application";

export type StaffBoardApplication = {
  id: string;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
  source: string;
  coverLetter: string | null;
  additionalMaterials: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { id: string; name: string } | null;
  };
  position: { id: string; title: string; chapter: { id: string; name: string } | null };
  interviewSlots: Array<{ scheduledAt: Date }>;
};

type StaffBoardRow = {
  id: string;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
  source: string;
  coverLetter: string | null;
  additionalMaterials: string | null;
  applicantId: string;
  applicantName: string | null;
  applicantEmail: string;
  applicantChapterId: string | null;
  applicantChapterName: string | null;
  positionId: string;
  positionTitle: string;
  positionChapterId: string | null;
  positionChapterName: string | null;
  interviewScheduledAt: Date | null;
};

function mapRow(row: StaffBoardRow): StaffBoardApplication {
  return {
    id: row.id,
    status: row.status,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt,
    source: row.source,
    coverLetter: row.coverLetter,
    additionalMaterials: row.additionalMaterials,
    applicant: {
      id: row.applicantId,
      name: row.applicantName,
      email: row.applicantEmail,
      chapter:
        row.applicantChapterId && row.applicantChapterName
          ? { id: row.applicantChapterId, name: row.applicantChapterName }
          : null,
    },
    position: {
      id: row.positionId,
      title: row.positionTitle,
      chapter:
        row.positionChapterId && row.positionChapterName
          ? { id: row.positionChapterId, name: row.positionChapterName }
          : null,
    },
    interviewSlots: row.interviewScheduledAt
      ? [{ scheduledAt: row.interviewScheduledAt }]
      : [],
  };
}

/**
 * Load Technology Manager applications without Prisma enum decoding.
 * Rows with ApplicationStatus.WAITLISTED crash a stale generated client.
 */
export async function loadStaffBoardApplications(opts: {
  archived: boolean;
  chapterId?: string | null;
  take?: number;
}): Promise<StaffBoardApplication[]> {
  const chapterFilter = opts.chapterId
    ? Prisma.sql`AND u."chapterId" = ${opts.chapterId}`
    : Prisma.empty;
  const archiveFilter = opts.archived
    ? Prisma.sql`AND a."archivedAt" IS NOT NULL`
    : Prisma.sql`AND a."archivedAt" IS NULL AND CAST(a.status AS TEXT) <> 'WITHDRAWN'`;
  const takeSql =
    typeof opts.take === "number" && Number.isFinite(opts.take) && opts.take > 0
      ? Prisma.raw(`LIMIT ${Math.floor(opts.take)}`)
      : Prisma.empty;
  const title = TECHNOLOGY_MANAGER_POSITION_TITLE;

  const rows = await prisma.$queryRaw<StaffBoardRow[]>`
    SELECT
      a.id,
      CAST(a.status AS TEXT) AS status,
      a."archivedAt" AS "archivedAt",
      a."updatedAt" AS "updatedAt",
      CAST(a.source AS TEXT) AS source,
      a."coverLetter" AS "coverLetter",
      a."additionalMaterials" AS "additionalMaterials",
      u.id AS "applicantId",
      u.name AS "applicantName",
      u.email AS "applicantEmail",
      uc.id AS "applicantChapterId",
      uc.name AS "applicantChapterName",
      p.id AS "positionId",
      p.title AS "positionTitle",
      pc.id AS "positionChapterId",
      pc.name AS "positionChapterName",
      (
        SELECT s."scheduledAt"
        FROM "InterviewSlot" s
        WHERE s."applicationId" = a.id
        ORDER BY s."scheduledAt" ASC
        LIMIT 1
      ) AS "interviewScheduledAt"
    FROM "Application" a
    INNER JOIN "Position" p ON p.id = a."positionId"
    INNER JOIN "User" u ON u.id = a."applicantId"
    LEFT JOIN "Chapter" uc ON uc.id = u."chapterId"
    LEFT JOIN "Chapter" pc ON pc.id = p."chapterId"
    WHERE p.type = 'STAFF'::"PositionType"
      AND LOWER(p.title) = LOWER(${title})
      ${archiveFilter}
      ${chapterFilter}
    ORDER BY a."updatedAt" DESC, a."submittedAt" DESC
    ${takeSql}
  `;

  return rows.map(mapRow);
}
