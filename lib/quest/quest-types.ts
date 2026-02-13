// ═══════════════════════════════════════════════════════════════
// Quest Engine — Data Model (Step 25)
// Defines all quest-related types for the personalized quest system
// ═══════════════════════════════════════════════════════════════

/** Quest slot types: how often they refresh */
export type QuestCadence = "daily" | "weekly" | "explore";

/** The six quest archetypes */
export type QuestType = "learn" | "practice" | "build" | "reflect" | "collab" | "explore";

/** Difficulty tier */
export type QuestDifficulty = "easy" | "medium" | "hard";

/** Quest status lifecycle */
export type QuestStatus = "active" | "completed" | "skipped" | "expired";

/** A single quest slot on the board */
export interface Quest {
  id: string;
  templateId: string;
  title: string;
  description: string;
  type: QuestType;
  cadence: QuestCadence;
  difficulty: QuestDifficulty;
  xpReward: number;
  /** Why this quest was picked for the student */
  reason: string;
  /** Related passion area (null = general) */
  passionArea: string | null;
  /** When this quest was assigned */
  assignedAt: string; // ISO date
  /** Expiry: daily = end of day, weekly = end of week */
  expiresAt: string; // ISO date
  /** Current status */
  status: QuestStatus;
  /** Completed timestamp */
  completedAt: string | null;
  /** Optional reflection prompt for learning outcome */
  reflectionPrompt: string | null;
  /** Student's reflection response */
  reflectionResponse: string | null;
}

/** Student's quest profile — drives personalization */
export interface QuestProfile {
  /** Student's passion interests (from DB) */
  interests: string[];
  /** Student's global level (1-8) */
  level: number;
  /** Current active streak (consecutive days with quest activity) */
  streak: number;
  /** Preferred quest types based on completion history */
  preferredTypes: QuestType[];
  /** Types the student tends to skip (avoid over-assigning) */
  avoidedTypes: QuestType[];
  /** Number of recent completions (last 7 days) */
  recentCompletions: number;
  /** Total quests ever completed */
  totalCompleted: number;
}

/** A completed/skipped/expired quest in history */
export interface QuestHistoryEntry {
  questId: string;
  templateId: string;
  type: QuestType;
  status: QuestStatus;
  xpEarned: number;
  timestamp: string; // ISO date
  reflectionResponse: string | null;
}

/** Full quest board state — persisted in localStorage on client */
export interface QuestBoardState {
  /** Currently active quests on the board */
  quests: Quest[];
  /** When daily quests were last refreshed (ISO date) */
  dailyRefreshedAt: string;
  /** When weekly quests were last refreshed (ISO date) */
  weeklyRefreshedAt: string;
  /** Quest history (last 50 entries) */
  history: QuestHistoryEntry[];
  /** Derived profile for personalization */
  profile: QuestProfile;
  /** Schema version for future migrations */
  version: number;
}

/** Slot configuration: how many of each cadence */
export const QUEST_SLOTS = {
  daily: 3,
  weekly: 2,
  explore: 1,
} as const;

/** XP rewards by difficulty */
export const QUEST_XP = {
  easy: { daily: 15, weekly: 40, explore: 25 },
  medium: { daily: 25, weekly: 60, explore: 40 },
  hard: { daily: 40, weekly: 100, explore: 60 },
} as const;

/** Board state version */
export const BOARD_VERSION = 1;
