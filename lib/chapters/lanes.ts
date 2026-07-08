// ============================================================================
// The FIVE-LANE ChapterOS presentation contract — Partners · Students ·
// Instructors · Actions · Meetings, the five things a Chapter President
// actually organizes. Pure adapters over the already-loaded `ChapterOSModel`
// (no new DB reads for Partners/Students/Instructors — Actions and Meetings
// have their own loaders in actions-lane.ts / meetings-lane.ts).
//
// Every `LaneRecord` carries owner + concrete status + next step + related
// records — never a generic health grade ("At Risk"/"On Track"). Status
// labels are always the underlying evidence itself (a stage, a count, an
// overdue duration), so a Chapter President never has to trust a color they
// can't verify.
//
// This is a presentation layer, not a new data model: it re-shapes the same
// evidence the six rooms (lib/chapters/rooms.ts) already compute. Learning
// Program folds into Instructors (curriculum is instructor-authored, under a
// CP/global review chain); Live Classes folds into both Instructors and
// Students as an explicit, labeled "Live Classes" section (a class's launch
// readiness genuinely depends on both), not a silent merge. Chapter Growth
// stays outside the 5 lanes entirely — it's rendered as the separate "This
// week" pulse strip (chapter-growth-strip.tsx), not a lane.

import type { RoomTone, RoomNeedsItem } from "@/lib/chapters/rooms";
import type { ChapterOSModel } from "@/lib/chapters/chapter-os";

export type LaneKey = "partners" | "students" | "instructors" | "actions" | "meetings";

export const LANE_KEYS: readonly LaneKey[] = ["partners", "students", "instructors", "actions", "meetings"];

export const LANE_TITLES: Record<LaneKey, string> = {
  partners: "Partners",
  students: "Students",
  instructors: "Instructors",
  actions: "Actions",
  meetings: "Meetings",
};

/** Concrete evidence, never a health grade — `label` IS the evidence. */
export type LaneStatus = { label: string; tone: RoomTone };

export type RelatedRefKind = "partner" | "student" | "instructor" | "meeting" | "class" | "action" | "curriculum";

export type RelatedRef = { kind: RelatedRefKind; id: string; label: string; href: string };

export type LaneRecord = {
  id: string;
  name: string;
  subtitle?: string | null;
  owner: { name: string } | null;
  status: LaneStatus;
  nextStep: string;
  related: RelatedRef[];
  href: string;
  /** Instructors-lane Curriculum section only: which one-click review action
   *  (if any) applies at this record's current stage. Null when the next move
   *  is the instructor's (revision) or there's nothing left to review. */
  curriculumOneClickStep?: "cp_approve" | "send_to_global" | "global_approve" | null;
  /** Instructors-lane Curriculum section only: global leadership may send this back for revision. */
  curriculumCanRequestRevision?: boolean;
};

export type LaneSection = { title: string; question?: string; records: LaneRecord[]; emptyMessage: string };

export type ChapterLaneView = {
  key: LaneKey;
  title: string;
  question: string;
  /** One concrete count line, e.g. "12 partners · 3 need follow-up". */
  headline: string;
  records: LaneRecord[];
  /** Extra labeled groupings within the lane (e.g. Instructors' Curriculum and
   *  Live Classes sections). Rendered below the primary `records`. */
  sections: LaneSection[];
  needs: RoomNeedsItem[];
  totalRecords: number;
  emptyMessage: string;
};

/** Deep link into the Actions lane, pre-filtered to one entity's related actions. */
export function relatedActionsHref(entityType: "PARTNER" | "INSTRUCTOR_APPLICATION" | "USER" | "CLASS_OFFERING", entityId: string): string {
  return `/chapter?lane=actions&relatedType=${entityType}&relatedId=${encodeURIComponent(entityId)}`;
}

/** Deep link into the Meetings lane, pre-filtered to one partner's meetings (the only entity Meeting links to directly). */
export function relatedMeetingsHref(partnerId: string): string {
  return `/chapter?lane=meetings&partnerId=${encodeURIComponent(partnerId)}`;
}

// ---------------------------------------------------------------------------
// Partners lane
// ---------------------------------------------------------------------------

const PARTNER_TONE: Record<"stuck" | "at_risk" | "on_track", RoomTone> = {
  stuck: "danger",
  at_risk: "warning",
  on_track: "success",
};

