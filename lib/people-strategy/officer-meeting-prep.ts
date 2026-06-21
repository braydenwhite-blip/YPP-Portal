import { formatDueDate } from "@/lib/leadership-action-center/dates";

import type { ActionLite, OperationalReviewItem } from "./operational-digest";
import type { AgendaItemDTO, MeetingDetailDTO } from "./meetings-queries";
import type { EffectiveMeetingStatus } from "./meetings-status";

/**
 * Officer Meetings prep — pure derivations for the Before / During / After
 * workflow on `/actions/meetings`.
 */

export type OfficerMeetingPhase = "before" | "during" | "after";

export type CandidateGroupKey = "ownerless" | "blocked" | "cross_team";

export const CANDIDATE_GROUP_META: Record<
  CandidateGroupKey,
  { label: string; color: string; flaggedLabel: (n: number) => string }
> = {
  ownerless: {
    label: "Ownerless items",
    color: "#e07b2d",
    flaggedLabel: (n) => `${n} flagged`,
  },
  blocked: {
    label: "Blocked & escalations",
    color: "#c0392b",
    flaggedLabel: (n) => `${n} flagged`,
  },
  cross_team: {
    label: "Cross-team decisions",
    color: "#1d4ed8",
    flaggedLabel: (n) => `${n} flagged`,
  },
};

export type OfficerMeetingCandidate = {
  id: string;
  group: CandidateGroupKey;
  title: string;
  sourceLabel: string;
  sourceColor: string;
  sourceBg: string;
  sourceHref: string;
  ownerMeta: string;
  agendaItemId: string | null;
};

export type OfficerMeetingAgendaRow = {
  id: string;
  title: string;
  status: AgendaItemDTO["status"];
  color: string;
};

export type OfficerMeetingPastRow = {
  id: string;
  day: string;
  mon: string;
  title: string;
  note: string;
};

export type OfficerMeetingFocus = {
  id: string;
  title: string;
  day: string;
  mon: string;
  meta: string;
  phaseBadge: string;
  effectiveStatus: EffectiveMeetingStatus;
  storedStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notesText: string | null;
};

export type OfficerMeetingPrepData = {
  focus: OfficerMeetingFocus | null;
  candidateGroups: Array<{
    key: CandidateGroupKey;
    label: string;
    color: string;
    count: string;
    items: OfficerMeetingCandidate[];
  }>;
  agenda: OfficerMeetingAgendaRow[];
  decisionsNeeded: string[];
  pastMeetings: OfficerMeetingPastRow[];
  summarySections: Array<{ title: string; color: string; bullet: string; lines: string[] }>;
  summaryPlain: string;
  discussedCount: number;
  unresolved: string[];
};

const SOURCE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  partner: { color: "#5a1da8", bg: "#f3edff", label: "Partner" },
  person: { color: "#0e7c52", bg: "#ecfdf5", label: "People" },
  mentorship: { color: "#db2777", bg: "#fdf2f8", label: "Mentorship" },
  instructor: { color: "#0891b2", bg: "#ecfeff", label: "Applicant review" },
  action: { color: "#717189", bg: "#f4f4f8", label: "Operations" },
  decision: { color: "#b45309", bg: "#fdf2e3", label: "Decision" },
  default: { color: "#717189", bg: "#f4f4f8", label: "Operations" },
};

