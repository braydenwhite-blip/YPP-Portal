import type {
  ClassOutcomeStatus,
  ClassRepeatRecommendation,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isGoodFeedback,
  isRepeatRecommendation,
  REPEAT_RECOMMENDATION_ORDER,
  summarizeFeedback,
  type ClassFeedbackSummary,
} from "@/lib/class-feedback-constants";
import { getPortalSettings } from "@/lib/portal-settings";

/**
 * Class feedback + completion-outcome layer — server-side read helpers.
 *
 * Pure taxonomy, labels, and aggregation live in
 * lib/class-feedback-constants.ts (no prisma import, safe for client
 * components). This module holds the database reads. Two tables back the layer
 * (see schema.prisma):
 *   • ClassFeedback — one row per (offering, student): rating + liked + improve.
 *   • ClassOutcome  — one row per offering: instructor reflection + admin outcome.
 *
 * Because the layer is additive, the underlying tables may not exist yet in an
 * environment that has not run the migration. Every read therefore goes through
 * `safeRead`, which degrades to an empty/neutral value when the relation is
 * missing rather than 500-ing an otherwise-working page. Writes (in
 * lib/class-feedback-actions.ts) deliberately do NOT swallow these errors.
 */

export type StudentFeedbackEntry = {
  id: string;
  studentId: string;
  studentName: string;
  rating: number;
  liked: string | null;
  improve: string | null;
  wouldRecommend: boolean | null;
  createdAt: Date;
};

export type ClassOutcomeRecord = {
  offeringId: string;
  instructorWentWell: string | null;
  instructorChallenges: string | null;
  instructorStudentImpact: string | null;
  instructorWouldTeachAgain: boolean | null;
  instructorReflectedAt: Date | null;
  status: ClassOutcomeStatus;
  repeatRecommendation: ClassRepeatRecommendation | null;
  gotGoodFeedback: boolean;
  adminNotes: string | null;
  recordedAt: Date | null;
  hasInstructorReflection: boolean;
};

export type FeedbackPrompt = {
  offeringId: string;
  title: string;
  instructorName: string;
  interestArea: string;
  endDate: Date;
};

// ─────────────────────────────────────────────────────────────────────────────
// Graceful degradation
// ─────────────────────────────────────────────────────────────────────────────

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  // P2021: table does not exist. P2022: column does not exist. 42P01: raw
  // "relation does not exist" if a query ever bypasses the typed client.
  if (code === "P2021" || code === "P2022" || code === "42P01") return true;
  const message = (error as { message?: string }).message ?? "";
  return /does not exist in the current database|relation .* does not exist|column .* does not exist/i.test(
    message,
  );
}

async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isMissingRelationError(error)) {
      return fallback;
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregate rating summary for a single offering. Empty when none / not migrated. */
export async function getClassFeedbackSummary(
  offeringId: string,
): Promise<ClassFeedbackSummary> {
  const rows = await safeRead(
    () =>
      prisma.classFeedback.findMany({
        where: { offeringId },
        select: { rating: true, wouldRecommend: true },
      }),
    [] as Array<{ rating: number; wouldRecommend: boolean | null }>,
  );
  return summarizeFeedback(rows);
}

/**
 * Individual student feedback for an offering, newest first, with student names
 * resolved in app code (studentId is FK-less by convention).
 */
export async function getStudentFeedbackForOffering(
  offeringId: string,
): Promise<StudentFeedbackEntry[]> {
  const rows = await safeRead(
    () =>
      prisma.classFeedback.findMany({
        where: { offeringId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          studentId: true,
          rating: true,
          liked: true,
          improve: true,
          wouldRecommend: true,
          createdAt: true,
        },
      }),
    [] as Array<{
      id: string;
      studentId: string;
      rating: number;
      liked: string | null;
      improve: string | null;
      wouldRecommend: boolean | null;
      createdAt: Date;
    }>,
  );

  if (rows.length === 0) return [];

  const students = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } },
    select: { id: true, name: true, email: true },
  });
  const nameById = new Map(
    students.map((s) => [s.id, s.name || s.email || "Student"]),
  );

  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: nameById.get(row.studentId) ?? "Student",
    rating: row.rating,
    liked: row.liked,
    improve: row.improve,
    wouldRecommend: row.wouldRecommend,
    createdAt: row.createdAt,
  }));
}

