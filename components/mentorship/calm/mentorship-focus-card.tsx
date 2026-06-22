import type { CcIconName } from "@/components/command-center/icons";
import { PrimaryFocusCard } from "@/components/command-center/simple";
import type { MentorshipFocusKind, NextMentorshipFocus } from "@/lib/mentorship/view-model";

/**
 * The one "what should I do next?" mentorship card. A thin mapping from the
 * canonical `NextMentorshipFocus` onto the shared calm `PrimaryFocusCard`, so
 * every mentorship home leads with the same calm shape and one obvious move.
 */

const ICON_BY_KIND: Record<MentorshipFocusKind, CcIconName> = {
  kickoff: "flag",
  reflection: "compass",
  review: "scale",
  chair_approval: "scale",
  changes_requested: "flag",
  session: "calendar",
  commitment: "check",
  feedback: "send",
  support: "users",
};

const EYEBROW_BY_KIND: Record<MentorshipFocusKind, string> = {
  kickoff: "Kickoff",
  reflection: "Your reflection",
  review: "Review due",
  chair_approval: "Chair approval",
  changes_requested: "Changes requested",
  session: "Upcoming session",
  commitment: "Commitment",
  feedback: "Feedback",
  support: "Support request",
};

export function MentorshipFocusCard({ focus }: { focus: NextMentorshipFocus }) {
  return (
    <PrimaryFocusCard
      eyebrow={EYEBROW_BY_KIND[focus.kind]}
      title={focus.title}
      reason={focus.reason}
      icon={ICON_BY_KIND[focus.kind]}
      tone={focus.tone === "success" ? "success" : "brand"}
      ctaLabel={focus.ctaLabel}
      ctaHref={focus.ctaHref}
    />
  );
}
