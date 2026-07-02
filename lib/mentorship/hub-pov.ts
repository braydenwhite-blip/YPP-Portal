/**
 * Mentorship hub POV resolution (pure, testable).
 *
 * The unified `/mentorship` command center adapts to the viewer: the person
 * being developed sees "My Development", a mentor sees their coaching console,
 * and leadership sees the org-wide command center. One page, one mental model,
 * `?view=` switches between the POVs the viewer actually has.
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
  /** Passes the leadership command-center gate (flag + officer tier + leadership). */
  hasCommandCenterAccess: boolean;
};

const POV_ORDER: HubPov[] = ["me", "mentor", "admin"];

/** Every POV this viewer may open, in display order (me · mentor · admin). */
export function availablePovs(facts: HubViewerFacts): HubPov[] {
  const povs = new Set<HubPov>();
  if (facts.isMentee) povs.add("me");
  if (facts.isMentor || facts.isChair || facts.isAdmin) povs.add("mentor");
  if (facts.hasCommandCenterAccess) povs.add("admin");
  // Everyone who can open the hub gets at least their own development view —
  // an instructor without a mentor yet still needs to see what they owe.
  if (povs.size === 0) povs.add("me");
  return POV_ORDER.filter((p) => povs.has(p));
}

/**
 * The POV to render: the requested one if the viewer has it, otherwise the
 * most operational POV they hold (admin → mentor → me). Leadership lands on
 * the command center; mentors land on their console; everyone else on
 * their own development.
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
