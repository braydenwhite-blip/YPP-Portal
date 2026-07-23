import { prisma } from "@/lib/prisma";
import { ApplicationTrack, ApplicationSource } from "@prisma/client";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  getApplicantPipeline,
  getArchivedApplications,
} from "@/lib/instructor-applicant-board-queries";
import {
  mapCpStatusToBoardStatus,
  mapStaffStatusToBoardStatus,
  parseApplicantKindFilter,
} from "@/lib/applicant-board-kind";
import { ensureSocialMediaManagerPosition } from "@/lib/application-actions";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { listOperatingChaptersForFilters } from "@/lib/chapters/operating";
import { SOCIAL_MEDIA_MANAGER_POSITION_TITLE } from "@/lib/social-media-manager-application";
import { extractStaffLocation } from "@/lib/staff-applicant-location";
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
            eyebrow={isAdmin ? "Admin" : isHiringChair ? "Hiring Chair" : "Chapter President"}
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
              eyebrow="Chapter President"
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
  const kindFilter = parseApplicantKindFilter(resolvedParams.kind);
  // Admins and Hiring Chairs share the unified Instructor + CP + Staff board.
  const includeCpApps =
    (isAdmin || isHiringChair) && (kindFilter === "all" || kindFilter === "cp");
  const includeInstructorApps = kindFilter === "all" || kindFilter === "instructor";
  const includeStaffApps =
    (isAdmin || isHiringChair) && (kindFilter === "all" || kindFilter === "staff");

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

  const pipelineFilters = {
    reviewerId,
    interviewerId,
    materialsMissing,
    overdueOnly,
    myCasesActorId: myCasesOnly ? sessionUser.id : undefined,
    applicationTrack: applicationTrackFilter,
    source: sourceFilter,
  };

  const filterTake = hiringDemoMode ? 40 : undefined;

  const loadChapters = async () => {
    if (!hasNetworkScope) return [] as Array<{ id: string; name: string }>;
    const rows = await listOperatingChaptersForFilters();
    const mapped = rows.map(({ id, name }) => ({ id, name }));
    return filterTake ? mapped.slice(0, filterTake) : mapped;
  };

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
      take: filterTake,
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
      take: filterTake,
    });

  let pipelineResult: Awaited<ReturnType<typeof getApplicantPipeline>> | null = null;
  let archiveResult: Awaited<ReturnType<typeof getArchivedApplications>> = {
    items: [],
    total: 0,
    skip: 0,
    take: 0,
  };
  let chapters: Array<{ id: string; name: string }> = [];
  let reviewers: Array<{ id: string; name: string | null; email: string }> = [];
  let interviewers: Array<{ id: string; name: string | null; email: string }> = [];
  let cpApps: Array<{
    id: string;
    status: string;
    interviewScheduledAt: Date | null;
    archivedAt: Date | null;
    archiveReason: string | null;
    updatedAt: Date;
    legalName: string | null;
    preferredFirstName: string | null;
    lastName: string | null;
    schoolName: string | null;
    applicant: {
      id: string;
      name: string | null;
      email: string;
      chapter: { id: string; name: string } | null;
    };
    reviewer: { id: string; name: string | null } | null;
    chapter: { id: string; name: string } | null;
  }> = [];
  let archivedCpApps: typeof cpApps = [];

  const cpChapterWhere = effectiveChapterId
    ? {
        OR: [
          { chapterId: effectiveChapterId },
          { applicant: { chapterId: effectiveChapterId } },
        ],
      }
    : {};

  const cpBoardSelect = {
    id: true,
    status: true,
    interviewScheduledAt: true,
    archivedAt: true,
    archiveReason: true,
    updatedAt: true,
    legalName: true,
    preferredFirstName: true,
    lastName: true,
    schoolName: true,
    applicant: {
      select: {
        id: true,
        name: true,
        email: true,
        chapter: { select: { id: true, name: true } },
      },
    },
    reviewer: { select: { id: true, name: true } },
    chapter: { select: { id: true, name: true } },
  } as const;

  const loadCpApps = async () => {
    if (!includeCpApps) return [] as typeof cpApps;
    return prisma.chapterPresidentApplication.findMany({
      where: {
        archivedAt: null,
        ...cpChapterWhere,
      },
      select: cpBoardSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: hiringDemoMode ? DEMO_PIPELINE_TAKE : undefined,
    });
  };

  const loadArchivedCpApps = async () => {
    if (!includeCpApps || hiringDemoMode) return [] as typeof cpApps;
    return prisma.chapterPresidentApplication.findMany({
      where: {
        archivedAt: { not: null },
        ...cpChapterWhere,
      },
      select: cpBoardSelect,
      orderBy: { archivedAt: "desc" },
      take: 50,
    });
  };

  type StaffBoardApp = {
    id: string;
    status: string;
    archivedAt: Date | null;
    updatedAt: Date;
    source: string;
    coverLetter: string | null;
    additionalMaterials: string | null;
    applicant: {
      id: string;
      name: string | null;
      email: string;
      chapter: { id: string; name: string } | null;
    };
    position: { id: string; title: string; chapter: { id: string; name: string } | null };
    interviewSlots: Array<{ scheduledAt: Date }>;
  };

  let staffApps: StaffBoardApp[] = [];
  let archivedStaffApps: StaffBoardApp[] = [];

  const staffChapterWhere = effectiveChapterId
    ? { applicant: { chapterId: effectiveChapterId } }
    : {};

  const staffBoardSelect = {
    id: true,
    status: true,
    archivedAt: true,
    updatedAt: true,
    source: true,
    coverLetter: true,
    additionalMaterials: true,
    applicant: {
      select: {
        id: true,
        name: true,
        email: true,
        chapter: { select: { id: true, name: true } },
      },
    },
    position: {
      select: {
        id: true,
        title: true,
        chapter: { select: { id: true, name: true } },
      },
    },
    interviewSlots: {
      select: { scheduledAt: true },
      orderBy: { scheduledAt: "asc" as const },
      take: 1,
    },
  } as const;

  const staffPositionWhere = {
    type: "STAFF" as const,
    title: { equals: SOCIAL_MEDIA_MANAGER_POSITION_TITLE, mode: "insensitive" as const },
  };

  const loadStaffApps = async () => {
    if (!includeStaffApps) return [] as StaffBoardApp[];
    // Ensure the Social Media Manager opening exists so title matching always works.
    await ensureSocialMediaManagerPosition();
    return prisma.application.findMany({
      where: {
        archivedAt: null,
        status: { not: "WITHDRAWN" },
        position: staffPositionWhere,
        ...staffChapterWhere,
      },
      select: staffBoardSelect,
      orderBy: [{ updatedAt: "desc" }, { submittedAt: "desc" }],
      take: hiringDemoMode ? DEMO_PIPELINE_TAKE : undefined,
    });
  };

  const loadArchivedStaffApps = async () => {
    if (!includeStaffApps || hiringDemoMode) return [] as StaffBoardApp[];
    return prisma.application.findMany({
      where: {
        archivedAt: { not: null },
        position: staffPositionWhere,
        ...staffChapterWhere,
      },
      select: staffBoardSelect,
      orderBy: { archivedAt: "desc" },
      take: 50,
    });
  };

  if (hiringDemoMode) {
    const [pipeline, chapterRows, reviewerRows, cpRows, staffRows] = await Promise.all([
      includeInstructorApps
        ? getApplicantPipeline({
            scope,
            chapterId: effectiveChapterId,
            filters: pipelineFilters,
            take: DEMO_PIPELINE_TAKE,
          })
        : Promise.resolve(null),
      loadChapters(),
      loadReviewerUsers(),
      loadCpApps(),
      loadStaffApps(),
    ]);
    pipelineResult = pipeline;
    chapters = chapterRows;
    reviewers = reviewerRows;
    interviewers = reviewerRows;
    cpApps = cpRows;
    staffApps = staffRows;
  } else {
    const [
      pipeline,
      archive,
      chapterRows,
      reviewerRows,
      interviewerRows,
      cpRows,
      archivedCpRows,
      staffRows,
      archivedStaffRows,
    ] = await Promise.all([
      includeInstructorApps
        ? getApplicantPipeline({
            scope,
            chapterId: effectiveChapterId,
            filters: pipelineFilters,
          })
        : Promise.resolve(null),
      includeInstructorApps
        ? getArchivedApplications({ scope, chapterId: effectiveChapterId })
        : Promise.resolve({ items: [], total: 0, skip: 0, take: 0 }),
      loadChapters(),
      loadReviewerUsers(),
      loadInterviewerUsers(),
      loadCpApps(),
      loadArchivedCpApps(),
      loadStaffApps(),
      loadArchivedStaffApps(),
    ]);
    pipelineResult = pipeline;
    archiveResult = archive;
    chapters = chapterRows;
    reviewers = reviewerRows;
    interviewers = interviewerRows;
    cpApps = cpRows;
    archivedCpApps = archivedCpRows;
    staffApps = staffRows;
    archivedStaffApps = archivedStaffRows;
  }

  // Flatten pipeline columns into a single array
  const pipelineApps = pipelineResult
    ? (Object.values(pipelineResult.columns).flat() as any[])
    : [];

  // Serialize dates for client components
  function serializeApp(app: any) {
    const outline = (app.workshopOutline as {
      title?: string;
      ageRange?: string;
      durationMinutes?: number;
    } | null) ?? null;
    return {
      id: app.id as string,
      kind: "instructor" as const,
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

  function serializeCpApp(app: (typeof cpApps)[number]) {
    const chapter =
      app.chapter ??
      (app.applicant.chapter
        ? { id: app.applicant.chapter.id, name: app.applicant.chapter.name }
        : null);
    return {
      id: app.id,
      kind: "cp" as const,
      status: mapCpStatusToBoardStatus(app.status),
      materialsReadyAt: null as string | null,
      interviewScheduledAt: app.interviewScheduledAt?.toISOString() ?? null,
      archivedAt: app.archivedAt?.toISOString() ?? null,
      archiveReason: app.archiveReason,
      updatedAt: app.updatedAt.toISOString(),
      overdue: false,
      awaitingSlots: false,
      subjectsOfInterest: app.schoolName,
      applicationTrack: "CHAPTER_PRESIDENT",
      instructorSubtype: "CHAPTER_PRESIDENT",
      legalName: app.legalName,
      preferredFirstName: app.preferredFirstName,
      lastName: app.lastName,
      workshopOutlinePresent: false,
      workshopTitle: null as string | null,
      workshopAgeRange: null as string | null,
      workshopDurationMinutes: null as number | null,
      isReapplication: false,
      previousApplicationId: null as string | null,
      source: "PORTAL",
      applicant: {
        id: app.applicant.id,
        name: app.applicant.name ?? formatApplicantDisplayName(app),
        email: app.applicant.email,
        chapter,
      },
      reviewer: app.reviewer,
      interviewerAssignments: [] as Array<{
        id: string;
        role: string;
        interviewer: { id: string; name: string | null };
      }>,
      applicationReviews: [] as Array<{
        summary: string | null;
        nextStep: string | null;
        overallRating: string | null;
      }>,
      chairDecision: null as {
        action: string;
        decidedAt: string;
        rationale: string | null;
      } | null,
    };
  }

  function serializeStaffApp(app: StaffBoardApp) {
    const typedLocation = extractStaffLocation(app.additionalMaterials);
    const locationName = typedLocation ?? app.applicant.chapter?.name ?? null;
    const location = locationName
      ? {
          id: app.applicant.chapter?.id ?? "",
          name: locationName,
        }
      : null;
    const interviewScheduledAt = app.interviewSlots[0]?.scheduledAt ?? null;
    return {
      id: app.id,
      kind: "staff" as const,
      status: mapStaffStatusToBoardStatus(app.status),
      materialsReadyAt: null as string | null,
      interviewScheduledAt: interviewScheduledAt?.toISOString() ?? null,
      archivedAt: app.archivedAt?.toISOString() ?? null,
      archiveReason: null as string | null,
      updatedAt: app.updatedAt.toISOString(),
      overdue: false,
      awaitingSlots: false,
      subjectsOfInterest: SOCIAL_MEDIA_MANAGER_POSITION_TITLE,
      applicationTrack: "STAFF",
      instructorSubtype: "STAFF",
      legalName: app.applicant.name,
      preferredFirstName: null as string | null,
      lastName: null as string | null,
      workshopOutlinePresent: false,
      workshopTitle: null as string | null,
      workshopAgeRange: null as string | null,
      workshopDurationMinutes: null as number | null,
      isReapplication: false,
      previousApplicationId: null as string | null,
      source: app.source,
      applicant: {
        id: app.applicant.id,
        name: app.applicant.name,
        email: app.applicant.email,
        chapter: location,
      },
      reviewer: null as { id: string; name: string | null } | null,
      interviewerAssignments: [] as Array<{
        id: string;
        role: string;
        interviewer: { id: string; name: string | null };
      }>,
      applicationReviews: [] as Array<{
        summary: string | null;
        nextStep: string | null;
        overallRating: string | null;
      }>,
      chairDecision: null as {
        action: string;
        decidedAt: string;
        rationale: string | null;
      } | null,
    };
  }

  const serializedPipeline = [
    ...pipelineApps.map(serializeApp),
    ...cpApps.map(serializeCpApp),
    ...staffApps.map(serializeStaffApp),
  ].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
  const serializedArchive = [
    ...archiveResult.items.map((app) => {
      const archiveOutline = (app as {
        workshopOutline?: { title?: string; ageRange?: string; durationMinutes?: number };
      }).workshopOutline ?? null;
      return {
        id: app.id,
        kind: "instructor" as const,
        status: app.status,
        archivedAt: app.archivedAt?.toISOString() ?? null,
        archiveReason: (app as { archiveReason?: string | null }).archiveReason ?? null,
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
        interviewerAssignments: [] as Array<{
          id: string;
          role: string;
          interviewer: { id: string; name: string | null };
        }>,
        overdue: false,
        applicationReviews: [] as Array<{
          summary: string | null;
          nextStep: string | null;
          overallRating: string | null;
        }>,
        applicationTrack:
          (app as { applicationTrack?: string }).applicationTrack ?? "STANDARD_INSTRUCTOR",
        instructorSubtype:
          (app as { instructorSubtype?: string }).instructorSubtype ?? "STANDARD",
        workshopOutlinePresent: !!archiveOutline,
        workshopTitle: archiveOutline?.title ?? null,
        workshopAgeRange: archiveOutline?.ageRange ?? null,
        workshopDurationMinutes: archiveOutline?.durationMinutes ?? null,
      };
    }),
    ...archivedCpApps.map(serializeCpApp),
    ...archivedStaffApps.map(serializeStaffApp),
  ].sort((a, b) => {
    const aTime = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
    const bTime = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
    return bTime - aTime;
  });

  const strip = [
    { label: "Add Applicant", href: "/admin/external-applicants/new", icon: "user" as const },
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
        chapters={chapters}
        reviewers={reviewers}
        interviewers={interviewers}
        actorId={sessionUser.id}
        showChapterFilter={hasNetworkScope}
        showKindFilter={isAdmin || isHiringChair}
      />
    </ApplicationReviewShell>
  );
}
