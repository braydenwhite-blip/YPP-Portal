/**
 * Cohort resolution for review-cycle launches (pure, testable).
 *
 * Turns a launcher scope ("all new instructors", "the Scarsdale chapter",
 * "everyone in the review-due lane", "these three people") into a concrete
 * list of user ids plus a human label. Facts-derived scopes work over the
 * same `DevelopmentPersonFacts` the command-center lanes are built from, so
 * "start reviews from this lane" matches exactly what the lane shows.
 */

import {
  deriveDevelopmentSignals,
  primaryLane,
  LANE_META,
  NEW_PERSON_DAYS,
  type DevelopmentLaneId,
  type DevelopmentPersonFacts,
  type DevelopmentPopulation,
} from "@/lib/development/signals";

export const ROLE_GROUPS = [
  "new-instructors",
  "instructors",
  "chapter-presidents",
  "officers",
] as const;
export type RoleGroup = (typeof ROLE_GROUPS)[number];

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
  "new-instructors": "All new instructors",
  instructors: "All instructors",
  "chapter-presidents": "All chapter presidents",
  officers: "All officers",
};

export type CohortScope =
  | { type: "role-group"; group: RoleGroup }
  | { type: "chapter"; chapterId: string; chapterName?: string }
  | { type: "lane"; lane: DevelopmentLaneId; population: DevelopmentPopulation }
  | { type: "custom"; userIds: string[]; label?: string };

export type ResolvedCohort = {
  userIds: string[];
  label: string;
};

function matchesRoleGroup(facts: DevelopmentPersonFacts, group: RoleGroup): boolean {
  switch (group) {
    case "new-instructors":
      return (
        facts.population === "instructor" && facts.daysSinceJoined <= NEW_PERSON_DAYS
      );
    case "instructors":
      return facts.population === "instructor";
    case "chapter-presidents":
      return facts.role === "CHAPTER_PRESIDENT";
    case "officers":
      return facts.population === "officer";
  }
}

/**
 * Resolve a facts-derived scope against the loaded population. Chapter and
 * custom scopes are resolved DB-side in cycle-actions (they need a query);
 * this function still handles them for completeness (dedupe + label).
 */
export function resolveCohortFromFacts(
  scope: CohortScope,
  people: DevelopmentPersonFacts[]
): ResolvedCohort {
  switch (scope.type) {
    case "role-group": {
      const userIds = people
        .filter((p) => matchesRoleGroup(p, scope.group))
        .map((p) => p.id);
      return { userIds: dedupe(userIds), label: ROLE_GROUP_LABELS[scope.group] };
    }
    case "lane": {
      const userIds = people
        .filter((p) => p.population === scope.population)
        .filter((p) => primaryLane(deriveDevelopmentSignals(p)) === scope.lane)
        .map((p) => p.id);
      const populationLabel =
        scope.population === "officer" ? "officers" : "instructors";
      return {
        userIds: dedupe(userIds),
        label: `${LANE_META[scope.lane].title} — ${populationLabel}`,
      };
    }
    case "chapter":
      return {
        userIds: dedupe(people.map((p) => p.id)),
        label: scope.chapterName ? `${scope.chapterName} chapter` : "Chapter",
      };
    case "custom":
      return {
        userIds: dedupe(scope.userIds),
        label:
          scope.label ??
          `${scope.userIds.length} selected ${scope.userIds.length === 1 ? "person" : "people"}`,
      };
  }
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}
