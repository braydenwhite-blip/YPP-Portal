import { prisma } from "@/lib/prisma";

/**
 * Read-only aggregations for the admin class reports page (/admin/classes/reports).
 *
 * Leadership had no way to see the shape of the class program — what's in the
 * pipeline, whether classes are filling, which subjects draw demand, who's
 * teaching. This computes that from live `ClassOffering` / `ClassEnrollment`
 * data. No fake numbers: every figure is derived, and the page shows an honest
 * "Not enough data yet" empty state when there's nothing to report.
 *
 * One broad offering fetch + a couple of counts, aggregated in memory. The class
 * catalog is small enough (hundreds, not millions) that this is cheaper and far
 * simpler than a fan-out of groupBy queries.
 */

/** A published class is "under-enrolled" below this fraction of capacity. */
const UNDER_ENROLLED_RATIO = 0.5;
const UPCOMING_WINDOW_DAYS = 14;

export interface ClassReports {
  generatedAt: Date;
  totalClasses: number;
  pipeline: {
    draft: number;
    needsReview: number;
    approvedNotPublished: number;
    published: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  enrollment: {
    publishedClasses: number;
    totalActive: number;
    totalWaitlisted: number;
    totalCapacity: number;
    avgPerClass: number;
    fullClasses: number;
    underEnrolledClasses: number;
    capacityUtilization: number; // 0..1
  };
  upcoming: Array<{
    id: string;
    title: string;
    startDate: Date;
    instructorName: string;
    deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
    enrolledCount: number;
    capacity: number;
    missingMeetingLink: boolean;
    lowEnrollment: boolean;
  }>;
  subjects: Array<{
    interestArea: string;
    classCount: number;
    enrollmentCount: number;
  }>;
  instructors: Array<{
    id: string;
    name: string;
    activeClasses: number;
    completedClasses: number;
    totalEnrollments: number;
  }>;
}

export async function getClassReports(): Promise<ClassReports> {
  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [offerings, totalWaitlisted] = await Promise.all([
    prisma.classOffering.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        capacity: true,
        enrollmentOpen: true,
        deliveryMode: true,
        zoomLink: true,
        grandfatheredTrainingExemption: true,
        instructorId: true,
        instructor: { select: { id: true, name: true, email: true } },
        template: { select: { interestArea: true } },
        approval: { select: { status: true } },
        _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
      },
    }),
    prisma.classEnrollment.count({ where: { status: "WAITLISTED" } }),
  ]);

  const pipeline = {
    draft: 0,
    needsReview: 0,
    approvedNotPublished: 0,
    published: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  };

  let publishedClasses = 0;
  let totalActive = 0;
  let totalCapacity = 0;
  let fullClasses = 0;
  let underEnrolledClasses = 0;

  const subjectMap = new Map<string, { classCount: number; enrollmentCount: number }>();
  const instructorMap = new Map<
    string,
    { id: string; name: string; activeClasses: number; completedClasses: number; totalEnrollments: number }
  >();
  const upcoming: ClassReports["upcoming"] = [];

  for (const o of offerings) {
    const enrolled = o._count.enrollments;
    const approvalStatus = o.approval?.status ?? "NOT_REQUESTED";
    const isApproved = o.grandfatheredTrainingExemption || approvalStatus === "APPROVED";
    const isLive = o.status === "PUBLISHED" || o.status === "IN_PROGRESS";

    // Pipeline buckets.
    if (o.status === "CANCELLED") pipeline.cancelled += 1;
    else if (o.status === "COMPLETED") pipeline.completed += 1;
    else if (o.status === "IN_PROGRESS") pipeline.inProgress += 1;
    else if (o.status === "PUBLISHED") pipeline.published += 1;
    else if (o.status === "DRAFT") {
      pipeline.draft += 1;
      if (approvalStatus === "REQUESTED" || approvalStatus === "UNDER_REVIEW") {
        pipeline.needsReview += 1;
      } else if (isApproved) {
        pipeline.approvedNotPublished += 1;
      }
    }

    // Enrollment health (live classes only).
    if (isLive) {
      publishedClasses += 1;
      totalActive += enrolled;
      totalCapacity += o.capacity;
      if (o.capacity > 0 && enrolled >= o.capacity) fullClasses += 1;
      if (o.enrollmentOpen && o.capacity > 0 && enrolled < Math.ceil(o.capacity * UNDER_ENROLLED_RATIO)) {
        underEnrolledClasses += 1;
      }
    }

    // Subject demand (exclude cancelled noise).
    if (o.status !== "CANCELLED") {
      const area = o.template?.interestArea || "Uncategorized";
      const entry = subjectMap.get(area) ?? { classCount: 0, enrollmentCount: 0 };
      entry.classCount += 1;
      entry.enrollmentCount += enrolled;
      subjectMap.set(area, entry);
    }

    // Instructor teaching load.
    if (o.instructor) {
      const entry =
        instructorMap.get(o.instructor.id) ?? {
          id: o.instructor.id,
          name: o.instructor.name || o.instructor.email || "Unknown",
          activeClasses: 0,
          completedClasses: 0,
          totalEnrollments: 0,
        };
      if (isLive) {
        entry.activeClasses += 1;
        entry.totalEnrollments += enrolled;
      }
      if (o.status === "COMPLETED") entry.completedClasses += 1;
      instructorMap.set(o.instructor.id, entry);
    }

    // Upcoming starts that may need attention.
    if (isLive && o.startDate >= now && o.startDate <= upcomingCutoff) {
      const needsLink =
        (o.deliveryMode === "VIRTUAL" || o.deliveryMode === "HYBRID") && !o.zoomLink;
      upcoming.push({
        id: o.id,
        title: o.title,
        startDate: o.startDate,
        instructorName: o.instructor?.name || "Unassigned",
        deliveryMode: o.deliveryMode,
        enrolledCount: enrolled,
        capacity: o.capacity,
        missingMeetingLink: needsLink,
        lowEnrollment: o.capacity > 0 && enrolled < Math.ceil(o.capacity * UNDER_ENROLLED_RATIO),
      });
    }
  }

  upcoming.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const subjects = [...subjectMap.entries()]
    .map(([interestArea, v]) => ({ interestArea, ...v }))
    .sort((a, b) => b.enrollmentCount - a.enrollmentCount || b.classCount - a.classCount);

  const instructors = [...instructorMap.values()]
    .filter((i) => i.activeClasses > 0 || i.completedClasses > 0)
    .sort((a, b) => b.activeClasses - a.activeClasses || b.totalEnrollments - a.totalEnrollments);

  return {
    generatedAt: now,
    totalClasses: offerings.length,
    pipeline,
    enrollment: {
      publishedClasses,
      totalActive,
      totalWaitlisted,
      totalCapacity,
      avgPerClass: publishedClasses > 0 ? totalActive / publishedClasses : 0,
      fullClasses,
      underEnrolledClasses,
      capacityUtilization: totalCapacity > 0 ? totalActive / totalCapacity : 0,
    },
    upcoming,
    subjects,
    instructors,
  };
}
