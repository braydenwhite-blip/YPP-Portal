import type { GrowthTag } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { whereActiveMember } from "@/lib/user-role-where";
import { getUserTitle } from "@/lib/user-title";

import { getMyActionItems } from "./action-queries";
import { isOfficerTier, type ActionViewer } from "./action-permissions";
import { formatClassSchedule, getMyTeachingClasses } from "./class-tracker";

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

/** A linked person (mentor / mentee) shown on a profile. */
export interface PublicProfilePerson {
  id: string;
  name: string;
  title: string;
}

/** A class this person teaches, surfaced from the Classes system. */
export interface PublicProfileClassRef {
  id: string;
  title: string;
  schedule: string;
}

/** A public peer kudos this person received. */
export interface PublicProfileKudos {
  id: string;
  category: string;
  message: string;
  giverId: string;
  giverName: string;
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
  /** Contact details — public per the member-profile design (only performance
   * data is leadership-gated). */
  email: string;
  phone: string | null;
  school: string | null;
  /** Whole months since the account was created ("Active — N months"). */
  monthsActive: number;
  /** Mentorship links (active pairings only). */
  mentors: PublicProfilePerson[];
  mentees: PublicProfilePerson[];
  classesTaught: PublicProfileClassRef[];
  /** Public peer recognition received (total + a few most recent). */
  kudosTotal: number;
  kudos: PublicProfileKudos[];
  actionsLed: PublicProfileActionRef[];
  actionsExecuting: PublicProfileActionRef[];
  /** Officer-tier viewers only; null when the viewer may not see assessments. */
  growthSignals: PublicProfileGrowthSignal[] | null;
}

/** User-shape select that powers `getUserTitle`. */
const TITLE_SELECT = {
  id: true,
  name: true,
  email: true,
  title: true,
  primaryRole: true,
  adminSubtypes: { select: { subtype: true } },
} as const;

type TitleShaped = {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  primaryRole: string | null;
  adminSubtypes: { subtype: string }[];
};

function toProfilePerson(user: TitleShaped): PublicProfilePerson {
  return {
    id: user.id,
    name: user.name?.trim() || user.email,
    title: getUserTitle({
      title: user.title,
      primaryRole: user.primaryRole,
      adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    }),
  };
}

/** Whole months between `from` and now (floored, never negative). */
function monthsSince(from: Date, now: Date = new Date()): number {
  const months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth());
  return Math.max(0, months);
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
      phone: true,
      title: true,
      primaryRole: true,
      createdAt: true,
      adminSubtypes: { select: { subtype: true } },
      chapter: { select: { name: true } },
      profile: {
        select: {
          bio: true,
          avatarUrl: true,
          city: true,
          stateProvince: true,
          school: true,
        },
      },
      // Active mentorships: `menteePairs` are pairings where this person is the
      // mentee (→ their mentor); `mentorPairs` are where they are the mentor
      // (→ their mentees).
      menteePairs: {
        where: { status: "ACTIVE" },
        select: { mentor: { select: TITLE_SELECT } },
      },
      mentorPairs: {
        where: { status: "ACTIVE" },
        select: { mentee: { select: TITLE_SELECT } },
      },
    },
  });
  if (!user) return null;

  const viewerIsOfficer = isOfficerTier(viewer);

  // Classes this person teaches (lead or executing instructor) — read-only.
  const teaching = await getMyTeachingClasses(subjectUserId);
  const classesTaught = teaching.map((c) => ({
    id: c.id,
    title: c.title,
    schedule: formatClassSchedule(c),
  }));

  const mentors = user.menteePairs.map((p) => toProfilePerson(p.mentor));
  const mentees = user.mentorPairs.map((p) => toProfilePerson(p.mentee));

  // Public peer recognition received (a few most recent + a total count).
  const [kudosRows, kudosTotal] = await Promise.all([
    prisma.peerKudos.findMany({
      where: { receiverId: subjectUserId, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        category: true,
        message: true,
        giver: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.peerKudos.count({
      where: { receiverId: subjectUserId, isPublic: true },
    }),
  ]);
  const kudos = kudosRows.map((k) => ({
    id: k.id,
    category: k.category,
    message: k.message,
    giverId: k.giver.id,
    giverName: k.giver.name ?? k.giver.email,
  }));

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
    email: user.email,
    phone: user.phone ?? null,
    school: user.profile?.school ?? null,
    monthsActive: monthsSince(user.createdAt),
    mentors,
    mentees,
    classesTaught,
    kudosTotal,
    kudos,
    actionsLed,
    actionsExecuting,
    growthSignals,
  };
}
