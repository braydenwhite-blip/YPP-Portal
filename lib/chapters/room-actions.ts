// Chapter OS Phase 3 — ROOM ACTIONS. Turns each operating room's evidence/needs
// into a small set of high-value, contextual actions a Chapter President can run
// from the room itself. Pure + deterministic so it is fully unit testable: it
// only re-shapes the already-computed `ChapterRoom` data into serializable action
// descriptors. The UI maps each descriptor to either a real server action
// (`mutation.handler`), the Track-as-Action bridge (`track`), or a deep link
// (`href`) into the exact existing workflow — never a parallel task system.

import { z } from "zod";

import type { ChapterRoom, RoomKey, RoomNeedsItem } from "@/lib/chapters/rooms";

// --- Input schemas for the direct mutations (shared with the server file so
//     validation lives in one pure, testable place) -------------------------

export const SaveSnapshotSchema = z.object({
  chapterId: z.string().min(1),
});
export type SaveSnapshotInput = z.infer<typeof SaveSnapshotSchema>;

export const LogPartnerFollowUpSchema = z.object({
  chapterId: z.string().min(1),
  partnerId: z.string().min(1),
  note: z.string().min(1).max(2000),
  /** ISO datetime; optional next follow-up date. */
  nextFollowUpAt: z.string().datetime().optional(),
});
export type LogPartnerFollowUpInput = z.infer<typeof LogPartnerFollowUpSchema>;

// --- Action descriptor ------------------------------------------------------

/** How an action runs: a direct mutation, the Action Tracker bridge, or a link. */
export type RoomActionKind = "mutate" | "track" | "link";
/** The direct mutations the client knows how to dispatch to a server action. */
export type RoomMutationHandler = "saveKpiSnapshot" | "logPartnerFollowUp";

export type ChapterRoomAction = {
  roomActionId: string;
  roomKey: RoomKey;
  label: string;
  description: string;
  kind: RoomActionKind;
  severity: "critical" | "warning" | "info" | "neutral";
  /** The single most important action in the room renders prominently. */
  primary: boolean;
  /** Deep-link / fallback target. Always present so there is a way through. */
  href: string;
  /** Set when kind === "mutate". */
  mutation?: {
    handler: RoomMutationHandler;
    entityType?: "PARTNER" | "INSTRUCTOR_APPLICATION" | "CLASS_OFFERING";
    entityId?: string;
  };
  /** Set when kind === "track" (feeds trackChapterBlocker, deduped server-side). */
  track?: {
    blockerKey: string;
    title: string;
    detail?: string;
    severity: "critical" | "warning" | "info";
    entityType?: "PARTNER" | "INSTRUCTOR_APPLICATION" | "CLASS_OFFERING";
    entityId?: string;
  };
  /** When set, the action is shown disabled with this explanation (href still works). */
  disabledReason?: string;
};

export type ChapterRoomWithActions = ChapterRoom & { actions: ChapterRoomAction[] };

// --- Helpers ---------------------------------------------------------------

const SEV_RANK = { critical: 0, warning: 1, info: 2 } as const;

function prefixOf(key: string): string {
  const i = key.indexOf(":");
  return i === -1 ? key : key.slice(0, i);
}

function topNeed(room: ChapterRoom): RoomNeedsItem | null {
  return room.needs.length ? room.needs[0] : null;
}

function needByPrefix(room: ChapterRoom, ...prefixes: string[]): RoomNeedsItem | null {
  return room.needs.find((n) => prefixes.includes(prefixOf(n.key))) ?? null;
}

function trackAction(room: ChapterRoom, need: RoomNeedsItem): ChapterRoomAction {
  return {
    roomActionId: `${room.key}:track`,
    roomKey: room.key,
    label: "Track",
    description: `Add “${need.title}” to your Action Tracker.`,
    kind: "track",
    severity: need.severity,
    primary: false,
    href: need.href,
    track: {
      blockerKey: need.key,
      title: need.title,
      detail: need.detail,
      severity: need.severity,
      entityType: need.entityType,
      entityId: need.entityId,
    },
  };
}

function linkAction(
  room: ChapterRoom,
  id: string,
  label: string,
  description: string,
  href: string,
  opts: { primary?: boolean; severity?: ChapterRoomAction["severity"]; disabledReason?: string } = {}
): ChapterRoomAction {
  return {
    roomActionId: `${room.key}:${id}`,
    roomKey: room.key,
    label,
    description,
    kind: "link",
    severity: opts.severity ?? "neutral",
    primary: opts.primary ?? false,
    href,
    disabledReason: opts.disabledReason,
  };
}

// --- Per-room action builders ----------------------------------------------

