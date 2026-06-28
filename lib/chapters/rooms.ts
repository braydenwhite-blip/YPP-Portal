// The shared SIX-ROOM model for the Chapter Operating System. Every operating
// room — whether it is backed by the existing pipeline read models (Partner
// Network, Teaching Organization, Learning Program, Live Classes) or the new
// ones (Student Community, Chapter Growth) — is projected into ONE consistent
// `ChapterRoom` shape: title · mission · question · evidence-backed status ·
// Needs You · compact evidence · one recommended next action · deep links.
//
// Pure + deterministic so it is fully unit testable: it only re-shapes data the
// loaders already computed. No new state, no parallel task system — room "Needs
// You" items are the same blockers/needs that bridge to the Action Tracker.

import type { Entity360Type } from "@/lib/operations/entity-360";
import type { ChapterOperatingSystem, DeliberableStatTone } from "@/lib/chapters/operating-system";
import type { ChapterBlocker, ChapterLane } from "@/lib/chapters/needs-attention-rules";
import type { StudentCommunitySummary, StudentEvidenceStatus } from "@/lib/chapters/student-community";
import type { ChapterGrowthSummary, ChapterGrowthStatus, GrowthEvidenceStatus } from "@/lib/chapters/chapter-growth";

export type RoomTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export const ROOM_KEYS = [
  "partner_network",
  "teaching_org",
  "learning_program",
  "live_classes",
  "student_community",
  "chapter_growth",
] as const;
export type RoomKey = (typeof ROOM_KEYS)[number];

/** Visual identity token — UI maps this to a subtle per-room gradient/accent. */
export type RoomAccent = "violet" | "sky" | "amber" | "emerald" | "rose" | "indigo";

export type RoomStat = { label: string; value: number | string; tone: RoomTone };

export type RoomNeedsItem = {
  key: string;
  roomKey: RoomKey;
  roomTitle: string;
  title: string;
  detail?: string;
  severity: "critical" | "warning" | "info";
  href: string;
  entityType?: "PARTNER" | "INSTRUCTOR_APPLICATION" | "CLASS_OFFERING";
  entityId?: string;
};

export type RoomEvidenceRow = {
  id: string;
  /** One per column, excluding the trailing Status column. */
  cells: { text: string; muted?: boolean }[];
  status: { label: string; tone: RoomTone };
  href?: string;
  entity?: { type: Entity360Type; id: string };
};

export type RoomEvidence = {
  columns: string[];
  rows: RoomEvidenceRow[];
  totalRows: number;
  emptyMessage: string;
};

export type ChapterRoom = {
  key: RoomKey;
  title: string;
  mission: string;
  question: string;
  accent: RoomAccent;
  status: { label: string; tone: RoomTone; summary: string };
  stats: RoomStat[];
  needs: RoomNeedsItem[];
  evidence: RoomEvidence;
  nextAction: { text: string; cta: string; href: string };
  /** Deep link to the room's underlying records. */
  href: string;
};

const EVIDENCE_ROW_CAP = 6;
const SEV_RANK = { critical: 0, warning: 1, info: 2 } as const;

function statTone(t: DeliberableStatTone): RoomTone {
  return t === "positive" ? "success" : t === "warning" ? "warning" : t === "danger" ? "danger" : "neutral";
}

function laneBlockers(os: ChapterOperatingSystem, lane: ChapterLane): ChapterBlocker[] {
  return os.blockers.filter((b) => b.lane === lane);
}

function severityCounts(bs: { severity: "critical" | "warning" | "info" }[]) {
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const b of bs) {
    if (b.severity === "critical") critical += 1;
    else if (b.severity === "warning") warning += 1;
    else info += 1;
  }
  return { critical, warning, info };
}

function blockerNeed(b: ChapterBlocker, roomKey: RoomKey, roomTitle: string): RoomNeedsItem {
  return {
    key: b.key,
    roomKey,
    roomTitle,
    title: b.title,
    detail: b.detail,
    severity: b.severity,
    href: b.href,
    entityType: b.entityType,
    entityId: b.entityId,
  };
}

