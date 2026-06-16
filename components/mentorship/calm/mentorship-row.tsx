import type { GoalRatingColor, MentorshipCycleStage } from "@prisma/client";

import { SimpleRow } from "@/components/command-center/simple";
import type { StatusTone } from "@/components/ui-v2";
import { getRatingCopyForAudience, type RatingAudience } from "@/lib/mentorship-rubric-copy";
import type { MentorshipRelationshipSummary, MentorshipRole } from "@/lib/mentorship/view-model";

/**
 * A calm, scannable relationship row built on the shared `SimpleRow`. Shows the
 * *other* party (the mentee for a mentor, the mentor for a mentee), the current
 * cycle state in plain language, and the rubric color as a DS status pill.
 */

const CYCLE_STAGE_LABEL: Record<MentorshipCycleStage, string> = {
  KICKOFF_PENDING: "Kickoff pending",
  REFLECTION_DUE: "Reflection due",
  REFLECTION_SUBMITTED: "Reflection in",
  REVIEW_SUBMITTED: "Review submitted",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Up to date",
  PAUSED: "Paused",
  COMPLETE: "Complete",
};

const RATING_TONE: Record<GoalRatingColor, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

function audienceForRole(role: MentorshipRole): RatingAudience {
  if (role === "mentee") return "mentee";
  if (role === "admin") return "admin";
  return "mentor";
}

export function MentorshipRow({
  relationship,
  audience,
}: {
  relationship: MentorshipRelationshipSummary;
  /** Override the rubric audience; defaults to the viewer's role for the row. */
  audience?: RatingAudience;
}) {
  const otherName =
    relationship.viewerRole === "mentee" ? relationship.mentorName : relationship.menteeName;
  const resolvedAudience = audience ?? audienceForRole(relationship.viewerRole);
  const status = relationship.colorStatus
    ? {
        label: getRatingCopyForAudience(relationship.colorStatus, resolvedAudience).label,
        tone: RATING_TONE[relationship.colorStatus],
      }
    : null;

  return (
    <SimpleRow
      href={relationship.href}
      name={otherName}
      what={CYCLE_STAGE_LABEL[relationship.cycleStage]}
      status={status}
    />
  );
}
