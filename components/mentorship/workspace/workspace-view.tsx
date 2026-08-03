import Link from "next/link";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink } from "@/components/ui-v2";
import { prisma } from "@/lib/prisma";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

import { GoalsSection } from "./goals-section";
import { ProgressUpdateSection } from "./progress-update-section";
import { FeedbackSection } from "./feedback-section";
import { ChairApprovalPanel } from "./chair-approval-panel";
import {
  SetupRepairPanel,
  type MentorshipSetupData,
} from "./setup-repair-panel";
import { ManageRelationship } from "./manage-relationship";
import { MenteeDashboardHome } from "./mentee-dashboard-home";
import { SelfHelpCard, SelfRecognitionCard } from "./self-sections";

/**
 * Shared Mentorship person workspace — quiet chrome, one job per tab.
 */

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "goals", label: "G&R" },
  { id: "feedback", label: "Feedback" },
  { id: "progress", label: "Review" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const SECTION_ALIASES: Record<string, SectionId> = {
  plan: "goals",
  relationships: "overview",
  timeline: "overview",
  opportunities: "overview",
  /** Old Feedback / Reviews / Meetings aliases */
  reviews: "feedback",
  reflection: "feedback",
  review: "progress",
  schedule: "overview",
  "check-ins": "overview",
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
      className="flex flex-wrap gap-1 border-b border-line-soft"
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
  reviewId,
  setup,
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
  reviewId?: string;
  setup?: MentorshipSetupData;
  sectionHref: (sectionId: string) => string;
  showHeader?: boolean;
  helpSent?: boolean;
  alsoMentors?: boolean;
  progressSent?: boolean;
  progressPending?: boolean;
}) {
  const isSelf = workspace.isSelf;
  const active =
    panel === "draft" || panel === "approve"
      ? "progress"
      : resolveSection(section);

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
      {!isSelf && (workspace.isAdmin || workspace.isLeadership) ? (
        <div className="rounded-[12px] border border-brand-200 bg-brand-50/60 px-4 py-3">
          <p className="m-0 text-[13.5px] font-semibold text-ink">
            Viewing as admin
          </p>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
            Same Home / G&amp;R / Feedback / Review tools their mentor uses — you can
            create reviews, request feedback, and manage the relationship.
          </p>
        </div>
      ) : null}

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
        <>
          <MenteeDashboardHome
            workspace={workspace}
            goalsHref={sectionHref("goals")}
            reviewsHref={sectionHref("progress")}
            personBasePath={`/mentorship/people/${workspace.person.id}`}
          />
          {isSelf ? (
            <SelfHelpCard
              returnHref={sectionHref("overview")}
              sent={helpSent}
              scheduleHref={sectionHref("overview")}
              goalsHref={sectionHref("goals")}
              resourcesHref={sectionHref("goals")}
            />
          ) : null}
          {!isSelf &&
          (workspace.isAdmin || workspace.isLeadership) &&
          workspace.activeMentorshipId ? (
            <details className="w-full">
              <summary className="cursor-pointer text-[12.5px] font-medium text-ink-muted">
                Manage relationship
              </summary>
              <div className="mt-3 max-w-xl">
                <ManageRelationshipHost
                  mentorshipId={workspace.activeMentorshipId}
                  menteeId={workspace.person.id}
                />
              </div>
            </details>
          ) : null}
          {!isSelf &&
          (workspace.isAdmin || workspace.isLeadership) &&
          !workspace.activeMentorshipId ? (
            <div className="rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3">
              <p className="m-0 text-[13.5px] font-semibold text-ink">
                No active mentorship yet
              </p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                Assign a mentor from the People dashboard, or open setup to pair them.
              </p>
              <div className="mt-2">
                <ButtonLink
                  href={sectionHref("overview") + (sectionHref("overview").includes("?") ? "&" : "?") + "panel=setup"}
                  variant="secondary"
                  size="sm"
                >
                  Open setup
                </ButtonLink>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!focusedReviewPanel && active === "goals" ? (
        <>
          <GoalsSection workspace={workspace} />
          {isSelf ? (
            <SelfRecognitionCard reflectionHref={sectionHref("feedback")} />
          ) : null}
        </>
      ) : null}

      {!focusedReviewPanel && active === "feedback" ? (
        <FeedbackSection
          workspace={workspace}
          sectionHref={sectionHref}
        />
      ) : null}

      {(canOpenDraft || (!focusedReviewPanel && active === "progress")) ? (
        <ProgressUpdateSection
          workspace={workspace}
          justSent={progressSent}
          pendingChair={progressPending}
          reviewId={reviewId}
          sectionHref={sectionHref}
        />
      ) : null}
    </>
  );

  if (!showHeader) {
    return <div className="flex flex-col gap-5">{body}</div>;
  }

  const reviewWrite =
    !isSelf &&
    active === "progress" &&
    workspace.capabilities.canDraftReview;

  return (
    <div
      className={`${skin.portalSkin} mx-auto flex w-full flex-col gap-5 ${
        reviewWrite || focusedReviewPanel ? "max-w-6xl" : "max-w-5xl"
      }`}
    >
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
