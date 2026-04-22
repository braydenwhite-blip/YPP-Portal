import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import {
  getApplicantPipeline,
  getArchivedApplications,
} from "@/lib/instructor-applicant-board-queries";
import InstructorApplicantsCommandCenter from "@/components/instructor-applicants/InstructorApplicantsCommandCenter";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";

const DEMO_PIPELINE_TAKE = 48;
const DEMO_FILTER_TAKE = 40;

export default async function ChapterLeadInstructorApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isChapterPresident = roles.includes("CHAPTER_PRESIDENT");
  const isAdmin = roles.includes("ADMIN");
  const hiringDemoMode = isHiringDemoModeEnabled();

  if (!isChapterPresident && !isAdmin) {
    redirect("/");
  }

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    // TODO: render legacy view when flag is off
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Instructor Applicants</h1>
            <p className="page-subtitle">
              The new applicant workflow is currently disabled.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { chapterId: true },
  });
  const chapterId = user?.chapterId ?? undefined;

  const resolvedParams = await searchParams;
  const reviewerId = (resolvedParams.reviewerId as string) || undefined;
  const interviewerId = (resolvedParams.interviewerId as string) || undefined;
  const materialsMissing = resolvedParams.materialsMissing === "1";
  const overdueOnly = resolvedParams.overdueOnly === "1";
  const myCasesOnly = resolvedParams.myCasesOnly === "1";

  const pipelineFilters = {
    reviewerId,
    interviewerId,
    materialsMissing,
    overdueOnly,
    myCasesActorId: myCasesOnly ? session!.user.id : undefined,
  };

  const loadReviewerUsers = () =>
    prisma.user.findMany({
      where: {
        chapterId: chapterId ?? undefined,
        OR: [
          { roles: { some: { role: "ADMIN" } } },
          { roles: { some: { role: "CHAPTER_PRESIDENT" } } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: hiringDemoMode ? DEMO_FILTER_TAKE : undefined,
    });

  const loadInterviewerUsers = () =>
    prisma.user.findMany({
      where: {
        chapterId: chapterId ?? undefined,
        OR: [
          { roles: { some: { role: "ADMIN" } } },
          { roles: { some: { role: "CHAPTER_PRESIDENT" } } },
          {
            featureGateRulesTargeted: {
              some: { featureKey: "INTERVIEWER", enabled: true },
            },
          },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: hiringDemoMode ? DEMO_FILTER_TAKE : undefined,
    });

  let pipelineResult: Awaited<ReturnType<typeof getApplicantPipeline>>;
  let archiveResult: Awaited<ReturnType<typeof getArchivedApplications>>;
  let reviewerUsers: Awaited<ReturnType<typeof loadReviewerUsers>>;
  let interviewerUsers: Awaited<ReturnType<typeof loadInterviewerUsers>>;

  if (hiringDemoMode) {
    pipelineResult = await getApplicantPipeline({
      scope: "chapter",
      chapterId,
      filters: pipelineFilters,
      take: DEMO_PIPELINE_TAKE,
    });
    archiveResult = { items: [], total: 0, skip: 0, take: 0 };
    reviewerUsers = await loadReviewerUsers();
    interviewerUsers = reviewerUsers;
  } else {
    [pipelineResult, archiveResult, reviewerUsers, interviewerUsers] = await Promise.all([
      getApplicantPipeline({
        scope: "chapter",
        chapterId,
        filters: pipelineFilters,
      }),
      getArchivedApplications({ scope: "chapter", chapterId }),
      loadReviewerUsers(),
      loadInterviewerUsers(),
    ]);
  }

  const pipelineApps = (Object.values(pipelineResult.columns).flat() as any[]);

  function serializeApp(app: any) {
    return {
      id: app.id as string,
      status: app.status as string,
      materialsReadyAt: (app.materialsReadyAt as Date | null)?.toISOString() ?? null,
      interviewScheduledAt: (app.interviewScheduledAt as Date | null)?.toISOString() ?? null,
      archivedAt: (app.archivedAt as Date | null)?.toISOString() ?? null,
      updatedAt: (app.updatedAt as Date | null)?.toISOString() ?? null,
      overdue: app.overdue as boolean | undefined,
      subjectsOfInterest: app.subjectsOfInterest as string | null,
      applicant: {
        id: app.applicant.id as string,
        name: app.applicant.name as string | null,
        email: app.applicant.email as string,
        chapter: app.applicant.chapter
          ? { id: app.applicant.chapter.id as string, name: app.applicant.chapter.name as string }
          : null,
      },
      reviewer: app.reviewer
        ? { id: app.reviewer.id as string, name: app.reviewer.name as string | null }
        : null,
      interviewerAssignments: (app.interviewerAssignments as Array<{id: string; role: string; interviewer: {id: string; name: string | null}}>) ?? [],
      applicationReviews: (app.applicationReviews as Array<{summary: string | null; nextStep: string | null; overallRating: string | null}>) ?? [],
      chairDecision: app.chairDecision
        ? { action: app.chairDecision.action as string, decidedAt: (app.chairDecision.decidedAt as Date).toISOString() }
        : null,
    };
  }

  const serializedPipeline = pipelineApps.map(serializeApp);
  const serializedArchive = archiveResult.items.map((app) => ({
    id: app.id,
    status: app.status,
    archivedAt: app.archivedAt?.toISOString() ?? null,
    updatedAt: app.updatedAt.toISOString(),
    subjectsOfInterest: app.subjectsOfInterest ?? null,
    applicant: {
      id: app.applicant.id,
      name: app.applicant.name,
      email: "",
      chapter: app.applicant.chapter ?? null,
    },
    reviewer: app.reviewer ?? null,
    chairDecision: app.chairDecision
      ? { action: app.chairDecision.action, decidedAt: app.chairDecision.decidedAt.toISOString() }
      : null,
    materialsReadyAt: null as string | null,
    interviewScheduledAt: null as string | null,
    interviewerAssignments: [] as Array<{ id: string; role: string; interviewer: { id: string; name: string | null } }>,
    overdue: false,
    applicationReviews: [] as Array<{ summary: string | null; nextStep: string | null; overallRating: string | null }>,
  }));

  const newCount = pipelineResult.columns.new.length;
  const toReviewCount = pipelineResult.columns.needs_review.length;
  const toInterviewCount =
    pipelineResult.columns.interview_prep.length + pipelineResult.columns.ready_for_interview.length;
  const postInterviewCount = pipelineResult.columns.post_interview.length;

  return (
    <div className="page-shell applicant-command-page">
      <div className="page-header applicant-command-header">
        <div>
          <span className="badge">Chapter President</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Review and manage instructor applicants from your chapter.
          </p>
        </div>
      </div>

      <div className="grid four applicant-command-kpis">
        <div className="card kpi applicant-command-kpi">
          <div className="kpi-value">{newCount}</div>
          <div className="kpi-label">New Applications</div>
        </div>
        <div className="card kpi applicant-command-kpi">
          <div className="kpi-value">{toReviewCount}</div>
          <div className="kpi-label">Needs Review</div>
        </div>
        <div className="card kpi applicant-command-kpi">
          <div className="kpi-value">{toInterviewCount}</div>
          <div className="kpi-label">In Interview Stage</div>
        </div>
        <div className="card kpi applicant-command-kpi">
          <div className="kpi-value">{postInterviewCount}</div>
          <div className="kpi-label">Post-Interview</div>
        </div>
      </div>

      <InstructorApplicantsCommandCenter
        scope="chapter"
        chapterId={chapterId}
        pipelineApps={serializedPipeline as any}
        archivedApps={serializedArchive as any}
        chairQueueCount={0}
        canSeeChairQueue={false}
        reviewers={reviewerUsers}
        interviewers={interviewerUsers}
        actorId={session!.user.id}
        isAdmin={false}
      />
    </div>
  );
}
