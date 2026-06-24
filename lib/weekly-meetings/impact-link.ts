/**
 * The Weekly Impact ↔ Impact Meeting bridge.
 *
 * Weekly Impact (the `/my-weekly-impact` form) and the impact meeting runner
 * (`WEEKLY_TEAM_IMPACT` / `CHAPTER_IMPACT`) are joined implicitly by three keys:
 * the reporting `weekStart`, the scope (team or chapter), and a row's
 * `presentToMeeting` flag. This module holds the pure, client-safe logic that
 * makes that link visible on both sides — coverage for the runner ("who has
 * reported") and a meeting hint for the form ("where my flagged rows go"). No
 * `server-only`/prisma here so both client components can import the types.
 */
import type { MeetingStatus, MeetingType } from "./meeting-types";

// --- Form side: which impact meeting an entry feeds ------------------------

export type ImpactMeetingHint = {
  id: string;
  title: string;
  scheduledISO: string;
  status: MeetingStatus;
  /** True for an all-teams meeting (no specific team scope). */
  allTeams: boolean;
};

type MeetingCandidate = {
  id: string;
  title: string;
  type: MeetingType;
  teamId: string | null;
  chapterId: string | null;
  status: MeetingStatus;
  scheduledISO: string;
};

const HINT_STATUS_RANK: Record<string, number> = { IN_PROGRESS: 0, SCHEDULED: 1 };

/**
 * Best open meeting an entry's flagged rows would surface in for its week.
 * Prefers in-progress over scheduled, a team-specific meeting over all-teams,
 * then the soonest start. Returns null when no live impact meeting matches.
 */
export function matchImpactMeetingForEntry(
  entry: { scope: "team" | "chapter"; scopeId: string },
  meetings: MeetingCandidate[]
): ImpactMeetingHint | null {
  const candidates = meetings.filter((m) => {
    if (m.status !== "SCHEDULED" && m.status !== "IN_PROGRESS") return false;
    if (entry.scope === "team") {
      return m.type === "WEEKLY_TEAM_IMPACT" && (m.teamId === entry.scopeId || m.teamId === null);
    }
    return m.type === "CHAPTER_IMPACT" && m.chapterId === entry.scopeId;
  });
  if (candidates.length === 0) return null;

  const best = [...candidates].sort((a, b) => {
    const statusDelta = (HINT_STATUS_RANK[a.status] ?? 9) - (HINT_STATUS_RANK[b.status] ?? 9);
    if (statusDelta !== 0) return statusDelta;
    // Team-specific (teamId set) beats all-teams (teamId null) for team scope.
    const aSpecific = entry.scope === "team" && a.teamId !== null ? 0 : 1;
    const bSpecific = entry.scope === "team" && b.teamId !== null ? 0 : 1;
    if (aSpecific !== bSpecific) return aSpecific - bSpecific;
    return a.scheduledISO.localeCompare(b.scheduledISO);
  })[0];

  return {
    id: best.id,
    title: best.title,
    scheduledISO: best.scheduledISO,
    status: best.status,
    allTeams: entry.scope === "team" && best.teamId === null,
  };
}

// --- Runner side: coverage of a meeting's scope for the week ----------------

export type ImpactCoverageStatus = "SUBMITTED" | "DRAFT" | "MISSING";

export type ImpactCoveragePerson = {
  userId: string;
  name: string;
  status: ImpactCoverageStatus;
  /** Rows flagged to present — only counted once the entry is submitted. */
  presentingCount: number;
};

export type ImpactCoverage = {
  scopeLabel: string;
  weekLabel: string;
  /** Whether we know the full expected roster (team scope) or only submitters. */
  hasRoster: boolean;
  /** Roster size for team scope; submitter count otherwise. */
  expected: number;
  /** Entries marked SUBMITTED. */
  submitted: number;
  /** Total rows flagged to present across submitted entries (matches the table). */
  presenting: number;
  people: ImpactCoveragePerson[];
};

const COVERAGE_STATUS_RANK: Record<ImpactCoverageStatus, number> = {
  SUBMITTED: 0,
  DRAFT: 1,
  MISSING: 2,
};

type CoverageEntry = {
  userId: string;
  name: string;
  status: "DRAFT" | "SUBMITTED";
  presentingCount: number;
};

/**
 * Reconcile the expected roster with the week's entries into a coverage view.
 * When `roster` is null (e.g. chapter scope, where there is no membership
 * table) we report only the people who actually have entries.
 */
export function buildImpactCoverage(input: {
  scopeLabel: string;
  weekLabel: string;
  roster: Array<{ userId: string; name: string }> | null;
  entries: CoverageEntry[];
}): ImpactCoverage {
  // Aggregate per user: a person on several teams can have multiple entries for
  // an all-teams meeting. They count once, submitted if any entry is submitted,
  // and their presenting tally sums only their submitted entries' flagged rows.
  const agg = new Map<string, { name: string; submitted: boolean; presentingCount: number }>();
  for (const entry of input.entries) {
    const cur = agg.get(entry.userId) ?? { name: entry.name, submitted: false, presentingCount: 0 };
    if (!cur.name) cur.name = entry.name;
    if (entry.status === "SUBMITTED") {
      cur.submitted = true;
      cur.presentingCount += entry.presentingCount;
    }
    agg.set(entry.userId, cur);
  }

  const people: ImpactCoveragePerson[] = [];
  const seen = new Set<string>();
  const pushPerson = (userId: string, name: string) => {
    if (seen.has(userId)) return;
    seen.add(userId);
    const a = agg.get(userId);
    if (!a) {
      people.push({ userId, name, status: "MISSING", presentingCount: 0 });
      return;
    }
    people.push({
      userId,
      name: name || a.name,
      status: a.submitted ? "SUBMITTED" : "DRAFT",
      presentingCount: a.presentingCount,
    });
  };

  if (input.roster) {
    for (const member of input.roster) pushPerson(member.userId, member.name);
  }
  // Always fold in submitters even if they are not (or no longer) on the roster.
  for (const entry of input.entries) pushPerson(entry.userId, entry.name);

  people.sort(
    (a, b) =>
      COVERAGE_STATUS_RANK[a.status] - COVERAGE_STATUS_RANK[b.status] ||
      a.name.localeCompare(b.name)
  );

  const submitted = people.filter((p) => p.status === "SUBMITTED").length;
  const presenting = Array.from(agg.values()).reduce((sum, a) => sum + a.presentingCount, 0);

  return {
    scopeLabel: input.scopeLabel,
    weekLabel: input.weekLabel,
    hasRoster: input.roster !== null,
    expected: input.roster ? input.roster.length : people.length,
    submitted,
    presenting,
    people,
  };
}
