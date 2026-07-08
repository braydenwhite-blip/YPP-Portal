import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, StatusBadge, CardV2 } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { loadChapterOS } from "@/lib/chapters/chapter-os";
import { loadChapterWorkspace } from "@/lib/chapters/workspace";
import { chapterLifecycleTone, chapterLifecycleLabel, isLaunchingStatus } from "@/lib/chapters/lifecycle";
import { LaunchChecklist } from "@/components/chapters/launch-checklist";
import { ChapterOS } from "@/components/chapters/chapter-os";
import { activeLaneFromSearchParam } from "@/components/chapters/chapter-os-lane-tabs";
import { LanePartners } from "@/components/chapters/lane-partners";
import { LaneInstructors } from "@/components/chapters/lane-instructors";
import { LaneStudents } from "@/components/chapters/lane-students";
import { LaneActions } from "@/components/chapters/lane-actions";
import { LaneMeetings } from "@/components/chapters/lane-meetings";
import { partnerLaneFromModel, instructorLaneFromModel, studentLaneFromModel, type LaneKey } from "@/lib/chapters/lanes";
import { loadChapterActionsLane } from "@/lib/chapters/actions-lane";
import { loadChapterMeetingsLane } from "@/lib/chapters/meetings-lane";
import { EntityWorkflowCard } from "@/components/workflow-engine/entity-workflow-card";
import { assembleChapterAutomation, chapterFactsFromModel } from "@/lib/automation/build-chapter-automation";
import { ChapterAutomationSection } from "@/components/automation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Home — Pathways Portal" };