/** Evidence-backed status for a pipeline-backed room, from its blockers + size. */
function pipelineRoomStatus(
  bs: { severity: "critical" | "warning" | "info" }[],
  totalRecords: number,
  healthySummary: string
): ChapterRoom["status"] {
  const { critical, warning } = severityCounts(bs);
  if (critical > 0)
    return { label: "Critical", tone: "danger", summary: `${critical} critical · ${warning} more need you` };
  if (warning > 0) return { label: "Needs Attention", tone: "warning", summary: `${warning} items need you` };
  if (totalRecords === 0) return { label: "Not Started", tone: "neutral", summary: healthySummary };
  return { label: "On Track", tone: "success", summary: healthySummary };
}

function sortNeeds(needs: RoomNeedsItem[]): RoomNeedsItem[] {
  return [...needs].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}

// ---------------------------------------------------------------------------
// Room 1 — Partner Network
// ---------------------------------------------------------------------------

const PARTNER_TONE: Record<"stuck" | "at_risk" | "on_track", RoomTone> = {
  stuck: "danger",
  at_risk: "warning",
  on_track: "success",
};
const PARTNER_LABEL: Record<"stuck" | "at_risk" | "on_track", string> = {
  stuck: "Stuck",
  at_risk: "At Risk",
  on_track: "On Track",
};

function partnerNetworkRoom(os: ChapterOperatingSystem): ChapterRoom {
  const d = os.deliberables.partner;
  const bs = laneBlockers(os, "partners");
  const rows: RoomEvidenceRow[] = d.rows.map((r) => ({
    id: r.id,
    cells: [
      { text: r.name },
      { text: r.stage, muted: true },
      { text: r.lastContact, muted: true },
      { text: r.nextStep, muted: true },
    ],
    status: { label: PARTNER_LABEL[r.status], tone: PARTNER_TONE[r.status] },
    href: `/admin/partners/${r.id}`,
    entity: { type: "partner", id: r.id },
  }));
  return {
    key: "partner_network",
    title: "Partner Network",
    mission: "Build and maintain the relationships that make every class possible.",
    question: "How healthy is our partner network?",
    accent: "violet",
    status: pipelineRoomStatus(bs, os.partners.total, `${os.partners.total} partners · ${os.partners.confirmed} confirmed`),
    stats: d.stats.map((s) => ({ label: s.label, value: s.value, tone: statTone(s.tone) })),
    needs: sortNeeds(bs.map((b) => blockerNeed(b, "partner_network", "Partner Network"))),
    evidence: {
      columns: ["Partner", "Stage", "Last Contact", "Next Step", "Status"],
      rows: rows.slice(0, EVIDENCE_ROW_CAP),
      totalRows: d.totalRows,
      emptyMessage: "No partner prospects yet — add your first to start the pipeline.",
    },
    nextAction: { text: d.recommendation.text, cta: d.recommendation.cta, href: d.recommendation.href },
    href: "/partners",
  };
}

// ---------------------------------------------------------------------------
// Room 2 — Teaching Organization
// ---------------------------------------------------------------------------

const INSTRUCTOR_TONE: Record<"strong" | "on_track" | "at_risk", RoomTone> = {
  strong: "success",
  on_track: "info",
  at_risk: "warning",
};
const INSTRUCTOR_LABEL: Record<"strong" | "on_track" | "at_risk", string> = {
  strong: "Strong",
  on_track: "On Track",
  at_risk: "At Risk",
};

function teachingOrgRoom(os: ChapterOperatingSystem): ChapterRoom {
  const d = os.deliberables.instructor;
  const bs = laneBlockers(os, "instructors");
  const rows: RoomEvidenceRow[] = d.rows.map((r) => ({
    id: r.id,
    cells: [
      { text: r.name },
      { text: r.stage, muted: true },
      { text: r.applied, muted: true },
      { text: r.specialties, muted: true },
    ],
    status: { label: INSTRUCTOR_LABEL[r.status], tone: INSTRUCTOR_TONE[r.status] },
    href: `/admin/instructor-applicants/${r.id}`,
    entity: { type: "applicant", id: r.id },
  }));
  return {
    key: "teaching_org",
    title: "Teaching Organization",
    mission: "Recruit, evaluate, prepare, and support the instructors who make the chapter possible.",
    question: "Do we have the people to deliver great classes?",
    accent: "sky",
    status: pipelineRoomStatus(bs, os.instructors.total, `${os.instructors.applicants} applicants · ${os.instructors.hired} hired`),
    stats: d.stats.map((s) => ({ label: s.label, value: s.value, tone: statTone(s.tone) })),
    needs: sortNeeds(bs.map((b) => blockerNeed(b, "teaching_org", "Teaching Organization"))),
    evidence: {
      columns: ["Instructor", "Stage", "Applied", "Specialties", "Status"],
      rows: rows.slice(0, EVIDENCE_ROW_CAP),
      totalRows: d.totalRows,
      emptyMessage: "No instructor applications yet — open applications to build your bench.",
    },
    nextAction: { text: d.recommendation.text, cta: d.recommendation.cta, href: d.recommendation.href },
    href: "/chapter/recruiting?tab=candidates",
  };
}

