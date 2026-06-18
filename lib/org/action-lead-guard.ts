/**
 * Action-lead eligibility (Phase 5 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * The proposal: an action's accountable Lead must be internal level >= 3 on
 * either ladder; Managers / Senior Managers (levels 1-2) may lead only when
 * explicitly authorized by an Officer or Board Member. This enforces that on
 * lead assignment, and provides the pure "needs an eligible owner" predicate
 * behind the Owner Needed queue.
 *
 * The server enforcement is ADDITIVE and OFF BY DEFAULT
 * (ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED): with the flag off it is a no-op, so
 * existing flows are unchanged until internal levels are populated and the org
 * opts in.
 */

import { prisma } from "@/lib/prisma";
import {
  canLeadAction,
  resolvePersonAuthority,
  type PersonAuthority,
} from "@/lib/org/levels";

/** Whether action-lead eligibility enforcement is turned on. */
export function isActionLeadEligibilityEnforced(): boolean {
  return process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED === "true";
}

/** Pure: is this authority allowed to be an accountable Lead? */
export function actionLeadIsEligible(
  authority: PersonAuthority,
  opts: { authorizedByOfficer?: boolean } = {}
): boolean {
  return canLeadAction(authority, opts).eligible;
}

/**
 * Pure Owner Needed predicate: an active action needs an owner when it has no
 * lead, or its lead is not eligible to lead. `leadAuthority` is the resolved
 * authority of the current lead (null when there is no lead).
 */
export function actionNeedsOwner(args: {
  hasLead: boolean;
  leadAuthority: PersonAuthority | null;
  authorizedByOfficer?: boolean;
}): boolean {
  if (!args.hasLead || !args.leadAuthority) return true;
  return !actionLeadIsEligible(args.leadAuthority, {
    authorizedByOfficer: args.authorizedByOfficer,
  });
}

/**
 * Throws Unauthorized when the flag is on and `userId` is not eligible to be an
 * action Lead. No-op when the flag is off or the user cannot be loaded (fail
 * open while the spine is still being populated). `authorizedByOfficer` carries
 * the proposal's carve-out: an Officer/Board Member making the assignment counts
 * as explicit authorization for a Manager/Senior Manager.
 */
export async function assertActionLeadEligible(
  userId: string,
  opts: { authorizedByOfficer?: boolean } = {}
): Promise<void> {
  if (!isActionLeadEligibilityEnforced()) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      title: true,
      primaryRole: true,
      internalLevel: true,
      ladder: true,
      canonicalTitle: true,
      adminSubtypes: { select: { subtype: true } },
    },
  });
  if (!user) return; // fail open

  const authority = resolvePersonAuthority({
    title: user.title,
    primaryRole: user.primaryRole,
    internalLevel: user.internalLevel,
    ladder: user.ladder,
    canonicalTitle: user.canonicalTitle,
    adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
  });

  const verdict = canLeadAction(authority, opts);
  if (!verdict.eligible) {
    throw new Error(
      `Unauthorized: ${user.name} cannot be the accountable Lead — ${verdict.reason}`
    );
  }
}