/** The completion-outcome record for an offering (instructor reflection + admin outcome). */
export async function getClassOutcome(
  offeringId: string,
): Promise<ClassOutcomeRecord | null> {
  const row = await safeRead(
    () =>
      prisma.classOutcome.findUnique({
        where: { offeringId },
      }),
    null,
  );
  if (!row) return null;
  return {
    offeringId: row.offeringId,
    instructorWentWell: row.instructorWentWell,
    instructorChallenges: row.instructorChallenges,
    instructorStudentImpact: row.instructorStudentImpact,
    instructorWouldTeachAgain: row.instructorWouldTeachAgain,
    instructorReflectedAt: row.instructorReflectedAt,
    status: row.status,
    repeatRecommendation: row.repeatRecommendation,
    gotGoodFeedback: row.gotGoodFeedback,
    adminNotes: row.adminNotes,
    recordedAt: row.recordedAt,
    hasInstructorReflection: Boolean(
      row.instructorWentWell ||
        row.instructorChallenges ||
        row.instructorStudentImpact ||
        row.instructorWouldTeachAgain != null,
    ),
  };
}

/**
 * Classes a student took that have wrapped up but that they have not given
 * feedback on yet. Powers the post-class feedback prompt in My Classes.
 */
export async function getMyClassFeedbackPrompts(
  userId: string,
): Promise<FeedbackPrompt[]> {
  return safeRead(async () => {
    const now = new Date();
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        studentId: userId,
        status: { in: ["ENROLLED", "COMPLETED"] },
        offering: {
          OR: [{ status: "COMPLETED" }, { endDate: { lt: now } }],
          // A cancelled class never really ran — nothing to rate.
          NOT: { status: "CANCELLED" },
        },
      },
      select: {
        offeringId: true,
        offering: {
          select: {
            id: true,
            title: true,
            endDate: true,
            instructor: { select: { name: true } },
            template: { select: { interestArea: true } },
          },
        },
      },
      orderBy: { offering: { endDate: "desc" } },
    });

    if (enrollments.length === 0) return [];

    const offeringIds = enrollments.map((e) => e.offeringId);
    const existing = await prisma.classFeedback.findMany({
      where: { studentId: userId, offeringId: { in: offeringIds } },
      select: { offeringId: true },
    });
    const answered = new Set(existing.map((f) => f.offeringId));

    return enrollments
      .filter((e) => !answered.has(e.offeringId))
      .map((e) => ({
        offeringId: e.offering.id,
        title: e.offering.title,
        instructorName: e.offering.instructor?.name ?? "Your instructor",
        interestArea: e.offering.template?.interestArea ?? "Class",
        endDate: e.offering.endDate,
      }));
  }, [] as FeedbackPrompt[]);
}

export type MyClassFeedback = {
  rating: number;
  liked: string | null;
  improve: string | null;
  wouldRecommend: boolean | null;
  createdAt: Date;
};

