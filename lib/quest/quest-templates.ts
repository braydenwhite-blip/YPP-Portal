// ═══════════════════════════════════════════════════════════════
// Quest Templates + Rules (Step 26)
// Template pool organized by type, with difficulty constraints
// ═══════════════════════════════════════════════════════════════

import type { QuestType, QuestDifficulty, QuestCadence } from "./quest-types";

/** A quest template — the blueprint from which active quests are generated */
export interface QuestTemplate {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  difficulty: QuestDifficulty;
  /** Which cadences this template is valid for */
  validCadences: QuestCadence[];
  /** Minimum student level required (1-8) */
  minLevel: number;
  /** If set, this quest is passion-specific (null = any passion) */
  passionSpecific: boolean;
  /** Reflection prompt shown after completion */
  reflectionPrompt: string | null;
  /** Tags for filtering/matching */
  tags: string[];
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE POOL — organized by quest type
// ═══════════════════════════════════════════════════════════════

const LEARN_TEMPLATES: QuestTemplate[] = [
  {
    id: "learn-watch-video",
    type: "learn",
    title: "Watch a Lesson",
    description: "Complete one video lesson in any of your enrolled courses.",
    difficulty: "easy",
    validCadences: ["daily"],
    minLevel: 1,
    passionSpecific: false,
    reflectionPrompt: "What was the most surprising thing you learned?",
    tags: ["course", "video"],
  },
  {
    id: "learn-read-article",
    type: "learn",
    title: "Read & Summarize",
    description: "Read an article related to one of your passions and write a one-sentence summary.",
    difficulty: "easy",
    validCadences: ["daily"],
    minLevel: 1,
    passionSpecific: true,
    reflectionPrompt: "How does this connect to something you already knew?",
    tags: ["reading", "summary"],
  },
  {
    id: "learn-deep-dive",
    type: "learn",
    title: "Deep Dive Session",
    description: "Spend 30 minutes studying a topic in your passion area. Take notes on 3 key takeaways.",
    difficulty: "medium",
    validCadences: ["daily", "weekly"],
    minLevel: 2,
    passionSpecific: true,
    reflectionPrompt: "What questions do you still have after this deep dive?",
    tags: ["study", "notes"],
  },
  {
    id: "learn-course-module",
    type: "learn",
    title: "Complete a Course Module",
    description: "Finish an entire module in one of your enrolled courses.",
    difficulty: "hard",
    validCadences: ["weekly"],
    minLevel: 2,
    passionSpecific: false,
    reflectionPrompt: "Rate your understanding of this module from 1-5 and explain why.",
    tags: ["course", "module"],
  },
  {
    id: "learn-teach-back",
    type: "learn",
    title: "Teach It Back",
    description: "Explain a concept you recently learned to someone else (or write it as if you were teaching).",
    difficulty: "medium",
    validCadences: ["weekly"],
    minLevel: 3,
    passionSpecific: true,
    reflectionPrompt: "What was hardest to explain? That's probably where you need more practice.",
    tags: ["teaching", "mastery"],
  },
];

const PRACTICE_TEMPLATES: QuestTemplate[] = [
  {
    id: "practice-daily-drill",
    type: "practice",
    title: "Daily Practice",
    description: "Spend 15 minutes practicing a skill in your passion area.",
    difficulty: "easy",
    validCadences: ["daily"],
    minLevel: 1,
    passionSpecific: true,
    reflectionPrompt: "What felt easier today compared to last time?",
    tags: ["practice", "skill"],
  },
  {
    id: "practice-challenge",
    type: "practice",
    title: "Skill Challenge",
    description: "Attempt a skill challenge at your current level or one level above.",
    difficulty: "medium",
    validCadences: ["daily", "weekly"],
    minLevel: 2,
    passionSpecific: true,
    reflectionPrompt: "Did you push past your comfort zone? How did it feel?",
    tags: ["challenge", "growth"],
  },
  {
    id: "practice-streak",
    type: "practice",
    title: "Practice Streak",
    description: "Practice your passion for 20 minutes every day this week (5 out of 7 days).",
    difficulty: "hard",
    validCadences: ["weekly"],
    minLevel: 2,
    passionSpecific: true,
    reflectionPrompt: "What strategies helped you stay consistent?",
    tags: ["streak", "consistency"],
  },
  {
    id: "practice-new-technique",
    type: "practice",
    title: "Try a New Technique",
    description: "Learn and practice one new technique or method in your passion area.",
    difficulty: "medium",
    validCadences: ["daily", "weekly"],
    minLevel: 3,
    passionSpecific: true,
    reflectionPrompt: "Will you add this technique to your regular practice? Why or why not?",
    tags: ["technique", "exploration"],
  },
];

const BUILD_TEMPLATES: QuestTemplate[] = [
  {
    id: "build-mini-project",
    type: "build",
    title: "Mini Project",
    description: "Create something small related to your passion — a sketch, a code snippet, a recipe, a poem, etc.",
    difficulty: "medium",
    validCadences: ["daily", "weekly"],
    minLevel: 2,
    passionSpecific: true,
    reflectionPrompt: "What would you improve if you had more time?",
    tags: ["project", "creation"],
  },
  {
    id: "build-portfolio-piece",
    type: "build",
    title: "Portfolio Piece",
    description: "Work on a project that you'd be proud to show others. Spend at least 1 hour.",
    difficulty: "hard",
    validCadences: ["weekly"],
    minLevel: 3,
    passionSpecific: true,
    reflectionPrompt: "What skills did you use or develop while building this?",
    tags: ["portfolio", "showcase"],
  },
  {
    id: "build-remix",
    type: "build",
    title: "Remix & Improve",
    description: "Take something you've made before and make it better, or combine two ideas into something new.",
    difficulty: "medium",
    validCadences: ["weekly"],
    minLevel: 2,
    passionSpecific: true,
    reflectionPrompt: "How is the new version different from the original?",
    tags: ["iteration", "improvement"],
  },
  {
    id: "build-quick-prototype",
    type: "build",
    title: "Quick Prototype",
    description: "Spend 10 minutes creating a rough draft or prototype of an idea. Don't worry about perfection!",
    difficulty: "easy",
    validCadences: ["daily"],
    minLevel: 1,
    passionSpecific: true,
    reflectionPrompt: "What's the core idea you were testing?",
    tags: ["prototype", "speed"],
  },
];

const REFLECT_TEMPLATES: QuestTemplate[] = [
  {
    id: "reflect-journal",
    type: "reflect",
    title: "Passion Journal",
    description: "Write 3-5 sentences about what you learned or experienced in your passion today.",
    difficulty: "easy",
    validCadences: ["daily"],
    minLevel: 1,
    passionSpecific: true,
    reflectionPrompt: null, // The quest IS the reflection
    tags: ["journal", "writing"],
  },
  {
    id: "reflect-goals",
    type: "reflect",
    title: "Goal Check-In",
    description: "Review your passion goals. Are you on track? Adjust one goal if needed.",
    difficulty: "easy",
    validCadences: ["weekly"],
    minLevel: 1,
    passionSpecific: false,
    reflectionPrompt: "What's the #1 thing standing between you and your goal?",
    tags: ["goals", "planning"],
  },
  {
    id: "reflect-weekly-review",
    type: "reflect",
    title: "Weekly Review",
    description: "Look back on your week: What went well? What was challenging? What will you do differently?",
    difficulty: "medium",
    validCadences: ["weekly"],
    minLevel: 2,
    passionSpecific: false,
    reflectionPrompt: "Name one thing you're grateful for in your learning journey this week.",
    tags: ["review", "growth"],
  },
  {
    id: "reflect-milestone",
    type: "reflect",
    title: "Milestone Reflection",
    description: "Think about how far you've come. Write about a skill you didn't have a month ago.",
    difficulty: "medium",
    validCadences: ["weekly", "explore"],
    minLevel: 3,
    passionSpecific: true,
    reflectionPrompt: "If you could give advice to yourself from one month ago, what would it be?",
    tags: ["milestone", "growth"],
  },
];

const COLLAB_TEMPLATES: QuestTemplate[] = [
  {
    id: "collab-share",
    type: "collab",
    title: "Share Your Work",
    description: "Share something you've created or learned with a friend, mentor, or your chapter.",
    difficulty: "easy",
    validCadences: ["daily", "weekly"],
    minLevel: 1,
    passionSpecific: false,
    reflectionPrompt: "What feedback did you receive? Was it helpful?",
    tags: ["sharing", "community"],
  },
  {
    id: "collab-feedback",
    type: "collab",
    title: "Give & Get Feedback",
    description: "Give constructive feedback on someone else's work, and ask for feedback on yours.",
    difficulty: "medium",
    validCadences: ["weekly"],
    minLevel: 2,
    passionSpecific: false,
    reflectionPrompt: "What's one piece of feedback you'll act on?",
    tags: ["feedback", "peer"],
  },
  {
    id: "collab-mentor-chat",
    type: "collab",
    title: "Mentor Check-In",
    description: "Have a 10-minute conversation with your mentor about your progress and goals.",
    difficulty: "easy",
    validCadences: ["weekly"],
    minLevel: 1,
    passionSpecific: false,
    reflectionPrompt: "What's one piece of advice your mentor shared that resonated?",
    tags: ["mentor", "guidance"],
  },
  {
    id: "collab-teach",
    type: "collab",
    title: "Help a Fellow Explorer",
    description: "Help someone in your chapter with something you know well. Teaching is the best learning!",
    difficulty: "medium",
    validCadences: ["weekly", "explore"],
    minLevel: 3,
    passionSpecific: false,
    reflectionPrompt: "What did you learn by teaching someone else?",
    tags: ["teaching", "peer"],
  },
];

const EXPLORE_TEMPLATES: QuestTemplate[] = [
  {
    id: "explore-new-area",
    type: "explore",
    title: "Explore Something New",
    description: "Spend 20 minutes learning about a passion area you haven't tried before.",
    difficulty: "easy",
    validCadences: ["explore", "weekly"],
    minLevel: 1,
    passionSpecific: false,
    reflectionPrompt: "Could you see this becoming a new passion? Why or why not?",
    tags: ["discovery", "new"],
  },
  {
    id: "explore-cross-pollinate",
    type: "explore",
    title: "Cross-Pollinate",
    description: "Find a connection between two of your passions. How could they work together?",
    difficulty: "medium",
    validCadences: ["explore", "weekly"],
    minLevel: 2,
    passionSpecific: false,
    reflectionPrompt: "What surprising connection did you find?",
    tags: ["interdisciplinary", "creativity"],
  },
  {
    id: "explore-inspiration",
    type: "explore",
    title: "Inspiration Hunt",
    description: "Find 3 examples of amazing work in one of your passion areas. What makes them great?",
    difficulty: "easy",
    validCadences: ["explore", "daily"],
    minLevel: 1,
    passionSpecific: true,
    reflectionPrompt: "Which example inspired you the most and why?",
    tags: ["inspiration", "research"],
  },
  {
    id: "explore-challenge-yourself",
    type: "explore",
    title: "Stretch Challenge",
    description: "Attempt something in your passion area that feels slightly beyond your current ability.",
    difficulty: "hard",
    validCadences: ["explore"],
    minLevel: 3,
    passionSpecific: true,
    reflectionPrompt: "How did it feel to stretch beyond your comfort zone?",
    tags: ["stretch", "growth"],
  },
];

// ═══════════════════════════════════════════════════════════════
// FULL TEMPLATE POOL
// ═══════════════════════════════════════════════════════════════

export const ALL_TEMPLATES: QuestTemplate[] = [
  ...LEARN_TEMPLATES,
  ...PRACTICE_TEMPLATES,
  ...BUILD_TEMPLATES,
  ...REFLECT_TEMPLATES,
  ...COLLAB_TEMPLATES,
  ...EXPLORE_TEMPLATES,
];

/** Get templates filtered by constraints */
export function getEligibleTemplates(opts: {
  cadence: QuestCadence;
  level: number;
  /** Template IDs to exclude (recently used) */
  excludeIds?: Set<string>;
  /** Preferred types (weighted higher) */
  preferredTypes?: QuestType[];
  /** Types to avoid */
  avoidedTypes?: QuestType[];
}): QuestTemplate[] {
  const { cadence, level, excludeIds, avoidedTypes } = opts;

  return ALL_TEMPLATES.filter((t) => {
    // Must be valid for this cadence
    if (!t.validCadences.includes(cadence)) return false;
    // Must meet level requirement
    if (level < t.minLevel) return false;
    // Exclude recently used
    if (excludeIds?.has(t.id)) return false;
    // Avoid types the student dislikes (soft filter — only if alternatives exist)
    if (avoidedTypes?.includes(t.type)) return false;
    return true;
  });
}

/** Ensure a healthy difficulty mix: at least 1 easy, no more than 1 hard per batch */
export function enforceDifficultyMix(templates: QuestTemplate[], slotCount: number): QuestTemplate[] {
  if (templates.length <= slotCount) return templates;

  const easy = templates.filter((t) => t.difficulty === "easy");
  const medium = templates.filter((t) => t.difficulty === "medium");
  const hard = templates.filter((t) => t.difficulty === "hard");

  const result: QuestTemplate[] = [];

  // Guarantee at least 1 easy quest
  if (easy.length > 0) {
    result.push(easy[Math.floor(Math.random() * easy.length)]);
  }

  // Allow at most 1 hard quest
  if (hard.length > 0 && slotCount >= 3) {
    result.push(hard[Math.floor(Math.random() * hard.length)]);
  }

  // Fill remaining with medium, then any
  const remaining = slotCount - result.length;
  const usedIds = new Set(result.map((t) => t.id));
  const pool = [...medium, ...easy, ...hard].filter((t) => !usedIds.has(t.id));

  for (let i = 0; i < remaining && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return result;
}
