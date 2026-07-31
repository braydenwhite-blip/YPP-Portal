import Link from "next/link";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink } from "@/components/ui-v2";
import { prisma } from "@/lib/prisma";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { KickoffStatusRow } from "@/components/mentorship/kickoff-status-row";

import { CheckInsSection } from "./sections";
import { GoalsSection } from "./goals-section";
import { ReviewsSection } from "./reviews-section";
import { ProgressUpdateSection } from "./progress-update-section";
import { ChairApprovalPanel } from "./chair-approval-panel";
import {
  SetupRepairPanel,
  type MentorshipSetupData,
} from "./setup-repair-panel";
import { ManageRelationship } from "./manage-relationship";
import { MentorPersonHome } from "./mentor-person-home";
import { MenteeDashboardHome } from "./mentee-dashboard-home";
import { SelfHelpCard, SelfMilestones, SelfRecognitionCard } from "./self-sections";

/**
 * Shared Mentorship person workspace — quiet chrome, one job per tab.
 */

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "goals", label: "G&R" },
  { id: "check-ins", label: "Meetings" },
  { id: "reviews", label: "Feedback" },
  { id: "progress", label: "Progress" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const SECTION_ALIASES: Record<string, SectionId> = {
  plan: "goals",
  relationships: "overview",
  timeline: "overview",
  opportunities: "overview",
  reflection: "reviews",
  review: "reviews",
  schedule: "check-ins",
  recognition: "overview",
  "progress-update": "progress",
};

function resolveSection(raw: string | undefined): SectionId {
  if (!raw) return "overview";
  if ((SECTIONS as readonly { id: string }[]).some((s) => s.id === raw)) {
    return raw as SectionId;
  }
  return SECTION_ALIASES[raw] ?? "overview";
}

function QuietTabs({
  tabs,
  activeId,
}: {
  tabs: Array<{ id: string; label: string; href: string }>;
  activeId: string;
}) {
  return (
    <nav
      aria-label="Mentorship section"
      className="flex gap-1 overflow-x-auto border-b border-line-soft"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "-mb-px border-b-2 border-ink px-3 py-2.5 text-[13px] font-semibold text-ink no-underline"
                : "-mb-px border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium text-ink-muted no-underline hover:text-ink"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
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
  progressSent = false,
  progressPending = false,
}: {
  workspace: MentorshipWorkspace;
  section?: string;
  panel?: string;
  setup?: MentorshipSetupData;
  kickoff?: {
    scheduledAt: Date | null;
    completedAt: Date | null;
    canMarkComplete: boolean;
  };
  sectionHref: (sectionId: string) => string;
  showHeader?: boolean;
  helpSent?: boolean;
  alsoMentors?: boolean;
  progressSent?: boolean;
  progressPending?: boolean;
}) {
  const isSelf = workspace.isSelf;
  const active =
    panel === "draft" || panel === "approve" ? "reviews" : resolveSection(section);

  const tabs = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    href: sectionHref(s.id),
  }));

  const canOpenApproval =
    panel === "approve" &&
    workspace.capabilities.canApprove &&
    workspace.lifecycle.cycleStage === "REVIEW_SUBMITTED";
  const canOpenDraft =
    panel === "draft" &&
    !workspace.isSelf &&
    workspace.capabilities.canDraftReview;
  const focusedReviewPanel = canOpenApproval || canOpenDraft;
  const requestedUnavailablePanel = panel === "approve" && !canOpenApproval;

  const body = (
    <>
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

      {canOpenApproval ? (
        <ChairApprovalPanel
          menteeId={workspace.person.id}
          mentorshipId={workspace.activeMentorshipId!}
        />
      ) : null}

      {requestedUnavailablePanel ? (
        <section className="rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3">
          <p className="m-0 text-[13px] text-ink-muted">
            That step isn&apos;t ready. Next up:{" "}
            <strong className="text-ink">{workspace.cycleState.nextAction.label}</strong>.
          </p>
        </section>
      ) : null}

      {!focusedReviewPanel ? <QuietTabs tabs={tabs} activeId={active} /> : null}

      {!focusedReviewPanel && active === "overview" ? (
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
              feedbackHref={sectionHref("reviews")}
              progressHref={sectionHref("progress")}
            />
            {workspace.isAdmin && workspace.activeMentorshipId ? (
              <details className="mx-auto w-full max-w-xl">
                <summary className="cursor-pointer text-[12.5px] font-medium text-ink-muted">
                  Manage relationship
                </summary>
                <div className="mt-3">
                  <ManageRelationshipHost
                    mentorshipId={workspace.activeMentorshipId}
                    menteeId={workspace.person.id}
                  />
                </div>
              </details>
            ) : null}
          </>
        )
      ) : null}

      {!focusedReviewPanel && active === "goals" ? (
        <>
          <GoalsSection workspace={workspace} />
          {isSelf ? (
            <SelfRecognitionCard reflectionHref={sectionHref("reviews")} />
          ) : null}
        </>
      ) : null}

      {!focusedReviewPanel && active === "check-ins" ? (
        <CheckInsSection workspace={workspace} />
      ) : null}

      {(canOpenDraft || (!focusedReviewPanel && active === "reviews")) ? (
        <ReviewsSection
          workspace={workspace}
          sectionHref={sectionHref}
          forceDraft={panel === "draft" || canOpenDraft}
        />
      ) : null}

      {!focusedReviewPanel && active === "progress" ? (
        <ProgressUpdateSection
          workspace={workspace}
          justSent={progressSent}
          pendingChair={progressPending}
        />
      ) : null}
    </>
  );

  if (!showHeader) {
    return <div className="flex flex-col gap-5">{body}</div>;
  }

  return (
    <div className={`${skin.portalSkin} mx-auto flex w-full max-w-3xl flex-col gap-5`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {!isSelf ? (
            <Link
              href="/mentorship"
              className="mb-1 inline-block text-[12.5px] font-medium text-ink-muted no-underline hover:text-ink"
            >
              ← Mentorship
            </Link>
          ) : null}
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.3px] text-ink">
            {isSelf ? "Your mentorship" : workspace.person.name}
          </h1>
          {(isSelf
            ? workspace.overview.mentorName
              ? `Mentor: ${workspace.overview.mentorName}`
              : "No mentor yet"
            : workspace.person.contextLabel) ? (
            <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
              {isSelf
                ? workspace.overview.mentorName
                  ? `Mentor: ${workspace.overview.mentorName}`
                  : "No mentor yet"
                : workspace.person.contextLabel}
            </p>
          ) : null}
        </div>
        {alsoMentors && isSelf ? (
          <ButtonLink href="/mentorship?view=mentor" variant="secondary" size="sm">
            Your mentees →
          </ButtonLink>
        ) : null}
      </header>
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
