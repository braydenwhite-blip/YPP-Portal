import { isActionTrackerEnabled } from "@/lib/feature-flags";

import { type ActionViewer } from "./action-permissions";
import { loadDigestInputs, type DigestInputs } from "./operational-digest-queries";
import {
  deriveInitiativeSummary,
  selectInitiativesNeedingAttention,
  selectUpcomingMilestones,
  classifyInitiativeWork,
  type InitiativeSummary,
  type UpcomingMilestone,
} from "./strategic-initiative-summary";
import {
  getInitiativeDef,
  listInitiativeDefs,
  type StrategicInitiativeDef,
} from "./strategic-initiatives";
import {
  deriveInitiativeMilestones,
  type InitiativeMilestoneSummary,
} from "./strategic-milestones";
import {
  getProjectDef,
  listProjectDefs,
  listProjectsForInitiative,
} from "./strategic-project-registry";
import type { StrategicProjectDef } from "./strategic-projects";
import {
  classifyProjectWork,
  compareProjectsByConcern,
  deriveProjectDossier,
  deriveProjectPortfolioStats,
  deriveProjectSummary,
  selectBlockedProjects,
  selectFastestProjects,
  selectProjectsNeedingAttention,
  selectStaleProjects,
  selectUnownedProjects,
  type ProjectDossier,
  type ProjectPortfolioStats,
  type ProjectSummary,
} from "./strategic-project-summary";

/**
 * YPP Execution OS — STRATEGIC PROJECT QUERIES (3.0, Phase A/B/C/D).
 *
 * The single batched read layer for the project surfaces + the Command Center's
 * Strategic Command cockpit. It introduces NO second source of truth: it REUSES
 * the operational-digest read ({@link loadDigestInputs}) and classifies that
 * already-loaded work into the config-defined initiatives → projects in memory.
 * One read, no N+1.
 *
 * Always call from an officer-gated surface (actions are visibility-filtered via
 * the viewer; the meeting reads are officer-gated at the page guard). Every
 * function fails safe (empty pool) when the tracker flag is off.
 */

function emptyPool(): DigestInputs {
  return { actions: [], meetings: [], decisions: [], labels: new Map() };
}

async function loadPool(viewer: ActionViewer, now: Date): Promise<DigestInputs> {
  if (!isActionTrackerEnabled()) return emptyPool();
  return loadDigestInputs(viewer, now).catch(() => emptyPool());
}

export type StrategicProjectQueryOptions = { now?: Date };

// --- shared derivation -------------------------------------------------------

/**
 * Derive every project summary from a single shared pool. Two passes: pass 1
 * derives summaries to learn which projects are unhealthy; pass 2 re-derives the
 * projects whose declared `dependsOn` references an unhealthy sibling so their
 * declared dependency is honestly flagged at-risk. Pure given the pool.
 */
export function deriveAllProjectSummaries(
  pool: DigestInputs,
  now: Date
): ProjectSummary[] {
  // Cache parent-initiative classification + milestones (keyed by initiative id).
  const initWork = new Map<string, ReturnType<typeof classifyInitiativeWork>>();
  const initMilestones = new Map<string, InitiativeMilestoneSummary[]>();

  function parentWork(init: StrategicInitiativeDef) {
    let w = initWork.get(init.id);
    if (!w) {
      w = classifyInitiativeWork(init, pool);
      initWork.set(init.id, w);
    }
    return w;
  }
  function parentMilestones(init: StrategicInitiativeDef) {
    let m = initMilestones.get(init.id);
    if (!m) {
      const w = parentWork(init);
      m = deriveInitiativeMilestones({
        def: init,
        actions: w.actions,
        meetings: w.meetings,
        decisions: w.decisions,
        now,
      });
      initMilestones.set(init.id, m);
    }
    return m;
  }

  function linkedMilestonesFor(def: StrategicProjectDef, init: StrategicInitiativeDef) {
    if (!def.workstreamIds || def.workstreamIds.length === 0) return [];
    const ids = new Set(
      init.milestones
        .filter((m) => m.workstreamId && def.workstreamIds!.includes(m.workstreamId))
        .map((m) => m.id)
    );
    return parentMilestones(init).filter((m) => ids.has(m.id));
  }

  function derive(def: StrategicProjectDef, dependencyAtRisk: boolean): ProjectSummary | null {
    const init = getInitiativeDef(def.initiativeId);
    if (!init) return null;
    const work = classifyProjectWork(def, parentWork(init));
    return deriveProjectSummary({
      def,
      initiative: init,
      actions: work.actions,
      meetings: work.meetings,
      decisions: work.decisions,
      labels: pool.labels,
      linkedMilestones: linkedMilestonesFor(def, init),
      dependencyAtRisk,
      now,
    });
  }

  // Pass 1.
  const pass1 = listProjectDefs()
    .map((def) => derive(def, false))
    .filter((s): s is ProjectSummary => !!s);

  const unhealthyTitles = new Set(
    pass1
      .filter((p) => p.health.level === "at_risk" || p.health.level === "critical")
      .map((p) => p.title.toLowerCase())
  );

  // Pass 2 — only re-derive projects whose declared dependency is now at-risk.
  return pass1
    .map((summary) => {
      const def = getProjectDef(summary.id)!;
      const atRisk = (def.dependsOn ?? []).some((dep) => unhealthyTitles.has(dep.toLowerCase()));
      if (!atRisk) return summary;
      return derive(def, true) ?? summary;
    })
    .sort(compareProjectsByConcern);
}

