"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { InstructorApplicationStatus, ChapterPresidentApplicationStatus } from "@prisma/client";

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsv).join(",");
}

export async function exportInstructorApplicationsCsv(filters?: {
  status?: InstructorApplicationStatus;
  graduationYear?: number;
  stateProvince?: string;
  search?: string;
}): Promise<{ csv: string; filename: string } | { error: string }> {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) return { error: "Unauthorized" };

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.stateProvince) where.stateProvince = { contains: filters.stateProvince, mode: "insensitive" };
  if (filters?.search) {
    where.OR = [
      { legalName: { contains: filters.search, mode: "insensitive" } },
      { applicant: { name: { contains: filters.search, mode: "insensitive" } } },
      { applicant: { email: { contains: filters.search, mode: "insensitive" } } },
      { schoolName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const applications = await prisma.instructorApplication.findMany({
    where,
    include: {
      applicant: { select: { name: true, email: true, chapter: { select: { name: true } } } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "ID",
    "Status",
    "Applied At",
    "Account Name",
    "Email",
    "Chapter",
    "Legal Name",
    "Preferred First Name",
    "Phone",
    "Date of Birth",
    "City",
    "State/Province",
    "ZIP Code",
    "Country",
    "School Name",
    "Graduation Year",
    "GPA",
    "Class Rank",
    "Subjects of Interest",
    "Why YPP",
    "Motivation to Teach",
    "Motivation Video URL",
    "Teaching Experience",
    "Extracurriculars",
    "Prior Leadership",
    "Special Skills",
    "Availability",
    "Hours Per Week",
    "Preferred Start Date",
    "Referral Emails",
    "Hear About YPP",
    "Ethnicity",
    "Score: Academic",
    "Score: Communication",
    "Score: Leadership",
    "Score: Motivation",
    "Score: Fit",
    "Composite Score",
    "Reviewer",
    "Reviewer Notes",
    "Interview Scheduled At",
    "Approved At",
    "Rejected At",
  ];

  const lines = [headers.join(",")];

  for (const app of applications) {
    const scores = [app.scoreAcademic, app.scoreCommunication, app.scoreLeadership, app.scoreMotivation, app.scoreFit];
    const scoredCount = scores.filter((s) => s != null).length;
    const compositeScore = scoredCount > 0
      ? (scores.reduce((sum, s) => (sum ?? 0) + (s ?? 0), 0) ?? 0) / scoredCount
      : null;

    lines.push(row([
      app.id,
      app.status,
      app.createdAt.toISOString(),
      app.applicant.name,
      app.applicant.email,
      app.applicant.chapter?.name ?? "",
      app.legalName,
      app.preferredFirstName,
      app.phoneNumber,
      app.dateOfBirth,
      app.city,
      app.stateProvince,
      app.zipCode,
      app.country,
      app.schoolName,
      app.graduationYear,
      app.gpa,
      app.classRank,
      app.subjectsOfInterest,
      app.whyYPP,
      app.motivation,
      app.motivationVideoUrl,
      app.teachingExperience,
      app.extracurriculars,
      app.priorLeadership,
      app.specialSkills,
      app.availability,
      app.hoursPerWeek,
      app.preferredStartDate,
      app.referralEmails,
      app.hearAboutYPP,
      app.ethnicity,
      app.scoreAcademic,
      app.scoreCommunication,
      app.scoreLeadership,
      app.scoreMotivation,
      app.scoreFit,
      compositeScore != null ? compositeScore.toFixed(1) : "",
      app.reviewer?.name ?? "",
      app.reviewerNotes,
      app.interviewScheduledAt?.toISOString() ?? "",
      app.approvedAt?.toISOString() ?? "",
      app.rejectedAt?.toISOString() ?? "",
    ]));
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    csv: lines.join("\n"),
    filename: `instructor-applications-${date}.csv`,
  };
}

export async function saveApplicationScores(
  prevState: { status: "idle" | "error" | "success"; message: string },
  formData: FormData
): Promise<{ status: "idle" | "error" | "success"; message: string }> {
  try {
    const session = await getSession();
    const roles = session?.user?.roles ?? [];
    if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
      return { status: "error", message: "Unauthorized" };
    }

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    if (!applicationId) return { status: "error", message: "Application ID required." };

    function getScore(key: string): number | null {
      const val = formData.get(key);
      if (!val) return null;
      const n = parseInt(String(val), 10);
      return n >= 1 && n <= 5 ? n : null;
    }

    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: {
        scoreAcademic: getScore("scoreAcademic"),
        scoreCommunication: getScore("scoreCommunication"),
        scoreLeadership: getScore("scoreLeadership"),
        scoreMotivation: getScore("scoreMotivation"),
        scoreFit: getScore("scoreFit"),
        reviewerNotes: String(formData.get("reviewerNotes") ?? "").trim() || null,
      },
    });

    return { status: "success", message: "Scores saved." };
  } catch {
    return { status: "error", message: "Failed to save scores." };
  }
}

// ============================================
// CHAPTER PRESIDENT APPLICATION EXPORT & SCORING
// ============================================

export async function exportCPApplicationsCsv(filters?: {
  status?: ChapterPresidentApplicationStatus;
  graduationYear?: number;
  stateProvince?: string;
  search?: string;
}): Promise<{ csv: string; filename: string } | { error: string }> {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) return { error: "Unauthorized" };

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.graduationYear) where.graduationYear = filters.graduationYear;
  if (filters?.stateProvince) where.stateProvince = { contains: filters.stateProvince, mode: "insensitive" };
  if (filters?.search) {
    where.OR = [
      { legalName: { contains: filters.search, mode: "insensitive" } },
      { applicant: { name: { contains: filters.search, mode: "insensitive" } } },
      { applicant: { email: { contains: filters.search, mode: "insensitive" } } },
      { schoolName: { contains: filters.search, mode: "insensitive" } },
      { partnerSchool: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const applications = await prisma.chapterPresidentApplication.findMany({
    where,
    include: {
      applicant: { select: { name: true, email: true, chapter: { select: { name: true } } } },
      chapter: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "ID", "Status", "Applied At",
    "Account Name", "Email", "Current Chapter",
    "Legal Name", "Preferred First Name", "Phone", "Date of Birth",
    "City", "State/Province", "ZIP Code", "Country",
    "School Name", "Graduation Year", "GPA", "Class Rank",
    "Target Chapter", "Partner School",
    "Why Chapter President", "Leadership Experience", "Chapter Vision",
    "Recruitment Plan", "Launch Plan", "Prior Organizing",
    "Extracurriculars", "Special Skills",
    "Availability", "Hours Per Week", "Preferred Launch Date",
    "Referral Emails", "Hear About YPP", "Ethnicity",
    "Score: Leadership", "Score: Vision", "Score: Organization", "Score: Commitment", "Score: Fit",
    "Composite Score",
    "Reviewer", "Reviewer Notes",
    "Interview Scheduled At", "Approved At", "Rejected At",
  ];

  const lines = [headers.join(",")];

  for (const app of applications) {
    const scores = [app.scoreLeadership, app.scoreVision, app.scoreOrganization, app.scoreCommitment, app.scoreFit];
    const valid = scores.filter((s) => s != null);
    const comp = valid.length > 0 ? (valid.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0) / valid.length : null;

    lines.push(row([
      app.id, app.status, app.createdAt.toISOString(),
      app.applicant.name, app.applicant.email, app.applicant.chapter?.name ?? "",
      app.legalName, app.preferredFirstName, app.phoneNumber, app.dateOfBirth,
      app.city, app.stateProvince, app.zipCode, app.country,
      app.schoolName, app.graduationYear, app.gpa, app.classRank,
      app.chapter?.name ?? "", app.partnerSchool,
      app.whyChapterPresident, app.leadershipExperience, app.chapterVision,
      app.recruitmentPlan, app.launchPlan, app.priorOrganizing,
      app.extracurriculars, app.specialSkills,
      app.availability, app.hoursPerWeek, app.preferredStartDate,
      app.referralEmails, app.hearAboutYPP, app.ethnicity,
      app.scoreLeadership, app.scoreVision, app.scoreOrganization, app.scoreCommitment, app.scoreFit,
      comp != null ? comp.toFixed(1) : "",
      app.reviewer?.name ?? "", app.reviewerNotes,
      app.interviewScheduledAt?.toISOString() ?? "",
      app.approvedAt?.toISOString() ?? "",
      app.rejectedAt?.toISOString() ?? "",
    ]));
  }

  const date = new Date().toISOString().slice(0, 10);
  return { csv: lines.join("\n"), filename: `cp-applications-${date}.csv` };
}

export async function saveCPApplicationScores(
  prevState: { status: "idle" | "error" | "success"; message: string },
  formData: FormData
): Promise<{ status: "idle" | "error" | "success"; message: string }> {
  try {
    const session = await getSession();
    const roles = session?.user?.roles ?? [];
    if (!roles.includes("ADMIN")) return { status: "error", message: "Unauthorized" };

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    if (!applicationId) return { status: "error", message: "Application ID required." };

    function getScore(key: string): number | null {
      const val = formData.get(key);
      if (!val) return null;
      const n = parseInt(String(val), 10);
      return n >= 1 && n <= 5 ? n : null;
    }

    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        scoreLeadership: getScore("scoreLeadership"),
        scoreVision: getScore("scoreVision"),
        scoreOrganization: getScore("scoreOrganization"),
        scoreCommitment: getScore("scoreCommitment"),
        scoreFit: getScore("scoreFit"),
        reviewerNotes: String(formData.get("reviewerNotes") ?? "").trim() || null,
      },
    });

    return { status: "success", message: "Scores saved." };
  } catch {
    return { status: "error", message: "Failed to save scores." };
  }
}
