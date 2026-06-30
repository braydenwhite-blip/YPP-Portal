/**
 * Chapter-President-facing partner pipeline (presentation layer).
 *
 * The database keeps its stable 12-value `Partner.stage` vocabulary
 * (`lib/partners-constants.ts`). This module maps those stages onto a smaller,
 * calmer set of CP "lanes" for the partner workspace board, and derives the one
 * obvious next action for each partner. Nothing here writes the database or
 * changes the stage vocabulary — it is a pure read/derive layer so the admin
 * pipeline board and operations consumers are untouched.
 *
 * Pure + dependency-light (only the partner constants + the follow-up helper),
 * so it is safe in server components, server actions, client components, tests.
 */

import {
  asPartnerStage,
  PARTNER_STAGE_LABELS,
  type PartnerStage,
} from "@/lib/partners-constants";
import { isFollowUpDue } from "@/lib/partners/follow-up";
import type { StatusTone } from "@/components/ui-v2/status-badge";

// --- Lanes ------------------------------------------------------------------

export const CP_LANES = [
  "RESEARCH",
  "CONTACTED",
  "FOLLOW_UP_DUE",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "CONFIRMED",
  "CLOSED",
] as const;
export type CpLane = (typeof CP_LANES)[number];

export const CP_LANE_LABELS: Record<CpLane, string> = {
  RESEARCH: "Research / New Lead",
  CONTACTED: "Contacted / Waiting",
  FOLLOW_UP_DUE: "Follow-Up Due",
  INTERESTED: "Interested",
  MEETING: "Meeting Scheduled",
  PROPOSAL: "Proposal / Final Conversation",
  CONFIRMED: "Confirmed",
  CLOSED: "Closed / Not Now",
};

export const CP_LANE_HINTS: Record<CpLane, string> = {
  RESEARCH: "Found a school, library, or center — gather contacts before reaching out.",
  CONTACTED: "Intro email is out. Waiting to hear back.",
  FOLLOW_UP_DUE: "No reply yet and the follow-up date has arrived — send a nudge.",
  INTERESTED: "They replied with interest. Get a meeting on the calendar.",
  MEETING: "A conversation is scheduled. Prep, meet, then log the outcome.",
  PROPOSAL: "They want details. Send a proposal and drive it to a decision.",
  CONFIRMED: "Partner is in. Confirm logistics and keep weekly check-ins.",
  CLOSED: "Paused or not a fit right now.",
};

/** Badge tone per lane (maps to ui-v2 StatusBadge tones). */
export const CP_LANE_TONE: Record<CpLane, StatusTone> = {
  RESEARCH: "neutral",
  CONTACTED: "info",
  FOLLOW_UP_DUE: "danger",
  INTERESTED: "brand",
  MEETING: "warning",
  PROPOSAL: "warning",
  CONFIRMED: "success",
  CLOSED: "neutral",
};

/** Static stage → lane mapping (ignores the follow-up-due override). */
export const STAGE_TO_LANE: Record<PartnerStage, CpLane> = {
  NOT_STARTED: "RESEARCH",
  RESEARCHING: "RESEARCH",
  REACHED_OUT: "CONTACTED",
  RESPONDED: "INTERESTED",
  MEETING_SCHEDULED: "MEETING",
  NEEDS_PROPOSAL: "PROPOSAL",
  PROPOSAL_SENT: "PROPOSAL",
  NEGOTIATING: "PROPOSAL",
  ACTIVE_PARTNERSHIP: "CONFIRMED",
  COMPLETED: "CONFIRMED",
  PAUSED: "CLOSED",
  NOT_A_FIT: "CLOSED",
};

/**
 * In-conversation, pre-confirmation stages where an overdue follow-up means
 * "you owe them a touch". A partner in one of these with an overdue follow-up
 * is the FOLLOW_UP_DUE lane AND the followUpsDue metric — one definition shared
 * by the board and the Impact numbers so they never disagree. MEETING_SCHEDULED
 * is excluded (an overdue meeting needs its outcome logged, not a nudge), as are
 * the settled CONFIRMED / CLOSED stages.
 */
const FOLLOW_UP_DUE_STAGES: ReadonlySet<PartnerStage> = new Set<PartnerStage>([
  "REACHED_OUT",
  "RESPONDED",
  "NEEDS_PROPOSAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
]);

/** Single source of truth for "this partner's follow-up is due and needs action". */
export function isPartnerFollowUpDue(input: PartnerWorkInput, now: Date): boolean {
  return FOLLOW_UP_DUE_STAGES.has(asPartnerStage(input.stage)) && isFollowUpDue(input.nextFollowUpAt, now);
}

/** Lanes that mean the partner is settled (no live outreach next step). */
export const SETTLED_LANES: ReadonlySet<CpLane> = new Set<CpLane>(["CONFIRMED", "CLOSED"]);

export function cpLaneLabel(lane: CpLane): string {
  return CP_LANE_LABELS[lane];
}

export function stageLaneLabel(stage: string | null | undefined): string {
  return PARTNER_STAGE_LABELS[asPartnerStage(stage)];
}

// --- Per-partner derivation -------------------------------------------------