// THE Chapter Operating System — the single Chapter President cockpit,
// organized around the five things a chapter actually has to organize:
// Partners, Students, Instructors, Actions, Meetings. Replaces the former
// "Chapter Home" + "Operating System" (six-room) pages, which duplicated the
// same automation section and computed chapter status two different ways.
export default async function ChapterHomePage(props: {
  searchParams?: Promise<{ lane?: string; relatedType?: string; relatedId?: string; partnerId?: string }>;
}) {
  const ctx = await getChapterViewerContext();

  // National leadership run every chapter from the command center, not a
  // single chapter home.
  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }

  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2 eyebrow="Chapter" title="Chapter Home" subtitle="Lead your YPP chapter from one place." />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your chapter home appears here — partners, students, instructors, actions, and meetings, all in one place."
            action={
              <ButtonLink href="/chapter/apply" variant="primary">
                Apply to start a chapter
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  const chapterId = ctx.ledChapterId;
  const searchParams = (await props.searchParams) ?? {};
  const active: LaneKey = activeLaneFromSearchParam(searchParams.lane);

  const [model, workspace, onboarding] = await Promise.all([
    loadChapterOS(chapterId, { isLeadership: ctx.isLeadership }),
    loadChapterWorkspace(chapterId),
    prisma.chapterPresidentOnboarding
      .findUnique({
        where: { userId: ctx.user.id },
        select: { status: true, metTeam: true, setChapterGoals: true, reviewedResources: true, introMessageSent: true },
      })
      .catch(() => null),
  ]);
  if (!model || !workspace) redirect("/chapter/apply");

  // CP onboarding nudge — surfaced inline so the President has one home.
  const onboardingSteps = onboarding
    ? [onboarding.metTeam, onboarding.setChapterGoals, onboarding.reviewedResources, onboarding.introMessageSent]
    : [];
  const onboardingDone = onboardingSteps.filter(Boolean).length;
  const onboardingComplete = onboarding?.status === "COMPLETED" || (onboardingSteps.length > 0 && onboardingSteps.every(Boolean));
  const showOnboardingBanner = onboarding != null && !onboardingComplete;

  const showLaunch = workspace.launch.items.length > 0 || isLaunchingStatus(model.chapter.lifecycleStatus);

  // The Automation Brain: playbook pacing, readiness, today's priorities, and
  // impact-meeting prep — built from the already-loaded `model`, no extra DB
  // reads. Rendered ONCE on this single merged page (both predecessor pages
  // rendered it independently, which was the actual duplication — one page
  // means one automation section, not zero).
  const automation = assembleChapterAutomation({
    facts: chapterFactsFromModel(model),
    blockers: model.blockers,
    studentNeeds: model.studentCommunity.needsAttention,
    impactPrep: model.impact,
    now: new Date(),
    weekAnchored: model.chapter.weekAnchored,
  });

  // Only the active lane's own data is loaded — Partners/Students/Instructors
  // come free from the already-loaded `model` (no extra reads); Actions and
  // Meetings have their own lightweight, lazily-loaded queries.
  let panel: React.ReactNode;
  if (active === "partners") {
    panel = <LanePartners chapterId={chapterId} view={partnerLaneFromModel(model)} />;
  } else if (active === "instructors") {
    panel = <LaneInstructors chapterId={chapterId} view={instructorLaneFromModel(model)} />;
  } else if (active === "students") {
    panel = <LaneStudents chapterId={chapterId} view={studentLaneFromModel(model)} />;
  } else if (active === "actions") {
    const [actionsView] = await Promise.all([
      loadChapterActionsLane(chapterId, ctx.user, searchParams.relatedType && searchParams.relatedId ? { relatedType: searchParams.relatedType, relatedId: searchParams.relatedId } : undefined),
    ]);
    panel = (
      <LaneActions
        view={actionsView}
        chapterId={chapterId}
        workflowCard={<EntityWorkflowCard entityType="CHAPTER" entityId={chapterId} chapterId={chapterId} title="Active chapter workflows" />}
      />
    );
  } else {
    const meetingsView = await loadChapterMeetingsLane(chapterId, searchParams.partnerId ? { partnerId: searchParams.partnerId } : undefined);
    panel = <LaneMeetings chapterId={chapterId} view={meetingsView} />;
  }

  const laneCounts = {
    partners: model.partners.followUpNeeded,
    instructors: model.instructors.applicants > 0 ? model.instructors.byStage.under_review : 0,
    students: model.studentCommunity.needsAttention.length,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow={`Week ${model.weekNumber}`}
        title="Chapter Operating System"
        subtitle="Partners, students, instructors, actions, and meetings — everything to run your chapter, in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={chapterLifecycleTone(model.chapter.lifecycleStatus)}>{chapterLifecycleLabel(model.chapter.lifecycleStatus)}</StatusBadge>
            <ButtonLink href="/chapter/impact" variant="primary" size="sm">
              Impact Meeting
            </ButtonLink>
            <ButtonLink href="/chapter/organization" variant="secondary" size="sm">
              Explore relationships
            </ButtonLink>
          </div>
        }
      />

      {showOnboardingBanner && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-brand-200 bg-brand-50 px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-brand-900">Finish setting up as Chapter President</p>
            <p className="text-[12.5px] text-brand-700">{onboardingDone} of 4 setup steps complete.</p>
          </div>
          <ButtonLink href="/chapter/onboarding" variant="primary" size="sm">
            Continue onboarding
          </ButtonLink>
        </div>
      )}

      <div className="mt-6">
        <ChapterAutomationSection automation={automation} showEscalations={ctx.isLeadership} />
      </div>

      <div className="mt-6">
        <ChapterOS
          chapterId={chapterId}
          weekNumber={model.weekNumber}
          growth={model.growth}
          active={active}
          laneCounts={laneCounts}
          launchBanner={
            showLaunch ? (
              <CardV2 padding="md">
                <LaunchChecklist
                  chapterId={chapterId}
                  items={workspace.launch.items.map((i) => ({
                    id: i.id,
                    key: i.key,
                    title: i.title,
                    description: i.description,
                    owner: i.owner,
                    leadershipOnly: i.leadershipOnly,
                    ownerLabel: i.ownerLabel,
                    dueDate: i.dueDate ? i.dueDate.toISOString() : null,
                    done: i.done,
                  }))}
                  progress={workspace.launch.progress}
                  canManage
                  isLeadership={false}
                />
              </CardV2>
            ) : null
          }
          panel={panel}
        />
      </div>
    </div>
  );
}
