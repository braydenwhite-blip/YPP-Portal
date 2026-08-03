import "server-only";

import {
  TRACKS,
  getRole,
  getNextRole,
  type PathwayCompetency,
} from "@/lib/growth-pathway";
import {
  dualBandBulletsForProgressGoal,
  resolveProgressRubricContext,
} from "@/lib/mentorship/progress-rubric";

export type GrCompetencyRow = {
  competencyId: string;
  number: number;
  title: string;
  oneLiner: string;
  currentLabel: string;
  nextLabel: string | null;
  currentBullets: string[];
  nextBullets: string[];
  /** Role-specific examples (mentor-authored); newline-separated bullets. */
  roleExamples: string;
  /** Existing GRDocumentGoal id when matched. */
  goalId: string | null;
};

function matchCompetencyGoal(
  title: string,
  goals: Array<{ id: string; title: string; description: string; kind?: string }>,
) {
  const t = title.trim().toLowerCase();
  const matches = goals.filter((g) => {
    const gt = g.title.trim().toLowerCase();
    return gt === t || gt.includes(t) || t.includes(gt);
  });
  // Only COMPETENCY rows hold mentor role-examples. Monthly GOAL rows may share
  // a title with a competency but store different content.
  return matches.find((g) => g.kind === "COMPETENCY") ?? null;
}

/**
 * Build the G&R competency expectations grid for a mentee's band,
 * optionally joining saved role-specific examples from their GR document.
 */
export function buildGrCompetencyRows(input: {
  primaryRole: string | null;
  title?: string | null;
  goals?: Array<{ id: string; title: string; description: string; kind?: string }>;
}): {
  rubricLabel: string;
  currentLevelHeading: string;
  nextLevelHeading: string;
  rows: GrCompetencyRow[];
} {
  const rubric = resolveProgressRubricContext({
    primaryRole: input.primaryRole,
    title: input.title ?? null,
  });
  const track = TRACKS[rubric.trackId];
  const role = getRole(track, rubric.roleId);
  const next = role ? getNextRole(track, role.id) : null;

  let currentLevelHeading = `${rubric.displayLabel} level expectations`;
  let nextLevelHeading = next?.label
    ? `${next.label} level expectations`
    : "Next level expectations";
  if (role?.id === "MANAGER") {
    // Manager band also covers Senior Manager; promotion column is Director.
    if (!input.title?.trim().toLowerCase().includes("senior manager")) {
      currentLevelHeading = "Manager level expectations";
    }
    nextLevelHeading = next?.label
      ? `${next.label} level expectations`
      : "Senior Manager / Director level expectations";
  }

  const goals = input.goals ?? [];
  const rows: GrCompetencyRow[] = track.competencies.map((c: PathwayCompetency) => {
    const dual = dualBandBulletsForProgressGoal({
      title: c.title,
      description: null,
      trackId: rubric.trackId,
      roleId: rubric.roleId,
    });
    const oneLiner =
      c.oneLiner ||
      dual.oneLiner ||
      dual.currentBullets[0] ||
      "Expectation for this competency.";
    const matched = matchCompetencyGoal(c.title, goals);

    return {
      competencyId: c.id,
      number: c.number,
      title: c.title,
      oneLiner,
      currentLabel: dual.currentLabel,
      nextLabel: dual.nextLabel,
      currentBullets: dual.currentBullets,
      nextBullets: dual.nextBullets,
      roleExamples: matched?.description?.trim() ?? "",
      goalId: matched?.id ?? null,
    };
  });

  const rubricLabel = formatRubricLabel(rubric);

  return {
    rubricLabel,
    currentLevelHeading,
    nextLevelHeading,
    rows,
  };
}

function formatRubricLabel(rubric: {
  trackLabel: string;
  displayLabel: string;
  roleLabel: string;
  roleSubtitle: string | null;
}): string {
  const level = rubric.displayLabel;
  const subtitle = rubric.roleSubtitle?.trim() || null;
  // Skip redundant parentheticals like "Officer (Officer)".
  if (
    !subtitle ||
    subtitle.toLowerCase() === level.toLowerCase() ||
    subtitle.toLowerCase() === rubric.roleLabel.toLowerCase()
  ) {
    return `${rubric.trackLabel} · ${level}`;
  }
  return `${rubric.trackLabel} · ${level} (${subtitle})`;
}
