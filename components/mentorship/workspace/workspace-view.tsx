import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { isGamificationEnabled } from "@/lib/gamification-gate";
import { SegmentedTabs } from "@/app/(app)/mentorship/_components/segmented-tabs";
import { MenteeDevelopmentBrief } from "@/app/(app)/mentorship/_components/mentee-development-brief";

import {
  OverviewSection,
  DevelopmentPlanSection,
  CheckInsSection,
  TimelineSection,
  OpportunitiesSection,
  RelationshipsSection,
} from "./sections";
import {
  SelfGoalsSection,
  SelfHelpCard,
  SelfRecognitionSection,
  SelfReflectionSection,
  SelfReviewsSection,
  SelfScheduleSection,
} from "./self-sections";
import { MentorToolsPanel } from "./mentor-tools-panel";

/**
 * The shared Mentorship workspace body — header, section tabs, and the active
 * section. Rendered from two hosts: `/mentorship/people/[id]` (full header) and
 * the hub's `?view=me` POV (`showHeader={false}`, one header per page).
 *
 * Two section sets, decided by `workspace.isSelf` (never by URL): the person's
 * own workspace gets the expanded mentee set (goals, reviews, reflection,
 * schedule, recognition folded in from the old /my-mentor/* satellites); every
 * other viewer keeps the mentor/leadership six.
 */

const STANDARD_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Plan" },
  { id: "check-ins", label: "Check-ins" },
  { id: "timeline", label: "Timeline" },
  { id: "opportunities", label: "Opportunities" },
  { id: "relationships", label: "Relationships" },
] as const;

function selfSections(): Array<{ id: string; label: string }> {
  return [
    { id: "overview", label: "Overview" },
    { id: "goals", label: "Goals" },
    { id: "reviews", label: "Reviews" },
    { id: "reflection", label: "Reflection" },
    { id: "check-ins", label: "Check-ins" },
    { id: "schedule", label: "Schedule" },
    // Awards are dark until ENABLE_GAMIFICATION; the section then only holds
    // mentor-shared resources.
    { id: "recognition", label: isGamificationEnabled() ? "Recognition" : "Resources" },
    { id: "timeline", label: "Timeline" },
  ];
}

export function MentorshipWorkspaceView({
  workspace,
  section,
  sectionHref,
  showHeader = true,
  helpSent = false,
}: {
  workspace: MentorshipWorkspace;
  /** Raw `?section=` value; anything unknown falls back to "overview". */
  section?: string;
  /** Builds the tab href for a section id (host decides the URL shape). */
  sectionHref: (sectionId: string) => string;
  /** The hub renders its own PageHeaderV2 — pass false to skip this one. */
  showHeader?: boolean;
  /** Whether the help-request form just submitted (`?sent=1`). */
  helpSent?: boolean;
}) {
  const isSelf = workspace.isSelf;

  const sections: Array<{ id: string; label: string }> = isSelf
    ? selfSections()
    : [...STANDARD_SECTIONS];

  const active = sections.some((s) => s.id === section) ? section! : "overview";

  const tabs = sections.map((s) => ({
    id: s.id,
    label: s.label,
    href: sectionHref(s.id),
    count:
      s.id === "check-ins"
        ? workspace.checkIns.length || undefined
        : s.id === "opportunities"
          ? workspace.opportunities.length || undefined
          : undefined,
  }));

  const showMentorTools =
    !!workspace.activeMentorshipId &&
    (workspace.accessLevel === "leadership" ||
      (workspace.canRecordCheckIn && !workspace.isSelf));

  const body = (
    <>
      <div className="overflow-x-auto pb-1">
        <SegmentedTabs tabs={tabs} activeId={active} ariaLabel="Mentorship section" />
      </div>

      {active === "overview" ? (
        isSelf ? (
          <>
            <MenteeDevelopmentBrief
              userId={workspace.person.id}
              embedded
              links={{
                reflection: sectionHref("reflection"),
                reviews: sectionHref("reviews"),
              }}
            />
            <OverviewSection workspace={workspace} />
            {/* No ninth tab: growth opportunities surface inline when present. */}
            {workspace.opportunities.length > 0 ? (
              <OpportunitiesSection workspace={workspace} />
            ) : null}
            <SelfHelpCard
              returnHref={sectionHref("overview")}
              sent={helpSent}
              scheduleHref={sectionHref("schedule")}
              goalsHref={sectionHref("goals")}
              resourcesHref={sectionHref("recognition")}
            />
          </>
        ) : (
          <>
            <OverviewSection workspace={workspace} />
            {showMentorTools ? (
              <MentorToolsPanel
                menteeId={workspace.person.id}
                mentorshipId={workspace.activeMentorshipId!}
              />
            ) : null}
          </>
        )
      ) : null}

      {/* Shared sections */}
      {active === "check-ins" ? <CheckInsSection workspace={workspace} /> : null}
      {active === "timeline" ? <TimelineSection workspace={workspace} /> : null}

      {/* Self-only sections (folded in from the old /my-mentor/* satellites) */}
      {isSelf && active === "goals" ? <SelfGoalsSection /> : null}
      {isSelf && active === "reviews" ? (
        <SelfReviewsSection reflectionHref={sectionHref("reflection")} />
      ) : null}
      {isSelf && active === "reflection" ? (
        <SelfReflectionSection overviewHref={sectionHref("overview")} />
      ) : null}
      {isSelf && active === "schedule" ? (
        <SelfScheduleSection reflectionHref={sectionHref("reflection")} />
      ) : null}
      {isSelf && active === "recognition" ? (
        <SelfRecognitionSection
          reflectionHref={sectionHref("reflection")}
          overviewHref={sectionHref("overview")}
        />
      ) : null}

      {/* Mentor/leadership-only sections */}
      {!isSelf && active === "plan" ? <DevelopmentPlanSection workspace={workspace} /> : null}
      {!isSelf && active === "opportunities" ? (
        <OpportunitiesSection workspace={workspace} />
      ) : null}
      {!isSelf && active === "relationships" ? (
        <RelationshipsSection workspace={workspace} />
      ) : null}
    </>
  );

  if (!showHeader) {
    return <div className="flex flex-col gap-5">{body}</div>;
  }

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-5`}>
      <PageHeaderV2
        backHref="/mentorship"
        backLabel="Mentorship"
        eyebrow={isSelf ? "Your development" : "Mentorship"}
        title={workspace.person.name}
        subtitle={[
          workspace.person.contextLabel,
          workspace.overview.mentorName
            ? `Mentored by ${workspace.overview.mentorName}`
            : "No mentor assigned",
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          workspace.accessLevel === "leadership" ? (
            <ButtonLink
              href={`/people/${workspace.person.id}`}
              variant="secondary"
              size="sm"
            >
              Full profile →
            </ButtonLink>
          ) : undefined
        }
      />
      {body}
    </div>
  );
}
