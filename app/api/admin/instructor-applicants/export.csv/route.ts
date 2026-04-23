import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { InstructorApplicationStatus } from "@prisma/client";

// ─── CSV helper ───────────────────────────────────────────────────────────────

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(",");
}

// ─── GET /api/admin/instructor-applicants/export.csv ─────────────────────────

export async function GET(request: Request) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id || (!roles.includes("ADMIN") && !roles.includes("HIRING_CHAIR"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") as InstructorApplicationStatus | null;
  const chapterId = searchParams.get("chapterId") || undefined;
  const cohortId = searchParams.get("cohortId") || undefined;

  // Validate status param if provided
  const validStatuses: InstructorApplicationStatus[] = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "INFO_REQUESTED",
    "PRE_APPROVED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "CHAIR_REVIEW",
    "APPROVED",
    "REJECTED",
    "ON_HOLD",
    "WITHDRAWN",
  ];
  const status =
    statusParam && validStatuses.includes(statusParam) ? statusParam : undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (cohortId) where.cohortId = cohortId;
  if (chapterId) where.applicant = { chapterId };

  const applications = await prisma.instructorApplication.findMany({
    where,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      legalName: true,
      preferredFirstName: true,
      schoolName: true,
      graduationYear: true,
      interviewRound: true,
      interviewScheduledAt: true,
      approvedAt: true,
      rejectedAt: true,
      archivedAt: true,
      lastNotificationError: true,
      applicant: {
        select: {
          name: true,
          email: true,
          chapter: { select: { name: true } },
        },
      },
      reviewer: {
        select: { name: true, email: true },
      },
      applicationReviews: {
        where: { status: "SUBMITTED" },
        select: { id: true },
      },
      interviewReviews: {
        where: { status: "SUBMITTED" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = csvRow([
    "id",
    "status",
    "createdAt",
    "updatedAt",
    "legalName",
    "preferredFirstName",
    "email",
    "schoolName",
    "graduationYear",
    "chapterName",
    "reviewerName",
    "reviewerEmail",
    "interviewRound",
    "interviewScheduledAt",
    "approvedAt",
    "rejectedAt",
    "archivedAt",
    "notificationError",
    "applicationReviewCount",
    "interviewReviewCount",
  ]);

  const rows = applications.map((app) =>
    csvRow([
      app.id,
      app.status,
      app.createdAt.toISOString(),
      app.updatedAt.toISOString(),
      app.legalName,
      app.preferredFirstName,
      app.applicant.email,
      app.schoolName,
      app.graduationYear,
      app.applicant.chapter?.name,
      app.reviewer?.name,
      app.reviewer?.email,
      app.interviewRound,
      app.interviewScheduledAt?.toISOString() ?? "",
      app.approvedAt?.toISOString() ?? "",
      app.rejectedAt?.toISOString() ?? "",
      app.archivedAt?.toISOString() ?? "",
      app.lastNotificationError ? "yes" : "no",
      app.applicationReviews.length,
      app.interviewReviews.length,
    ])
  );

  const csv = [header, ...rows].join("\n");
  const filename = `instructor-applicants-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
