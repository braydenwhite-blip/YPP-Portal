// Shared XP/Level config — importable by both client and server

export interface LevelDef {
  level: number;
  xpRequired: number;
  title: string;
}

export const LEVELS: LevelDef[] = [
  { level: 1, xpRequired: 0, title: "Explorer" },
  { level: 2, xpRequired: 100, title: "Learner" },
  { level: 3, xpRequired: 300, title: "Scholar" },
  { level: 4, xpRequired: 600, title: "Achiever" },
  { level: 5, xpRequired: 1000, title: "Champion" },
  { level: 6, xpRequired: 1500, title: "Leader" },
  { level: 7, xpRequired: 2500, title: "Visionary" },
  { level: 8, xpRequired: 4000, title: "Legend" },
];

export const XP_REWARDS = {
  // Student milestones
  COMPLETE_ONBOARDING: 50,
  ENROLL_COURSE: 25,
  COMPLETE_COURSE: 100,
  COMPLETE_PATHWAY: 500,
  ATTEND_EVENT: 30,
  SET_GOAL: 15,
  MENTOR_FEEDBACK: 20,
  SUBMIT_REFLECTION: 25,
  FIRST_LOGIN: 10,
  // Instructor milestones
  COMPLETE_INSTRUCTOR_TRAINING: 200,
  PASS_INTERVIEW_GATE: 150,
  UNLOCK_LEVEL_201: 300,
  UNLOCK_LEVEL_301: 500,
  UNLOCK_LEVEL_401: 800,
  TEACH_FIRST_CLASS: 100,
  TEACH_10_CLASSES: 250,
  MENTOR_5_STUDENTS: 200,
  CURRICULUM_APPROVED: 75,
} as const;

// Instructor milestone definitions (for badge display)
export interface InstructorMilestone {
  key: keyof typeof XP_REWARDS;
  label: string;
  description: string;
  xp: number;
}

export const INSTRUCTOR_MILESTONES: InstructorMilestone[] = [
  {
    key: "COMPLETE_INSTRUCTOR_TRAINING",
    label: "Training Complete",
    description: "Finished all required Training Academy modules",
    xp: XP_REWARDS.COMPLETE_INSTRUCTOR_TRAINING,
  },
  {
    key: "PASS_INTERVIEW_GATE",
    label: "Interview Passed",
    description: "Passed the instructor interview gate",
    xp: XP_REWARDS.PASS_INTERVIEW_GATE,
  },
  {
    key: "TEACH_FIRST_CLASS",
    label: "First Class Taught",
    description: "Published and launched your first class offering",
    xp: XP_REWARDS.TEACH_FIRST_CLASS,
  },
  {
    key: "UNLOCK_LEVEL_201",
    label: "Level 201 Unlocked",
    description: "Earned permission to teach 200-level courses",
    xp: XP_REWARDS.UNLOCK_LEVEL_201,
  },
  {
    key: "UNLOCK_LEVEL_301",
    label: "Level 301 Unlocked",
    description: "Earned permission to teach 300-level courses",
    xp: XP_REWARDS.UNLOCK_LEVEL_301,
  },
  {
    key: "UNLOCK_LEVEL_401",
    label: "Level 401 Unlocked",
    description: "Reached Expert Instructor status",
    xp: XP_REWARDS.UNLOCK_LEVEL_401,
  },
  {
    key: "TEACH_10_CLASSES",
    label: "10 Classes Taught",
    description: "Published 10 or more class offerings",
    xp: XP_REWARDS.TEACH_10_CLASSES,
  },
  {
    key: "MENTOR_5_STUDENTS",
    label: "5 Students Mentored",
    description: "Actively mentored 5 or more students",
    xp: XP_REWARDS.MENTOR_5_STUDENTS,
  },
  {
    key: "CURRICULUM_APPROVED",
    label: "Curriculum Approved",
    description: "Had a curriculum reviewed and approved",
    xp: XP_REWARDS.CURRICULUM_APPROVED,
  },
];

export function getLevelForXp(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) {
      current = lvl;
    } else {
      break;
    }
  }
  const nextLevel = LEVELS.find((l) => l.level === current.level + 1);
  const xpIntoLevel = xp - current.xpRequired;
  const xpForNextLevel = nextLevel
    ? nextLevel.xpRequired - current.xpRequired
    : 0;
  const progress = xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 1;

  return {
    level: current.level,
    title: current.title,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    progress,
    nextLevel: nextLevel ?? null,
  };
}