// ---------------------------------------------------------------------------
// Room 3 — Learning Program
// ---------------------------------------------------------------------------

const CURRICULUM_TONE: Record<"ready" | "needs_feedback" | "not_started", RoomTone> = {
  ready: "success",
  needs_feedback: "warning",
  not_started: "neutral",
};
const CURRICULUM_LABEL: Record<"ready" | "needs_feedback" | "not_started", string> = {
  ready: "Ready",
  needs_feedback: "In Review",
  not_started: "Not Started",
};

function learningProgramRoom(os: ChapterOperatingSystem): ChapterRoom {
  const d = os.deliberables.curriculum;
  const bs = laneBlockers(os, "curriculum");
  const rows: RoomEvidenceRow[] = d.rows.map((r) => ({
    id: r.id,
    cells: [{ text: r.title }, { text: r.subject, muted: true }, { text: r.stage, muted: true }, { text: r.owner, muted: true }],
    status: { label: CURRICULUM_LABEL[r.status], tone: CURRICULUM_TONE[r.status] },
    href: "/admin/curricula",
  }));
  return {
    key: "learning_program",
    title: "Learning Program",
    mission: "Make sure every class has a serious, approved curriculum before students walk in.",
    question: "Are we ready to teach?",
    accent: "amber",
    status: pipelineRoomStatus(bs, os.curriculum.total, `${os.curriculum.approved} approved · ${os.curriculum.reviewNeeded} in review`),
    stats: d.stats.map((s) => ({ label: s.label, value: s.value, tone: statTone(s.tone) })),
    needs: sortNeeds(bs.map((b) => blockerNeed(b, "learning_program", "Learning Program"))),
    evidence: {
      columns: ["Curriculum", "Subject", "Stage", "Owner", "Status"],
      rows: rows.slice(0, EVIDENCE_ROW_CAP),
      totalRows: d.totalRows,
      emptyMessage: "No curricula yet — instructors submit theirs as classes take shape.",
    },
    nextAction: { text: d.recommendation.text, cta: d.recommendation.cta, href: d.recommendation.href },
    href: "/admin/curricula",
  };
}

// ---------------------------------------------------------------------------
// Room 4 — Live Classes
// ---------------------------------------------------------------------------

const CLASS_TONE: Record<"ready" | "needs_attention" | "not_ready", RoomTone> = {
  ready: "success",
  needs_attention: "warning",
  not_ready: "danger",
};
const CLASS_LABEL: Record<"ready" | "needs_attention" | "not_ready", string> = {
  ready: "Ready",
  needs_attention: "Needs Attention",
  not_ready: "Not Ready",
};

