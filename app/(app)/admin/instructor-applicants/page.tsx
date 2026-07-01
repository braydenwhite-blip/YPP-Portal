import { prisma } from "@/lib/prisma";
import { ApplicationTrack, ApplicationSource } from "@prisma/client";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { canSeeChairQueue } from "@/lib/chapter-hiring-permissions";
import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  getApplicantPipeline,
  getApplicantsWorkspace,
  getArchivedApplications,
  getChairQueue,
} from "@/lib/instructor-applicant-board-queries";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import InstructorApplicantsCommandCenter from "@/components/instructor-applicants/InstructorApplicantsCommandCenter";
import { buttonVariants, PageHeaderV2 } from "@/components/ui-v2";
import { ArchiveAllButton } from "@/components/instructor-applicants/ArchiveActions";
import { type FunnelCounts } from "@/components/instructor-applicants/ApplicantPipelineOverview";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";

const DEMO_PIPELINE_TAKE = 48;
const DEMO_FILTER_TAKE = 40;

export default async function AdminInstructorApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Hiring chairs need pipeline context (prior reviews, in-flight interview
  // queues, chapter peers) before deciding applicants. Allow read access to
  // the board; mutations remain gated on the role-specific assertions inside
  // each server action (chairDecide, assignReviewer, etc.).
  const sessionUser = await requireApplicationReviewerPage();
  const roles = sessionUser.roles;
  const isAdmin = roles.includes("ADMIN");
  const isChapterPresident = roles.includes("CHAPTER_PRESIDENT");
  const isHiringChair = roles.includes("HIRING_CHAIR");

  const hiringDemoMode = isHiringDemoModeEnabled();

  // Feature flag gate — when the applicant workflow is disabled, hand off to the
  // live Instructor Operations database (and the People hub) instead of leaving
  // the reviewer on a dead end. No TODO / blank state.
  if (!isInstructorApplicantWorkflowV1Enabled()) {
    return (
      <ApplicationReviewShell
        maxWidth={1100}
        header={
          <PageHeaderV2
            eyebrow={isAdmin ? "Admin" : isHiringChair ? "Hiring chair" : "Chapter president"}
            title="Application board"
            subtitle="The applicant review board is turned off in this environment. Confirmed instructors and their lifecycle still live in the Instructor Operations database — pick up there."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/admin/instructors"
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  Open Instructor Operations
                </a>
                <a
                  href="/people"
                  className={buttonVariants({ variant: "secondary", size: "md" })}
                >
                  Open People
                </a>
              </div>
            }
          >
            <p className="text-sm text-[var(--muted,#6b7280)]">
              To re-enable the applicant pipeline, review, interview, and chair-decision
              workspace, set <code>ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=true</code>.
            </p>
          </PageHeaderV2>
        }
        actions={[{ label: "Home", href: "/", icon: "compass" }]}
      />
    );
  }

  const resolvedParams = await searchParams;
  const actor = {
    id: sessionUser.id,
    roles: roles as string[],
    chapterId: null as string | null,
    featureKeys: new Set<string>(),
  };

  // Resolve chapter for scoped queries.
  //
  // ADMIN and HIRING_CHAIR get network-wide visibility (chair-queue scope).
  // Pure CHAPTER_PRESIDENTs (no admin/chair role) are auto-scoped to their
  // own chapter and must have one assigned, otherwise the empty state.
  let chapterId: string | undefined;
  const needsChapterScope = isChapterPresident && !isAdmin && !isHiringChair;
  if (needsChapterScope) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { chapterId: true },
    });
    chapterId = user?.chapterId ?? undefined;
    actor.chapterId = user?.chapterId ?? null;

    // A CP without a chapter assignment must not see other chapters' data.
    if (!chapterId) {
      return (
        <ApplicationReviewShell
          maxWidth={1100}
          header={
            <PageHeaderV2
              eyebrow="Chapter president"
              title="Application board"
              subtitle="No chapter is assigned to your account yet, so there are no applicants to show. Ask an administrator to link your account to a chapter."
            />
          }
          actions={[{ label: "Home", href: "/", icon: "compass" }]}
        />
      );
    }
  }

  // Parse filters from URL
  const filterChapterId = (resolvedParams.chapterId as string) || undefined;
  const reviewerId = (resolvedParams.reviewerId as string) || undefined;
  const interviewerId = (resolvedParams.interviewerId as string) || undefined;
  const materialsMissing = resolvedParams.materialsMissing === "1";
  const overdueOnly = resolvedParams.overdueOnly === "1";
  const myCasesOnly = resolvedParams.myCasesOnly === "1";

  // Subtype filter: ?track=summer_workshop | standard. Omit/invalid = all.
  const applicationTrackParam = (resolvedParams.track as string | undefined)?.toLowerCase();
  const applicationTrackFilter: ApplicationTrack | undefined =
    applicationTrackParam === "summer_workshop"
      ? ApplicationTrack.SUMMER_WORKSHOP_INSTRUCTOR
      : applicationTrackParam === "standard"
      ? ApplicationTrack.STANDARD_INSTRUCTOR
      : undefined;

  // Source filter: ?source=portal | google_forms | csv_import | manual.
  // Omit/invalid = all sources (PORTAL + every external channel).
  const sourceParamRaw = (resolvedParams.source as string | undefined)?.toLowerCase();
  const sourceFilter: ApplicationSource | undefined =
    sourceParamRaw === "portal"
      ? ApplicationSource.PORTAL
      : sourceParamRaw === "google_forms"
        ? ApplicationSource.GOOGLE_FORMS
        : sourceParamRaw === "csv_import"
          ? ApplicationSource.CSV_IMPORT
          : sourceParamRaw === "manual" || sourceParamRaw === "manual_admin_entry"
            ? ApplicationSource.MANUAL_ADMIN_ENTRY
            : undefined;

  // HIRING_CHAIRs share ADMIN's network-wide scope so they can see prior
  // reviews and chapter peers before deciding. Pure CP scope still narrows
  // to a single chapter via `chapterId` above.
  const hasNetworkScope = isAdmin || isHiringChair;
  const effectiveChapterId = hasNetworkScope ? filterChapterId : chapterId;
  const scope: "admin" | "chapter" = hasNetworkScope ? "admin" : "chapter";

  // Determine chair queue visibility
  const showChairQueue = canSeeChairQueue(actor);

  const pipelineFilters = {
    reviewerId,
    interviewerId,
    materialsMissing,
    overdueOnly,
    myCasesActorId: myCasesOnly ? sessionUser.id : undefined,
    applicationTrack: applicationTrackFilter,
    source: sourceFilter,
  };

  const loadChapters = () =>
    hasNetworkScope
      ? prisma.chapter.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: hiringDemoMode ? DEMO_FILTER_TAKE : undefined,
        })
      : Promise.resolve([]);

  const loadReviewerUsers = () =>
    prisma.user.findMany({
      where: {
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
  let chairQueueItems: Awaited<ReturnType<typeof getChairQueue>>;
  let workspaceApps: Awaited<ReturnType<typeof getApplicantsWorkspace>>;
  let chapters: Awaited<ReturnType<typeof loadChapters>>;
  let reviewerUsers: Awaited<ReturnType<typeof loadReviewerUsers>>;
  let interviewerUsers: Awaited<ReturnType<typeof loadInterviewerUsers>>;

  // Funnel counts — separate query, no filters applied (global view of the funnel).
  // ADMIN and HIRING_CHAIR share the network-wide funnel; pure CPs see a
  // chapter-scoped funnel.
  const funnelGroupBy = hasNetworkScope
    ? prisma.instructorApplication.groupBy({
        by: ["status"],
        _count: true,
        where: { archivedAt: null },
      })
    : prisma.instructorApplication.groupBy({
        by: ["status"],
        _count: true,
        where: { archivedAt: null, applicant: { chapterId } },
      });

  let funnelCounts: FunnelCounts = {};

  if (hiringDemoMode) {
    [pipelineResult, chapters, reviewerUsers] = await Promise.all([
      getApplicantPipeline({
        scope,
        chapterId: effectiveChapterId,
        filters: pipelineFilters,
        take: DEMO_PIPELINE_TAKE,
      }),
      loadChapters(),
      loadReviewerUsers(),
    ]);
    archiveResult = { items: [], total: 0, skip: 0, take: 0 };
    chairQueueItems = [];
    workspaceApps = [];
    interviewerUsers = reviewerUsers;
  } else {
    const [pipelineRes, archiveRes, chairRes, workspaceRes, chaptersRes, reviewerRes, interviewerRes, funnelRes] =
      await Promise.all([
        getApplicantPipeline({
          scope,
          chapterId: effectiveChapterId,
          filters: pipelineFilters,
        }),
        getArchivedApplications({ scope, chapterId: effectiveChapterId }),
        showChairQueue
          ? getChairQueue({ scope, chapterId: effectiveChapterId })
          : Promise.resolve([]),
        getApplicantsWorkspace({ scope, chapterId: effectiveChapterId }),
        loadChapters(),
        loadReviewerUsers(),
        loadInterviewerUsers(),
        funnelGroupBy,
      ]);

    pipelineResult = pipelineRes;
    archiveResult = archiveRes;
    chairQueueItems = chairRes;
    workspaceApps = workspaceRes;
    chapters = chaptersRes;
    reviewerUsers = reviewerRes;
    interviewerUsers = interviewerRes;

    funnelCounts = Object.fromEntries(
      funnelRes.map((row) => [row.status, row._count])
    ) as FunnelCounts;
  }

  // Flatten pipeline columns into a single array
  const pipelineApps = (Object.values(pipelineResult.columns).flat() as any[]);

  // Serialize dates for client components
  function serializeApp(app: any) {
    const outline = (app.workshopOutline as {
      title?: string;
      ageRange?: string;
      durationMinutes?: number;
    } | null) ?? null;
    return {
      id: app.id as string,
      status: app.status as string,
      materialsReadyAt: (app.materialsReadyAt as Date | null)?.toISOString() ?? null,
      interviewScheduledAt: (app.interviewScheduledAt as Date | null)?.toISOString() ?? null,
      archivedAt: (app.archivedAt as Date | null)?.toISOString() ?? null,
      updatedAt: (app.updatedAt as Date | null)?.toISOString() ?? null,
      overdue: app.overdue as boolean | undefined,
      awaitingSlots: app.awaitingSlots as boolean | undefined,
      subjectsOfInterest: app.subjectsOfInterest as string | null,
      applicationTrack: (app.applicationTrack as string) ?? "STANDARD_INSTRUCTOR",
      instructorSubtype: (app.instructorSubtype as string) ?? "STANDARD",
      legalName: (app.legalName as string | null) ?? null,
      preferredFirstName: (app.preferredFirstName as string | null) ?? null,
      lastName: (app.lastName as string | null) ?? null,
      workshopOutlinePresent: !!app.workshopOutline,
      workshopTitle: outline?.title ?? null,
      workshopAgeRange: outline?.ageRange ?? null,
      workshopDurationMinutes: outline?.durationMinutes ?? null,
      isReapplication: !!app.isReapplication,
      previousApplicationId: (app.previousApplicationId as string | null) ?? null,
      source: (app.source as string | null) ?? "PORTAL",
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
        ? {
            action: app.chairDecision.action as string,
            decidedAt: (app.chairDecision.decidedAt as Date).toISOString(),
            rationale: (app.chairDecision as { rationale?: string | null }).rationale ?? null,
          }
        : null,
    };
  }

  const serializedPipeline = pipelineApps.map(serializeApp);
  const serializedArchive = archiveResult.items.map((app) => {
    const archiveOutline = (app as {
      workshopOutline?: { title?: string; ageRange?: string; durationMinutes?: number };
    }).workshopOutline ?? null;
    return {
      id: app.id,
      status: app.status,
      archivedAt: app.archivedAt?.toISOString() ?? null,
      updatedAt: app.updatedAt.toISOString(),
      subjectsOfInterest: app.subjectsOfInterest ?? null,
      source: ((app as { source?: string }).source ?? "PORTAL") as string,
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
      workshopOutlinePresent: !!archiveOutline,
      workshopTitle: archiveOutline?.title ?? null,
      workshopAgeRange: archiveOutline?.ageRange ?? null,
      workshopDurationMinutes: archiveOutline?.durationMinutes ?? null,
    };
  });

  const newCount = pipelineResult.columns.new.length;
  const toReviewCount = pipelineResult.columns.needs_review.length;
  const toInterviewCount =
    pipelineResult.columns.interview_prep.length +
    pipelineResult.columns.ready_for_interview.length;
  const postInterviewCount = pipelineResult.columns.post_interview.length;
  const chairQueueCount =
    hiringDemoMode && showChairQueue
      ? pipelineResult.columns.chair_review.length
      : chairQueueItems.length;

  const missingMaterialsCount = serializedPipeline.filter(
    (app) =>
      app.applicationTrack !== "SUMMER_WORKSHOP_INSTRUCTOR" && !app.materialsReadyAt
  ).length;
  const overdueCount = serializedPipeline.filter((app) => app.overdue).length;

  const strip = [
    { label: "Add applicant", href: "/admin/external-applicants/new", icon: "user" as const },
    ...(showChairQueue
      ? [{ label: "Chair queue", href: "/admin/instructor-applicants/chair-queue", icon: "inbox" as const }]
      : []),
    { label: "Home", href: "/", icon: "compass" as const },
  ];

  return (
    <ApplicationReviewShell
      maxWidth={1200}
      header={
        <PageHeaderV2
          eyebrow="Applicants"
          title="Application board"
          subtitle={`${serializedPipeline.length} in pipeline · ${toReviewCount} need review${overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}${missingMaterialsCount > 0 ? ` · ${missingMaterialsCount} missing materials` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {hasNetworkScope && (
                <a
                  href="/api/admin/instructor-applicants/export.csv"
                  download
                  className={buttonVariants({ variant: "secondary", size: "md" })}
                >
                  Export CSV
                </a>
              )}
              {isAdmin && <ArchiveAllButton />}
            </div>
          }
        />
      }
      actions={strip}
    >
      <InstructorApplicantsCommandCenter
        scope={hasNetworkScope ? "global" : "chapter"}
        chapterId={chapterId}
        pipelineApps={serializedPipeline as any}
        archivedApps={serializedArchive as any}
        chairQueueCount={chairQueueCount}
        canSeeChairQueue={showChairQueue}
        chapters={chapters}
        reviewers={reviewerUsers}
        interviewers={interviewerUsers}
        actorId={sessionUser.id}
        isAdmin={isAdmin}
        workspaceApps={workspaceApps as any}
        pipelineFilteredCounts={{
          newApplications: newCount,
          needsReview: toReviewCount,
          interviewStage: toInterviewCount,
          postInterview: postInterviewCount,
        }}
        funnelCounts={funnelCounts}
      />
    </ApplicationReviewShell>
  );
}
