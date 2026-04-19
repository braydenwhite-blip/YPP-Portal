import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { canSeeChairQueue } from "@/lib/chapter-hiring-permissions";
import {
  getApplicantPipeline,
  getArchivedApplications,
  getChairQueue,
} from "@/lib/instructor-applicant-board-queries";
import InstructorApplicantsCommandCenter from "@/components/instructor-applicants/InstructorApplicantsCommandCenter";

export default async function AdminInstructorApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterPresident = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterPresident) {
    redirect("/");
  }

  // Feature flag gate — if off, show legacy empty state with TODO
  if (!isInstructorApplicantWorkflowV1Enabled()) {
    // TODO: render legacy InstructorKanbanBoard when flag is off
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">Instructor Applicants</h1>
            <p className="page-subtitle">
              The new applicant workflow is currently disabled. Set{" "}
              <code>ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=true</code> to enable it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const resolvedParams = await searchParams;
  const actor = {
    id: session!.user.id,
    roles: roles as string[],
    chapterId: null as string | null,
    featureKeys: new Set<string>(),
  };

  // Resolve chapter for scoped queries
  let chapterId: string | undefined;
  if (isChapterPresident && !isAdmin) {
    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { chapterId: true },
    });
    chapterId = user?.chapterId ?? undefined;
    actor.chapterId = user?.chapterId ?? null;
  }

  // Parse filters from URL
  const filterChapterId = (resolvedParams.chapterId as string) || undefined;
  const reviewerId = (resolvedParams.reviewerId as string) || undefined;
  const interviewerId = (resolvedParams.interviewerId as string) || undefined;
  const materialsMissing = resolvedParams.materialsMissing === "1";
  const overdueOnly = resolvedParams.overdueOnly === "1";
  const myCasesOnly = resolvedParams.myCasesOnly === "1";

  const effectiveChapterId = isAdmin ? filterChapterId : chapterId;
  const scope = isAdmin ? "admin" : "chapter";

  // Determine chair queue visibility
  const showChairQueue = canSeeChairQueue(actor);

  const [pipelineResult, archiveResult, chairQueueItems, chapters, reviewerUsers, interviewerUsers] =
    await Promise.all([
      getApplicantPipeline({
        scope,
        chapterId: effectiveChapterId,
        filters: {
          reviewerId,
          interviewerId,
          materialsMissing,
          overdueOnly,
          myCasesActorId: myCasesOnly ? session!.user.id : undefined,
        },
      }),
      getArchivedApplications({ scope, chapterId: effectiveChapterId }),
      showChairQueue
        ? getChairQueue({ scope, chapterId: effectiveChapterId })
        : Promise.resolve([]),
      isAdmin
        ? prisma.chapter.findMany({
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      prisma.user.findMany({
        where: {
          OR: [
            { roles: { some: { role: "ADMIN" } } },
            { roles: { some: { role: "CHAPTER_PRESIDENT" } } },
            { roles: { some: { role: "HIRING_CHAIR" } } },
          ],
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
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
      }),
    ]);

  // Flatten pipeline columns into a single array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineApps = (Object.values(pipelineResult.columns).flat() as any[]);

  // Serialize dates for client components
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function serializeApp(app: any) {
    return {
      id: app.id as string,
      status: app.status as string,
      materialsReadyAt: (app.materialsReadyAt as Date | null)?.toISOString() ?? null,
      archivedAt: (app.archivedAt as Date | null)?.toISOString() ?? null,
      updatedAt: (app.updatedAt as Date | null)?.toISOString() ?? null,
      overdue: app.overdue as boolean | undefined,
      applicant: {
        id: app.applicant.id as string,
        name: app.applicant.name as string | null,
        email: app.applicant.email as string,
        subjectsOfInterest: app.applicant.subjectsOfInterest as string | null,
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
    applicant: {
      id: app.applicant.id,
      name: app.applicant.name,
      email: "",
      subjectsOfInterest: null as string | null,
      chapter: app.applicant.chapter ?? null,
    },
    reviewer: app.reviewer ?? null,
    chairDecision: app.chairDecision
      ? { action: app.chairDecision.action, decidedAt: app.chairDecision.decidedAt.toISOString() }
      : null,
    materialsReadyAt: null as string | null,
    interviewerAssignments: [] as Array<{ id: string; role: string; interviewer: { id: string; name: string | null } }>,
    overdue: false,
    applicationReviews: [] as Array<{ summary: string | null; nextStep: string | null; overallRating: string | null }>,
  }));

  const newCount = pipelineResult.columns.new.length;
  const toReviewCount = pipelineResult.columns.needs_review.length;
  const toInterviewCount =
    pipelineResult.columns.interview_prep.length +
    pipelineResult.columns.ready_for_interview.length;
  const postInterviewCount = pipelineResult.columns.post_interview.length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">{isAdmin ? "Admin" : "Chapter President"}</span>
          <h1 className="page-title">Instructor Applicants</h1>
          <p className="page-subtitle">
            Pipeline, assignments, and decisions for all instructor applicants.
          </p>
        </div>
      </div>

      <div className="grid four" style={{ marginTop: 20, marginBottom: 20 }}>
        <div className="card kpi">
          <div className="kpi-value">{newCount}</div>
          <div className="kpi-label">New Applications</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{toReviewCount}</div>
          <div className="kpi-label">Needs Review</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{toInterviewCount}</div>
          <div className="kpi-label">In Interview Stage</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{postInterviewCount}</div>
          <div className="kpi-label">Post-Interview</div>
        </div>
      </div>

      <InstructorApplicantsCommandCenter
        scope={isAdmin ? "global" : "chapter"}
        chapterId={chapterId}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pipelineApps={serializedPipeline as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        archivedApps={serializedArchive as any}
        chairQueueCount={chairQueueItems.length}
        canSeeChairQueue={showChairQueue}
        chapters={chapters}
        reviewers={reviewerUsers}
        interviewers={interviewerUsers}
        actorId={session!.user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