export function partnerLaneFromModel(model: ChapterOSModel): ChapterLaneView {
  const d = model.deliberables.partner;
  const bs = model.blockers.filter((b) => b.lane === "partners");
  const records: LaneRecord[] = d.rows.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle ? `${r.subtitle} · ${r.stage}` : r.stage,
    owner: r.ownerName ? { name: r.ownerName } : null,
    status: { label: r.nextStep, tone: PARTNER_TONE[r.status] },
    nextStep: r.nextStep,
    related: [
      { kind: "action", id: r.id, label: "Related actions", href: relatedActionsHref("PARTNER", r.id) },
      { kind: "meeting", id: r.id, label: "Related meetings", href: relatedMeetingsHref(r.id) },
    ],
    href: `/admin/partners/${r.id}`,
  }));
  return {
    key: "partners",
    title: "Partners",
    question: "Which schools, camps, and orgs belong to this chapter, and what do they need next?",
    headline: `${model.partners.total} partners · ${model.partners.followUpNeeded} need follow-up`,
    records,
    sections: [],
    needs: bs.map((b) => ({
      key: b.key,
      roomKey: "partner_network",
      roomTitle: "Partners",
      title: b.title,
      detail: b.detail,
      severity: b.severity,
      href: b.href,
      entityType: b.entityType,
      entityId: b.entityId,
    })),
    totalRecords: d.totalRows,
    emptyMessage: "No partner prospects yet — add your first to start the pipeline.",
  };
}

// ---------------------------------------------------------------------------
// Instructors lane (+ folded-in Curriculum + Live Classes sections)
// ---------------------------------------------------------------------------

const INSTRUCTOR_TONE: Record<"strong" | "on_track" | "at_risk", RoomTone> = {
  strong: "success",
  on_track: "info",
  at_risk: "warning",
};
const INSTRUCTOR_NEXT_STEP: Record<string, string> = {
  Applied: "Assign a reviewer",
  "Under Review": "Review the application",
  "Interview Ready": "Schedule an interview",
  "Interview Scheduled": "Hold the interview",
  "Interview Complete": "Record a hire/reject decision",
  Hired: "Assign to a class",
};

const CURRICULUM_TONE: Record<"ready" | "needs_feedback" | "not_started", RoomTone> = {
  ready: "success",
  needs_feedback: "warning",
  not_started: "neutral",
};

const CLASS_TONE: Record<"ready" | "needs_attention" | "not_ready", RoomTone> = {
  ready: "success",
  needs_attention: "warning",
  not_ready: "danger",
};
const CLASS_NEXT_STEP: Record<"ready" | "needs_attention" | "not_ready", string> = {
  ready: "Monitor and launch on schedule",
  needs_attention: "Close remaining launch-checklist gaps",
  not_ready: "Not launch-ready — resolve blockers now",
};

function liveClassesSection(model: ChapterOSModel): LaneSection {
  const d = model.deliberables.class;
  const records: LaneRecord[] = d.rows.map((r) => ({
    id: r.id,
    name: r.title,
    subtitle: r.subtitle ? `${r.subtitle} · ${r.launchDate}` : r.launchDate,
    owner: null,
    status: {
      label: `${r.enrolled}/${r.capacity} enrolled · ${r.readinessPct}% ready`,
      tone: CLASS_TONE[r.status],
    },
    nextStep: CLASS_NEXT_STEP[r.status],
    related: [{ kind: "action", id: r.id, label: "Related actions", href: relatedActionsHref("CLASS_OFFERING", r.id) }],
    href: `/admin/classes/${r.id}`,
  }));
  return {
    title: "Live Classes",
    question: "Which classes are ready to launch, and which need attention?",
    records,
    emptyMessage: "No classes planned yet — build one to start its launch checklist.",
  };
}

