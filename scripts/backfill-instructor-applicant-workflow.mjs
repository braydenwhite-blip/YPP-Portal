/**
 * Idempotent backfill for Instructor Applicant Workflow V1 fields.
 *
 * What it does:
 *  1. Populates reviewerId from the most recent SUBMITTED lead review
 *     (for applications that have a review but no reviewerId yet).
 *  2. Writes STATUS_CHANGE timeline events derived from updatedAt
 *     (only when the application has no timeline events yet).
 *  3. Ensures materialsReadyAt is null for applications without both docs.
 *  4. Sets archivedAt on terminal applications (APPROVED / REJECTED)
 *     that were last updated more than 30 days ago and have no archivedAt.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfillReviewerIds() {
  const apps = await prisma.instructorApplication.findMany({
    where: { reviewerId: null },
    select: {
      id: true,
      applicationReviews: {
        where: { isLeadReview: true },
        select: { reviewerId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let updated = 0;
  for (const app of apps) {
    const leadReview = app.applicationReviews[0];
    if (!leadReview) continue;

    await prisma.instructorApplication.update({
      where: { id: app.id },
      data: { reviewerId: leadReview.reviewerId },
    });
    updated++;
  }
  console.log(`[reviewer-ids] Set reviewerId on ${updated} application(s).`);
}

async function backfillTimelineEvents() {
  const apps = await prisma.instructorApplication.findMany({
    where: { timeline: { none: {} } },
    select: { id: true, status: true, applicantId: true, updatedAt: true },
  });

  let created = 0;
  for (const app of apps) {
    await prisma.instructorApplicationTimelineEvent.create({
      data: {
        applicationId: app.id,
        kind: "STATUS_CHANGE",
        actorId: app.applicantId,
        payload: { from: null, to: app.status, backfilled: true },
        createdAt: app.updatedAt,
      },
    });
    created++;
  }
  console.log(`[timeline] Created ${created} STATUS_CHANGE event(s) from updatedAt.`);
}

async function clearStaleMaterialsReadyAt() {
  const apps = await prisma.instructorApplication.findMany({
    where: { materialsReadyAt: { not: null } },
    select: {
      id: true,
      documents: {
        where: { supersededAt: null },
        select: { kind: true },
      },
    },
  });

  const kinds = ["COURSE_OUTLINE", "FIRST_CLASS_PLAN"];
  let cleared = 0;
  for (const app of apps) {
    const docKinds = new Set(app.documents.map((d) => d.kind));
    const hasAll = kinds.every((k) => docKinds.has(k));
    if (!hasAll) {
      await prisma.instructorApplication.update({
        where: { id: app.id },
        data: { materialsReadyAt: null },
      });
      cleared++;
    }
  }
  console.log(`[materials] Cleared materialsReadyAt on ${cleared} application(s) missing docs.`);
}

async function archiveOldTerminal() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.instructorApplication.updateMany({
    where: {
      status: { in: ["APPROVED", "REJECTED"] },
      archivedAt: null,
      updatedAt: { lt: cutoff },
    },
    data: { archivedAt: new Date() },
  });
  console.log(`[archive] Archived ${result.count} terminal application(s) older than 30 days.`);
}

async function main() {
  console.log("Starting Instructor Applicant Workflow V1 backfill…");
  await backfillReviewerIds();
  await backfillTimelineEvents();
  await clearStaleMaterialsReadyAt();
  await archiveOldTerminal();
  console.log("Backfill complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
