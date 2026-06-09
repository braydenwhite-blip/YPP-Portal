import {
  selectBlockedProjects,
  selectProjectsNeedingAttention,
  selectStaleProjects,
  selectUnownedProjects,
  type ProjectSummary,
} from "./strategic-project-summary";

/**
 * Strategic project attention layer (3.5, Phase C).
 *
 * Pure derivation that turns the already-derived {@link ProjectSummary} into the
 * two things the project board's executive header needs: a single SPECIFIC
 * call-to-action per project (never a generic "View"), and a ranked attention
 * queue answering — for each project leadership should look at first — why it
 * needs attention, what is blocking it, and what the next move is.
 *
 * Reads only fields the summary already computes; adds no new backend concept.
 */

export type ProjectCtaKind =
  | "clear_blocker"
  | "assign_owner"
  | "review_decisions"
  | "create_next_action"
  | "review_project"
  | "open_project";

export type ProjectCta = {
  kind: ProjectCtaKind;
  label: string;
  href: string;
};

const CTA_LABELS: Record<ProjectCtaKind, string> = {
  clear_blocker: "Clear blocker",
  assign_owner: "Assign owner",
  review_decisions: "Review decisions",
  create_next_action: "Create next action",
  review_project: "Review project",
  open_project: "Open project",
};

/**
 * The single most useful action for a project right now, as a specific labeled
 * CTA. Picks the most pressing signal first: an observed blocker, then an owner
 * gap, then decisions without follow-through, then "no next move" (kick it off),
 * then a needed review, otherwise just open it.
 */
export function deriveProjectCta(project: ProjectSummary): ProjectCta {
  const observed = project.blockers.find((b) => b.kind === "observed");
  if (observed) {
    // Send leadership straight to the overdue/blocked work, the same target the
    // derived "Clear the blocker" next move uses.
    const href = project.nextMoves.find((move) => move.id === "unblock")?.href ?? project.href;
    return { kind: "clear_blocker", label: CTA_LABELS.clear_blocker, href };
  }
  if (project.ownership.clarity === "unowned" || project.ownership.clarity === "unclear") {
    return { kind: "assign_owner", label: CTA_LABELS.assign_owner, href: `${project.href}#review` };
  }
  if (project.counts.decisionsWithoutAction > 0) {
    return {
      kind: "review_decisions",
      label: CTA_LABELS.review_decisions,
      href: `${project.href}#decisions`,
    };
  }
  if (!project.hasWork || project.counts.openActions === 0) {
    return {
      kind: "create_next_action",
      label: CTA_LABELS.create_next_action,
      href: project.newActionHref,
    };
  }
  if (project.reviewNeed.needed) {
    return { kind: "review_project", label: CTA_LABELS.review_project, href: `${project.href}#review` };
  }
  return { kind: "open_project", label: CTA_LABELS.open_project, href: project.href };
}

export type ProjectAttentionSeverity = "critical" | "warning" | "watch";

export type ProjectAttentionItem = {
  project: ProjectSummary;
  severity: ProjectAttentionSeverity;
  reason: string;
  blocker: string | null;
  nextMove: string | null;
  cta: ProjectCta;
};

const SEVERITY_RANK: Record<ProjectAttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  watch: 2,
};

function attentionSeverity(project: ProjectSummary): ProjectAttentionSeverity {
  if (project.health.level === "critical") return "critical";
  if (project.blockers.some((b) => b.kind === "observed" && b.severity === "critical")) {
    return "critical";
  }
  if (project.health.level === "at_risk") return "warning";
  if (project.counts.overdueActions > 0) return "warning";
  if (project.blockers.some((b) => b.kind === "observed")) return "warning";
  if (project.reviewNeed.needed && project.reviewNeed.urgency === "now") return "warning";
  return "watch";
}

/** One project's compact attention read: why, what's blocking, next move, CTA. */
export function deriveProjectAttentionItem(project: ProjectSummary): ProjectAttentionItem {
  const blocker = project.blockers[0] ?? null; // already sorted worst-first
  return {
    project,
    severity: attentionSeverity(project),
    reason: project.statusExplanation.headline,
    blocker: blocker ? `${blocker.label} — ${blocker.detail}` : null,
    nextMove: project.nextMoves[0]?.title ?? null,
    cta: deriveProjectCta(project),
  };
}

/**
 * The ranked "look here first" queue: the union of projects that are drifting /
 * at risk / critical, blocked, unowned, or stale — deduped, then ordered worst
 * severity first (then priority, then title for a deterministic result).
 */
export function selectProjectAttentionQueue(
  projects: ProjectSummary[],
  limit = 5,
): ProjectAttentionItem[] {
  const seen = new Map<string, ProjectSummary>();
  for (const project of [
    ...selectProjectsNeedingAttention(projects),
    ...selectBlockedProjects(projects),
    ...selectUnownedProjects(projects),
    ...selectStaleProjects(projects),
  ]) {
    if (!seen.has(project.id)) seen.set(project.id, project);
  }

  const items = [...seen.values()].map(deriveProjectAttentionItem);
  items.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    if (b.project.priorityWeight !== a.project.priorityWeight) {
      return b.project.priorityWeight - a.project.priorityWeight;
    }
    return a.project.title.localeCompare(b.project.title);
  });
  return items.slice(0, limit);
}