function liveClassesRoom(os: ChapterOperatingSystem): ChapterRoom {
  const d = os.deliberables.class;
  const bs = laneBlockers(os, "classes");
  const rows: RoomEvidenceRow[] = d.rows.map((r) => ({
    id: r.id,
    cells: [
      { text: r.title },
      { text: r.launchDate, muted: true },
      { text: `${r.enrolled}/${r.capacity}`, muted: true },
      { text: `${r.readinessPct}%`, muted: true },
    ],
    status: { label: CLASS_LABEL[r.status], tone: CLASS_TONE[r.status] },
    href: `/admin/classes/${r.id}`,
    entity: { type: "class", id: r.id },
  }));
  return {
    key: "live_classes",
    title: "Live Classes",
    mission: "Make sure every class can launch, run, and recover from problems quickly.",
    question: "Which classes are healthy and which need intervention?",
    accent: "emerald",
    status: pipelineRoomStatus(bs, os.launch.total, `${os.launch.ready}/${os.launch.total} ready to launch`),
    stats: d.stats.map((s) => ({ label: s.label, value: s.value, tone: statTone(s.tone) })),
    needs: sortNeeds(bs.map((b) => blockerNeed(b, "live_classes", "Live Classes"))),
    evidence: {
      columns: ["Class", "Launch Date", "Enrollment", "Readiness", "Status"],
      rows: rows.slice(0, EVIDENCE_ROW_CAP),
      totalRows: d.totalRows,
      emptyMessage: "No classes planned yet — build one to start its launch checklist.",
    },
    nextAction: { text: d.recommendation.text, cta: d.recommendation.cta, href: d.recommendation.href },
    href: "/admin/classes",
  };
}

// ---------------------------------------------------------------------------
// Room 5 — Student Community
// ---------------------------------------------------------------------------

const STUDENT_TONE: Record<StudentCommunitySummary["status"], RoomTone> = {
  Strong: "success",
  "Needs Feedback": "info",
  "Attendance Risk": "warning",
  "Retention Risk": "warning",
  "No Data Yet": "neutral",
  Critical: "danger",
};
const STUDENT_ROW_TONE: Record<StudentEvidenceStatus, RoomTone> = {
  strong: "success",
  attendance_risk: "warning",
  retention_risk: "warning",
  needs_feedback: "info",
  no_data: "neutral",
};
const STUDENT_ROW_LABEL: Record<StudentEvidenceStatus, string> = {
  strong: "Strong",
  attendance_risk: "Attendance Risk",
  retention_risk: "Retention Risk",
  needs_feedback: "Needs Feedback",
  no_data: "No Data",
};

function pctTone(pct: number, hasData: boolean): RoomTone {
  if (!hasData) return "neutral";
  if (pct >= 85) return "success";
  if (pct >= 75) return "info";
  if (pct >= 50) return "warning";
  return "danger";
}

function studentCommunityRoom(sc: StudentCommunitySummary): ChapterRoom {
  const m = sc.metrics;
  const rows: RoomEvidenceRow[] = sc.evidence.map((r) => ({
    id: r.id,
    cells: [
      { text: r.className },
      { text: String(r.enrollment), muted: true },
      { text: r.attendance, muted: true },
      { text: r.feedback, muted: true },
      { text: r.retention, muted: true },
    ],
    status: { label: STUDENT_ROW_LABEL[r.status], tone: STUDENT_ROW_TONE[r.status] },
    href: r.href,
    entity: { type: "class", id: r.id },
  }));
  return {
    key: "student_community",
    title: "Student Community",
    mission: "Understand whether students and families are enrolling, attending, staying, and giving positive feedback.",
    question: "Are students having a great experience?",
    accent: "rose",
    status: {
      label: sc.status,
      tone: STUDENT_TONE[sc.status],
      summary:
        sc.status === "No Data Yet"
          ? "No attendance or feedback has been collected yet."
          : `${m.enrolledCount} enrolled · ${m.hasAttendanceData ? `${m.attendancePercent}% attendance` : "attendance not started"}`,
    },
    stats: [
      { label: "Enrolled", value: m.enrolledCount, tone: "neutral" },
      { label: "Attendance", value: m.hasAttendanceData ? `${m.attendancePercent}%` : "—", tone: pctTone(m.attendancePercent, m.hasAttendanceData) },
      { label: "Retention", value: m.retentionBase > 0 ? `${m.retentionPercent}%` : "—", tone: pctTone(m.retentionPercent, m.retentionBase > 0) },
      { label: "Feedback", value: m.feedbackCount, tone: m.feedbackCount > 0 ? "success" : "warning" },
    ],
    needs: sortNeeds(
      sc.needsAttention.map((n) => ({
        key: n.key,
        roomKey: "student_community" as const,
        roomTitle: "Student Community",
        title: n.title,
        detail: n.detail,
        severity: n.severity,
        href: n.href,
        entityType: n.entityType,
        entityId: n.entityId,
      }))
    ),
    evidence: {
      columns: ["Class", "Enrollment", "Attendance", "Feedback", "Retention", "Status"],
      rows: rows.slice(0, EVIDENCE_ROW_CAP),
      totalRows: sc.evidence.length,
      emptyMessage: "No attendance or feedback has been collected yet.",
    },
    nextAction: { text: sc.nextAction, cta: "Open student records", href: "/chapter/students" },
    href: "/chapter/students",
  };
}