// --- public reads ------------------------------------------------------------

/** Every project's derived summary, worst-concern first. Officer-gate caller. */
export async function getStrategicProjectsOverview(
  viewer: ActionViewer,
  options: StrategicProjectQueryOptions = {}
): Promise<ProjectSummary[]> {
  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);
  return deriveAllProjectSummaries(pool, now);
}

/** One project's complete dossier, or null when the id is unknown. Officer-gate. */
export async function getStrategicProjectDossier(
  projectId: string,
  viewer: ActionViewer,
  options: StrategicProjectQueryOptions = {}
): Promise<ProjectDossier | null> {
  const def = getProjectDef(projectId);
  if (!def) return null;
  const init = getInitiativeDef(def.initiativeId);
  if (!init) return null;

  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);

  const parentWork = classifyInitiativeWork(init, pool);
  const work = classifyProjectWork(def, parentWork);

  const linkedMilestones = (() => {
    if (!def.workstreamIds || def.workstreamIds.length === 0) return [];
    const ids = new Set(
      init.milestones
        .filter((m) => m.workstreamId && def.workstreamIds!.includes(m.workstreamId))
        .map((m) => m.id)
    );
    const all = deriveInitiativeMilestones({
      def: init,
      actions: parentWork.actions,
      meetings: parentWork.meetings,
      decisions: parentWork.decisions,
      now,
    });
    return all.filter((m) => ids.has(m.id));
  })();

  // Flag a declared dependency at-risk if it references an unhealthy sibling.
  const siblings = deriveAllProjectSummaries(pool, now);
  const unhealthyTitles = new Set(
    siblings
      .filter((p) => p.health.level === "at_risk" || p.health.level === "critical")
      .map((p) => p.title.toLowerCase())
  );
  const dependencyAtRisk = (def.dependsOn ?? []).some((dep) =>
    unhealthyTitles.has(dep.toLowerCase())
  );

  return deriveProjectDossier({
    def,
    initiative: init,
    actions: work.actions,
    meetings: work.meetings,
    decisions: work.decisions,
    labels: pool.labels,
    linkedMilestones,
    dependencyAtRisk,
    now,
  });
}

/** The projects belonging to an initiative, for the initiative detail embed. */
export async function getProjectsForInitiative(
  initiativeId: string,
  viewer: ActionViewer,
  options: StrategicProjectQueryOptions = {}
): Promise<ProjectSummary[]> {
  const defs = listProjectsForInitiative(initiativeId);
  if (defs.length === 0) return [];
  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);
  const all = deriveAllProjectSummaries(pool, now);
  const ids = new Set(defs.map((d) => d.id));
  return all.filter((p) => ids.has(p.id));
}

export type StrategicProjectPortfolioData = {
  generatedAt: Date;
  stats: ProjectPortfolioStats;
  projects: ProjectSummary[];
  needingAttention: ProjectSummary[];
  blocked: ProjectSummary[];
  stale: ProjectSummary[];
  unowned: ProjectSummary[];
  fastest: ProjectSummary[];
  byInitiative: Array<{
    initiativeId: string;
    initiativeTitle: string;
    initiativeHref: string;
    projects: ProjectSummary[];
  }>;
};

/** The project portfolio executive read (index + portfolio board). Officer-gate. */
export async function getStrategicProjectPortfolio(
  viewer: ActionViewer,
  options: StrategicProjectQueryOptions = {}
): Promise<StrategicProjectPortfolioData> {
  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);
  const projects = deriveAllProjectSummaries(pool, now);

  const byInitiativeMap = new Map<string, ProjectSummary[]>();
  for (const p of projects) {
    const list = byInitiativeMap.get(p.initiativeId) ?? [];
    list.push(p);
    byInitiativeMap.set(p.initiativeId, list);
  }
  const byInitiative = [...byInitiativeMap.entries()]
    .map(([initiativeId, list]) => ({
      initiativeId,
      initiativeTitle: list[0]?.initiativeTitle ?? initiativeId,
      initiativeHref: list[0]?.initiativeHref ?? "/operations/initiatives",
      projects: list,
    }))
    .sort((a, b) => b.projects.length - a.projects.length);

  return {
    generatedAt: now,
    stats: deriveProjectPortfolioStats(projects),
    projects,
    needingAttention: selectProjectsNeedingAttention(projects),
    blocked: selectBlockedProjects(projects),
    stale: selectStaleProjects(projects),
    unowned: selectUnownedProjects(projects),
    fastest: selectFastestProjects(projects),
    byInitiative,
  };
}

// --- Command Center: Strategic Command cockpit (Phase D) ---------------------

