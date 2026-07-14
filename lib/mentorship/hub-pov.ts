/**
 * Mentorship hub POV resolution (pure, testable).
 *
 * The unified `/mentorship` home adapts to the viewer: mentees, mentors, and
 * leadership all land on the same card chooser, then enter the POV(s) they
 * hold via `?view=`.
 */

export type HubPov = "me" | "mentor" | "admin";

export type HubViewerFacts = {
  /** Has an active mentorship as the mentee (someone develops them). */
  isMentee: boolean;
  /** Actively mentors at least one person. */
  isMentor: boolean;
  isAdmin: boolean;
  /** Chairs at least one review lane (chair queue access). */
  isChair: boolean;
  /** Participates in at least one Role Committee. */
  isCommitteeMember?: boolean;
  /** Passes the leadership command-center gate (flag + officer tier + leadership). */
  hasCommandCenterAccess: boolean;
};

const POV_ORDER: HubPov[] = ["me", "mentor", "admin"];

/**
 * True when the viewer’s only Mentorship identity is being mentored —
 * no mentor console, chair queue, committee, or command center.
 */
export function isMenteeOnly(facts: HubViewerFacts): boolean {
  return (
    facts.isMentee &&
    !facts.isMentor &&
    !facts.isChair &&
    !facts.isCommitteeMember &&
    !facts.isAdmin &&
    !facts.hasCommandCenterAccess
  );
}

/** Every POV this viewer may open, in display order (me · mentor · admin). */
export function availablePovs(facts: HubViewerFacts): HubPov[] {
  const povs = new Set<HubPov>();
  // Mentee / Mentor cards only from real pairings — not admin/chair alone.
  if (facts.isMentee) povs.add("me");
  if (facts.isMentor) povs.add("mentor");
  // Chair / committee still use the mentor console for approval queues.
  if (facts.isChair || facts.isCommitteeMember) povs.add("mentor");
  // Any ADMIN gets the cockpit (parity with the old /admin/mentorship gate);
  // the leadership-only overview blocks are gated separately inside it.
  if (facts.hasCommandCenterAccess || facts.isAdmin) povs.add("admin");
  // Everyone who can open the hub gets at least their own development view —
  // an instructor without a mentor yet still needs to see what they owe.
  if (povs.size === 0) povs.add("me");
  return POV_ORDER.filter((p) => povs.has(p));
}

/**
 * Everyone lands on the Mentorship home chooser until they pick a `?view=`
 * (or open their mentee workspace). Cards shown depend on {@link availablePovs}.
 */
export function needsMentorshipRoleChooser(
  _facts: HubViewerFacts,
  requestedView: string | undefined
): boolean {
  return !requestedView;
}

/**
 * The POV to render: the requested one if the viewer has it, otherwise the
 * most operational POV they hold (admin → mentor → me).
 *
 * Callers that show {@link needsMentorshipRoleChooser} should not call this
 * until a view is chosen.
 */
export function resolvePov(
  facts: HubViewerFacts,
  requested: string | undefined
): HubPov {
  const available = availablePovs(facts);
  if (requested && (available as string[]).includes(requested)) {
    return requested as HubPov;
  }
  if (available.includes("admin")) return "admin";
  if (available.includes("mentor")) return "mentor";
  return "me";
}
