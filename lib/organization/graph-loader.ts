// The ONE impure module of the organization graph. It gathers chapter-scoped
// rows from Prisma, maps them to the pure builder's compact record shapes, and
// returns a built graph. It deliberately reuses the chapter operating system
// for chapter identity + the ranked blockers (the dependency signal already
// derived from existing data), so there is no parallel "needs attention" model.
//
// Everything downstream (health, dependencies, timeline, recommendations,
// entity summaries) is pure and lives in the sibling modules.

import "server-only";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { loadChapterOperatingSystem } from "@/lib/chapters/operating-system";
import { buildOrganizationGraph } from "@/lib/organization/graph";
import type {
  ClassInput,
  CurriculumInput,
  EnrollmentInput,
  FamilyInput,
  GraphBlocker,
  OrganizationGraph,
  OrgEvent,
  PartnerInput,
  PersonInput,
} from "@/lib/organization/types";

function humanize(token: string | null | undefined): string {
  if (!token) return "";
  const t = token.replace(/[_\s]+/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const ATTENDED = new Set(["PRESENT", "TARDY"]);

/**
 * Load + build the full organization graph for a chapter. Caller is responsible
 * for authZ (use `requireChapterManager(chapterId)` in the page).
 */
export async function loadOrganizationGraph(
  chapterId: string,
  now: Date = new Date()
): Promise<OrganizationGraph | null> {
  const os = await loadChapterOperatingSystem(chapterId);
  if (!os) return null;

  const [partnerRows, curriculumRows, offeringRows, parentRows] = await Promise.all([
    withPrismaFallback(
      "org-graph:partners",
      () =>
        prisma.partner.findMany({
          where: { chapterId, archivedAt: null },
          take: 300,
          select: {
            id: true,
            name: true,
            type: true,
            partnerType: true,
            stage: true,
            agreements: { select: { status: true } },
            requests: { select: { status: true } },
          },
        }),
      []
    ),
    withPrismaFallback(
      "org-graph:curricula",
      () =>
        prisma.classTemplate.findMany({
          where: { chapterId },
          take: 300,
          select: { id: true, title: true, interestArea: true, submissionStatus: true },
        }),
      []
    ),
    withPrismaFallback(
      "org-graph:offerings",
      () =>
        prisma.classOffering.findMany({
          where: { chapterId, status: { not: "CANCELLED" } },
          take: 300,
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            meetingDays: true,
            meetingTime: true,
            capacity: true,
            partnerId: true,
            templateId: true,
            instructorId: true,
            grandfatheredTrainingExemption: true,
            template: { select: { submissionStatus: true } },
            approval: { select: { status: true } },
            instructor: { select: { id: true, name: true } },
            enrollments: {
              select: { id: true, status: true, studentId: true, enrolledAt: true, student: { select: { id: true, name: true } } },
            },
            feedback: { select: { id: true, rating: true, createdAt: true } },
            sessions: {
              select: { id: true, date: true, isCancelled: true, attendance: { select: { status: true } } },
            },
          },
        }),
      []
    ),
    withPrismaFallback(
      "org-graph:families",
      () =>
        prisma.parentStudent.findMany({
          where: { archivedAt: null, student: { chapterId } },
          take: 500,
          select: { parentId: true, studentId: true, parent: { select: { name: true } } },
        }),
      []
    ),
  ]);

  // --- Partners ---------------------------------------------------------------
  const partners: PartnerInput[] = partnerRows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type ?? p.partnerType ?? null,
    stageLabel: humanize(p.stage) || "Researching",
    confirmed: p.stage === "ACTIVE_PARTNERSHIP" || (p.agreements ?? []).some((a) => a.status === "SIGNED"),
    openIssues: (p.requests ?? []).filter((r) => r.status === "OPEN" || r.status === "IN_NEGOTIATION").length,
  }));

  // --- Curricula --------------------------------------------------------------
  const curricula: CurriculumInput[] = curriculumRows.map((c) => {
    const status = c.submissionStatus ?? "DRAFT";
    return {
      id: c.id,
      title: c.title,
      subject: c.interestArea ?? null,
      statusLabel: humanize(status),
      approved: status === "APPROVED",
      submitted: status !== "DRAFT",
    };
  });

  // --- Classes + the people/enrollments/events they connect -------------------
  const instructorById = new Map<string, PersonInput>();
  const studentById = new Map<string, PersonInput>();
  const enrollments: EnrollmentInput[] = [];
  const events: OrgEvent[] = [];

  const classes: ClassInput[] = offeringRows.map((c) => {
    if (c.instructor) instructorById.set(c.instructor.id, { id: c.instructor.id, name: c.instructor.name ?? "Instructor", subtitle: "Instructor" });

    // Attendance % across held, non-cancelled sessions.
    let present = 0;
    let totalMarks = 0;
    for (const s of c.sessions ?? []) {
      if (s.isCancelled || s.date.getTime() > now.getTime()) continue;
      for (const a of s.attendance ?? []) {
        totalMarks += 1;
        if (ATTENDED.has(a.status)) present += 1;
      }
      if ((s.attendance ?? []).length > 0) {
        events.push({
          id: `attendance:${s.id}`,
          kind: "attendance",
          title: `Attendance recorded for ${c.title}`,
          occurredAt: s.date,
          href: `/admin/classes/${c.id}`,
          nodeIds: [`class:${c.id}`],
        });
      }
    }
    const attendancePercent = totalMarks > 0 ? Math.round((present / totalMarks) * 100) : null;

    const feedback = c.feedback ?? [];
    const feedbackCount = feedback.length;
    const averageRating = feedbackCount > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedbackCount : null;
    for (const f of feedback)
      events.push({
        id: `feedback:${f.id}`,
        kind: "feedback",
        title: `${f.rating}★ feedback on ${c.title}`,
        occurredAt: f.createdAt,
        href: `/admin/classes/${c.id}`,
        nodeIds: [`class:${c.id}`],
      });

    const enrolledCount = (c.enrollments ?? []).filter((e) => e.status === "ENROLLED").length;
    for (const e of c.enrollments ?? []) {
      if (e.student) studentById.set(e.student.id, { id: e.student.id, name: e.student.name ?? "Student", subtitle: "Student" });
      enrollments.push({ id: e.id, studentId: e.studentId, classId: c.id, status: e.status });
      events.push({
        id: `enroll:${e.id}`,
        kind: "enrollment",
        title: `${e.student?.name ?? "A student"} enrolled in ${c.title}`,
        occurredAt: e.enrolledAt,
        href: `/admin/classes/${c.id}`,
        nodeIds: [`class:${c.id}`, `student:${e.studentId}`],
      });
    }

    const status = c.status;
    const isLive = status === "IN_PROGRESS";
    const isCompleted = status === "COMPLETED";
    const curriculumApproved = c.approval?.status === "APPROVED" || c.grandfatheredTrainingExemption === true;
    const publiclyVisible = (status === "PUBLISHED" || status === "IN_PROGRESS") && curriculumApproved;
    const scheduleConfirmed = (c.meetingDays?.length ?? 0) > 0 && !!c.meetingTime;
    const interventionNeeded =
      isLive && ((attendancePercent != null && attendancePercent < 50) || (averageRating != null && averageRating < 2.5));

    return {
      id: c.id,
      title: c.title,
      statusLabel: humanize(status),
      stageLabel: classStageLabel({ status, publiclyVisible, curriculumApproved, scheduleConfirmed }),
      health: classHealthBucket({ isLive, isCompleted, attendancePercent, averageRating, feedbackCount }),
      partnerId: c.partnerId ?? null,
      curriculumId: c.templateId ?? null,
      instructorId: c.instructorId ?? null,
      enrolledCount,
      capacity: c.capacity ?? null,
      attendancePercent,
      averageRating,
      feedbackCount,
      interventionNeeded,
      curriculumApproved,
      curriculumSubmitted: c.template?.submissionStatus != null && c.template.submissionStatus !== "DRAFT",
      hasInstructor: !!c.instructorId,
      scheduleConfirmed,
      partnerConfirmed: c.partnerId != null,
      publiclyVisible,
      isLive,
      isCompleted,
    };
  });

  // --- Families (group parent → students) -------------------------------------
  const familyMap = new Map<string, FamilyInput>();
  for (const r of parentRows) {
    const fam = familyMap.get(r.parentId) ?? {
      id: r.parentId,
      label: `${r.parent?.name ?? "Family"}${r.parent?.name ? "'s family" : ""}`,
      studentIds: [],
    };
    if (!fam.studentIds.includes(r.studentId)) fam.studentIds.push(r.studentId);
    familyMap.set(r.parentId, fam);
  }

  const blockers: GraphBlocker[] = os.blockers.map((b) => ({
    key: b.key,
    severity: b.severity,
    title: b.title,
    detail: b.detail,
    href: b.href,
    entityType: b.entityType,
    entityId: b.entityId,
  }));

  return buildOrganizationGraph({
    chapterId,
    now,
    chapter: {
      id: os.chapter.id,
      name: os.chapter.name,
      location: os.chapter.location,
      lifecycleStatus: os.chapter.lifecycleStatus,
      lifecycleLabel: os.chapter.lifecycleLabel,
      health: null,
    },
    partners,
    curricula,
    instructors: [...instructorById.values()],
    students: [...studentById.values()],
    families: [...familyMap.values()],
    classes,
    enrollments,
    blockers,
    events: events.slice(0, 200),
  });
}

function classStageLabel(c: {
  status: string;
  publiclyVisible: boolean;
  curriculumApproved: boolean;
  scheduleConfirmed: boolean;
}): string {
  if (c.status === "COMPLETED") return "Completed";
  if (c.status === "IN_PROGRESS") return "Live";
  if (c.publiclyVisible) return "Enrolling";
  if (c.curriculumApproved && c.scheduleConfirmed) return "Launch Ready";
  if (!c.curriculumApproved) return "Needs Approval";
  return "Setup";
}

function classHealthBucket(c: {
  isLive: boolean;
  isCompleted: boolean;
  attendancePercent: number | null;
  averageRating: number | null;
  feedbackCount: number;
}): ClassInput["health"] {
  if (c.isCompleted) return c.averageRating != null && c.averageRating < 3 ? "watch" : "healthy";
  if (!c.isLive) return "unknown";
  if (c.attendancePercent != null && c.attendancePercent < 50) return "critical";
  if ((c.attendancePercent != null && c.attendancePercent < 70) || (c.averageRating != null && c.averageRating < 3))
    return "at_risk";
  if (c.attendancePercent == null && c.feedbackCount === 0) return "watch";
  return "healthy";
}
