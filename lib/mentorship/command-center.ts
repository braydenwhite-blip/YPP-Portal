import "server-only";

/**
 * Mentorship command center — the admin POV loader for the unified hub.
 *
 * Composes the Leadership Development overview (lifecycle lanes + review
 * queue, lib/development) with the review-cycle rollups and mentor
 * load/coverage. Read-only; every CTA lands on an existing write surface.
 */

import {
  loadDevelopmentOverview,
  type DevelopmentOverview,
} from "@/lib/development/load";
import type { DevelopmentPopulation } from "@/lib/development/signals";

import { listActiveReviewCycles, type CycleSummary } from "./cycle-load";
import { buildMentorLoad, type MentorCoverage } from "./mentor-load";

export type MentorshipCommandCenter = {
  overview: DevelopmentOverview;
  activeCycles: CycleSummary[];
  mentorCoverage: MentorCoverage;
};

export async function loadMentorshipCommandCenter(
  population: DevelopmentPopulation,
  now: Date = new Date()
): Promise<MentorshipCommandCenter> {
  const [overview, activeCycles] = await Promise.all([
    loadDevelopmentOverview(population, now),
    listActiveReviewCycles(),
  ]);

  return {
    overview,
    activeCycles,
    mentorCoverage: buildMentorLoad(overview.people),
  };
}
