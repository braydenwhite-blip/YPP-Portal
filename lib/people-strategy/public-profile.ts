import type { GrowthTag } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { whereActiveMember } from "@/lib/user-role-where";
import { getUserTitle } from "@/lib/user-title";

import { getMyActionItems } from "./action-queries";
import { isOfficerTier, type ActionViewer } from "./action-permissions";

/**
 * People Strategy — read-only public member profile (`/people/[id]`).
 *
 * Comment #5: "users clickable anywhere → useful public profile." Any signed-in
 * portal member may view any other active member's profile, so this loader is
 * deliberately conservative about what it exposes:
 *
 *   - Identity (name, resolved title, chapter, public bio/avatar) is shown to
 *     everyone.
 *   - "Current ownership" (actions this person leads / executes) is filtered
 *     through `getMyActionItems(subject, viewer)`, which enforces per-viewer
 *     action visibility — a member never sees an action they couldn't otherwise.
 *   - Growth Signals are a leadership *assessment* of the member (incl. watch
 *     signals like "At risk of disengaging"), so they are returned ONLY when the
 *     viewer is officer-tier. Never surfaced to peers or to the subject.
 *
 * Applicants are `User` rows distinguished only by role, so the lookup is scoped
 * with `whereActiveMember()` — a pure applicant (or an archived user) resolves to
 * null and the route 404s, keeping the applicant pipeline separate (comment #8).
 */

export interface PublicProfileActionRef {
  id: string;
  title: string;
  status: string;
  departmentName: string;
}

export interface PublicProfileGrowthSignal {
  tag: GrowthTag;
}

export interface PublicProfile {
  id: string;
  name: string;
  title: string;
  primaryRole: string | null;
  chapterName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  actionsLed: PublicProfileActionRef[];
  actionsExecuting: PublicProfileActionRef[];
  /** Officer-tier viewers only; null when the viewer may not see assessments. */
  growthSignals: PublicProfileGrowthSignal[] | null;
}

function locationLabel(
  city: string | null | undefined,
  stateProvince: string | null | undefined
): string | null {
  const parts = [city?.trim(), stateProvince?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Load the public profile for `subjectUserId` as seen by `viewer`. Returns null
 * when the subject does not exist, is archived, or is an applicant-only user —
 * the caller renders a 404 in every case so the route never leaks existence.
 */
export async function loadPublicProfile(
  subjectUserId: string,
  viewer: ActionViewer
): Promise<PublicProfile | null> {
  const user = await prisma.user.findFirst({
    where: { id: subjectUserId, archivedAt: null, ...whereActiveMember() },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      primaryRole: true,
      adminSubtypes: { select: { subtype: true } },
      chapter: { select: { name: true } },
      profile: {
        select: { bio: true, avatarUrl: true, city: true, stateProvince: true },
      },
    },
  });
  if (!user) return null;

  const viewerIsOfficer = isOfficerTier(viewer);

  // Actions the subject owns, filtered to what the viewer is allowed to see.
  const actionItems = await getMyActionItems(subjectUserId, viewer);
  const activeItems = actionItems.filter((item) => item.status !== "COMPLETE");

  const toRef = (item: (typeof activeItems)[number]): PublicProfileActionRef => ({
    id: item.id,
    title: item.title,
    status: item.status,
    departmentName: item.department?.name ?? "Unassigned",
  });

  const actionsLed = activeItems
    .filter((item) => item.leadId === subjectUserId)
    .map(toRef);
  const actionsExecuting = activeItems
    .filter(
      (item) =>
        item.leadId !== subjectUserId &&
        item.assignments.some(
          (a) => a.user.id === subjectUserId && a.role === "EXECUTING"
        )
    )
    .map(toRef);

  // Growth Signals: officer-tier only (leadership assessment, not public).
  let growthSignals: PublicProfileGrowthSignal[] | null = null;
  if (viewerIsOfficer) {
    const tags = await prisma.memberGrowthTag.findMany({
      where: { userId: subjectUserId },
      select: { tag: true },
      orderBy: { createdAt: "asc" },
    });
    growthSignals = tags.map((t) => ({ tag: t.tag }));
  }

  return {
    id: user.id,
    name: user.name?.trim() || user.email,
    title: getUserTitle({
      title: user.title,
      primaryRole: user.primaryRole,
      adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    }),
    primaryRole: user.primaryRole,
    chapterName: user.chapter?.name ?? null,
    bio: user.profile?.bio ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    location: locationLabel(user.profile?.city, user.profile?.stateProvince),
    actionsLed,
    actionsExecuting,
    growthSignals,
  };
}
