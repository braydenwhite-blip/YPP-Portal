import {
  actionToMatchable,
  listInitiativeDefs,
  matchesInitiative,
  matchWork,
  meetingToMatchable,
  type MatchableWork,
} from "./strategic-initiatives";
import { listProjectsForInitiative, projectHref } from "./strategic-project-registry";
import { initiativeHref } from "./strategic-timeline";

/**
 * YPP Execution OS — STRATEGIC CONTEXT for a single work item (3.0, Phase F/G).
 *
 * The reverse lookup: given ONE action or meeting, which initiative(s) and
 * project(s) does it ladder up to? This is what lets an action page answer "what
 * project does this belong to, and what does it unlock?" — without any DB column.
 * It reuses the exact 2.0 initiative matcher + the 3.0 project matcher on a single
 * {@link MatchableWork}, so membership stays explainable and consistent with the
 * aggregate views. Pure: no DB, no React.
 */

export type StrategicContextInitiative = {
  id: string;
  title: string;
  href: string;
  /** Why this work matched the initiative (e.g. "keyword 'camp'"). */
  reasons: string[];
};

export type StrategicContextProject = {
  id: string;
  title: string;
  href: string;
  initiativeId: string;
  initiativeTitle: string;
};

export type StrategicWorkContext = {
  /** Matched initiatives, strongest signal first. */
  initiatives: StrategicContextInitiative[];
  /** Matched projects within those initiatives. */
  projects: StrategicContextProject[];
  /** The strongest-matched initiative, or null. */
  primaryInitiative: StrategicContextInitiative | null;
  /** True when the work ladders up to any initiative or project. */
  isStrategic: boolean;
};

/**
 * Resolve the strategic context of a single work item. Runs every initiative's
 * membership rule (with the same contextual-signal guard as the aggregate views),
 * then each matched initiative's projects. Initiatives are ranked by match score.
 */
export function deriveStrategicContext(work: MatchableWork): StrategicWorkContext {
  const scored: Array<StrategicContextInitiative & { score: number }> = [];
  for (const def of listInitiativeDefs()) {
    const res = matchesInitiative(work, def);
    if (res.matched) {
      scored.push({
        id: def.id,
        title: def.title,
        href: initiativeHref(def.id),
        reasons: res.reasons,
        score: res.score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const projects: StrategicContextProject[] = [];
  for (const init of scored) {
    for (const p of listProjectsForInitiative(init.id)) {
      if (matchWork(work, p.match).matched) {
        projects.push({
          id: p.id,
          title: p.title,
          href: projectHref(p.id),
          initiativeId: init.id,
          initiativeTitle: init.title,
        });
      }
    }
  }

  const initiatives: StrategicContextInitiative[] = scored.map(({ score: _score, ...rest }) => rest);
  return {
    initiatives,
    projects,
    primaryInitiative: initiatives[0] ?? null,
    isStrategic: initiatives.length > 0 || projects.length > 0,
  };
}

/** Strategic context for an action item (uses its title/description/goalCategory). */
export function deriveStrategicContextForAction(action: {
  title: string;
  description?: string | null;
  goalCategory?: string | null;
  actionType?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): StrategicWorkContext {
  return deriveStrategicContext(actionToMatchable(action));
}

/** Strategic context for a meeting (uses its title/purpose/category). */
export function deriveStrategicContextForMeeting(meeting: {
  title: string;
  purpose?: string | null;
  category?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): StrategicWorkContext {
  return deriveStrategicContext(meetingToMatchable(meeting));
}
