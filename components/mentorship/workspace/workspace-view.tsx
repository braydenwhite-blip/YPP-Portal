import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import { prisma } from "@/lib/prisma";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { SegmentedTabs } from "@/app/(app)/mentorship/_components/segmented-tabs";
import { ActiveReviewCycleCard } from "@/components/people-strategy/active-review-cycle-card";
import { KickoffStatusRow } from "@/components/mentorship/kickoff-status-row";

import { CheckInsSection } from "./sections";
import { MenteeGoalsSection } from "./goals-section";
import { ReviewsSection } from "./reviews-section";
import { ReviewDraftPanel } from "./review-draft-panel";
import { ChairApprovalPanel } from "./chair-approval-panel";
import {
  SetupRepairPanel,
  type MentorshipSetupData,
} from "./setup-repair-panel";
import { ManageRelationship } from "./manage-relationship";
import { MentorPersonHome } from "./mentor-person-home";
import { MenteeDashboardHome } from "./mentee-dashboard-home";
import { SelfGoalsSection, SelfHelpCard, SelfMilestones, SelfRecognitionCard } from "./self-sections";

/**
 * The shared Mentorship workspace body — header, section tabs, and the active
 * section. Rendered from two hosts: `/mentorship/people/[id]` (full header) and
 * the hub's `?view=me` POV (`showHeader={false}`, one header per page).
 *
 * One lifecycle, one workspace: four sections for every viewer — Overview,
 * Goals, Check-ins, Reviews — because Mentorship is one lifecycle
 * (relationship → goals → check-ins → reflection/review → follow-up), not a
 * menu of features. `workspace.isSelf` only changes what each section shows
 * (e.g. Goals renders the mentee's own G&R document vs. the mentor's read
 * view + propose-change form), never which tabs exist.
 */

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "goals", label: "Goals" },
  { id: "check-ins", label: "Meetings" },
  { id: "reviews", label: "Feedback" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** Old section ids from the previous seven-tab layout resolve into the four above. */
const SECTION_ALIASES: Record<string, SectionId> = {
  plan: "goals",
  relationships: "overview",
  timeline: "overview",
  opportunities: "overview",
  reflection: "reviews",
  schedule: "check-ins",
  recognition: "overview",
};

function resolveSection(raw: string | undefined): SectionId {
  if (!raw) return "overview";
  if (SECTIONS.some((s) => s.id === raw)) return raw as SectionId;
  return SECTION_ALIASES[raw] ?? "overview";
}

export function MentorshipWorkspaceView({
  workspace,
  section,
  panel,
  setup,
  kickoff,
  sectionHref,
  showHeader = true,
  helpSent = false,
  alsoMentors = false,
}: {
  workspace: MentorshipWorkspace;
  /** Raw `?section=` value; unknown or legacy ids resolve to one of the four. */
  section?: string;
  /** Opens the one stage-specific work surface selected by the lifecycle CTA. */
  panel?: string;
  setup?: MentorshipSetupData;
  kickoff?: {
    scheduledAt: Date | null;
    completedAt: Date | null;
    canMarkComplete: boolean;
  };
  /** Builds the tab href for a section id (host decides the URL shape). */
  sectionHref: (sectionId: string) => string;
  /** The hub renders its own PageHeaderV2 — pass false to skip this one. */
  showHeader?: boolean;
  /** Whether the help-request form just submitted (`?sent=1`). */
  helpSent?: boolean;
  /** Self workspace: viewer also mentors others — show Mentor switch. */
  alsoMentors?: boolean;
}) {
  const isSelf = workspace.isSelf;
  const active = resolveSection(section);

  const tabs = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    href: sectionHref(s.id),
  }));

  const canOpenDraft =
    panel === "draft" &&
    workspace.capabilities.canDraftReview &&
    (workspace.lifecycle.cycleStage === "REFLECTION_SUBMITTED" ||
      workspace.lifecycle.cycleStage === "CHANGES_REQUESTED");
  const canOpenApproval =
    panel === "approve" &&
    workspace.capabilities.canApprove &&
    workspace.lifecycle.cycleStage === "REVIEW_SUBMITTED";
  const requestedUnavailablePanel =
    (panel === "draft" || panel === "approve") && !canOpenDraft && !canOpenApproval;

  const body = (
    <>
      <ActiveReviewCycleCard
        cycleState={workspace.cycleState}
        canTakeNextAction={
          workspace.nextAction.key === workspace.cycleState.nextAction.key ||
          workspace.cycleState.availableActions.includes(workspace.cycleState.nextAction.key) ||
          (workspace.canManageSetup &&
            ["assign-mentor", "schedule-kickoff", "assign-goals", "assign-role-chair"].includes(
              workspace.cycleState.nextAction.key
            ))
        }
      />

      {panel === "setup" && setup ? (
        <SetupRepairPanel
          personId={workspace.person.id}
          personName={workspace.person.name}
          needsMentor={!workspace.lifecycle.hasActiveMentorship}
          needsGR={workspace.lifecycle.grDocStatus === "NONE"}
          needsChair={
            workspace.lifecycle.requiresChairApproval &&
            workspace.lifecycle.hasRoleChair === false
          }
          setup={setup}
        />
      ) : null}

      {active === "check-ins" &&
      workspace.activeMentorshipId &&
      kickoff &&
      !kickoff.completedAt ? (
        <KickoffStatusRow
          mentorshipId={workspace.activeMentorshipId}
          kickoffScheduledAt={kickoff.scheduledAt}
          kickoffCompletedAt={kickoff.completedAt}
          canMarkComplete={kickoff.canMarkComplete}
        />
      ) : null}

      {canOpenDraft ? (
        <ReviewDraftPanel
          menteeId={workspace.person.id}
          menteeName={workspace.person.name}
          commitments={workspace.commitments}
        />
      ) : null}

      {canOpenApproval ? (
        <ChairApprovalPanel
          menteeId={workspace.person.id}
          mentorshipId={workspace.activeMentorshipId!}
          commitments={workspace.commitments}
        />
      ) : null}

      {requestedUnavailablePanel ? (
        <section className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] px-4 py-3">
          <p className="m-0 text-[13px] text-[#717189]">
            That step is not ready yet. Right now the next step is{" "}
            <strong className="text-[#1c1a2e]">{workspace.cycleState.nextAction.label}</strong>.
          </p>
        </section>
      ) : null}

      <div className="overflow-x-auto pb-1">
        <SegmentedTabs tabs={tabs} activeId={active} ariaLabel="Mentorship section" />
      </div>

      {active === "overview" ? (
        isSelf ? (
          <>
            <MenteeDashboardHome
              workspace={workspace}
              goalsHref={sectionHref("goals")}
              checkInsHref={sectionHref("check-ins")}
              reviewsHref={sectionHref("reviews")}
            />
            <SelfMilestones />
            <SelfHelpCard
              returnHref={sectionHref("overview")}
              sent={helpSent}
              scheduleHref={sectionHref("check-ins")}
              goalsHref={sectionHref("goals")}
              resourcesHref={sectionHref("goals")}
            />
          </>
        ) : (
          <>
            <MentorPersonHome
              workspace={workspace}
              goalsHref={sectionHref("goals")}
              meetingsHref={sectionHref("check-ins")}
              feedbackHref={sectionHref("reviews")}
            />
            {workspace.isAdmin && workspace.activeMentorshipId ? (
              <ManageRelationshipHost
                mentorshipId={workspace.activeMentorshipId}
                menteeId={workspace.person.id}
              />
            ) : null}
          </>
        )
      ) : null}

      {active === "goals" ? (
        isSelf ? (
          <>
            <SelfGoalsSection />
            <SelfRecognitionCard reflectionHref={sectionHref("reviews")} />
          </>
        ) : (
          <MenteeGoalsSection workspace={workspace} />
        )
      ) : null}

      {active === "check-ins" ? (
        <CheckInsSection workspace={workspace} />
      ) : null}

      {active === "reviews" ? (
        <ReviewsSection workspace={workspace} sectionHref={sectionHref} />
      ) : null}
    </>
  );

  if (!showHeader) {
    return <div className="flex flex-col gap-5">{body}</div>;
  }

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-5`}>
      <PageHeaderV2
        backHref={isSelf ? undefined : "/mentorship"}
        backLabel={isSelf ? undefined : "Mentorship"}
        title={isSelf ? "Your mentorship" : workspace.person.name}
        subtitle={
          isSelf
            ? workspace.overview.mentorName
              ? `Mentor: ${workspace.overview.mentorName}`
              : "No mentor yet"
            : workspace.person.contextLabel ?? undefined
        }
        actions={
          alsoMentors && isSelf ? (
            <ButtonLink href="/mentorship?view=mentor" variant="secondary" size="sm">
              Open as mentor →
            </ButtonLink>
          ) : undefined
        }
      />
      {body}
    </div>
  );
}

async function ManageRelationshipHost({
  mentorshipId,
  menteeId,
}: {
  mentorshipId: string;
  menteeId: string;
}) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: { mentorId: true, status: true },
  });
  if (!mentorship) return null;
  return (
    <ManageRelationship
      mentorshipId={mentorshipId}
      menteeId={menteeId}
      mentorId={mentorship.mentorId}
      status={mentorship.status}
    />
  );
}