export function instructorLaneFromModel(model: ChapterOSModel): ChapterLaneView {
  const d = model.deliberables.instructor;
  const bs = model.blockers.filter((b) => b.lane === "instructors");
  const records: LaneRecord[] = d.rows.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.specialties !== "—" ? r.specialties : null,
    owner: null,
    status: { label: `${r.stage} · applied ${r.applied}`, tone: INSTRUCTOR_TONE[r.status] },
    nextStep: INSTRUCTOR_NEXT_STEP[r.stage] ?? "Move the application forward",
    related: [{ kind: "action", id: r.id, label: "Related actions", href: relatedActionsHref("INSTRUCTOR_APPLICATION", r.id) }],
    href: `/admin/instructor-applicants/${r.id}`,
  }));

  const cd = model.deliberables.curriculum;
  const curriculumBlockers = model.blockers.filter((b) => b.lane === "curriculum");
  const ONE_CLICK_STEP: Partial<Record<string, "cp_approve" | "send_to_global" | "global_approve">> = {
    cp_review: "cp_approve",
    cp_approved: "send_to_global",
    global_review: "global_approve",
  };
  const curriculumSection: LaneSection = {
    title: "Curriculum",
    question: "Is every class's curriculum reviewed and fully approved?",
    records: cd.rows.map((r) => ({
      id: r.id,
      name: r.title,
      subtitle: r.subject !== "—" ? r.subject : null,
      owner: r.owner !== "Unassigned" ? { name: r.owner } : null,
      status: { label: `${r.stage} · next: ${r.actor}`, tone: CURRICULUM_TONE[r.status] },
      nextStep: `Next: ${r.actor}`,
      related: [],
      href: "/admin/curricula",
      curriculumOneClickStep: ONE_CLICK_STEP[r.playbookStatus] ?? null,
      curriculumCanRequestRevision: r.playbookStatus === "global_review",
    })),
    emptyMessage: "No curricula yet — instructors submit theirs as classes take shape.",
  };

  return {
    key: "instructors",
    title: "Instructors",
    question: "Who's teaching, helping, applying, or waiting on onboarding — and who needs follow-up?",
    headline: `${model.instructors.applicants} applicants · ${model.instructors.hired} hired`,
    records,
    sections: [curriculumSection, liveClassesSection(model)],
    needs: [...bs, ...curriculumBlockers].map((b) => ({
      key: b.key,
      roomKey: "teaching_org",
      roomTitle: "Instructors",
      title: b.title,
      detail: b.detail,
      severity: b.severity,
      href: b.href,
      entityType: b.entityType,
      entityId: b.entityId,
    })),
    totalRecords: d.totalRows,
    emptyMessage: "No instructor applications yet — open applications to build your bench.",
  };
}

// ---------------------------------------------------------------------------
// Students lane (+ folded-in Live Classes section)
// ---------------------------------------------------------------------------

const STUDENT_ROW_TONE: Record<string, RoomTone> = {
  strong: "success",
  attendance_risk: "warning",
  retention_risk: "warning",
  needs_feedback: "info",
  no_data: "neutral",
};
const STUDENT_NEXT_STEP: Record<string, string> = {
  strong: "Keep it up — no action needed",
  attendance_risk: "Check in with families about attendance",
  retention_risk: "Reach out before more students drop",
  needs_feedback: "Send a short feedback form",
  no_data: "Start tracking attendance",
};

export function studentLaneFromModel(model: ChapterOSModel): ChapterLaneView {
  const sc = model.studentCommunity;
  const records: LaneRecord[] = sc.evidence.map((r) => ({
    id: r.id,
    name: r.className,
    subtitle: `${r.enrollment} enrolled`,
    owner: null,
    status: { label: `${r.attendance} attendance · ${r.retention} retention`, tone: STUDENT_ROW_TONE[r.status] ?? "neutral" },
    nextStep: STUDENT_NEXT_STEP[r.status] ?? "Review this class's student community",
    related: [{ kind: "action", id: r.id, label: "Related actions", href: relatedActionsHref("CLASS_OFFERING", r.id) }],
    href: r.href,
  }));

  const needs: RoomNeedsItem[] = sc.needsAttention.map((n) => ({
    key: n.key,
    roomKey: "student_community",
    roomTitle: "Students",
    title: n.title,
    detail: n.detail,
    severity: n.severity,
    href: n.href,
    entityType: n.entityType,
    entityId: n.entityId,
  }));

  return {
    key: "students",
    title: "Students",
    question: "Which students are attached to this chapter, and what do they need next?",
    headline: `${sc.metrics.enrolledCount} enrolled · ${sc.metrics.hasAttendanceData ? `${sc.metrics.attendancePercent}% attendance` : "no attendance data yet"}`,
    records,
    sections: [liveClassesSection(model)],
    needs,
    totalRecords: sc.evidence.length,
    emptyMessage: "No attendance or feedback has been collected yet.",
  };
}
