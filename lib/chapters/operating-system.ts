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
  partnerPlaybookStatus,
  partnerIsInFlight,
  partnerEvidenceRow,
  partnerPipelineRecommendation,
  instructorEvidenceRow,
  instructorPipelineRecommendation,
  summarizeInstructorPipeline,
  type PipelineThresholds,
  type PartnerRecord,
  type InstructorApplicantRecord,
} from "@/lib/chapters/pipeline";
import {
  summarizeCurriculumReview,
  curriculumEvidenceRow,
  curriculumReviewRecommendation,
  curriculumSatisfiesLaunch,
  type CurriculumRecord,
} from "@/lib/chapters/curriculum-review";
import {
  summarizeLaunchReadiness,
  classEvidenceRow,
  launchReadinessRecommendation,
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
import { getPortalSettings } from "@/lib/portal-settings";

export type ChapterOperatingSystem = NonNullable<
  Awaited<ReturnType<typeof loadChapterOperatingSystem>>
>;

/** Colour intent for a Deliberable KPI stat card. */
export type DeliberableStatTone = "neutral" | "positive" | "warning" | "danger";
/** One KPI stat on a Deliberable header (e.g. "Stuck · 1 · Need attention"). */
export type DeliberableStat = {
  label: string;
  value: number;
  /** Sub-label under the number, e.g. "In pipeline". */
  hint: string;
  tone: DeliberableStatTone;
};
/** The single recommended next step + where it leads. */
export type DeliberableRecommendation = { text: string; cta: string; href: string };

const CONFIRMED_RIA = ["INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED", "FULLY_CONFIRMED"];
const NOT_READY_RIA = ["NEEDS_TRAINING", "NEEDS_CURRICULUM"];

// Evidence row ordering (most-urgent-first) and the per-table row cap are now
// admin-configurable via portal settings (lib/portal-settings). The defaults
// match the previous hardcoded values, so behaviour is unchanged until edited.

/** Count evidence rows in a given status (for the KPI stat cards). */
function countStatus<T extends { status: string }>(rows: T[], status: T["status"]): number {
  return rows.filter((r) => r.status === status).length;
}

/**
 * Rank an evidence row by its status using an admin-configurable order map.
 * Unknown / unmapped statuses sort last (defensive: an admin could omit a key).
 */
function rankByStatus(order: Record<string, number>, status: string): number {
  return order[status] ?? 99;
}

/**
 * Load the full chapter operating system. Caller is responsible for authZ
 * (use `requireChapterManager(chapterId)` in the page). Returns null if the
 * chapter doesn't exist.
 */
export async function loadChapterOperatingSystem(chapterId: string) {
  const now = new Date();

  // Admin-configurable thresholds, status orderings, and row cap (falls back to
  // defaults when unset — see lib/portal-settings).
  const settings = await getPortalSettings();
  const chapterOs = settings.chapterOs;
  const t: PipelineThresholds = chapterOs;
  const rowCap = chapterOs.deliberableRowCap;

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

  const [partnerDbRows, applicantRows, curriculumDbRows, classRows, curriculumApprovalRows] = await Promise.all([
    withPrismaFallback(
      "chapter-os:partners",
      () =>
        prisma.partner.findMany({
          where: { chapterId, archivedAt: null },
          take: 200,
          select: {
            id: true,
            name: true,
            type: true,
            partnerType: true,
            stage: true,
            lastContactedAt: true,
            nextFollowUpAt: true,
            relationshipLeadId: true,
            relationshipLead: { select: { name: true } },
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
            subjectsOfInterest: true,
            createdAt: true,
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
            interestArea: true,
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
            templateId: true,
            template: { select: { submissionStatus: true, targetAgeGroup: true } },
            approval: { select: { status: true } },
            regularInstructorAssignments: { select: { status: true } },
            reminders: { select: { status: true } },
            enrollments: { select: { status: true } },
            partner: { select: { agreements: { select: { status: true } } } },
          },
        }),
      []
    ),
    // Two-stage curriculum approval (Phase 4). Fault-tolerant + decoupled from the
    // curriculum query: if the CurriculumApproval table isn't migrated yet this
    // returns [] and every curriculum simply falls back to its legacy
    // submissionStatus — no data loss, the two-stage workflow is just inactive.
    withPrismaFallback(
      "chapter-os:curriculum-approvals",
      () =>
        prisma.curriculumApproval.findMany({
          where: { classTemplate: { chapterId } },
          take: 400,
          select: {
            classTemplateId: true,
            stage: true,
            submittedAt: true,
            cpReviewedByName: true,
            cpReviewNotes: true,
            cpReviewedAt: true,
            sentToGlobalAt: true,
            globalReviewedByName: true,
            globalReviewNotes: true,
            globalReviewedAt: true,
          },
        }),
      []
    ),
  ]);

  const approvalByTemplate = new Map(curriculumApprovalRows.map((a) => [a.classTemplateId, a]));

  // --- Map DB rows → pure record shapes -------------------------------------

  const partners: PartnerRecord[] = partnerDbRows.map((p) => {
    const offerings = p.classOfferings ?? [];
    return {
      id: p.id,
      name: p.name,
      type: p.type ?? p.partnerType ?? null,
      stage: p.stage,
      lastContactedAt: p.lastContactedAt,
      nextFollowUpAt: p.nextFollowUpAt,
      hasRelationshipLead: p.relationshipLeadId != null,
      relationshipLeadName: p.relationshipLead?.name ?? null,
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
      appliedAt: a.createdAt,
      specialties: a.subjectsOfInterest,
      hasReviewer: a.reviewerId != null,
      interviewScheduledAt: a.interviewScheduledAt,
      interviewCompletedAt,
      hasDecision: (a.chairDecisions ?? []).length > 0 || a.status === "APPROVED" || a.status === "REJECTED",
      hasCourseDescription: kinds.includes("COURSE_OUTLINE") || !!a.courseIdea,
      hasLessonPlan: kinds.includes("FIRST_CLASS_PLAN") || !!a.firstClassPlan,
      updatedAt: a.updatedAt,
    };
  });

  const curricula: CurriculumRecord[] = curriculumDbRows.map((c) => {
    const a = approvalByTemplate.get(c.id);
    return {
      id: c.id,
      title: c.title,
      subject: c.interestArea,
      instructorName: c.createdBy?.name ?? null,
      status: c.submissionStatus,
      // Authoritative two-stage stage when present; else legacy submissionStatus.
      approvalStage: a?.stage ?? null,
      submittedAt: a?.submittedAt ?? c.submittedAt,
      reviewedAt: a?.cpReviewedAt ?? null,
      cpReviewedByName: a?.cpReviewedByName ?? null,
      cpReviewNotes: a?.cpReviewNotes ?? null,
      cpReviewedAt: a?.cpReviewedAt ?? null,
      globalReviewedByName: a?.globalReviewedByName ?? null,
      globalReviewNotes: a?.globalReviewNotes ?? null,
      globalReviewedAt: a?.globalReviewedAt ?? null,
      sentToGlobalAt: a?.sentToGlobalAt ?? null,
    };
  });

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
      ageRange: c.template?.targetAgeGroup ?? null,
      startDate: c.startDate,
      status: c.status,
      partnerConfirmed: c.partnerId != null,
      hasRoom: isVirtual ? !!c.zoomLink : !!(c.room || c.locationName),
      hasTimes: c.meetingDays.length > 0 && !!c.meetingTime,
      hasInstructor: c.instructorId != null,
      instructorConfirmed: riaStatuses.some((s) => CONFIRMED_RIA.includes(s)),
      // Launch readiness now requires a TRUE full (global) approval, not the
      // legacy single-stage APPROVED. Falls back to legacy when no approval row.
      curriculumApproved: curriculumSatisfiesLaunch({
        approvalStage: approvalByTemplate.get(c.templateId)?.stage ?? null,
        status: c.template?.submissionStatus ?? null,
      }),
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
  const instructorSummary = summarizeInstructorPipeline(applicants, now, t);
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
    curriculaSubmitted: curriculumSummary.submittedEver,
    curriculaApproved: curriculumSummary.fullyApproved,
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

  // --- Deliberables: four evidence-backed decision views --------------------
  // Each lane becomes a guiding question + KPI stats + a real evidence table +
  // one recommended next step. Rows are sorted most-urgent-first and capped for
  // display; the stat cards still reflect the full set.

  const partnerEvidence = partners
    .filter((p) => partnerPlaybookStatus(p.stage) !== "closed")
    .map((p) => partnerEvidenceRow(p, now, t))
    .sort(
      (a, b) =>
        rankByStatus(chapterOs.partnerStatusOrder, a.status) -
        rankByStatus(chapterOs.partnerStatusOrder, b.status)
    );
  const instructorRows = applicants
    .filter((a) => a.status !== "REJECTED" && a.status !== "WITHDRAWN")
    .map((a) => instructorEvidenceRow(a, now, t))
    .sort(
      (a, b) =>
        rankByStatus(chapterOs.instructorStatusOrder, a.status) -
        rankByStatus(chapterOs.instructorStatusOrder, b.status)
    );
  const curriculumEvidence = curricula
    .map((c) => curriculumEvidenceRow(c))
    .sort(
      (a, b) =>
        rankByStatus(chapterOs.curriculumStatusOrder, a.status) -
        rankByStatus(chapterOs.curriculumStatusOrder, b.status)
    );
  const classEvidence = classes
    .map((c) => classEvidenceRow(c, now))
    .sort(
      (a, b) =>
        rankByStatus(chapterOs.classStatusOrder, a.status) -
        rankByStatus(chapterOs.classStatusOrder, b.status)
    );

  const partnerActive = partners.filter((p) => partnerIsInFlight(p.stage)).length;
  const partnerStats: DeliberableStat[] = [
    { label: "Active", value: partnerActive, hint: "In pipeline", tone: "neutral" },
    { label: "Confirmed", value: partnerSummary.confirmed, hint: "Locked in", tone: "positive" },
    { label: "At Risk", value: countStatus(partnerEvidence, "at_risk"), hint: "May slip", tone: "warning" },
    { label: "Stuck", value: countStatus(partnerEvidence, "stuck"), hint: "Need attention", tone: "danger" },
  ];
  const instructorStats: DeliberableStat[] = [
    { label: "Applicants", value: instructorSummary.applicants, hint: "This cycle", tone: "neutral" },
    { label: "In Review", value: instructorSummary.byStage.under_review, hint: "Applications", tone: "neutral" },
    { label: "Hired", value: instructorSummary.hired, hint: "Ready to assign", tone: "positive" },
    { label: "At Risk", value: countStatus(instructorRows, "at_risk"), hint: "May be short", tone: "warning" },
  ];
  const curriculumStats: DeliberableStat[] = [
    { label: "Approved", value: curriculumSummary.fullyApproved, hint: "Fully approved", tone: "positive" },
    { label: "CP Review", value: curriculumSummary.cpReviewNeeded, hint: "Awaiting CP", tone: curriculumSummary.cpReviewNeeded > 0 ? "warning" : "neutral" },
    { label: "Global Review", value: curriculumSummary.globalReviewNeeded, hint: "Awaiting global", tone: curriculumSummary.globalReviewNeeded > 0 ? "warning" : "neutral" },
    { label: "Revisions", value: curriculumSummary.needsRevision, hint: "Sent back", tone: curriculumSummary.needsRevision > 0 ? "warning" : "neutral" },
  ];
  const classStats: DeliberableStat[] = [
    { label: "Planned", value: launchSummary.total, hint: "All classes", tone: "neutral" },
    { label: "Ready", value: countStatus(classEvidence, "ready"), hint: "All set", tone: "positive" },
    { label: "Needs Attention", value: countStatus(classEvidence, "needs_attention"), hint: "At risk", tone: "warning" },
    { label: "Not Ready", value: countStatus(classEvidence, "not_ready"), hint: "Blocked", tone: "danger" },
  ];

  const deliberables = {
    partner: {
      id: "partner" as const,
      title: "Partner Pipeline",
      question: "What is the status of our partner pipeline, and where should we focus?",
      stats: partnerStats,
      rows: partnerEvidence.slice(0, rowCap),
      totalRows: partnerEvidence.length,
      recommendation: {
        text: partnerPipelineRecommendation(partnerEvidence),
        cta: "Go to Partner Pipeline",
        href: "/partners",
      } satisfies DeliberableRecommendation,
    },
    instructor: {
      id: "instructor" as const,
      title: "Instructor Pipeline",
      question: "Do we have enough qualified instructors to support our classes?",
      stats: instructorStats,
      rows: instructorRows.slice(0, rowCap),
      totalRows: instructorRows.length,
      recommendation: {
        text: instructorPipelineRecommendation(instructorSummary),
        cta: "Go to Instructor Pipeline",
        href: "/chapter/recruiting?tab=candidates",
      } satisfies DeliberableRecommendation,
    },
    curriculum: {
      id: "curriculum" as const,
      title: "Curriculum Readiness",
      question: "Is our curriculum ready for the classes we plan to launch?",
      stats: curriculumStats,
      rows: curriculumEvidence.slice(0, rowCap),
      totalRows: curriculumEvidence.length,
      recommendation: {
        text: curriculumReviewRecommendation(curriculumSummary),
        cta: "Go to Curriculum",
        href: "/admin/curricula",
      } satisfies DeliberableRecommendation,
    },
    class: {
      id: "class" as const,
      title: "Class Launch Readiness",
      question: "Which classes are ready to launch, and which need attention?",
      stats: classStats,
      rows: classEvidence.slice(0, rowCap),
      totalRows: classEvidence.length,
      recommendation: {
        text: launchReadinessRecommendation(launchSummary),
        cta: "Go to Class Launch",
        href: "/admin/classes",
      } satisfies DeliberableRecommendation,
    },
  };

  return {
    deliberables,
    chapter: {
      id: chapter.id,
      name: chapter.name,
      location: [chapter.city, chapter.state].filter(Boolean).join(", ") || null,
      lifecycleStatus: chapter.lifecycleStatus,
      lifecycleLabel: chapterLifecycleLabel(chapter.lifecycleStatus),
      president: chapter.president,
      // Cycle anchors — exposed so the Automation Brain can date "playbook week N"
      // and judge its confidence without re-querying the chapter.
      cycleStartISO: startDate.toISOString(),
      launchTargetISO: chapter.launchTargetDate?.toISOString() ?? null,
      /** True when the week is anchored to a real date (not just createdAt). */
      weekAnchored: Boolean(
        chapter.launchedAt || chapter.launchTargetDate || chapter.expectedFirstMeetingAt
      ),
    },
    weekNumber: impact.weekNumber,
    // Raw count-bag the Automation Brain reads to build `ChapterFacts` (no extra
    // DB reads). Already computed above for impact-meeting prep.
    metrics,
    partners: { ...partnerSummary, followUps: partnerFollowUps, confirmedLogistics },
    instructors: instructorSummary,
    curriculum: curriculumSummary,
    launch: launchSummary,
    impact,
    blockers,
    blockerSummary,
  };
}
