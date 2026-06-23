import type { RegularInstructorAssignmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatDueDate } from "@/lib/leadership-action-center/dates";

import { firstNameOf } from "./feedback-email-content";

/**
 * People Strategy — suggested collaborators for a monthly feedback request,
 * WITH the reasons and shared work that justify each suggestion.
 *
 * This is the review layer the legacy `findRecentCollaborators` (which the
 * blind bulk-send uses) never had: every suggested recipient carries concrete
 * evidence — shared action items, an active mentorship, co-instruction, or
 * shared officer meetings — so Leadership can see exactly why someone is being
 * asked before anything is sent, and the recipient's email/form can show the
 * same context.
 *
 * The evidence → suggestion composition is pure (`composeSuggestedCollaborator`)
 * so the reason wording, ranking, and default-selection rules are unit-testable
 * without a database.
 */

export type FeedbackContextItem = {
  type: "action" | "class" | "mentorship" | "meeting";
  id: string;
  title: string;
  /** Short connective detail ("leads · due Jun 20", "co-instructor"). */
  detail: string | null;
};

export type SuggestedFeedbackCollaborator = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  title: string | null;
  /** Concrete, human-readable reasons this person is relevant. Never empty. */
  reasons: string[];
  /** The shared work backing the reasons (capped for display). */
  contextItems: FeedbackContextItem[];
  /**
   * Pre-checked in the review UI. True for direct working relationships
   * (shared actions, co-instruction, mentorship) when an email is on file;
   * meetings-only overlaps and people without an email start unchecked.
   */
  defaultSelected: boolean;
};

/** Raw evidence gathered per collaborator before composition. */
export type CollaboratorWorkEvidence = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    primaryRole: string | null;
    title: string | null;
  };
  /** Active/recent action items both people are on. */
  sharedActions: Array<{
    id: string;
    title: string;
    deadlineLabel: string | null;
    /** True when the SUBJECT leads this item. */
    subjectLeads: boolean;
  }>;
  /** Collaborator's role(s) relative to the subject on active mentorships. */
  mentorshipRoles: Array<"mentor" | "mentee" | "chair">;
  /** Classes where both are on the instructional team. */
  sharedClasses: Array<{ id: string; title: string }>;
  /** Officer meetings both attended inside the window. */
  sharedMeetings: Array<{ id: string; title: string }>;
};

const MENTORSHIP_ROLE_PHRASES: Record<"mentor" | "mentee" | "chair", (s: string) => string> = {
  mentor: (s) => `${s}'s mentor`,
  mentee: (s) => `${s}'s mentee`,
  chair: (s) => `Chairs ${s}'s mentorship`,
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Compose one suggestion from raw evidence. Pure. Returns null when there is
 * no evidence at all (such a person should never have been collected).
 */
export function composeSuggestedCollaborator(
  evidence: CollaboratorWorkEvidence,
  subjectName: string | null,
  windowDays: number
): SuggestedFeedbackCollaborator | null {
  const subjectFirst = firstNameOf(subjectName);
  const reasons: string[] = [];
  const contextItems: FeedbackContextItem[] = [];

  if (evidence.sharedActions.length > 0) {
    reasons.push(
      `Worked with ${subjectFirst} on ${plural(evidence.sharedActions.length, "action item")} in the last ${windowDays} days`
    );
    for (const action of evidence.sharedActions.slice(0, 3)) {
      const detailParts = [
        action.subjectLeads ? `${subjectFirst} leads` : null,
        action.deadlineLabel ? `due ${action.deadlineLabel}` : null,
      ].filter(Boolean);
      contextItems.push({
        type: "action",
        id: action.id,
        title: action.title,
        detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
      });
    }
  }

  for (const role of evidence.mentorshipRoles) {
    reasons.push(MENTORSHIP_ROLE_PHRASES[role](subjectFirst));
  }

  if (evidence.sharedClasses.length > 0) {
    reasons.push(
      `On the same instructional team for ${plural(evidence.sharedClasses.length, "class")}`
    );
    for (const cls of evidence.sharedClasses.slice(0, 2)) {
      contextItems.push({ type: "class", id: cls.id, title: cls.title, detail: "co-instruction" });
    }
  }

  if (evidence.sharedMeetings.length > 0) {
    reasons.push(
      `Attended ${plural(evidence.sharedMeetings.length, "meeting")} with ${subjectFirst} in the last ${windowDays} days`
    );
    for (const meeting of evidence.sharedMeetings.slice(0, 2)) {
      contextItems.push({
        type: "meeting",
        id: meeting.id,
        title: meeting.title,
        detail: "attended together",
      });
    }
  }

  if (reasons.length === 0) return null;

  const hasDirectWork =
    evidence.sharedActions.length > 0 ||
    evidence.sharedClasses.length > 0 ||
    evidence.mentorshipRoles.length > 0;

  return {
    id: evidence.user.id,
    name: evidence.user.name,
    email: evidence.user.email,
    role: evidence.user.primaryRole,
    title: evidence.user.title,
    reasons,
    contextItems: contextItems.slice(0, 5),
    defaultSelected: hasDirectWork && Boolean(evidence.user.email),
  };
}

/** Ranking weight: direct shared work outranks meeting-room overlap. */
export function evidenceScore(evidence: CollaboratorWorkEvidence): number {
  return (
    evidence.sharedActions.length * 2 +
    evidence.sharedClasses.length * 2 +
    evidence.mentorshipRoles.length * 3 +
    Math.min(evidence.sharedMeetings.length, 3)
  );
}

/** Active assignment states that count as a live class collaboration. */
const ACTIVE_ASSIGNMENT_STATUSES: RegularInstructorAssignmentStatus[] = [
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
  "OFFERED",
  "PENDING_REVIEW",
];

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  primaryRole: true,
  title: true,
  archivedAt: true,
} as const;

