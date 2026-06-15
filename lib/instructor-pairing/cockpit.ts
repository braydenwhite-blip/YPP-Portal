// Instructor Pairing — the deterministic cockpit selector.
//
// Turns normalised pairing units + the accepted-applicant placement queue into
// a guided, lane-based cockpit. Pure and explainable; each unit resolves to
// exactly one coverage lane (de-duplicated), and every card carries who/what
// it's about, why it appears, and the single next action.

import { deriveUnitCoverage } from "./coverage";
import type {
  PairingBriefingChip,
  PairingCard,
  PairingCardAction,
  PairingCockpit,
  PairingCockpitInput,
  PairingLane,
  PairingLaneView,
  PairingTone,
  PairingUnit,
} from "./types";

const LANE_META: Record<
  PairingLane,
  { label: string; blurb: string; emptyTitle: string; emptyBody: string }
> = {
  needs_instructor: {
    label: "Needs instructor",
    blurb: "Classes with no confirmed instructor.",
    emptyTitle: "Every class has an instructor",
    emptyBody: "No uncovered classes right now. New offerings without coverage will appear here.",
  },
  starts_soon: {
    label: "Starts soon",
    blurb: "Time-critical: starting soon and not yet confirmed.",
    emptyTitle: "Nothing urgent on the calendar",
    emptyBody: "No unconfirmed classes are starting in the next few weeks.",
  },
  suggested_matches: {
    label: "Suggested matches ready",
    blurb: "A strong instructor match is ready to offer.",
    emptyTitle: "No matches waiting",
    emptyBody: "Add subject interests and training info to instructors to surface matches, or pair manually.",
  },
  accepted_unplaced: {
    label: "Accepted but unplaced",
    blurb: "Approved instructors with no class yet.",
    emptyTitle: "Every accepted instructor is placed",
    emptyBody: "Newly accepted instructors will appear here until they're paired to a class.",
  },
  needs_training: {
    label: "Needs training first",
    blurb: "Placement is blocked on training/onboarding.",
    emptyTitle: "No training blockers",
    emptyBody: "No pairings are waiting on training. Onboarding-blocked placements will show up here.",
  },
  waiting_instructor: {
    label: "Waiting on instructor",
    blurb: "Offer sent — awaiting the instructor's confirmation.",
    emptyTitle: "No offers outstanding",
    emptyBody: "No instructors have an unanswered offer. Sent offers will appear here until confirmed.",
  },
  waiting_partner: {
    label: "Waiting on partner",
    blurb: "Instructor confirmed — partner/chapter confirmation missing.",
    emptyTitle: "No partner confirmations pending",
    emptyBody: "Every confirmed instructor has partner sign-off. Pending partner confirmations will appear here.",
  },
  cp_follow_up: {
    label: "Chapter president follow-up",
    blurb: "Coverage is blocked on ownership.",
    emptyTitle: "Every partner has an owner",
    emptyBody: "No partner relationships are unowned. Unowned coverage will surface here for a chapter president.",
  },
  fully_covered: {
    label: "Fully covered / recently paired",
    blurb: "Confirmed and in good shape.",
    emptyTitle: "No confirmed coverage yet",
    emptyBody: "Confirmed pairings will appear here as a record of what's settled.",
  },
};

const LANE_ORDER: PairingLane[] = [
  "needs_instructor",
  "starts_soon",
  "suggested_matches",
  "accepted_unplaced",
  "needs_training",
  "waiting_instructor",
  "waiting_partner",
  "cp_follow_up",
  "fully_covered",
];

