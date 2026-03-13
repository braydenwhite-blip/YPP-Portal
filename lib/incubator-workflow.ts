import type { IncubatorMilestoneStatus, IncubatorPhase } from "@prisma/client";

export const INCUBATOR_PHASES: IncubatorPhase[] = [
  "IDEATION",
  "PLANNING",
  "BUILDING",
  "FEEDBACK",
  "POLISHING",
  "SHOWCASE",
];

export const INCUBATOR_PHASE_LABELS: Record<IncubatorPhase, string> = {
  IDEATION: "Ideation",
  PLANNING: "Planning",
  BUILDING: "Building",
  FEEDBACK: "Feedback",
  POLISHING: "Polishing",
  SHOWCASE: "Showcase",
};

export const INCUBATOR_PHASE_COLORS: Record<IncubatorPhase, string> = {
  IDEATION: "#f97316",
  PLANNING: "#2563eb",
  BUILDING: "#0f766e",
  FEEDBACK: "#d97706",
  POLISHING: "#be185d",
  SHOWCASE: "#15803d",
};

export const INCUBATOR_PHASE_DESCRIPTIONS: Record<IncubatorPhase, string> = {
  IDEATION: "Turn the first spark into a clear problem, audience, and project direction.",
  PLANNING: "Choose the first version, timeline, and support you need to build with confidence.",
  BUILDING: "Make the thing. Share visible progress every week so momentum stays strong.",
  FEEDBACK: "Put the work in front of other people and collect the clearest next improvements.",
  POLISHING: "Refine the work, sharpen the story, and prepare launch assets that feel proud and public-ready.",
  SHOWCASE: "Ship the launch page, final links, and presentation materials for the public reveal.",
};

export type DefaultMilestoneSeed = {
  phase: IncubatorPhase;
  title: string;
  description: string;
  deliverableLabel?: string;
  dueDayOffset: number;
  order: number;
  requiresMentorApproval?: boolean;
};

export const DEFAULT_INCUBATOR_MILESTONE_TEMPLATES: DefaultMilestoneSeed[] = [
  {
    phase: "IDEATION",
    title: "Define the problem worth solving",
    description: "Write down the real-world problem, who it matters to, and why you care enough to build this.",
    deliverableLabel: "Problem + audience brief",
    dueDayOffset: 3,
    order: 1,
  },
  {
    phase: "IDEATION",
    title: "Shape the first concept",
    description: "Capture the first version of the idea, inspiration, and what success could look like.",
    deliverableLabel: "Concept sketch or idea map",
    dueDayOffset: 6,
    order: 2,
  },
  {
    phase: "IDEATION",
    title: "Mentor kickoff",
    description: "Meet with your mentor and confirm the project direction before moving into planning.",
    deliverableLabel: "Mentor kickoff summary",
    dueDayOffset: 8,
    order: 3,
    requiresMentorApproval: true,
  },
  {
    phase: "PLANNING",
    title: "Choose the version one launch",
    description: "Narrow the project to the smallest strong version you can actually launch this cohort.",
    deliverableLabel: "Version one scope",
    dueDayOffset: 12,
    order: 1,
  },
  {
    phase: "PLANNING",
    title: "Build the roadmap",
    description: "Break the work into milestones with dates, risks, and support needs.",
    deliverableLabel: "Milestone roadmap",
    dueDayOffset: 16,
    order: 2,
  },
  {
    phase: "PLANNING",
    title: "Planning review",
    description: "Review the roadmap with your mentor so the project is realistic and launchable.",
    deliverableLabel: "Approved build plan",
    dueDayOffset: 20,
    order: 3,
    requiresMentorApproval: true,
  },
  {
    phase: "BUILDING",
    title: "Weekly build check-in",
    description: "Post a visible update that shows what changed this week and what is blocked.",
    deliverableLabel: "Weekly build update",
    dueDayOffset: 27,
    order: 1,
  },
  {
    phase: "BUILDING",
    title: "Working prototype",
    description: "Reach the first version that someone else can actually try, watch, hear, or review.",
    deliverableLabel: "Prototype link or demo",
    dueDayOffset: 35,
    order: 2,
  },
  {
    phase: "BUILDING",
    title: "Mentor build review",
    description: "Get mentor approval that the project is ready to enter feedback rounds.",
    deliverableLabel: "Mentor build review",
    dueDayOffset: 40,
    order: 3,
    requiresMentorApproval: true,
  },
  {
    phase: "FEEDBACK",
    title: "Collect outside feedback",
    description: "Share the project with people outside yourself and collect clear strengths and next fixes.",
    deliverableLabel: "Feedback notes",
    dueDayOffset: 47,
    order: 1,
  },
  {
    phase: "FEEDBACK",
    title: "Choose the top improvements",
    description: "Turn the feedback into a focused list of changes that will most improve the launch.",
    deliverableLabel: "Improvement plan",
    dueDayOffset: 51,
    order: 2,
  },
  {
    phase: "POLISHING",
    title: "Refine the final experience",
    description: "Apply the most important fixes and tighten the user or audience experience.",
    deliverableLabel: "Polished build update",
    dueDayOffset: 58,
    order: 1,
  },
  {
    phase: "POLISHING",
    title: "Prepare launch assets",
    description: "Gather the launch story, visuals, links, and pitch assets for the public release.",
    deliverableLabel: "Launch assets pack",
    dueDayOffset: 63,
    order: 2,
  },
  {
    phase: "POLISHING",
    title: "Launch readiness review",
    description: "Get mentor confirmation that the project is ready for the public launch review.",
    deliverableLabel: "Launch readiness sign-off",
    dueDayOffset: 66,
    order: 3,
    requiresMentorApproval: true,
  },
  {
    phase: "SHOWCASE",
    title: "Submit the launch page",
    description: "Complete the public story, links, and launch page draft for approval.",
    deliverableLabel: "Launch page submission",
    dueDayOffset: 70,
    order: 1,
  },
  {
    phase: "SHOWCASE",
    title: "Final presentation package",
    description: "Prepare the final pitch video, deck, or presentation materials for demo day.",
    deliverableLabel: "Presentation package",
    dueDayOffset: 72,
    order: 2,
  },
];