type RawUser = {
  id: string;
  name: string | null;
  email: string | null;
  primaryRole: string | null;
  title: string | null;
  archivedAt: Date | null;
};

export const FEEDBACK_SUGGESTION_WINDOW_DAYS = 120;

/** Keep the review list scannable — strongest collaborators only. */
export const FEEDBACK_SUGGESTION_CAP = 12;

/**
 * Suggest collaborators for `subjectUserId` with reasons and shared work.
 * Sources (all real records, mirroring the legacy collaborator finder plus
 * shared officer meetings):
 *   1. Action items the subject leads or is assigned to (updated in window).
 *   2. Active mentorship pairings (mentor / mentee / chair).
 *   3. Class offerings where both are on the instructional team.
 *   4. Officer meetings both attended inside the window.
 *
 * Archived users and the subject themself are excluded. Results are ranked by
 * evidence strength and capped at FEEDBACK_SUGGESTION_CAP.
 */
export async function suggestFeedbackCollaborators(
  subjectUserId: string,
  sinceDays = FEEDBACK_SUGGESTION_WINDOW_DAYS
): Promise<SuggestedFeedbackCollaborator[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: { id: true, name: true, email: true },
  });
  if (!subject) throw new Error("Subject user not found");

  const evidence = new Map<string, CollaboratorWorkEvidence>();
  const evidenceFor = (user: RawUser | null | undefined): CollaboratorWorkEvidence | null => {
    if (!user || user.id === subjectUserId || user.archivedAt) return null;
    let entry = evidence.get(user.id);
    if (!entry) {
      entry = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          primaryRole: user.primaryRole,
          title: user.title,
        },
        sharedActions: [],
        mentorshipRoles: [],
        sharedClasses: [],
        sharedMeetings: [],
      };
      evidence.set(user.id, entry);
    }
    return entry;
  };

  const [actionItems, mentorships, offerings] = await Promise.all([
    prisma.actionItem.findMany({
      where: {
        updatedAt: { gte: since },
        OR: [{ leadId: subjectUserId }, { assignments: { some: { userId: subjectUserId } } }],
      },
      select: {
        id: true,
        title: true,
        leadId: true,
        deadlineStart: true,
        deadlineEnd: true,
        lead: { select: USER_SELECT },
        assignments: { select: { user: { select: USER_SELECT } } },
      },
    }),
    prisma.mentorship.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { mentorId: subjectUserId },
          { menteeId: subjectUserId },
          { chairId: subjectUserId },
        ],
      },
      select: {
        mentor: { select: USER_SELECT },
        mentee: { select: USER_SELECT },
        chair: { select: USER_SELECT },
      },
    }),
    prisma.classOffering.findMany({
      where: {
        OR: [
          { instructorId: subjectUserId },
          {
            regularInstructorAssignments: {
              some: {
                instructorId: subjectUserId,
                status: { in: ACTIVE_ASSIGNMENT_STATUSES },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        instructor: { select: USER_SELECT },
        regularInstructorAssignments: {
          where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          select: { instructor: { select: USER_SELECT } },
        },
      },
    }),
  ]);

  // The old Meetings Tracker was removed — shared-meeting evidence is empty now.

  for (const item of actionItems) {
    const deadline = item.deadlineEnd ?? item.deadlineStart;
    const shared = {
      id: item.id,
      title: item.title,
      deadlineLabel: deadline ? formatDueDate(deadline) : null,
      subjectLeads: item.leadId === subjectUserId,
    };
    const seen = new Set<string>();
    const collect = (user: RawUser | null | undefined) => {
      if (!user || seen.has(user.id)) return;
      seen.add(user.id);
      evidenceFor(user)?.sharedActions.push(shared);
    };
    collect(item.lead);
    for (const a of item.assignments) collect(a.user);
  }

  for (const m of mentorships) {
    // The collaborator's role is what THEY are relative to the subject.
    if (m.mentor && m.mentor.id !== subjectUserId) {
      evidenceFor(m.mentor)?.mentorshipRoles.push("mentor");
    }
    if (m.mentee && m.mentee.id !== subjectUserId) {
      evidenceFor(m.mentee)?.mentorshipRoles.push("mentee");
    }
    if (m.chair && m.chair.id !== subjectUserId) {
      evidenceFor(m.chair)?.mentorshipRoles.push("chair");
    }
  }

  for (const offering of offerings) {
    const shared = { id: offering.id, title: offering.title };
    const seen = new Set<string>();
    const collect = (user: RawUser | null | undefined) => {
      if (!user || seen.has(user.id)) return;
      seen.add(user.id);
      evidenceFor(user)?.sharedClasses.push(shared);
    };
    collect(offering.instructor);
    for (const a of offering.regularInstructorAssignments) collect(a.instructor);
  }

  return Array.from(evidence.values())
    .sort((a, b) => evidenceScore(b) - evidenceScore(a))
    .map((e) => composeSuggestedCollaborator(e, subject.name, sinceDays))
    .filter((s): s is SuggestedFeedbackCollaborator => s !== null)
    .slice(0, FEEDBACK_SUGGESTION_CAP);
}