// ---------------------------------------------------------------------------
// Room 6 — Chapter Growth
// ---------------------------------------------------------------------------

const GROWTH_TONE: Record<ChapterGrowthStatus, RoomTone> = {
  Strong: "success",
  Improving: "success",
  Flat: "neutral",
  Slipping: "warning",
  Critical: "danger",
  "No Baseline Yet": "neutral",
};
const GROWTH_ROW_TONE: Record<GrowthEvidenceStatus, RoomTone> = {
  met: "success",
  close: "warning",
  behind: "danger",
};
const GROWTH_ROW_LABEL: Record<GrowthEvidenceStatus, string> = {
  met: "Met",
  close: "Close",
  behind: "Behind",
};

function chapterGrowthRoom(g: ChapterGrowthSummary): ChapterRoom {
  const targetsMet = g.evidence.filter((e) => e.status === "met").length;
  const rows: RoomEvidenceRow[] = g.evidence.map((r) => ({
    id: r.id,
    cells: [
      { text: r.goal },
      { text: String(r.current) },
      { text: String(r.target), muted: true },
      { text: r.trendLabel, muted: true },
    ],
    status: { label: GROWTH_ROW_LABEL[r.status], tone: GROWTH_ROW_TONE[r.status] },
  }));
  return {
    key: "chapter_growth",
    title: "Chapter Growth",
    mission: "Track whether the chapter is improving week over week across partners, instructors, students, classes, and quality.",
    question: "Is the chapter becoming stronger?",
    accent: "indigo",
    status: {
      label: g.status,
      tone: GROWTH_TONE[g.status],
      summary:
        g.status === "No Baseline Yet"
          ? "First week of tracking — trends appear next week."
          : `${g.signals.growth.length} improving · ${g.signals.regression.length} slipping`,
    },
    stats: [
      { label: "Week", value: g.weekNumber, tone: "neutral" },
      { label: "On Target", value: `${targetsMet}/${g.targets.length}`, tone: targetsMet === g.targets.length ? "success" : "warning" },
      { label: "Improving", value: g.signals.growth.length, tone: g.signals.growth.length > 0 ? "success" : "neutral" },
      { label: "Slipping", value: g.signals.regression.length, tone: g.signals.regression.length > 0 ? "warning" : "neutral" },
    ],
    needs: sortNeeds(
      g.needsAttention.map((n) => ({
        key: n.key,
        roomKey: "chapter_growth" as const,
        roomTitle: "Chapter Growth",
        title: n.title,
        detail: n.detail,
        severity: n.severity,
        href: n.href,
      }))
    ),
    evidence: {
      columns: ["Goal", "Current", "Target", "Trend", "Status"],
      rows: rows.slice(0, EVIDENCE_ROW_CAP),
      totalRows: g.evidence.length,
      emptyMessage: "No playbook targets are active for this week yet.",
    },
    nextAction: { text: g.nextAction, cta: "Prep impact meeting", href: "/my-weekly-impact" },
    href: "/meetings",
  };
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

/** Build all six operating rooms, in canonical order, from the loaded models. */
export function buildChapterRooms(
  os: ChapterOperatingSystem,
  studentCommunity: StudentCommunitySummary,
  growth: ChapterGrowthSummary
): ChapterRoom[] {
  return [
    partnerNetworkRoom(os),
    teachingOrgRoom(os),
    learningProgramRoom(os),
    liveClassesRoom(os),
    studentCommunityRoom(studentCommunity),
    chapterGrowthRoom(growth),
  ];
}

/** Flatten every room's Needs You items into one shared, severity-sorted feed. */
export function collectNeedsYou(rooms: ChapterRoom[]): RoomNeedsItem[] {
  return rooms.flatMap((r) => r.needs).sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}