function sourceStyle(kind: string, relatedLabel: string | null): {
  sourceLabel: string;
  sourceColor: string;
  sourceBg: string;
} {
  const base = SOURCE_STYLES[kind] ?? SOURCE_STYLES.default;
  return {
    sourceLabel: relatedLabel ?? base.label,
    sourceColor: base.color,
    sourceBg: base.bg,
  };
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function findAgendaMatch(title: string, agenda: AgendaItemDTO[]): string | null {
  const needle = normalizeTitle(title);
  const hit = agenda.find((a) => normalizeTitle(a.title) === needle);
  return hit?.id ?? null;
}

function actionOwnerMeta(action: ActionLite): string {
  const bits: string[] = [];
  if (!action.ownerName) bits.push("No owner");
  else bits.push(action.ownerName);
  if (action.dueISO) bits.push(`due ${formatDueDate(new Date(action.dueISO))}`);
  if (action.overdue) bits.push("overdue");
  return bits.join(" · ") || "Needs assignment";
}

function actionCandidate(
  action: ActionLite,
  group: CandidateGroupKey,
  agenda: AgendaItemDTO[]
): OfficerMeetingCandidate {
  const style = sourceStyle(action.relatedLabel ? "partner" : "action", action.relatedLabel);
  return {
    id: `action:${action.id}`,
    group,
    title: action.title,
    ...style,
    sourceHref: action.href,
    ownerMeta: actionOwnerMeta(action),
    agendaItemId: findAgendaMatch(action.title, agenda),
  };
}

function reviewCandidate(
  item: OperationalReviewItem,
  agenda: AgendaItemDTO[]
): OfficerMeetingCandidate {
  const kind =
    item.kind === "partner"
      ? "partner"
      : item.kind === "mentorship"
        ? "mentorship"
        : item.kind === "person" || item.kind === "instructor"
          ? item.kind
          : "decision";
  const style = sourceStyle(kind, item.kind === "partner" ? item.title.split("·")[0]?.trim() ?? null : null);
  return {
    id: item.id,
    group: "cross_team",
    title: item.title,
    ...style,
    sourceHref: item.href,
    ownerMeta: item.reason,
    agendaItemId: findAgendaMatch(item.title, agenda),
  };
}

export function buildCandidateGroups(input: {
  unassigned: ActionLite[];
  blocked: ActionLite[];
  overdue: ActionLite[];
  reviewItems: OperationalReviewItem[];
  agenda: AgendaItemDTO[];
}): OfficerMeetingPrepData["candidateGroups"] {
  const ownerless = input.unassigned.map((a) => actionCandidate(a, "ownerless", input.agenda));
  const blockedIds = new Set<string>();
  const blocked = [
    ...input.blocked.map((a) => {
      blockedIds.add(a.id);
      return actionCandidate(a, "blocked", input.agenda);
    }),
    ...input.overdue
      .filter((a) => !blockedIds.has(a.id))
      .map((a) => actionCandidate(a, "blocked", input.agenda)),
  ];
  const crossTeam = input.reviewItems
    .filter((r) => r.kind !== "action" && r.kind !== "meeting" && r.kind !== "area")
    .slice(0, 8)
    .map((r) => reviewCandidate(r, input.agenda));

  const groups: Array<{ key: CandidateGroupKey; items: OfficerMeetingCandidate[] }> = [
    { key: "ownerless", items: ownerless },
    { key: "blocked", items: blocked },
    { key: "cross_team", items: crossTeam },
  ];

  return groups.map(({ key, items }) => {
    const meta = CANDIDATE_GROUP_META[key];
    return {
      key,
      label: meta.label,
      color: meta.color,
      count: meta.flaggedLabel(items.length),
      items,
    };
  });
}

export function inferDefaultPhase(
  storedStatus: OfficerMeetingFocus["storedStatus"],
  effectiveStatus: EffectiveMeetingStatus
): OfficerMeetingPhase {
  if (storedStatus === "COMPLETED" || effectiveStatus === "needs_follow_up") return "after";
  if (effectiveStatus === "in_progress") return "during";
  return "before";
}

export function phaseBadgeLabel(phase: OfficerMeetingPhase): string {
  if (phase === "during") return "In progress";
  if (phase === "after") return "Wrap-up";
  return "Preparing";
}

const AGENDA_COLORS = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#c0392b"];

export function buildAgendaRows(agenda: AgendaItemDTO[]): OfficerMeetingAgendaRow[] {
  return agenda.map((item, index) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    color: AGENDA_COLORS[index % AGENDA_COLORS.length],
  }));
}

export function buildDecisionsNeeded(candidates: OfficerMeetingCandidate[]): string[] {
  return candidates
    .filter((c) => c.group === "cross_team" || c.group === "blocked")
    .slice(0, 6)
    .map((c) => c.title);
}

export function buildPastMeetingRows(
  meetings: Array<{ id: string; title: string; date: Date; note: string }>
): OfficerMeetingPastRow[] {
  return meetings.map((m) => {
    const d = m.date;
    return {
      id: m.id,
      day: String(d.getUTCDate()).padStart(2, "0"),
      mon: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d).toUpperCase(),
      title: m.title,
      note: m.note,
    };
  });
}

export function buildSummarySections(detail: MeetingDetailDTO): {
  sections: OfficerMeetingPrepData["summarySections"];
  plain: string;
  unresolved: string[];
} {
  const sections: OfficerMeetingPrepData["summarySections"] = [];

  if (detail.decisions.length > 0) {
    sections.push({
      title: "Decisions made",
      color: "#b45309",
      bullet: "◆",
      lines: detail.decisions.map((d) => d.decision),
    });
  }

  const discussed = detail.agenda.filter((a) => a.status === "DISCUSSED" || a.status === "CONVERTED");
  if (discussed.length > 0) {
    sections.push({
      title: "Agenda covered",
      color: "#5a1da8",
      bullet: "•",
      lines: discussed.map((a) => a.title),
    });
  }

  if (detail.notesText?.trim()) {
    sections.push({
      title: "Meeting notes",
      color: "#3a3a52",
      bullet: "•",
      lines: detail.notesText.trim().split(/\n+/).filter(Boolean),
    });
  }

  const openFollowUps = detail.followUps.filter((f) => f.effectiveStatus !== "completed");
  if (openFollowUps.length > 0) {
    sections.push({
      title: "Follow-ups captured",
      color: "#0e7c52",
      bullet: "•",
      lines: openFollowUps.map((f) =>
        f.owner ? `${f.title} — ${f.owner.name}` : f.title
      ),
    });
  }

  const unresolved = detail.agenda
    .filter((a) => a.status === "OPEN" || a.status === "DEFERRED")
    .map((a) => a.title);

  const plain = sections
    .map((s) => `${s.title}\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");

  return { sections, plain, unresolved };
}

export function meetingFocusFromDetail(detail: MeetingDetailDTO): OfficerMeetingFocus {
  const start = new Date(detail.startISO);
  const attendees = detail.attendees.map((a) => a.name);
  const metaParts = [
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(start),
    attendees.length > 0
      ? `${attendees.slice(0, 2).join(", ")}${attendees.length > 2 ? ` + ${attendees.length - 2} officers` : ""}`
      : null,
  ].filter(Boolean);

  return {
    id: detail.id,
    title: detail.title,
    day: String(start.getUTCDate()).padStart(2, "0"),
    mon: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
      .format(start)
      .toUpperCase(),
    meta: metaParts.join(" · "),
    phaseBadge: phaseBadgeLabel(inferDefaultPhase(detail.storedStatus, detail.effectiveStatus)),
    effectiveStatus: detail.effectiveStatus,
    storedStatus: detail.storedStatus,
    notesText: detail.notesText,
  };
}