function partnerActions(room: ChapterRoom): ChapterRoomAction[] {
  const actions: ChapterRoomAction[] = [];
  const followNeed = needByPrefix(room, "partner-followup", "partner-no-response");
  const partnerNeed = followNeed ?? room.needs.find((n) => n.entityType === "PARTNER") ?? null;

  if (partnerNeed?.entityId) {
    // Direct mutation: log a touchpoint (and optionally set next follow-up).
    actions.push({
      roomActionId: `${room.key}:log-follow-up`,
      roomKey: room.key,
      label: "Log follow-up",
      description: "Record a touchpoint and set the next follow-up date.",
      kind: "mutate",
      severity: partnerNeed.severity,
      primary: true,
      href: partnerNeed.href,
      mutation: { handler: "logPartnerFollowUp", entityType: "PARTNER", entityId: partnerNeed.entityId },
    });
  } else {
    actions.push(
      linkAction(room, "open", "Open partner pipeline", "Review and advance your partner relationships.", room.href, {
        primary: true,
      })
    );
  }

  const logistics = needByPrefix(room, "partner-logistics");
  if (logistics) {
    actions.push(
      linkAction(room, "logistics", "Confirm logistics", "Lock room, times, launch date, supervisor, and written confirmation.", logistics.href, {
        severity: logistics.severity,
      })
    );
  }
  const meeting = needByPrefix(room, "partner-no-meeting");
  if (meeting) {
    actions.push(linkAction(room, "meeting", "Schedule meeting", "Get an interested partner into a meeting.", meeting.href, { severity: meeting.severity }));
  }

  // Always offer the pipeline view if not already the primary.
  if (!actions.some((a) => a.href === room.href)) {
    actions.push(linkAction(room, "open", "Open partner pipeline", "See every partner and stage.", room.href));
  }

  const t = topNeed(room);
  if (t) actions.push(trackAction(room, t));
  return dedupeAndCap(actions);
}

function teachingActions(room: ChapterRoom): ChapterRoomAction[] {
  const actions: ChapterRoomAction[] = [];
  const review = needByPrefix(room, "applicant-review");
  const interview = needByPrefix(room, "applicant-interview");
  const decision = needByPrefix(room, "applicant-decision");
  const materials = needByPrefix(room, "applicant-materials");

  // Decisions are the most time-critical (12h SLA) — surface first if present.
  if (decision) {
    actions.push(linkAction(room, "decide", "Submit decision", "Record the hire/deny decision past the 12-hour window.", decision.href, { primary: true, severity: decision.severity }));
  }
  if (review) {
    actions.push(linkAction(room, "review", "Review applicant", "Open the application and complete the review.", review.href, { primary: !decision, severity: review.severity }));
  }
  if (interview) {
    actions.push(linkAction(room, "interview", "Schedule interview", "Assign a co-interviewer and put the interview on the calendar.", interview.href, { severity: interview.severity }));
  }
  if (materials && actions.length < 3) {
    actions.push(linkAction(room, "materials", "Request materials", "Collect the course description and sample lesson plan.", materials.href, { severity: materials.severity }));
  }
  if (!actions.some((a) => a.primary)) {
    actions.push(linkAction(room, "open", "Open recruiting", "Review your instructor pipeline.", room.href, { primary: true }));
  }
  const t = topNeed(room);
  if (t) actions.push(trackAction(room, t));
  return dedupeAndCap(actions);
}

function learningActions(room: ChapterRoom): ChapterRoomAction[] {
  const actions: ChapterRoomAction[] = [];
  const review = needByPrefix(room, "curriculum-review");
  actions.push(
    linkAction(room, "review", "Open curriculum review", "Read the submission and leave written feedback in the rubric.", review?.href ?? room.href, {
      primary: true,
      severity: review?.severity ?? "neutral",
    })
  );
  if (review) {
    actions.push(linkAction(room, "revision", "Request revision", "Send specific pacing/activity feedback back to the instructor.", review.href, { severity: review.severity }));
  }
  // Global review is not a separate schema stage yet — represent it honestly.
  actions.push(
    linkAction(room, "global", "Send to global review", "Escalate a CP-approved curriculum to national review.", "/admin/curricula", {
      disabledReason: "Global review isn’t a separate approval stage yet (Phase 4).",
    })
  );
  const t = topNeed(room);
  if (t) actions.push(trackAction(room, t));
  return dedupeAndCap(actions);
}

const CLASS_VERB: Record<string, { id: string; label: string; description: string }> = {
  "class-no-instructor": { id: "instructor", label: "Assign instructor", description: "Assign or confirm the class instructor." },
  "class-no-partner": { id: "partner", label: "Link partner & location", description: "Attach a confirmed partner and room/location." },
  "class-no-curriculum": { id: "curriculum", label: "Attach curriculum", description: "Link the approved curriculum to this class." },
  "class-not-public": { id: "publish", label: "Publish class", description: "Publish so students can enroll (meets readiness gate)." },
  "class-under-enrolled": { id: "enroll", label: "Boost enrollment", description: "Open the roster and intensify advertising." },
  "class-no-reminder": { id: "reminder", label: "Send pre-launch reminder", description: "Send the instructor the 48-hour pre-launch reminder." },
  "class-instructor-not-ready": { id: "readiness", label: "Run readiness check", description: "Log the instructor readiness check." },
};

