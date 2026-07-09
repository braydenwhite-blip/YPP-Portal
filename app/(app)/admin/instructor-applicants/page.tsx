import { prisma } from "@/lib/prisma";
import { ApplicationTrack, ApplicationSource } from "@prisma/client";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { canSeeChairQueue } from "@/lib/chapter-hiring-permissions";
import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  getApplicantPipeline,
  getArchivedApplications,
  getChairQueue,
} from "@/lib/instructor-applicant-board-queries";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import InstructorApplicantsCommandCenter from "@/components/instructor-applicants/InstructorApplicantsCommandCenter";
import { buttonVariants, PageHeaderV2 } from "@/components/ui-v2";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";

const DEMO_PIPELINE_TAKE = 48;

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

  let pipelineResult: Awaited<ReturnType<typeof getApplicantPipeline>>;
  let archiveResult: Awaited<ReturnType<typeof getArchivedApplications>>;
  let chairQueueItems: Awaited<ReturnType<typeof getChairQueue>>;

  if (hiringDemoMode) {
    pipelineResult = await getApplicantPipeline({
      scope,
      chapterId: effectiveChapterId,
      filters: pipelineFilters,
      take: DEMO_PIPELINE_TAKE,
    });
    archiveResult = { items: [], total: 0, skip: 0, take: 0 };
    chairQueueItems = [];
  } else {
    [pipelineResult, archiveResult, chairQueueItems] = await Promise.all([
      getApplicantPipeline({
        scope,
        chapterId: effectiveChapterId,
        filters: pipelineFilters,
      }),
      getArchivedApplications({ scope, chapterId: effectiveChapterId }),
      showChairQueue
        ? getChairQueue({ scope, chapterId: effectiveChapterId })
        : Promise.resolve([]),
    ]);
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

  const chairQueueCount =
    hiringDemoMode && showChairQueue
      ? pipelineResult.columns.chair_review.length
      : chairQueueItems.length;

  const strip = [
    { label: "Add applicant", href: "/admin/external-applicants/new", icon: "user" as const },
    ...(showChairQueue
      ? [{ label: "Chair queue", href: "/admin/instructor-applicants/chair-queue", icon: "inbox" as const }]
      : []),
  ];

  return (
    <ApplicationReviewShell
      maxWidth={1280}
      header={
        <PageHeaderV2
          eyebrow="Applicants"
          title="Application board"
          subtitle={
            serializedPipeline.length === 1
              ? "1 applicant in the pipeline"
              : `${serializedPipeline.length} applicants in the pipeline`
          }
        />
      }
      actions={strip}
    >
      <InstructorApplicantsCommandCenter
        pipelineApps={serializedPipeline as any}
        archivedApps={serializedArchive as any}
        chairQueueCount={chairQueueCount}
        canSeeChairQueue={showChairQueue}
      />
    </ApplicationReviewShell>
  );
}
