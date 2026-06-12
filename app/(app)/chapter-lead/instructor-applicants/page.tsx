import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { ApplicationTrack } from "@prisma/client";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import {
  getApplicantPipeline,
  getArchivedApplications,
} from "@/lib/instructor-applicant-board-queries";
import InstructorApplicantsCommandCenter from "@/components/instructor-applicants/InstructorApplicantsCommandCenter";
import ApplicantPipelineOverview from "@/components/instructor-applicants/ApplicantPipelineOverview";
import { type FunnelCounts } from "@/components/instructor-applicants/ApplicantPipelineOverview";
import { PageHeaderV2 } from "@/components/ui-v2";
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

  // Chapter Presidents without a chapter assignment see nothing — global admins
  // own no-chapter applicants. The downstream queries also short-circuit, but
  // we render a friendly state here so the CP isn't staring at an empty board.
  if (isChapterPresident && !isAdmin && !chapterId) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <span className="badge">Chapter President</span>
            <h1 className="page-title">Instructor Applicants</h1>
            <p className="page-subtitle">
              No chapter is assigned to your account yet, so there are no applicants to show. Ask
              an administrator to link your account to a chapter.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const resolvedParams = await searchParams;
  const reviewerId = (resolvedParams.reviewerId as string) || undefined;
  const interviewerId = (resolvedParams.interviewerId as string) || undefined;
  const materialsMissing = resolvedParams.materialsMissing === "1";
  const overdueOnly = resolvedParams.overdueOnly === "1";
  const myCasesOnly = resolvedParams.myCasesOnly === "1";

  // Subtype filter: ?track=summer_workshop | standard. Same shape as the
  // admin page — mirrors the chip group rendered by
  // InstructorApplicantsCommandCenter so CPs actually filter their pipeline
  // when they click the chips (chapter scoping is still enforced below).
  const applicationTrackParam = (resolvedParams.track as string | undefined)?.toLowerCase();
  const applicationTrackFilter: ApplicationTrack | undefined =
    applicationTrackParam === "summer_workshop"
      ? ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
      : applicationTrackParam === "standard"
      ? ApplicationTrack.STANDARD_INSTRUCTOR
      : undefined;

  const pipelineFilters = {
    reviewerId,
    interviewerId,
    materialsMissing,
    overdueOnly,
    myCasesActorId: myCasesOnly ? session!.user.id : undefined,
    applicationTrack: applicationTrackFilter,
  };

  // The "filter by reviewer/interviewer" dropdown only needs people who could
  // realistically own work in this chapter's pipeline. We require chapterId to
  // avoid `chapterId: undefined` collapsing to "no filter".
  const loadReviewerUsers = () =>
    chapterId
      ? prisma.user.findMany({
          where: {
            chapterId,
            OR: [
              { roles: { some: { role: "ADMIN" } } },
              { roles: { some: { role: "CHAPTER_PRESIDENT" } } },
            ],
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
          take: hiringDemoMode ? DEMO_FILTER_TAKE : undefined,
        })
      : Promise.resolve([] as Array<{ id: string; name: string | null; email: string }>);

  const loadInterviewerUsers = () =>
    chapterId
      ? prisma.user.findMany({
          where: {
            chapterId,
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
        })
      : Promise.resolve([] as Array<{ id: string; name: string | null; email: string }>);

  let pipelineResult: Awaited<ReturnType<typeof getApplicantPipeline>>;
  let archiveResult: Awaited<ReturnType<typeof getArchivedApplications>>;
  let reviewerUsers: Awaited<ReturnType<typeof loadReviewerUsers>>;
  let interviewerUsers: Awaited<ReturnType<typeof loadInterviewerUsers>>;
  let funnelCounts: FunnelCounts = {};

  if (hiringDemoMode) {
    [pipelineResult, reviewerUsers] = await Promise.all([
      getApplicantPipeline({
        scope: "chapter",
        chapterId,
        filters: pipelineFilters,
        take: DEMO_PIPELINE_TAKE,
      }),
      loadReviewerUsers(),
    ]);
    archiveResult = { items: [], total: 0, skip: 0, take: 0 };
    interviewerUsers = reviewerUsers;
  } else {
    const funnelGroupBy =
      chapterId != null
        ? prisma.instructorApplication.groupBy({
            by: ["status"],
            _count: true,
            where: { archivedAt: null, applicant: { chapterId } },
          })
        : Promise.resolve([] as Awaited<ReturnType<typeof prisma.instructorApplication.groupBy>>);

    const [pipelineRes, archiveRes, reviewerRes, interviewerRes, funnelRes] = await Promise.all([
      getApplicantPipeline({
        scope: "chapter",
        chapterId,
        filters: pipelineFilters,
      }),
      getArchivedApplications({ scope: "chapter", chapterId }),
      loadReviewerUsers(),
      loadInterviewerUsers(),
      funnelGroupBy,
    ]);

    pipelineResult = pipelineRes;
    archiveResult = archiveRes;
    reviewerUsers = reviewerRes;
    interviewerUsers = interviewerRes;
    funnelCounts = Object.fromEntries(funnelRes.map((row) => [row.status, row._count])) as FunnelCounts;
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
      legalName: (app.legalName as string | null) ?? null,
      preferredFirstName: (app.preferredFirstName as string | null) ?? null,
      lastName: (app.lastName as string | null) ?? null,
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
      applicationTrack: (app.applicationTrack as string) ?? "STANDARD_INSTRUCTOR",
      instructorSubtype: (app.instructorSubtype as string) ?? "STANDARD",
      workshopOutlinePresent: !!app.workshopOutline,
    };
  }

  const serializedPipeline = pipelineApps.map(serializeApp);
  const serializedArchive = archiveResult.items.map((app) => ({
    id: app.id,
    status: app.status,
    archivedAt: app.archivedAt?.toISOString() ?? null,
    updatedAt: app.updatedAt.toISOString(),
    subjectsOfInterest: app.subjectsOfInterest ?? null,
    legalName: app.legalName ?? null,
    preferredFirstName: app.preferredFirstName ?? null,
    lastName: app.lastName ?? null,
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
    applicationTrack: (app as { applicationTrack?: string }).applicationTrack ?? "STANDARD_INSTRUCTOR",
    instructorSubtype: (app as { instructorSubtype?: string }).instructorSubtype ?? "STANDARD",
    workshopOutlinePresent: !!(app as { workshopOutline?: unknown }).workshopOutline,
  }));

  const newCount = pipelineResult.columns.new.length;
  const toReviewCount = pipelineResult.columns.needs_review.length;
  const toInterviewCount =
    pipelineResult.columns.interview_prep.length + pipelineResult.columns.ready_for_interview.length;
  const postInterviewCount = pipelineResult.columns.post_interview.length;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-6 py-6">
      <PageHeaderV2
        eyebrow="Chapter President"
        title="Instructor Applicants"
        subtitle="Review and manage instructor applicants from your chapter."
      />

      <ApplicantPipelineOverview
        filteredCounts={{
          newApplications: newCount,
          needsReview: toReviewCount,
          interviewStage: toInterviewCount,
          postInterview: postInterviewCount,
        }}
        funnelCounts={funnelCounts}
      />

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
