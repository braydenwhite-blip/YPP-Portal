/**
 * Progress update = written Leadership / Instructor Goals & Rubric.
 * Resolves expectation bullets for the mentee's current band so the form
 * can mirror the G&R layout while mentors write narrative progress.
 */

import {
  TRACKS,
  expectationsFor,
  getRole,
  resolveStartingPosition,
  type PathwayCompetency,
  type PathwayRole,
  type TrackId,
} from "@/lib/growth-pathway";

export type ProgressRubricContext = {
  trackId: TrackId;
  trackLabel: string;
  roleId: string;
  roleLabel: string;
  roleSubtitle: string | null;
};

export function resolveProgressRubricContext(input: {
  primaryRole: string | null;
  stageId?: string | null;
}): ProgressRubricContext {
  const { trackId, roleId } = resolveStartingPosition({
    stageId: input.stageId ?? null,
    primaryRole: input.primaryRole,
  });
  const track = TRACKS[trackId];
  const role = getRole(track, roleId);
  return {
    trackId,
    trackLabel: track.label,
    roleId,
    roleLabel: role?.label ?? roleId,
    roleSubtitle: role?.subtitle ?? null,
  };
}

/** Split a free-text G&R description into bullet lines when possible. */
export function splitExpectationBullets(text: string | null | undefined): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n|(?<=[.!?])\s+(?=•)|•/g)
    .map((line) => line.replace(/^[\s•\-–—*]+/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  // Single paragraph — keep as one bullet so the rubric still shows context.
  return [raw];
}

function matchCompetency(
  title: string,
  competencies: PathwayCompetency[]
): PathwayCompetency | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  return (
    competencies.find(
      (c) =>
        t === c.title.toLowerCase() ||
        t === c.shortTitle.toLowerCase() ||
        t.includes(c.title.toLowerCase()) ||
        c.title.toLowerCase().includes(t) ||
        t.includes(c.shortTitle.toLowerCase())
    ) ?? null
  );
}

/**
 * Bullets for a progress-update goal row: prefer official pathway expectations
 * for this mentee's band (when the goal title matches a competency), else
 * fall back to the G&R goal description.
 */
export function bulletsForProgressGoal(input: {
  title: string;
  description: string | null | undefined;
  trackId: TrackId;
  roleId: string;
}): string[] {
  const track = TRACKS[input.trackId];
  const role: PathwayRole | null = getRole(track, input.roleId);
  if (role) {
    const competency = matchCompetency(input.title, track.competencies);
    if (competency) {
      const fromPathway = expectationsFor(competency, role);
      if (fromPathway.length > 0) return fromPathway;
    }
  }
  return splitExpectationBullets(input.description);
}

/** Full band rubric (all competencies) for reference when goals are missing. */
export function bandRubricRows(input: {
  trackId: TrackId;
  roleId: string;
}): Array<{ number: number; title: string; bullets: string[] }> {
  const track = TRACKS[input.trackId];
  const role = getRole(track, input.roleId);
  if (!role) return [];
  return track.competencies.map((c) => ({
    number: c.number,
    title: c.title,
    bullets: expectationsFor(c, role),
  }));
}
