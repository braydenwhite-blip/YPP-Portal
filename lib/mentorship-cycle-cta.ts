/**
 * Shared CTA lookup for a mentorship cycle stage (Phase 0.95 + 0.9999).
 *
 * Consumed by:
 *   - components/mentorship/cycle-status-block.tsx (mentee workspace pin)
 *   - components/mentorship/mentor-kanban-card.tsx (Phase 0.9999 Kanban)
 *
 * Keep this the ONLY place where stage → (label, href, disabled, variant)
 * mapping lives. Drift here shows up as contradictory button labels across
 * the Kanban and the workspace.
 */
import type { MentorshipCycleStage } from "@prisma/client";

export type CycleCTA = {
  label: string;
  href: string | null;
  disabled: boolean;
  variant: "primary" | "secondary" | "muted";
};

type LookupArgs = {
  stage: MentorshipCycleStage;
  menteeId: string;
  mentorshipId: string;
  reviewId?: string | null;
  mentorCheckInComplete?: boolean;
};

function feedbackHref(menteeId: string, panel?: "draft" | "approve"): string {
  const base = `/mentorship/people/${menteeId}?section=reviews`;
  return panel ? `${base}&panel=${panel}` : base;
}

export function getCycleStageCTA({
  stage,
  menteeId,
  mentorCheckInComplete = false,
}: LookupArgs): CycleCTA {
  switch (stage) {
    case "KICKOFF_PENDING":
      return {
        label: "Mark first meeting done",
        href: `/mentorship/people/${menteeId}?section=check-ins`,
        disabled: false,
        variant: "primary",
      };
    case "REFLECTION_DUE":
      return {
        label: "Waiting on their note",
        href: null,
        disabled: true,
        variant: "muted",
      };
    case "REFLECTION_SUBMITTED":
      if (!mentorCheckInComplete) {
        return {
          label: "Log meeting",
          href: feedbackHref(menteeId),
          disabled: false,
          variant: "primary",
        };
      }
      return {
        label: "Send feedback",
        href: feedbackHref(menteeId),
        disabled: false,
        variant: "primary",
      };
    case "REVIEW_SUBMITTED":
      return {
        label: "Waiting on chair",
        href: null,
        disabled: true,
        variant: "muted",
      };
    case "CHANGES_REQUESTED":
      return {
        label: "Fix and resend feedback",
        href: feedbackHref(menteeId, "draft"),
        disabled: false,
        variant: "primary",
      };
    case "APPROVED":
      return {
        label: "View feedback",
        href: feedbackHref(menteeId),
        disabled: false,
        variant: "secondary",
      };
    case "PAUSED":
      return { label: "Paused", href: null, disabled: true, variant: "muted" };
    case "COMPLETE":
      return { label: "Complete", href: null, disabled: true, variant: "muted" };
    default:
      return {
        label: "Open",
        href: `/mentorship/people/${menteeId}`,
        disabled: false,
        variant: "secondary",
      };
  }
}

export function stageLabel(stage: MentorshipCycleStage): string {
  switch (stage) {
    case "KICKOFF_PENDING":
      return "First meeting pending";
    case "REFLECTION_DUE":
      return "Note due";
    case "REFLECTION_SUBMITTED":
      return "Note in";
    case "REVIEW_SUBMITTED":
      return "Waiting on chair";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "APPROVED":
      return "Shared";
    case "PAUSED":
      return "Paused";
    case "COMPLETE":
      return "Complete";
    default:
      return stage;
  }
}
