import {
  isAdmin,
  isAssignedReviewer,
  isChapterLead,
  type HiringActor,
} from "@/lib/chapter-hiring-permissions";
import {
  INITIAL_REVIEW_LOCKED_MESSAGE,
  isInitialReviewLocked,
} from "@/lib/applicant-review-stage";
import type { ApplicationRecord } from "@/lib/applications/application-record";
import {
  getInstructorApplicationReviewWorkspace,
  getInstructorInterviewReviewWorkspace,
} from "@/lib/instructor-review-actions";

function deepSerialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (v instanceof Date ? v.toISOString() : v))
  ) as T;
}

export type InlineInitialReviewPanel = {
  myReview: Awaited<
    ReturnType<typeof getInstructorApplicationReviewWorkspace>
  >["myReview"];
  canEdit: boolean;
  lockedReason: string | null;
  isLeadReviewer: boolean;
  hasLeadInterviewer: boolean;
  roughPlan: {
    courseIdea: string | null;
    courseOutline: string | null;
    firstClassPlan: string | null;
  };
};

export type InlineInterviewReviewPanel = {
  myReview: Awaited<
    ReturnType<typeof getInstructorInterviewReviewWorkspace>
  >["myReview"];
  canEdit: boolean;
  isLeadReviewer: boolean;
  canFinalizeRecommendation: boolean;
  questionBank: Awaited<
    ReturnType<typeof getInstructorInterviewReviewWorkspace>
  >["questionBank"];
};

export type InlineReviewPanels = {
  initial: InlineInitialReviewPanel | null;
  interview: InlineInterviewReviewPanel | null;
};

/** Load review editors for embedding on Application 360 (best-effort). */
export async function loadInlineReviewPanels(
  applicationId: string,
  record: ApplicationRecord,
  actor: HiringActor
): Promise<InlineReviewPanels> {
  const actorIsAdmin = isAdmin(actor);
  const actorIsReviewer = isAssignedReviewer(actor, {
    id: record.id,
    applicantId: record.applicant.id,
    reviewerId: record.reviewer?.id ?? null,
    interviewRound: record.interviewRound,
    applicantChapterId: record.applicant.chapterId,
    interviewerAssignments: record.interviewerAssignments.map((a) => ({
      interviewerId: a.interviewer.id,
      round: a.round,
      removedAt: null,
    })),
  });
  const actorIsChapterLead = isChapterLead(actor);
  const initialReviewLocked = isInitialReviewLocked(record.status);
  const hasLeadInterviewer = record.interviewerAssignments.some((a) => a.role === "LEAD");

  let initial: InlineInitialReviewPanel | null = null;
  try {
    const workspace = await getInstructorApplicationReviewWorkspace(applicationId);
    const isReadOnlyReview =
      initialReviewLocked ||
      (!actorIsReviewer && !actorIsAdmin && !actorIsChapterLead);

    initial = deepSerialize({
      myReview: workspace.myReview,
      canEdit: !isReadOnlyReview,
      lockedReason: initialReviewLocked ? INITIAL_REVIEW_LOCKED_MESSAGE : null,
      isLeadReviewer: workspace.isLeadReviewer,
      hasLeadInterviewer,
      roughPlan: {
        courseIdea: record.courseIdea,
        courseOutline: record.courseOutline,
        firstClassPlan: record.firstClassPlan,
      },
    });
  } catch {
    /* viewer cannot access the application review workspace */
  }

  let interview: InlineInterviewReviewPanel | null = null;
  try {
    const workspace = await getInstructorInterviewReviewWorkspace(applicationId);

    interview = deepSerialize({
      myReview: workspace.myReview,
      canEdit: workspace.myReview?.status !== "SUBMITTED" || actorIsAdmin,
      isLeadReviewer: workspace.myReview?.isLeadReview ?? false,
      canFinalizeRecommendation: workspace.canFinalizeRecommendation,
      questionBank: workspace.questionBank,
    });
  } catch {
    /* not at interview stage or no access */
  }

  return { initial, interview };
}
