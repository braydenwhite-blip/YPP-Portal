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
  COMPLETE_ONBOARDING: 50,
  ENROLL_COURSE: 25,
  COMPLETE_COURSE: 100,
  COMPLETE_PATHWAY: 500,
  ATTEND_EVENT: 30,
  SET_GOAL: 15,
  MENTOR_FEEDBACK: 20,
  SUBMIT_REFLECTION: 25,
  FIRST_LOGIN: 10,
} as const;

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
