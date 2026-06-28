// Chapter OS Phase 4 — a UNIFIED, real recent-activity read model for the six
// operating rooms. Every item is derived from an existing, timestamped source of
// truth (partner touchpoints, the two-stage curriculum audit trail, class
// timeline events, applicant timeline events, enrollments, feedback, KPI
// snapshots) — never fabricated. Pure + deterministic (mappers + merge/sort);
// the chapter loader maps DB rows through these and the UI renders the feed.

import type { RoomKey } from "@/lib/chapters/rooms";
import { relativeAgo, shortDate } from "@/lib/chapters/format";

export type RoomActivityItem = {
  id: string;
  roomKey: RoomKey;
  entityType?: string;
  entityId?: string;
  title: string;
  description?: string;
  occurredAt: Date;
  href: string;
  actorName?: string | null;
};

/** "GLOBAL_APPROVED" → "Global approved". Used to humanise raw kind/decision tokens. */
export function humanizeToken(token: string): string {
  const t = token.replace(/[_\s]+/g, " ").trim().toLowerCase();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function trimDescription(text: string | null | undefined, max = 140): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// --- Per-source mappers (pure) ---------------------------------------------

export type PartnerNoteSource = {
  id: string;
  kind: string;
  body: string | null;
  createdAt: Date;
  partnerId: string;
  partnerName: string | null;
};

export function partnerNoteActivity(n: PartnerNoteSource): RoomActivityItem {
  const who = n.partnerName ?? "a partner";
  const verb =
    n.kind === "FOLLOW_UP"
      ? `Follow-up logged with ${who}`
      : n.kind === "MEETING"
        ? `Meeting logged with ${who}`
        : n.kind === "NOTE"
          ? `Note added on ${who}`
          : `${humanizeToken(n.kind)} · ${who}`;
  return {
    id: `partner-note:${n.id}`,
    roomKey: "partner_network",
    entityType: "PARTNER",
    entityId: n.partnerId,
    title: verb,
    description: trimDescription(n.body),
    occurredAt: n.createdAt,
    href: `/partners/${n.partnerId}`,
  };
}

export type CurriculumReviewSource = {
  id: string;
  decision: string;
  actorName: string | null;
  createdAt: Date;
  classTemplateId: string;
  classTemplateTitle: string | null;
};

const CURRICULUM_DECISION_VERB: Record<string, (title: string) => string> = {
  SUBMITTED: (t) => `${t} submitted for CP review`,
  CP_APPROVED: (t) => `${t} marked CP approved`,
  CP_REVISION: (t) => `${t}: CP requested a revision`,
  SENT_TO_GLOBAL: (t) => `${t} sent to global review`,
  GLOBAL_APPROVED: (t) => `${t} fully approved`,
  GLOBAL_REVISION: (t) => `${t}: global revision requested`,
};

export function curriculumReviewActivity(e: CurriculumReviewSource): RoomActivityItem {
  const title = e.classTemplateTitle ?? "A curriculum";
  const make = CURRICULUM_DECISION_VERB[e.decision] ?? ((t: string) => `${t}: ${humanizeToken(e.decision)}`);
  return {
    id: `curriculum-review:${e.id}`,
    roomKey: "learning_program",
    entityType: "CLASS_TEMPLATE",
    entityId: e.classTemplateId,
    title: make(title),
    description: e.actorName ? `by ${e.actorName}` : undefined,
    occurredAt: e.createdAt,
    href: "/admin/curricula",
    actorName: e.actorName,
  };
}

export type ClassTimelineSource = {
  id: string;
  kind: string;
  summary: string | null;
  createdAt: Date;
  offeringId: string;
  offeringTitle: string | null;
};

export function classTimelineActivity(t: ClassTimelineSource): RoomActivityItem {
  const title = t.offeringTitle ?? "A class";
  const verb =
    t.kind === "PUBLISHED"
      ? `${title} published`
      : t.kind === "ENROLLMENT_OPENED"
        ? `${title}: enrollment opened`
        : t.kind === "COMPLETED"
          ? `${title} completed`
          : `${title}: ${humanizeToken(t.kind)}`;
  return {
    id: `class-timeline:${t.id}`,
    roomKey: "live_classes",
    entityType: "CLASS_OFFERING",
    entityId: t.offeringId,
    title: verb,
    description: trimDescription(t.summary),
    occurredAt: t.createdAt,
    href: `/admin/classes/${t.offeringId}`,
  };
}

export type ApplicantTimelineSource = {
  id: string;
  kind: string;
  createdAt: Date;
  applicationId: string;
  applicantName: string | null;
};

export function applicantTimelineActivity(t: ApplicantTimelineSource): RoomActivityItem {
  const who = t.applicantName ?? "an applicant";
  return {
    id: `applicant-timeline:${t.id}`,
    roomKey: "teaching_org",
    entityType: "INSTRUCTOR_APPLICATION",
    entityId: t.applicationId,
    title: `${humanizeToken(t.kind)} · ${who}`,
    occurredAt: t.createdAt,
    href: `/chapter/recruiting?tab=candidates`,
  };
}

export type EnrollmentSource = {
  id: string;
  enrolledAt: Date;
  studentName: string | null;
  className: string | null;
};

export function enrollmentActivity(e: EnrollmentSource): RoomActivityItem {
  const who = e.studentName ?? "A student";
  const where = e.className ? ` in ${e.className}` : "";
  return {
    id: `enrollment:${e.id}`,
    roomKey: "student_community",
    title: `${who} enrolled${where}`,
    occurredAt: e.enrolledAt,
    href: "/chapter/students",
  };
}

export type FeedbackSource = {
  id: string;
  rating: number | null;
  createdAt: Date;
  className: string | null;
};

export function classFeedbackActivity(f: FeedbackSource): RoomActivityItem {
  const stars = typeof f.rating === "number" ? `${f.rating}★ ` : "";
  const where = f.className ? ` on ${f.className}` : "";
  return {
    id: `feedback:${f.id}`,
    roomKey: "student_community",
    title: `${stars}feedback received${where}`.trim(),
    occurredAt: f.createdAt,
    href: "/chapter/students",
  };
}

export type SnapshotSource = { id: string; weekStart: Date; createdAt: Date };

export function snapshotActivity(s: SnapshotSource): RoomActivityItem {
  return {
    id: `snapshot:${s.id}`,
    roomKey: "chapter_growth",
    title: `Weekly KPI snapshot saved (week of ${shortDate(s.weekStart)})`,
    occurredAt: s.createdAt,
    href: "/chapter/operating",
  };
}

export type AttendanceActivitySource = {
  sessionId: string;
  className: string | null;
  count: number;
  occurredAt: Date;
  offeringId: string;
};

export function attendanceActivity(a: AttendanceActivitySource): RoomActivityItem {
  const where = a.className ? ` for ${a.className}` : "";
  return {
    id: `attendance:${a.sessionId}`,
    roomKey: "student_community",
    entityType: "CLASS_OFFERING",
    entityId: a.offeringId,
    title: `Attendance recorded${where}`,
    description: `${a.count} student${a.count === 1 ? "" : "s"} marked`,
    occurredAt: a.occurredAt,
    href: "/chapter/students",
  };
}

export type ReflectionActivitySource = {
  id: string;
  className: string | null;
  actorName: string | null;
  createdAt: Date;
  offeringId: string;
};

export function reflectionActivity(r: ReflectionActivitySource): RoomActivityItem {
  const where = r.className ? ` on ${r.className}` : "";
  return {
    id: `reflection:${r.id}`,
    roomKey: "live_classes",
    entityType: "CLASS_OFFERING",
    entityId: r.offeringId,
    title: `Session reflection submitted${where}`,
    description: r.actorName ? `by ${r.actorName}` : undefined,
    occurredAt: r.createdAt,
    href: `/admin/classes/${r.offeringId}`,
    actorName: r.actorName,
  };
}

// --- Merge / sort / group ---------------------------------------------------

export const ROOM_ACTIVITY_LIMIT = 12;

/** Merge every source's items into one feed, newest first, capped. */
export function buildRoomActivity(
  items: RoomActivityItem[],
  opts: { limit?: number } = {}
): RoomActivityItem[] {
  const limit = opts.limit ?? ROOM_ACTIVITY_LIMIT;
  return [...items].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
}

/** Group an already-sorted feed by room (preserving order within each room). */
export function groupActivityByRoom(items: RoomActivityItem[]): Partial<Record<RoomKey, RoomActivityItem[]>> {
  const out: Partial<Record<RoomKey, RoomActivityItem[]>> = {};
  for (const item of items) {
    (out[item.roomKey] ??= []).push(item);
  }
  return out;
}

/** Relative "time ago" label for an activity item (reuses the shared helper). */
export function activityRelativeTime(item: RoomActivityItem, now: Date): string {
  return relativeAgo(item.occurredAt, now);
}