function subjectContext(unit: PairingUnit): string | null {
  const bits = [unit.subject, unit.ageGroup].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

function unitSubtitle(unit: PairingUnit): string {
  const partner = unit.partnerName ?? "No partner";
  const owner = unit.ownerName ? ` · owner ${unit.ownerName}` : "";
  return `${partner}${owner}`;
}

function buildUnitCard(unit: PairingUnit, now: Date): PairingCard {
  const cov = deriveUnitCoverage(unit, now);
  const open360: PairingCardAction[] = [
    { kind: "open_class_360", label: "Open class", offeringId: unit.offeringId },
  ];
  if (unit.partnerId) {
    open360.push({ kind: "open_partner_360", label: "Open partner", partnerId: unit.partnerId });
  }

  let primaryAction: PairingCardAction;
  let secondaryActions: PairingCardAction[];

  switch (cov.lane) {
    case "fully_covered":
      primaryAction = { kind: "open_class_360", label: "Open class", offeringId: unit.offeringId };
      secondaryActions = unit.partnerId
        ? [{ kind: "open_partner_360", label: "Open partner", partnerId: unit.partnerId }]
        : [];
      break;
    case "waiting_partner":
      primaryAction = {
        kind: "request_partner_confirmation",
        label: "Confirm with partner",
        assignmentId: cov.primaryAssignmentId ?? undefined,
        nextStatus: cov.confirmNextStatus ?? "FULLY_CONFIRMED",
      };
      secondaryActions = [
        { kind: "create_coverage_action", label: "Partner follow-up" },
        ...open360,
      ];
      break;
    case "waiting_instructor":
      primaryAction = {
        kind: "confirm_instructor",
        label: "Confirm instructor",
        assignmentId: cov.primaryAssignmentId ?? undefined,
        nextStatus: cov.confirmNextStatus ?? "INSTRUCTOR_CONFIRMED",
      };
      secondaryActions = [
        { kind: "replace_instructor", label: "Replace", offeringId: unit.offeringId },
        ...open360,
      ];
      break;
    case "needs_training":
      primaryAction = { kind: "schedule_training", label: "Schedule training", instructorId: unit.assignments[0]?.instructorId };
      secondaryActions = [
        {
          kind: "confirm_instructor",
          label: "Mark ready & confirm",
          assignmentId: cov.primaryAssignmentId ?? undefined,
          nextStatus: "FULLY_CONFIRMED",
        },
        ...open360,
      ];
      break;
    case "suggested_matches":
      primaryAction = cov.primaryAssignmentId
        ? {
            kind: "confirm_instructor",
            label: "Send offer",
            assignmentId: cov.primaryAssignmentId,
            nextStatus: "OFFERED",
          }
        : { kind: "review_suggestion", label: "Review match", offeringId: unit.offeringId };
      secondaryActions = [
        { kind: "pair_instructor", label: "Pair someone else", offeringId: unit.offeringId },
        ...open360,
      ];
      break;
    case "cp_follow_up":
      primaryAction = { kind: "assign_owner", label: "Assign owner", partnerId: unit.partnerId ?? undefined };
      secondaryActions = [
        { kind: "create_coverage_action", label: "Coverage follow-up" },
        ...open360,
      ];
      break;
    case "needs_instructor":
    case "starts_soon":
    default:
      primaryAction = { kind: "pair_instructor", label: "Pair instructor", offeringId: unit.offeringId };
      secondaryActions = [
        { kind: "create_coverage_action", label: "Coverage follow-up" },
        ...open360,
      ];
      break;
  }

  return {
    id: `unit:${unit.offeringId}`,
    lane: cov.lane,
    offeringId: unit.offeringId,
    offeringTitle: unit.title,
    partnerId: unit.partnerId,
    partnerName: unit.partnerName,
    instructorId: unit.assignments[0]?.instructorId ?? unit.legacyLeadId,
    instructorName: unit.assignments[0]?.instructorName ?? unit.legacyLeadName,
    primaryAssignmentId: cov.primaryAssignmentId,
    statusLabel: cov.label,
    statusTone: cov.tone,
    accentTone: cov.startsSoon && cov.lane !== "fully_covered" ? "danger" : cov.tone,
    title: unit.title,
    subtitle: unitSubtitle(unit),
    why: cov.reason,
    context: subjectContext(unit),
    metaLine: unit.chapterName,
    nextAction: cov.nextAction,
    primaryAction,
    secondaryActions,
    suggestions: unit.suggestions,
  };
}

export function buildInstructorPairingCockpit(
  input: PairingCockpitInput,
  now: Date = new Date(),
): PairingCockpit {
  const buckets: Record<PairingLane, PairingCard[]> = {
    needs_instructor: [],
    starts_soon: [],
    suggested_matches: [],
    accepted_unplaced: [],
    needs_training: [],
    waiting_instructor: [],
    waiting_partner: [],
    cp_follow_up: [],
    fully_covered: [],
  };
  const seen = new Set<string>();
  const push = (card: PairingCard) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    buckets[card.lane].push(card);
  };

  for (const unit of input.units) push(buildUnitCard(unit, now));

  for (const person of input.acceptedUnplaced) {
    push({
      id: `acc:${person.instructorId}`,
      lane: "accepted_unplaced",
      offeringId: null,
      offeringTitle: null,
      partnerId: null,
      partnerName: null,
      instructorId: person.instructorId,
      instructorName: person.name,
      primaryAssignmentId: null,
      statusLabel: person.trained ? "Ready to place" : "Accepted",
      statusTone: person.trained ? "info" : "warning",
      accentTone: "brand",
      title: person.name,
      subtitle: `${person.readinessLabel}${person.chapterName ? ` · ${person.chapterName}` : ""}`,
      why: person.trained
        ? `${person.name} is accepted and ready, but hasn't been paired with a class.`
        : `${person.name} is accepted but still needs training before placement.`,
      context: person.trained ? "Placement-ready" : "Training needed",
      metaLine: person.waitingDays > 0 ? `Waiting ${person.waitingDays}d` : "Newly accepted",
      nextAction: person.trained
        ? "Pair them to a class that needs an instructor."
        : "Schedule training, then place them.",
      primaryAction: { kind: "place_instructor", label: "Place in a class", instructorId: person.instructorId },
      secondaryActions: [
        { kind: "open_instructor_360", label: "Open instructor", instructorId: person.instructorId },
      ],
      suggestions: [],
    });
  }

  // Oldest-waiting accepted instructors first.
  buckets.accepted_unplaced.sort((a, b) => {
    const ad = Number((a.metaLine ?? "").replace(/\D/g, "")) || 0;
    const bd = Number((b.metaLine ?? "").replace(/\D/g, "")) || 0;
    return bd - ad;
  });
  // Most-urgent (soonest start) first in starts_soon.
  buckets.starts_soon.sort((a, b) => Number(a.accentTone === "danger") - Number(b.accentTone === "danger"));

  const lanes: PairingLaneView[] = LANE_ORDER.map((lane) => ({
    lane,
    label: LANE_META[lane].label,
    blurb: LANE_META[lane].blurb,
    cards: buckets[lane],
    total: buckets[lane].length,
    emptyTitle: LANE_META[lane].emptyTitle,
    emptyBody: LANE_META[lane].emptyBody,
  }));

  const count = (lane: PairingLane) => buckets[lane].length;
  const chip = (
    key: string,
    label: string,
    n: number,
    tone: PairingTone,
    lane: PairingLane | null,
  ): PairingBriefingChip => ({ key, label, count: n, tone, lane });

  const needsInstructor = count("needs_instructor") + count("starts_soon");
  const briefing: PairingBriefingChip[] = [
    chip("needs_instructor", "Classes needing instructor", needsInstructor, needsInstructor > 0 ? "danger" : "success", "needs_instructor"),
    chip("accepted", "Accepted, awaiting placement", count("accepted_unplaced"), count("accepted_unplaced") > 0 ? "warning" : "success", "accepted_unplaced"),
    chip("waiting_instructor", "Awaiting instructor confirmation", count("waiting_instructor"), count("waiting_instructor") > 0 ? "info" : "success", "waiting_instructor"),
    chip("waiting_partner", "Awaiting partner confirmation", count("waiting_partner"), count("waiting_partner") > 0 ? "warning" : "success", "waiting_partner"),
    chip("training", "Training / onboarding needed", count("needs_training"), count("needs_training") > 0 ? "warning" : "success", "needs_training"),
    chip("cp", "Chapter president follow-ups", count("cp_follow_up"), count("cp_follow_up") > 0 ? "danger" : "success", "cp_follow_up"),
  ];

  const totalSituations =
    needsInstructor +
    count("suggested_matches") +
    count("accepted_unplaced") +
    count("needs_training") +
    count("waiting_instructor") +
    count("waiting_partner") +
    count("cp_follow_up");

  return {
    briefing,
    lanes,
    totalSituations,
    generatedAtISO: now.toISOString(),
  };
}