function liveClassesActions(room: ChapterRoom): ChapterRoomAction[] {
  const actions: ChapterRoomAction[] = [];
  // Surface up to two concrete launch-gap fixes (deep links into class detail).
  let primaryUsed = false;
  for (const need of room.needs) {
    const verb = CLASS_VERB[prefixOf(need.key)];
    if (!verb) continue;
    if (actions.some((a) => a.roomActionId.endsWith(`:${verb.id}`))) continue;
    actions.push(linkAction(room, verb.id, verb.label, verb.description, need.href, { primary: !primaryUsed, severity: need.severity }));
    primaryUsed = true;
    if (actions.length >= 2) break;
  }
  if (!primaryUsed) {
    actions.push(linkAction(room, "open", "Open classes", "Review every class's launch readiness.", room.href, { primary: true }));
  } else {
    actions.push(linkAction(room, "open", "Open classes", "Review every class's launch readiness.", room.href));
  }
  const t = topNeed(room);
  if (t) actions.push(trackAction(room, t));
  return dedupeAndCap(actions);
}

function studentActions(room: ChapterRoom): ChapterRoomAction[] {
  const actions: ChapterRoomAction[] = [];
  const absence = needByPrefix(room, "student-absences", "class-attendance-decline", "class-never-attended");
  const feedback = needByPrefix(room, "class-no-feedback", "student-negative-feedback");

  actions.push(linkAction(room, "attendance", "Open attendance", "Submit or review session attendance.", "/attendance", { primary: true }));
  if (feedback) {
    actions.push(linkAction(room, "feedback", "Collect feedback", "Open the class to gather student/parent feedback.", feedback.href, { severity: feedback.severity }));
  } else {
    actions.push(linkAction(room, "feedback", "Collect feedback", "Gather student/parent feedback after sessions.", room.href));
  }
  if (absence) {
    actions.push(linkAction(room, "roster", "Open class roster", "Check in with students who are slipping.", absence.href, { severity: absence.severity }));
  } else {
    actions.push(linkAction(room, "students", "Open student records", "See enrolled students and families.", room.href));
  }
  const t = topNeed(room);
  if (t) actions.push(trackAction(room, t));
  return dedupeAndCap(actions);
}

function growthActions(room: ChapterRoom): ChapterRoomAction[] {
  const actions: ChapterRoomAction[] = [];
  // The centerpiece: persist this week's KPI snapshot so next week has a real
  // measured baseline (not just timestamp reconstruction).
  actions.push({
    roomActionId: `${room.key}:save-snapshot`,
    roomKey: room.key,
    label: "Save snapshot",
    description: "Capture this week's KPIs as the baseline for next week's trend.",
    kind: "mutate",
    severity: "neutral",
    primary: true,
    href: "/my-weekly-impact",
    mutation: { handler: "saveKpiSnapshot" },
  });
  actions.push(linkAction(room, "impact", "Open weekly impact", "Write your weekly narrative for the impact meeting.", "/my-weekly-impact"));
  const regression = needByPrefix(room, "growth-regression");
  if (regression) {
    actions.push(trackAction(room, regression));
  } else {
    const t = topNeed(room);
    if (t) actions.push(trackAction(room, t));
  }
  return dedupeAndCap(actions);
}

function dedupeAndCap(actions: ChapterRoomAction[]): ChapterRoomAction[] {
  const seen = new Set<string>();
  const out: ChapterRoomAction[] = [];
  for (const a of actions) {
    if (seen.has(a.roomActionId)) continue;
    seen.add(a.roomActionId);
    out.push(a);
    if (out.length >= 4) break;
  }
  // Ensure exactly one primary (the first one wins).
  let primarySeen = false;
  for (const a of out) {
    if (a.primary && !primarySeen) primarySeen = true;
    else a.primary = false;
  }
  if (!primarySeen && out.length) out[0].primary = true;
  return out;
}

/** Build the 2–4 contextual actions for one room. Pure + deterministic. */
export function buildRoomActions(room: ChapterRoom): ChapterRoomAction[] {
  switch (room.key) {
    case "partner_network":
      return partnerActions(room);
    case "teaching_org":
      return teachingActions(room);
    case "learning_program":
      return learningActions(room);
    case "live_classes":
      return liveClassesActions(room);
    case "student_community":
      return studentActions(room);
    case "chapter_growth":
      return growthActions(room);
    default:
      return [];
  }
}

/** Attach actions to every room. */
export function withRoomActions(rooms: ChapterRoom[]): ChapterRoomWithActions[] {
  return rooms.map((room) => ({ ...room, actions: buildRoomActions(room) }));
}

/** Flatten every room's actions into one severity-sorted list (for tests/feeds). */
export function collectRoomActions(rooms: ChapterRoomWithActions[]): ChapterRoomAction[] {
  return rooms
    .flatMap((r) => r.actions)
    .sort((a, b) => (SEV_RANK[a.severity as "critical" | "warning" | "info"] ?? 3) - (SEV_RANK[b.severity as "critical" | "warning" | "info"] ?? 3));
}
