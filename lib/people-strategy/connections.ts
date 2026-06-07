import { prisma } from "@/lib/prisma";

import { relatedEntityRefKey } from "./action-queries";
import {
  isRelatedEntityType,
  relatedEntityTypeLabel,
  type RelatedEntityRef,
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

/**
 * Batch variant of {@link loadRelatedEntitySummary}: resolve many polymorphic
 * refs to their display summaries in ONE query per entity TYPE (so N classes +
 * M mentorships cost two queries, never N + M). Returns a Map keyed by
 * {@link relatedEntityRefKey} so callers can title a grouped Action Tracker view
 * by each linked entity's own name ("Algebra 101 · Class") instead of just its
 * type. Refs that no longer resolve (a deleted class, a dangling link) are simply
 * absent from the Map — the caller falls back to the type label — and a query
 * failure for one type never drops the others (each type settles independently).
 */
export async function loadRelatedEntityLabels(
  refs: RelatedEntityRef[]
): Promise<Map<string, RelatedEntitySummary>> {
  const result = new Map<string, RelatedEntitySummary>();

  // Bucket de-duped, trimmed ids by type so each present type costs one query.
  const idsByType = new Map<RelatedEntityType, Set<string>>();
  for (const ref of refs) {
    if (!ref || !isRelatedEntityType(ref.type)) continue;
    const id = ref.id?.trim();
    if (!id) continue;
    let set = idsByType.get(ref.type);
    if (!set) {
      set = new Set<string>();
      idsByType.set(ref.type, set);
    }
    set.add(id);
  }
  if (idsByType.size === 0) return result;

  const put = (summary: RelatedEntitySummary) => {
    result.set(relatedEntityRefKey(summary.type, summary.id), summary);
  };

  const tasks: Array<Promise<unknown>> = [];

  const classIds = idsByType.get("CLASS_OFFERING");
  if (classIds?.size) {
    const typeLabel = relatedEntityTypeLabel("CLASS_OFFERING");
    tasks.push(
      prisma.classOffering
        .findMany({
          where: { id: { in: [...classIds] } },
          select: { id: true, title: true },
        })
        .then((rows) => {
          for (const c of rows) {
            put({
              type: "CLASS_OFFERING",
              id: c.id,
              label: c.title,
              typeLabel,
              href: `/admin/classes/${c.id}`,
            });
          }
        })
    );
  }

  const mentorshipIds = idsByType.get("MENTORSHIP");
  if (mentorshipIds?.size) {
    const typeLabel = relatedEntityTypeLabel("MENTORSHIP");
    tasks.push(
      prisma.mentorship
        .findMany({
          where: { id: { in: [...mentorshipIds] } },
          select: {
            id: true,
            mentor: { select: { name: true, email: true } },
            mentee: { select: { id: true, name: true, email: true } },
          },
        })
        .then((rows) => {
          for (const m of rows) {
            const mentor = m.mentor?.name ?? m.mentor?.email ?? "Mentor";
            const mentee = m.mentee?.name ?? m.mentee?.email ?? "Mentee";
            put({
              type: "MENTORSHIP",
              id: m.id,
              label: `${mentor} → ${mentee}`,
              typeLabel,
              href: m.mentee?.id ? `/mentorship/mentees/${m.mentee.id}` : null,
            });
          }
        })
    );
  }

  const userIds = idsByType.get("USER");
  if (userIds?.size) {
    const typeLabel = relatedEntityTypeLabel("USER");
    tasks.push(
      prisma.user
        .findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        })
        .then((rows) => {
          for (const u of rows) {
            put({
              type: "USER",
              id: u.id,
              label: u.name ?? u.email ?? "Person",
              typeLabel,
              href: `/people/${u.id}`,
            });
          }
        })
    );
  }

  const applicationIds = idsByType.get("INSTRUCTOR_APPLICATION");
  if (applicationIds?.size) {
    const typeLabel = relatedEntityTypeLabel("INSTRUCTOR_APPLICATION");
    tasks.push(
      prisma.instructorApplication
        .findMany({
          where: { id: { in: [...applicationIds] } },
          select: {
            id: true,
            legalName: true,
            preferredFirstName: true,
            lastName: true,
            applicant: { select: { name: true, email: true } },
          },
        })
        .then((rows) => {
          for (const app of rows) {
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
            // No deep link — its detail page is a risky redirect proxy (plan §4).
            put({ type: "INSTRUCTOR_APPLICATION", id: app.id, label, typeLabel, href: null });
          }
        })
    );
  }

  // One slow/failed type must not blank out the others.
  await Promise.allSettled(tasks);
  return result;
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

/**
 * Batch variant of {@link getMenteeSupport}: for a set of user ids, returns a
 * Map of userId → their active mentor support (most-recently-started wins), so
 * the Operations Hub can flag "instructors without a mentor" in ONE query
 * instead of N. Users with no active mentorship are simply absent from the Map.
 */
export async function getMenteeSupportMany(
  userIds: string[]
): Promise<Map<string, MenteeSupport>> {
  const result = new Map<string, MenteeSupport>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const mentorships = await prisma.mentorship.findMany({
    where: { menteeId: { in: ids }, status: "ACTIVE" },
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      type: true,
      status: true,
      menteeId: true,
      mentor: { select: { id: true, name: true, email: true } },
    },
  });

  // findMany returns newest-first; keep the first (most recent) per mentee.
  for (const m of mentorships) {
    if (result.has(m.menteeId)) continue;
    result.set(m.menteeId, {
      mentorshipId: m.id,
      mentor: m.mentor,
      type: m.type,
      status: m.status,
    });
  }
  return result;
}

/** A compact summary of one active mentorship, for hub gap lists. */
export type ActiveMentorshipSummary = {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
};

/**
 * All active mentorships as compact summaries, soonest-stale first is not
 * needed here — the hub joins these against linked tracker actions to find
 * "active mentorships with no execution plan". Capped for payload sanity.
 */
export async function listActiveMentorships(): Promise<ActiveMentorshipSummary[]> {
  const mentorships = await prisma.mentorship.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ startDate: "desc" }],
    take: 300,
    select: {
      id: true,
      mentor: { select: { id: true, name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true } },
    },
  });

  return mentorships.map((m) => ({
    id: m.id,
    mentorId: m.mentor.id,
    mentorName: m.mentor.name ?? m.mentor.email,
    menteeId: m.mentee.id,
    menteeName: m.mentee.name ?? m.mentee.email,
  }));
}
