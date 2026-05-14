import { SegmentedTabs } from "./segmented-tabs";

export type MentorshipView = "mentee" | "mentor";

interface MentorshipTabShellProps {
  /** Decoded ?view= param value, or undefined for "use the default". */
  requestedView?: string;
  showMentee: boolean;
  showMentor: boolean;
  /** Mentee count shown as a chip next to the Mentor tab label. */
  menteeCount?: number;
  menteeContent: React.ReactNode;
  mentorContent: React.ReactNode;
}

/**
 * Orchestrates the Mentee | Mentor tab experience.
 *
 * - When both showMentee and showMentor are true: renders the
 *   segmented control and the active tab's children. Default tab is
 *   "mentee".
 * - When only one is true: hides the segments (single-tab is silent)
 *   and renders that tab's children directly.
 * - When neither is true: renders nothing — the caller is expected
 *   to show an empty state instead.
 */
export function MentorshipTabShell({
  requestedView,
  showMentee,
  showMentor,
  menteeCount,
  menteeContent,
  mentorContent,
}: MentorshipTabShellProps) {
  if (!showMentee && !showMentor) return null;

  const activeView: MentorshipView = resolveActiveView({
    requestedView,
    showMentee,
    showMentor,
  });

  const showSegments = showMentee && showMentor;

  return (
    <>
      {showSegments && (
        <div style={{ margin: "0 0 24px" }}>
          <SegmentedTabs
            ariaLabel="Mentorship view"
            activeId={activeView}
            tabs={[
              {
                id: "mentee",
                label: "Being mentored",
                href: "/mentorship?view=mentee",
              },
              {
                id: "mentor",
                label: "Mentoring others",
                href: "/mentorship?view=mentor",
                count: menteeCount,
              },
            ]}
          />
        </div>
      )}

      {activeView === "mentor" ? mentorContent : menteeContent}
    </>
  );
}

function resolveActiveView({
  requestedView,
  showMentee,
  showMentor,
}: {
  requestedView?: string;
  showMentee: boolean;
  showMentor: boolean;
}): MentorshipView {
  if (requestedView === "mentor" && showMentor) return "mentor";
  if (requestedView === "mentee" && showMentee) return "mentee";
  // No valid request — default by available roles.
  if (showMentee) return "mentee";
  return "mentor";
}
