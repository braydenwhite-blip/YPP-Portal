// THE Chapter Operating System read model. One call returns everything a Chapter
// President needs to run Weeks 1–10 of the playbook: chapter identity + current
// week, the four pipeline lanes (partners, instructors, curriculum, classes),
// per-class launch readiness, the impact-meeting prep, and the ranked
// "needs attention" blockers — all computed from EXISTING data, no parallel
// model, no spreadsheets.
//
// The heavy lifting (rules, mappings, aggregation) lives in pure, unit-tested
// modules; this file only gathers chapter-scoped rows, maps them to those
// modules' record shapes, and assembles a serializable DTO for the UI.

import "server-only";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { chapterLifecycleLabel } from "@/lib/chapters/lifecycle";
import {
  summarizePartnerPipeline,
  partnerFollowUp,
  partnerLogistics,
  type PartnerRecord,
  type InstructorApplicantRecord,
  summarizeInstructorPipeline,
} from "@/lib/chapters/pipeline";
import {
  summarizeCurriculumReview,
  type CurriculumRecord,
} from "@/lib/chapters/curriculum-review";
import {
  summarizeLaunchReadiness,
  type ClassLaunchRecord,
} from "@/lib/chapters/launch-readiness";
import {
  buildImpactMeetingPrep,
  type ChapterImpactMetrics,
} from "@/lib/chapters/impact-meeting";
import {
  deriveChapterBlockers,
  summarizeBlockers,
  type ChapterBlocker,
} from "@/lib/chapters/needs-attention-rules";

export type ChapterOperatingSystem = NonNullable<
  Awaited<ReturnType<typeof loadChapterOperatingSystem>>
>;

const CONFIRMED_RIA = ["INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED", "FULLY_CONFIRMED"];
const NOT_READY_RIA = ["NEEDS_TRAINING", "NEEDS_CURRICULUM"];

/**
 * Load the full chapter operating system. Caller is responsible for authZ
 * (use `requireChapterManager(chapterId)` in the page). Returns null if the
 * chapter doesn't exist.
 */