export type StrategicLeadershipMove = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "watch" | "neutral";
};

export type StrategicCommandData = {
  generatedAt: Date;
  snapshot: {
    initiatives: number;
    projects: number;
    projectsNeedingAttention: number;
    blockedProjects: number;
    overdueStrategicActions: number;
    decisionsNeedingFollowThrough: number;
  };
  initiativesNeedingAttention: InitiativeSummary[];
  projectsNeedingAttention: ProjectSummary[];
  blockedProjects: ProjectSummary[];
  staleProjects: ProjectSummary[];
  unownedProjects: ProjectSummary[];
  upcomingMilestones: UpcomingMilestone[];
  decisionsNeedingFollowThrough: Array<{
    id: string;
    decision: string;
    meetingId: string;
    meetingTitle: string;
    decidedByName: string | null;
    href: string;
  }>;
  recommendedMoves: StrategicLeadershipMove[];
};

/**
 * The Command Center's executive cockpit across initiatives AND projects. One
 * shared pool drives both layers, so the read is consistent and N+1-free. Answers:
 * what matters, what's stuck, who owns what, what needs follow-up this week.
 */
export async function getStrategicCommandData(
  viewer: ActionViewer,
  options: StrategicProjectQueryOptions = {}
): Promise<StrategicCommandData> {
  const now = options.now ?? new Date();
  const pool = await loadPool(viewer, now);

  // Initiative summaries (lightweight — no per-initiative timeline).
  const initiativeSummaries = listInitiativeDefs().map((def) =>
    deriveInitiativeSummary({
      def,
      ...classifyInitiativeWork(def, pool),
      labels: pool.labels,
      now,
      limits: { timeline: 0, keyMoments: 0, recommendations: 0 },
    })
  );

  const projects = deriveAllProjectSummaries(pool, now);

  const initiativesNeedingAttention = selectInitiativesNeedingAttention(initiativeSummaries).slice(0, 5);
  const projectsNeedingAttention = selectProjectsNeedingAttention(projects).slice(0, 6);
  const blockedProjects = selectBlockedProjects(projects).slice(0, 6);
  const staleProjects = selectStaleProjects(projects).slice(0, 5);
  const unownedProjects = selectUnownedProjects(projects).slice(0, 5);
  const upcomingMilestones = selectUpcomingMilestones(initiativeSummaries, now).slice(0, 6);

  const decisionsNeedingFollowThrough = pool.decisions
    .filter((d) => !d.hasLinkedAction)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6)
    .map((d) => ({
      id: d.id,
      decision: d.decision,
      meetingId: d.meetingId,
      meetingTitle: d.meetingTitle,
      decidedByName: d.decidedByName,
      href: `/meetings/${d.meetingId}`,
    }));

  const overdueStrategicActions = projects.reduce((sum, p) => sum + p.counts.overdueActions, 0);

  // Recommended leadership moves — deterministic, worst-first, deduped by kind.
  const recommendedMoves: StrategicLeadershipMove[] = [];
  if (blockedProjects.length > 0) {
    const p = blockedProjects[0];
    recommendedMoves.push({
      id: `unblock:${p.id}`,
      title: `Unblock ${p.title}`,
      detail: p.blockers[0]?.label ?? "Project is blocked.",
      href: p.href,
      severity: "critical",
    });
  }
  if (decisionsNeedingFollowThrough.length > 0) {
    recommendedMoves.push({
      id: "decisions",
      title: "Convert open decisions into action",
      detail: `${decisionsNeedingFollowThrough.length} decision${decisionsNeedingFollowThrough.length === 1 ? "" : "s"} with no follow-through yet.`,
      href: "/operations/command-center",
      severity: "warning",
    });
  }
  if (unownedProjects.length > 0) {
    const p = unownedProjects[0];
    recommendedMoves.push({
      id: `owner:${p.id}`,
      title: `Assign an owner to ${p.title}`,
      detail: p.ownership.reason,
      href: p.href,
      severity: "warning",
    });
  }
  for (const p of projectsNeedingAttention) {
    if (recommendedMoves.length >= 6) break;
    if (recommendedMoves.some((m) => m.id.endsWith(p.id))) continue;
    recommendedMoves.push({
      id: `review:${p.id}`,
      title: `Review ${p.title}`,
      detail: p.statusExplanation.headline,
      href: p.href,
      severity: p.health.level === "critical" ? "critical" : "watch",
    });
  }

  return {
    generatedAt: now,
    snapshot: {
      initiatives: initiativeSummaries.length,
      projects: projects.length,
      projectsNeedingAttention: projectsNeedingAttention.length,
      blockedProjects: blockedProjects.length,
      overdueStrategicActions,
      decisionsNeedingFollowThrough: decisionsNeedingFollowThrough.length,
    },
    initiativesNeedingAttention,
    projectsNeedingAttention,
    blockedProjects,
    staleProjects,
    unownedProjects,
    upcomingMilestones,
    decisionsNeedingFollowThrough,
    recommendedMoves: recommendedMoves.slice(0, 6),
  };
}
