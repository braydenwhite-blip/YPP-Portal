import { prisma } from "@/lib/prisma";

import {
  isRelatedEntityType,
  relatedEntityTypeLabel,
  type RelatedEntityType,
} from "./constants";

/**
 * People Strategy Operating System — cross-surface connection loaders.
 *
 * Plain (non-"use server") read helpers, mirroring `action-queries.ts` /
 * `class-tracker.ts`. They resolve a polymorphic related-entity ref to a safe,
 * human-friendly summary (for the "Linked to …" chip + new-action prefill) and
 * answer the small "who supports this person?" question the class / instructor
 * panels ask. None of them throw on a missing/stale row — they return null so a
 * page can fail safe rather than 500 on a dangling link.
 */

/** A safe, human-friendly summary of a related entity for chips + prefill. */
export type RelatedEntitySummary = {
  type: RelatedEntityType;
  id: string;
  /** Entity-specific label, e.g. a class title or a person's name. */
  label: string;
  /** The type's display label, e.g. "Class" / "Mentorship" / "Person". */
  typeLabel: string;
  /** A safe in-portal detail link, or null when no stable page exists. */
  href: string | null;
};

/**
 * Resolve a polymorphic related-entity ref to a display summary. Returns null
 * for an unknown type, a blank id, or a row that no longer exists, so callers
 * fail safe (drop the prefill / hide the chip) instead of rendering a broken
 * link or throwing on a dangling reference.
 */
export async function loadRelatedEntitySummary(
  type: string,
  id: string
): Promise<RelatedEntitySummary | null> {
  if (!isRelatedEntityType(type)) return null;
  const entityId = id?.trim();
  if (!entityId) return null;

  const typeLabel = relatedEntityTypeLabel(type);

  switch (type) {
    case "CLASS_OFFERING": {
      const cls = await prisma.classOffering.findUnique({
        where: { id: entityId },
        select: { id: true, title: true },
      });
      if (!cls) return null;
      return {
        type,
        id: entityId,
        label: cls.title,
        typeLabel,
        href: `/admin/classes/${cls.id}`,
      };
    }
    case "MENTORSHIP": {
      const mentorship = await prisma.mentorship.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          mentor: { select: { name: true, email: true } },
          mentee: { select: { id: true, name: true, email: true } },
        },
      });
      if (!mentorship) return null;
      const mentor = mentorship.mentor?.name ?? mentorship.mentor?.email ?? "Mentor";
      const mentee = mentorship.mentee?.name ?? mentorship.mentee?.email ?? "Mentee";
      return {
        type,
        id: entityId,
        label: `${mentor} → ${mentee}`,
        typeLabel,
        // The mentee workspace route is keyed by the mentee USER id.
        href: mentorship.mentee?.id
          ? `/mentorship/mentees/${mentorship.mentee.id}`
          : null,
      };
    }
    case "USER": {
      const user = await prisma.user.findUnique({
        where: { id: entityId },
        select: { id: true, name: true, email: true },
      });
      if (!user) return null;
      return {
        type,
        id: entityId,
        label: user.name ?? user.email ?? "Person",
        typeLabel,
        href: `/people/${user.id}`,
      };
    }
    case "INSTRUCTOR_APPLICATION": {
      // A valid link value, but its detail page is a risky redirect proxy, so we
      // surface a label without a deep link (on-page panel deferred — plan §4).
      const app = await prisma.instructorApplication.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          legalName: true,
          preferredFirstName: true,
          lastName: true,
          applicant: { select: { name: true, email: true } },
        },
      });
      if (!app) return null;
      const composed = [app.preferredFirstName, app.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const label =
        composed ||
        app.legalName ||
        app.applicant?.name ||
        app.applicant?.email ||
        "Instructor application";
      return { type, id: entityId, label, typeLabel, href: null };
    }
    default: {
      // Exhaustiveness guard: a new RELATED_ENTITY_TYPE_VALUES entry without a
      // case here is a compile error.
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** The active mentor relationship supporting a person, summarised for a panel. */
export type MenteeSupport = {
  mentorshipId: string;
  mentor: { id: string; name: string | null; email: string };
  type: string;
  status: string;
};

/**
 * The active mentorship in which `userId` is the MENTEE, if any — answers "who
 * supports this instructor / person?" on the class and instructor panels.
 * Returns the most-recently-started active mentorship, or null when the person
 * has no active mentor (the panel then shows a clear "no mentor support yet").
 */
export async function getMenteeSupport(
  userId: string
): Promise<MenteeSupport | null> {
  if (!userId) return null;

  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      type: true,
      status: true,
      mentor: { select: { id: true, name: true, email: true } },
    },
  });
  if (!mentorship) return null;

  return {
    mentorshipId: mentorship.id,
    mentor: mentorship.mentor,
    type: mentorship.type,
    status: mentorship.status,
  };
}