export async function loadChapterOperatingSystem(chapterId: string) {
  const now = new Date();

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      lifecycleStatus: true,
      launchedAt: true,
      launchTargetDate: true,
      expectedFirstMeetingAt: true,
      lifecycleUpdatedAt: true,
      createdAt: true,
      president: { select: { id: true, name: true } },
    },
  });
  if (!chapter) return null;

  const [partnerRows, applicantRows, curriculumRows, classRows] = await Promise.all([
    withPrismaFallback(
      "chapter-os:partners",
      () =>
        prisma.partner.findMany({
          where: { chapterId, archivedAt: null },
          take: 200,
          select: {
            id: true,
            name: true,
            stage: true,
            lastContactedAt: true,
            nextFollowUpAt: true,
            relationshipLeadId: true,
            contactName: true,
            agreements: { select: { status: true } },
            requests: { select: { status: true } },
            classOfferings: {
              where: { status: { not: "CANCELLED" } },
              select: {
                room: true,
                locationName: true,
                meetingDays: true,
                meetingTime: true,
                startDate: true,
              },
            },
          },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:applicants",
      () =>
        prisma.instructorApplication.findMany({
          where: { applicant: { chapterId } },
          take: 300,
          select: {
            id: true,
            status: true,
            reviewerId: true,
            interviewScheduledAt: true,
            courseIdea: true,
            firstClassPlan: true,
            updatedAt: true,
            applicant: { select: { name: true } },
            documents: { select: { kind: true } },
            chairDecisions: { select: { id: true } },
            interviewReviews: { select: { submittedAt: true } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:curricula",
      () =>
        prisma.classTemplate.findMany({
          where: { chapterId },
          take: 200,
          select: {
            id: true,
            title: true,
            submissionStatus: true,
            submittedAt: true,
            createdBy: { select: { name: true } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "chapter-os:classes",
      () =>
        prisma.classOffering.findMany({
          where: { chapterId, status: { not: "CANCELLED" } },
          take: 200,
          select: {
            id: true,
            title: true,
            startDate: true,
            status: true,
            partnerId: true,
            room: true,
            locationName: true,
            zoomLink: true,
            deliveryMode: true,
            meetingDays: true,
            meetingTime: true,
            instructorId: true,
            capacity: true,
            grandfatheredTrainingExemption: true,
            template: { select: { submissionStatus: true } },
            approval: { select: { status: true } },
            regularInstructorAssignments: { select: { status: true } },
            reminders: { select: { status: true } },
            enrollments: { select: { status: true } },
            partner: { select: { agreements: { select: { status: true } } } },
          },
        }),
      []
    ),
  ]);

  // --- Map DB rows → pure record shapes -------------------------------------

  const partners: PartnerRecord[] = partnerRows.map((p) => {
    const offerings = p.classOfferings ?? [];
    return {
      id: p.id,
      name: p.name,
      stage: p.stage,
      lastContactedAt: p.lastContactedAt,
      nextFollowUpAt: p.nextFollowUpAt,
      hasRelationshipLead: p.relationshipLeadId != null,
      confirmedRoom: offerings.some((o) => !!(o.room || o.locationName)),
      confirmedTimes: offerings.some((o) => o.meetingDays.length > 0 && !!o.meetingTime),
      confirmedLaunchDate: offerings.some((o) => o.startDate != null),
      hasSupervisor: p.relationshipLeadId != null || !!p.contactName,
      writtenConfirmation: (p.agreements ?? []).some((a) => a.status === "SIGNED"),
      openIssues: (p.requests ?? []).filter((r) => r.status === "OPEN" || r.status === "IN_NEGOTIATION").length,
    };
  });

  const applicants: InstructorApplicantRecord[] = applicantRows.map((a) => {
    const kinds = (a.documents ?? []).map((d) => d.kind);
    const interviewCompletedAt = (a.interviewReviews ?? [])
      .map((r) => r.submittedAt)
      .filter((d): d is Date => d != null)
      .sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
    return {
      id: a.id,
      name: a.applicant?.name ?? "Applicant",
      status: a.status,
      hasReviewer: a.reviewerId != null,
      interviewScheduledAt: a.interviewScheduledAt,
      interviewCompletedAt,
      hasDecision: (a.chairDecisions ?? []).length > 0 || a.status === "APPROVED" || a.status === "REJECTED",
      hasCourseDescription: kinds.includes("COURSE_OUTLINE") || !!a.courseIdea,
      hasLessonPlan: kinds.includes("FIRST_CLASS_PLAN") || !!a.firstClassPlan,
      updatedAt: a.updatedAt,
    };
  });

  const curricula: CurriculumRecord[] = curriculumRows.map((c) => ({
    id: c.id,
    title: c.title,
    instructorName: c.createdBy?.name ?? null,
    status: c.submissionStatus,
    submittedAt: c.submittedAt,
    reviewedAt: null,
  }));

  const classes: ClassLaunchRecord[] = classRows.map((c) => {
    const riaStatuses = (c.regularInstructorAssignments ?? []).map((r) => r.status);
    const publiclyVisible =
      (c.status === "PUBLISHED" || c.status === "IN_PROGRESS") &&
      (c.approval?.status === "APPROVED" || c.grandfatheredTrainingExemption === true);
    const enrolledCount = (c.enrollments ?? []).filter((e) => e.status === "ENROLLED").length;
    const isVirtual = c.deliveryMode === "VIRTUAL";
    return {
      id: c.id,
      title: c.title,
      startDate: c.startDate,
      status: c.status,
      partnerConfirmed: c.partnerId != null,
      hasRoom: isVirtual ? !!c.zoomLink : !!(c.room || c.locationName),
      hasTimes: c.meetingDays.length > 0 && !!c.meetingTime,
      hasInstructor: c.instructorId != null,
      instructorConfirmed: riaStatuses.some((s) => CONFIRMED_RIA.includes(s)),
      curriculumApproved: c.template?.submissionStatus === "APPROVED",
      publiclyVisible,
      enrolledCount,
      capacity: c.capacity,
      instructorReady: riaStatuses.length > 0 && !riaStatuses.some((s) => NOT_READY_RIA.includes(s)),
      preLaunchReminderSent: (c.reminders ?? []).some((r) => r.status === "SENT"),
      logisticsInWriting: (c.partner?.agreements ?? []).some((a) => a.status === "SIGNED"),
    };
  });

  // --- Summaries (pure) ------------------------------------------------------

  const partnerSummary = summarizePartnerPipeline(partners, now);
  const instructorSummary = summarizeInstructorPipeline(applicants, now);
  const curriculumSummary = summarizeCurriculumReview(curricula, now);
  const launchSummary = summarizeLaunchReadiness(classes, now);

  const blockers = deriveChapterBlockers({ partners, applicants, curricula, classes }, now);
  const blockerSummary = summarizeBlockers(blockers);

  // --- Impact meeting prep ---------------------------------------------------

  const startDate =
    chapter.launchedAt ??
    chapter.expectedFirstMeetingAt ??
    chapter.lifecycleUpdatedAt ??
    chapter.createdAt;

  const metrics: ChapterImpactMetrics = {
    partnersTotal: partnerSummary.total,
    partnersContacted:
      partnerSummary.byStatus.contacted +
      partnerSummary.byStatus.interested +
      partnerSummary.byStatus.meeting_scheduled +
      partnerSummary.byStatus.final_conversation +
      partnerSummary.byStatus.confirmed,
    partnersResponded:
      partnerSummary.byStatus.interested +
      partnerSummary.byStatus.meeting_scheduled +
      partnerSummary.byStatus.final_conversation,
    partnersMeetingScheduled: partnerSummary.byStatus.meeting_scheduled,
    partnersMeetingsCompleted: partnerSummary.byStatus.final_conversation + partnerSummary.byStatus.confirmed,
    partnersInConversation: partnerSummary.byStatus.interested + partnerSummary.byStatus.final_conversation,
    partnersConfirmed: partnerSummary.byStatus.confirmed,
    partnersClosed: partnerSummary.byStatus.closed,
    instructorApplicants: instructorSummary.applicants,
    instructorsUnderReview: instructorSummary.byStage.under_review,
    interviewsScheduled: instructorSummary.byStage.interview_scheduled,
    interviewsCompleted: instructorSummary.byStage.interview_complete,
    instructorsHired: instructorSummary.hired,
    curriculaSubmitted: curriculumSummary.reviewNeeded,
    curriculaApproved: curriculumSummary.approved,
    curriculaNeedsRevision: curriculumSummary.needsRevision,
    classesTotal: launchSummary.total,
    classesPublic: classes.filter((c) => c.publiclyVisible).length,
    classesLaunched: launchSummary.classes.filter((c) => c.hasLaunched).length,
    classesRunning: classRows.filter((c) => c.status === "IN_PROGRESS").length,
    enrollmentTotal: classes.reduce((sum, c) => sum + c.enrolledCount, 0),
    underEnrolledClasses: launchSummary.underEnrolled,
  };

  const impactBlockers = blockers
    .filter((b) => b.severity === "critical" || b.severity === "warning")
    .slice(0, 8)
    .map((b) => b.title);

  const impact = buildImpactMeetingPrep({ metrics, startDate, now, blockers: impactBlockers });

  // --- Lane "follow-ups" for the partner card -------------------------------

  const partnerFollowUps = partners
    .map((p) => ({ p, fu: partnerFollowUp(p, now) }))
    .filter((x) => x.fu.needed)
    .slice(0, 6)
    .map((x) => ({ id: x.p.id, name: x.p.name, reason: x.fu.reason!, href: `/partners/${x.p.id}` }));

  const confirmedLogistics = partners
    .filter((p) => p.stage === "ACTIVE_PARTNERSHIP")
    .map((p) => ({ id: p.id, name: p.name, logistics: partnerLogistics(p) }));

  return {
    chapter: {
      id: chapter.id,
      name: chapter.name,
      location: [chapter.city, chapter.state].filter(Boolean).join(", ") || null,
      lifecycleStatus: chapter.lifecycleStatus,
      lifecycleLabel: chapterLifecycleLabel(chapter.lifecycleStatus),
      president: chapter.president,
    },
    weekNumber: impact.weekNumber,
    partners: { ...partnerSummary, followUps: partnerFollowUps, confirmedLogistics },
    instructors: instructorSummary,
    curriculum: curriculumSummary,
    launch: launchSummary,
    impact,
    blockers,
    blockerSummary,
  };
}
