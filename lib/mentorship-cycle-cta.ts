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
};

export function getCycleStageCTA({ stage, menteeId, reviewId }: LookupArgs): CycleCTA {
  switch (stage) {
    case "KICKOFF_PENDING":
      return {
        label: "Mark kickoff complete",
        href: `/mentorship/mentees/${menteeId}`,
        disabled: false,
        variant: "primary",
      };
    case "REFLECTION_DUE":
      return {
        label: "Waiting on mentee reflection",
        href: null,
        disabled: true,
        variant: "muted",
      };
    case "REFLECTION_SUBMITTED":
      return {
        label: "Write monthly review",
        href: `/mentorship/reviews/${menteeId}`,
        disabled: false,
        variant: "primary",
      };
    case "REVIEW_SUBMITTED":
      return {
        label: "Awaiting chair approval",
        href: null,
        disabled: true,
        variant: "muted",
      };
    case "CHANGES_REQUESTED":
      return {
        label: "Revise review",
        href: `/mentorship/reviews/${menteeId}`,
        disabled: false,
        variant: "primary",
      };
    case "APPROVED":
      return {
        label: "View released review",
        href: reviewId ? `/mentorship/reviews/${menteeId}` : `/mentorship/mentees/${menteeId}`,
        disabled: false,
        variant: "secondary",
      };
    case "PAUSED":
      return { label: "Paused", href: null, disabled: true, variant: "muted" };
    case "COMPLETE":
      return { label: "Complete", href: null, disabled: true, variant: "muted" };
    default:
      return { label: "View", href: `/mentorship/mentees/${menteeId}`, disabled: false, variant: "secondary" };
  }
}

export function stageLabel(stage: MentorshipCycleStage): string {
  switch (stage) {
    case "KICKOFF_PENDING":
      return "Kickoff pending";
    case "REFLECTION_DUE":
      return "Reflection due";
    case "REFLECTION_SUBMITTED":
      return "Reflection submitted";
    case "REVIEW_SUBMITTED":
      return "Awaiting chair";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "APPROVED":
      return "Approved";
    case "PAUSED":
      return "Paused";
    case "COMPLETE":
      return "Complete";
    default:
      return stage;
  }
}