/** A student's own feedback for an offering (for prefilling the edit form). */
export async function getMyClassFeedback(
  userId: string,
  offeringId: string,
): Promise<MyClassFeedback | null> {
  return safeRead(
    () =>
      prisma.classFeedback.findUnique({
        where: { offeringId_studentId: { offeringId, studentId: userId } },
        select: {
          rating: true,
          liked: true,
          improve: true,
          wouldRecommend: true,
          createdAt: true,
        },
      }),
    null,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports: program-wide feedback + repeat planning
// ─────────────────────────────────────────────────────────────────────────────

export type ClassFeedbackReportRow = {
  offeringId: string;
  title: string;
  instructorName: string;
  interestArea: string;
  status: string;
  avgRating: number;
  responseCount: number;
  recommendPct: number | null;
  outcomeStatus: ClassOutcomeStatus | null;
  repeatRecommendation: ClassRepeatRecommendation | null;
  gotGoodFeedbackFlag: boolean;
};

export type ClassFeedbackReport = {
  totalResponses: number;
  ratedClasses: number;
  avgRating: number | null;
  goodFeedback: ClassFeedbackReportRow[];
  repeatPlan: ClassFeedbackReportRow[];
  needsOutcomeReview: Array<{
    offeringId: string;
    title: string;
    instructorName: string;
    endDate: Date;
  }>;
};

type ReportOffering = {
  id: string;
  title: string;
  status: string;
  endDate: Date;
  instructorName: string;
  interestArea: string;
};

/**
 * Build the feedback + repeat-planning view for /admin/classes/reports from a
 * list of offerings already loaded by getClassReports. Takes the offerings so we
 * don't re-query the catalog; only the feedback/outcome tables are fetched here.
 */
export async function getClassFeedbackReport(
  offerings: ReportOffering[],
): Promise<ClassFeedbackReport> {
  const { classFeedback } = await getPortalSettings();
  const [feedbackRows, outcomeRows] = await Promise.all([
    safeRead(
      () =>
        prisma.classFeedback.findMany({
          select: { offeringId: true, rating: true, wouldRecommend: true },
        }),
      [] as Array<{
        offeringId: string;
        rating: number;
        wouldRecommend: boolean | null;
      }>,
    ),
    safeRead(
      () =>
        prisma.classOutcome.findMany({
          select: {
            offeringId: true,
            status: true,
            repeatRecommendation: true,
            gotGoodFeedback: true,
          },
        }),
      [] as Array<{
        offeringId: string;
        status: ClassOutcomeStatus;
        repeatRecommendation: ClassRepeatRecommendation | null;
        gotGoodFeedback: boolean;
      }>,
    ),
  ]);

  const offeringById = new Map(offerings.map((o) => [o.id, o]));

  // Aggregate feedback per offering.
  const feedbackByOffering = new Map<
    string,
    Array<{ rating: number; wouldRecommend: boolean | null }>
  >();
  for (const row of feedbackRows) {
    const list = feedbackByOffering.get(row.offeringId) ?? [];
    list.push({ rating: row.rating, wouldRecommend: row.wouldRecommend });
    feedbackByOffering.set(row.offeringId, list);
  }

  const outcomeByOffering = new Map(outcomeRows.map((o) => [o.offeringId, o]));

  let totalResponses = 0;
  let ratingSum = 0;

  const rows: ClassFeedbackReportRow[] = [];
  for (const [offeringId, list] of feedbackByOffering) {
    const offering = offeringById.get(offeringId);
    if (!offering) continue;
    const summary = summarizeFeedback(list);
    totalResponses += summary.responseCount;
    ratingSum += summary.avgRating * summary.responseCount;
    const outcome = outcomeByOffering.get(offeringId);
    rows.push({
      offeringId,
      title: offering.title,
      instructorName: offering.instructorName,
      interestArea: offering.interestArea,
      status: offering.status,
      avgRating: summary.avgRating,
      responseCount: summary.responseCount,
      recommendPct: summary.recommendPct,
      outcomeStatus: outcome?.status ?? null,
      repeatRecommendation: outcome?.repeatRecommendation ?? null,
      gotGoodFeedbackFlag: outcome?.gotGoodFeedback ?? false,
    });
  }

  // "Got good feedback": admin-flagged, or strong ratings with enough responses.
  // Also surface offerings an admin flagged even if students did not rate.
  const flaggedOnly: ClassFeedbackReportRow[] = [];
  for (const outcome of outcomeRows) {
    if (!outcome.gotGoodFeedback) continue;
    if (feedbackByOffering.has(outcome.offeringId)) continue; // already in rows
    const offering = offeringById.get(outcome.offeringId);
    if (!offering) continue;
    flaggedOnly.push({
      offeringId: outcome.offeringId,
      title: offering.title,
      instructorName: offering.instructorName,
      interestArea: offering.interestArea,
      status: offering.status,
      avgRating: 0,
      responseCount: 0,
      recommendPct: null,
      outcomeStatus: outcome.status,
      repeatRecommendation: outcome.repeatRecommendation,
      gotGoodFeedbackFlag: true,
    });
  }

  const goodFeedback = [...rows, ...flaggedOnly]
    .filter((row) =>
      isGoodFeedback(
        {
          avgRating: row.avgRating,
          responseCount: row.responseCount,
          flagged: row.gotGoodFeedbackFlag,
        },
        {
          minRating: classFeedback.goodFeedbackMinRating,
          minResponses: classFeedback.goodFeedbackMinResponses,
        },
      ),
    )
    .sort(
      (a, b) =>
        Number(b.gotGoodFeedbackFlag) - Number(a.gotGoodFeedbackFlag) ||
        b.avgRating - a.avgRating ||
        b.responseCount - a.responseCount,
    );

  const repeatOrder = new Map(
    REPEAT_RECOMMENDATION_ORDER.map((value, index) => [value, index]),
  );
  const repeatPlan = [...rows, ...flaggedOnly]
    .filter((row) => isRepeatRecommendation(row.repeatRecommendation))
    .sort(
      (a, b) =>
        (repeatOrder.get(a.repeatRecommendation!) ?? 99) -
          (repeatOrder.get(b.repeatRecommendation!) ?? 99) ||
        b.avgRating - a.avgRating,
    );

  // Completed classes still awaiting an admin outcome.
  const needsOutcomeReview = offerings
    .filter((offering) => {
      if (offering.status !== "COMPLETED") return false;
      const outcome = outcomeByOffering.get(offering.id);
      return !outcome || outcome.status === "PENDING";
    })
    .map((offering) => ({
      offeringId: offering.id,
      title: offering.title,
      instructorName: offering.instructorName,
      endDate: offering.endDate,
    }))
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());

  return {
    totalResponses,
    ratedClasses: rows.length,
    avgRating: totalResponses > 0 ? ratingSum / totalResponses : null,
    goodFeedback,
    repeatPlan,
    needsOutcomeReview,
  };
}