export function buildLaunchSlug(title: string, studentName?: string | null): string {
  const source = `${title}${studentName ? `-${studentName}` : ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return source || "incubator-launch";
}

export function getDefaultMilestonesForCohort() {
  return DEFAULT_INCUBATOR_MILESTONE_TEMPLATES.map((template) => ({
    ...template,
    requiresMentorApproval: template.requiresMentorApproval ?? false,
  }));
}

export function isMilestoneComplete(status: IncubatorMilestoneStatus): boolean {
  return status === "APPROVED";
}

export function canAdvancePhase(
  phase: IncubatorPhase,
  milestones: Array<{
    phase: IncubatorPhase;
    status: IncubatorMilestoneStatus;
    requiredForPhase: boolean;
  }>
): boolean {
  const currentPhaseMilestones = milestones.filter(
    (milestone) => milestone.phase === phase && milestone.requiredForPhase
  );

  if (currentPhaseMilestones.length === 0) {
    return false;
  }

  return currentPhaseMilestones.every((milestone) => isMilestoneComplete(milestone.status));
}

export function getNextPendingMilestone<T extends {
  phase: IncubatorPhase;
  status: IncubatorMilestoneStatus;
  order: number;
}>(milestones: T[]): T | null {
  const sorted = [...milestones].sort((a, b) => {
    const phaseOrder = INCUBATOR_PHASES.indexOf(a.phase) - INCUBATOR_PHASES.indexOf(b.phase);
    if (phaseOrder !== 0) return phaseOrder;
    return a.order - b.order;
  });

  return sorted.find((milestone) => !isMilestoneComplete(milestone.status)) ?? null;
}

export function getPhaseProgress(
  phase: IncubatorPhase,
  milestones: Array<{
    phase: IncubatorPhase;
    status: IncubatorMilestoneStatus;
    requiredForPhase: boolean;
  }>
) {
  const relevant = milestones.filter(
    (milestone) => milestone.phase === phase && milestone.requiredForPhase
  );

  if (relevant.length === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const completed = relevant.filter((milestone) => isMilestoneComplete(milestone.status)).length;
  return {
    completed,
    total: relevant.length,
    percent: Math.round((completed / relevant.length) * 100),
  };
}
