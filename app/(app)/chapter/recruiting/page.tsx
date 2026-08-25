import { redirect } from "next/navigation";

import {
  ChapterRecruitingPage,
  type PipelineAppSerialized,
} from "@/components/chapter/chapter-recruiting";
import { CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { normalizeRoleList } from "@/lib/authorization";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import {
  getApplicantPipeline,
  getArchivedApplications,
} from "@/lib/instructor-applicant-board-queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recruiting — Pathways Portal" };

const DEMO_PIPELINE_TAKE = 48;

function serializeApp(app: any): PipelineAppSerialized {
  return {
    id: app.id as string,
    status: app.status as string,
    materialsReadyAt: (app.materialsReadyAt as Date | null)?.toISOString() ?? null,
    interviewScheduledAt: (app.interviewScheduledAt as Date | null)?.toISOString() ?? null,
    archivedAt: (app.archivedAt as Date | null)?.toISOString() ?? null,
    updatedAt: (app.updatedAt as Date | null)?.toISOString() ?? new Date().toISOString(),
    overdue: app.overdue as boolean | undefined,
    subjectsOfInterest: app.subjectsOfInterest as string | null,
    legalName: (app.legalName as string | null) ?? null,
    preferredFirstName: (app.preferredFirstName as string | null) ?? null,
    lastName: (app.lastName as string | null) ?? null,
    applicant: {
      id: app.applicant.id as string,
      name: app.applicant.name as string | null,
      email: (app.applicant.email as string) ?? "",
      chapter: app.applicant.chapter
        ? {
            id: app.applicant.chapter.id as string,
            name: app.applicant.chapter.name as string,
          }
        : null,
    },
    reviewer: app.reviewer
      ? { id: app.reviewer.id as string, name: app.reviewer.name as string | null }
      : null,
    interviewerAssignments:
      (app.interviewerAssignments as PipelineAppSerialized["interviewerAssignments"]) ?? [],
    applicationReviews:
      (app.applicationReviews as PipelineAppSerialized["applicationReviews"]) ?? [],
    chairDecision: app.chairDecision
      ? {
          action: app.chairDecision.action as string,
          decidedAt: (app.chairDecision.decidedAt as Date).toISOString(),
        }
      : null,
    applicationTrack: (app.applicationTrack as string) ?? "STANDARD_INSTRUCTOR",
    instructorSubtype: (app.instructorSubtype as string) ?? "STANDARD",
    workshopOutlinePresent: !!app.workshopOutline,
  };
}

export default async function Page() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapterId: true,
      primaryRole: true,
      chapter: { select: { id: true, name: true } },
      roles: { select: { role: true } },
    },
  });

  if (!user) redirect("/login");

  const roles = normalizeRoleList(user.roles, user.primaryRole);
  if (!roles.includes("CHAPTER_PRESIDENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  if (!user.chapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2 eyebrow="Chapter" title="Recruiting" />
        <CardV2 padding="lg" className="mt-8 text-center">
          <p className="m-0 text-[13.5px] text-ink-muted">
            Your account needs a chapter before recruiting can open.
          </p>
        </CardV2>
      </div>
    );
  }

  const chapterId = user.chapterId;
  const chapterName = user.chapter?.name ?? "Your chapter";
  const workflowEnabled = isInstructorApplicantWorkflowV1Enabled();
  const hiringDemoMode = isHiringDemoModeEnabled();

  const positionsPromise = prisma.position.findMany({
    where: { chapterId },
    select: {
      id: true,
      title: true,
      type: true,
      isOpen: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
    orderBy: [{ isOpen: "desc" }, { createdAt: "desc" }],
  });

  let pipelineApps: PipelineAppSerialized[] = [];
  let archivedApps: PipelineAppSerialized[] = [];

  if (workflowEnabled) {
    const [pipelineResult, archiveResult] = await Promise.all([
      getApplicantPipeline({
        scope: "chapter",
        chapterId,
        take: hiringDemoMode ? DEMO_PIPELINE_TAKE : undefined,
      }),
      hiringDemoMode
        ? Promise.resolve({ items: [], total: 0, skip: 0, take: 0 })
        : getArchivedApplications({ scope: "chapter", chapterId }),
    ]);

    const flat = Object.values(pipelineResult.columns).flat() as any[];
    pipelineApps = flat.map(serializeApp);
    archivedApps = archiveResult.items.map((app) =>
      serializeApp({
        ...app,
        applicant: { ...app.applicant, email: "" },
        materialsReadyAt: null,
        interviewScheduledAt: null,
        interviewerAssignments: [],
        overdue: false,
        applicationReviews: [],
      })
    );
  }

  const positions = await positionsPromise;

  return (
    <ChapterRecruitingPage
      chapterId={chapterId}
      chapterName={chapterName}
      actorId={user.id}
      workflowEnabled={workflowEnabled}
      positions={positions.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        isOpen: p.isOpen,
        applicationCount: p._count.applications,
        createdAt: p.createdAt.toISOString(),
      }))}
      pipelineApps={pipelineApps}
      archivedApps={archivedApps}
    />
  );
}
