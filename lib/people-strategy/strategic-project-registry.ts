import { getInitiativeDef, type StrategicInitiativeDef } from "./strategic-initiatives";
import { STRATEGIC_PROJECTS, type StrategicProjectDef } from "./strategic-projects";

/**
 * YPP Execution OS — STRATEGIC PROJECT REGISTRY (Strategic Initiatives 3.0).
 *
 * Pure accessors over the curated {@link STRATEGIC_PROJECTS} config — by id, by
 * parent initiative, by workstream. Mirrors the initiative registry accessors so
 * the project layer reads the same way. No DB, no React; safe in unit tests.
 */

const PROJECT_BY_ID = new Map<string, StrategicProjectDef>(
  STRATEGIC_PROJECTS.map((p) => [p.id, p])
);

/** Canonical detail route for a project. */
export function projectHref(projectId: string): string {
  return `/operations/projects/${projectId}`;
}

/** Every project definition, in registry (curated) order. */
export function listProjectDefs(): StrategicProjectDef[] {
  return STRATEGIC_PROJECTS;
}

/** One project definition by id, or null when unknown. */
export function getProjectDef(id: string): StrategicProjectDef | null {
  return PROJECT_BY_ID.get(id) ?? null;
}

/** The projects belonging to an initiative, in priority then title order. */
export function listProjectsForInitiative(initiativeId: string): StrategicProjectDef[] {
  return STRATEGIC_PROJECTS.filter((p) => p.initiativeId === initiativeId);
}

/** The projects that declare membership in a given workstream of an initiative. */
export function listProjectsForWorkstream(
  initiativeId: string,
  workstreamId: string
): StrategicProjectDef[] {
  return STRATEGIC_PROJECTS.filter(
    (p) => p.initiativeId === initiativeId && (p.workstreamIds ?? []).includes(workstreamId)
  );
}

/** The parent initiative definition for a project, or null. */
export function getParentInitiative(
  project: Pick<StrategicProjectDef, "initiativeId">
): StrategicInitiativeDef | null {
  return getInitiativeDef(project.initiativeId);
}

/**
 * Whether a project's declared relationships are internally consistent: its
 * parent initiative exists and every `workstreamIds` entry is a real workstream
 * of that initiative. Used by the registry integrity test so a typo in config is
 * caught before it ships (it would silently orphan the project otherwise).
 */
export function projectConfigIsValid(project: StrategicProjectDef): boolean {
  const init = getInitiativeDef(project.initiativeId);
  if (!init) return false;
  if (!project.workstreamIds || project.workstreamIds.length === 0) return true;
  const wsIds = new Set((init.workstreams ?? []).map((w) => w.id));
  return project.workstreamIds.every((id) => wsIds.has(id));
}

/** Count of projects per initiative id (for portfolio rollups). */
export function countProjectsByInitiative(): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of STRATEGIC_PROJECTS) {
    out.set(p.initiativeId, (out.get(p.initiativeId) ?? 0) + 1);
  }
  return out;
}