/** The minimum a partner row needs for lane + next-action derivation. */
export type PartnerWorkInput = {
  stage: string | null;
  nextFollowUpAt: Date | null;
  meetingDate: Date | null;
  lastContactedAt: Date | null;
  contactName: string | null;
  contactEmail: string | null;
  /** Pre-derived from the logistics module; null when not yet confirmed. */
  logisticsComplete?: boolean | null;
};

/**
 * The lane a partner belongs in on the CP board. A partner we are waiting on
 * (REACHED_OUT / RESPONDED) whose follow-up date has arrived is pulled into the
 * dedicated FOLLOW_UP_DUE lane so it can't go cold; otherwise it maps by stage.
 */
export function partnerCpLane(input: PartnerWorkInput, now: Date): CpLane {
  if (isPartnerFollowUpDue(input, now)) return "FOLLOW_UP_DUE";
  return STAGE_TO_LANE[asPartnerStage(input.stage)];
}

// --- Next action engine -----------------------------------------------------

export type PartnerNextActionKey =
  | "ADD_CONTACT"
  | "GENERATE_EMAIL"
  | "AWAIT_REPLY"
  | "SEND_FOLLOW_UP"
  | "SCHEDULE_MEETING"
  | "MEETING_BRIEF"
  | "LOG_OUTCOME"
  | "SEND_PROPOSAL"
  | "CONFIRM_LOGISTICS"
  | "CHECK_IN"
  | "REOPEN";

export type PartnerNextAction = {
  key: PartnerNextActionKey;
  /** Imperative one-liner shown on the card ("Send the intro email"). */
  label: string;
  /** Optional supporting detail (a date, a count). */
  detail?: string;
  /** Urgency for styling — danger = needs you now. */
  tone: StatusTone;
};

function dateLabel(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The single most important next step for a partner, deterministically derived
 * from its stage, contact info, follow-up clock, meeting date, and logistics.
 * This is what makes the workspace feel like it is telling the CP what to do.
 */
export function partnerNextAction(input: PartnerWorkInput, now: Date): PartnerNextAction {
  const stage = asPartnerStage(input.stage);
  const lane = partnerCpLane(input, now);
  const overdue = isFollowUpDue(input.nextFollowUpAt, now);

  switch (lane) {
    case "RESEARCH":
      if (!input.contactEmail) {
        return {
          key: "ADD_CONTACT",
          label: "Find a contact email",
          detail: input.contactName ? `Have ${input.contactName}, need their email` : "No contact yet",
          tone: "neutral",
        };
      }
      return {
        key: "GENERATE_EMAIL",
        label: "Send the intro email",
        detail: "Ready to email",
        tone: "brand",
      };
    case "CONTACTED":
      return {
        key: "AWAIT_REPLY",
        label: "Waiting on a reply",
        detail: input.nextFollowUpAt ? `Follow up ${dateLabel(input.nextFollowUpAt)}` : "Schedule a follow-up",
        tone: "info",
      };
    case "FOLLOW_UP_DUE":
      return {
        key: "SEND_FOLLOW_UP",
        label: "Send a follow-up",
        detail: overdue ? `Due ${dateLabel(input.nextFollowUpAt)}` : undefined,
        tone: "danger",
      };
    case "INTERESTED":
      return {
        key: "SCHEDULE_MEETING",
        label: "Schedule a meeting",
        detail: "They're interested",
        tone: "brand",
      };
    case "MEETING": {
      const past = !!input.meetingDate && input.meetingDate.getTime() < now.getTime();
      if (past) {
        return { key: "LOG_OUTCOME", label: "Log the meeting outcome", detail: `Met ${dateLabel(input.meetingDate)}`, tone: "danger" };
      }
      return {
        key: "MEETING_BRIEF",
        label: "Prep for the meeting",
        detail: input.meetingDate ? dateLabel(input.meetingDate) : "Set a date",
        tone: "warning",
      };
    }
    case "PROPOSAL":
      if (stage === "NEEDS_PROPOSAL") {
        return { key: "SEND_PROPOSAL", label: "Send the proposal", tone: "brand" };
      }
      return {
        key: "SEND_FOLLOW_UP",
        label: "Follow up on the proposal",
        detail: input.nextFollowUpAt ? `Due ${dateLabel(input.nextFollowUpAt)}` : undefined,
        tone: overdue ? "danger" : "warning",
      };
    case "CONFIRMED":
      if (input.logisticsComplete === false) {
        return { key: "CONFIRM_LOGISTICS", label: "Confirm logistics", detail: "Confirmed, logistics incomplete", tone: "warning" };
      }
      return { key: "CHECK_IN", label: "Weekly partner check-in", detail: "Keep the relationship warm", tone: "success" };
    case "CLOSED":
    default:
      return { key: "REOPEN", label: "Reopen or archive", tone: "neutral" };
  }
}

// --- Board aggregation ------------------------------------------------------

/** Lanes shown as columns on the CP board, in pipeline order. */
export const CP_BOARD_LANES: readonly CpLane[] = CP_LANES;

export function summarizeLanes(
  partners: PartnerWorkInput[],
  now: Date
): Record<CpLane, number> {
  const counts = Object.fromEntries(CP_LANES.map((l) => [l, 0])) as Record<CpLane, number>;
  for (const p of partners) counts[partnerCpLane(p, now)] += 1;
  return counts;
}
