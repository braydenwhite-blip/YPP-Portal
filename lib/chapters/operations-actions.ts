"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireChapterManager } from "@/lib/chapters/access";
import { loadChapterOperations } from "@/lib/chapters/operations";

function positiveInt(form: FormData, key: string) {
  const value = Number(form.get(key));
  if (!Number.isInteger(value) || value < 0 || value > 100_000) throw new Error(`${key} must be a whole number.`);
  return value;
}

function text(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value ? value.slice(0, 10_000) : null;
}

export async function saveChapterOperationsTargets(form: FormData) {
  const chapterId = String(form.get("chapterId") ?? "");
  if (!chapterId) throw new Error("Chapter is required.");
  await requireChapterManager(chapterId);
  await prisma.chapterOperationsTarget.upsert({
    where: { chapterId },
    create: {
      chapterId,
      activeStudentsTarget: positiveInt(form, "activeStudentsTarget"),
      activeInstructorsTarget: positiveInt(form, "activeInstructorsTarget"),
      instructorPipelineTarget: positiveInt(form, "instructorPipelineTarget"),
      activePartnersTarget: positiveInt(form, "activePartnersTarget"),
      classesRunningTarget: positiveInt(form, "classesRunningTarget"),
    },
    update: {
      activeStudentsTarget: positiveInt(form, "activeStudentsTarget"),
      activeInstructorsTarget: positiveInt(form, "activeInstructorsTarget"),
      instructorPipelineTarget: positiveInt(form, "instructorPipelineTarget"),
      activePartnersTarget: positiveInt(form, "activePartnersTarget"),
      classesRunningTarget: positiveInt(form, "classesRunningTarget"),
    },
  });
  revalidatePath("/chapter");
  revalidatePath("/chapter/settings");
}

export async function saveChapterOperationsReport(form: FormData) {
  const chapterId = String(form.get("chapterId") ?? "");
  const type = String(form.get("type") ?? "") as "WEEKLY" | "MONTHLY";
  if (!chapterId || !["WEEKLY", "MONTHLY"].includes(type)) throw new Error("A valid report period is required.");
  const { user } = await requireChapterManager(chapterId);
  const data = await loadChapterOperations(chapterId);
  if (!data) throw new Error("Chapter not found.");
  const period = type === "WEEKLY" ? data.periods.weekly : data.periods.monthly;
  const existing = await prisma.chapterOperationsReport.findUnique({ where: { chapterId_type_periodStart: { chapterId, type, periodStart: period.start } }, select: { id: true, status: true } });
  if (existing?.status === "FINALIZED") redirect(`/chapter/reports/${existing.id}`);
  const weekly = data.weeklyActivity;
  const metrics = type === "WEEKLY" ? weekly : data.monthlyActivity;
  const metricRecords = {
    activeStudents: data.recordRefs.activeStudents,
    newStudents: type === "WEEKLY" ? data.recordRefs.weeklyNewStudents : data.recordRefs.monthlyNewStudents,
    activeInstructors: data.recordRefs.activeInstructors,
    activePartners: data.recordRefs.activePartners,
    classesRunning: data.recordRefs.classesRunning,
    sessionsHeld: type === "WEEKLY" ? data.recordRefs.weeklySessions : data.recordRefs.monthlySessions,
    attendanceRate: type === "WEEKLY" ? data.recordRefs.weeklySessions : data.recordRefs.monthlySessions,
    outreachAttempts: type === "WEEKLY" ? data.recordRefs.weeklyOutreach : data.recordRefs.monthlyOutreach,
    meetings: type === "WEEKLY" ? data.recordRefs.weeklyMeetings : data.recordRefs.monthlyMeetings,
    ...(type === "WEEKLY" ? {
      instructorPipeline: data.recordRefs.instructorPipeline,
      partnerMeetings: data.recordRefs.weeklyPartnerMeetings,
      openTasks: data.recordRefs.openTasks,
      overdueTasks: data.recordRefs.overdueTasks,
      blockedTasks: data.recordRefs.blockedTasks,
      followUpsDue: data.recordRefs.followUpsDue,
    } : {
      newInstructors: data.recordRefs.monthlyNewInstructors,
      newPartners: data.recordRefs.monthlyNewPartners,
      classesStarted: data.recordRefs.monthlyClassesStarted,
    }),
  };
  const sourceRecordRefs = {
    generatedAt: new Date().toISOString(),
    periodType: type,
    metricRecords,
    deadlineRecords: data.deadlines.map((d) => ({ id: d.id, type: d.type, href: d.href })),
    nextMeetingId: data.nextMeeting?.id ?? null,
  };
  const finalize = form.get("intent") === "finalize";
  const report = await prisma.chapterOperationsReport.upsert({
    where: { chapterId_type_periodStart: { chapterId, type, periodStart: period.start } },
    create: {
      chapterId, type, periodStart: period.start, periodEnd: period.end, metrics, sourceRecordRefs,
      biggestWin: text(form, "biggestWin"), biggestChallenge: text(form, "biggestChallenge"), mainFocus: text(form, "mainFocus"),
      decisionNeeded: text(form, "decisionNeeded"), supportNeeded: text(form, "supportNeeded"), nextPeriodFocus: text(form, "nextPeriodFocus"),
      createdById: user.id, status: finalize ? "FINALIZED" : "DRAFT", finalizedAt: finalize ? new Date() : null,
    },
    update: {
      periodEnd: period.end, metrics, sourceRecordRefs,
      biggestWin: text(form, "biggestWin"), biggestChallenge: text(form, "biggestChallenge"), mainFocus: text(form, "mainFocus"),
      decisionNeeded: text(form, "decisionNeeded"), supportNeeded: text(form, "supportNeeded"), nextPeriodFocus: text(form, "nextPeriodFocus"),
      status: finalize ? "FINALIZED" : "DRAFT", finalizedAt: finalize ? new Date() : null,
    },
  });
  revalidatePath("/chapter/reports");
  redirect(`/chapter/reports/${report.id}`);
}
