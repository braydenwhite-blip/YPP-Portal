// ═══════════════════════════════════════════════════════════════
// Quest Actions (Step 28 + Step 30)
// Client-side quest board management with localStorage persistence
// Auto-refill, rotation, daily/weekly reset, safe defaults
// ═══════════════════════════════════════════════════════════════

import type {
  Quest,
  QuestBoardState,
  QuestHistoryEntry,
  QuestCadence,
  QuestStatus,
} from "./quest-types";
import { BOARD_VERSION, QUEST_SLOTS } from "./quest-types";
import {
  generateQuestBoard,
  refillSlots,
  buildDefaultProfile,
  buildProfileFromData,
} from "./generate-personal-quests";

const STORAGE_KEY = "passionworld-quest-board";

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

/** Load board state from localStorage */
export function loadQuestBoard(): QuestBoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestBoardState;
    if (parsed.version !== BOARD_VERSION) return null; // version mismatch → regenerate
    return parsed;
  } catch {
    return null;
  }
}

/** Save board state to localStorage */
export function saveQuestBoard(board: QuestBoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch {
    // localStorage full or disabled — continue without persistence
  }
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULING — Daily/Weekly Reset (Step 30)
// ═══════════════════════════════════════════════════════════════

/** Check if we've crossed midnight since last daily refresh */
function needsDailyRefresh(board: QuestBoardState): boolean {
  const lastRefresh = new Date(board.dailyRefreshedAt);
  const now = new Date();
  // Different calendar day (local timezone)
  return (
    lastRefresh.getFullYear() !== now.getFullYear() ||
    lastRefresh.getMonth() !== now.getMonth() ||
    lastRefresh.getDate() !== now.getDate()
  );
}

/** Check if we've crossed Monday midnight since last weekly refresh */
function needsWeeklyRefresh(board: QuestBoardState): boolean {
  const lastRefresh = new Date(board.weeklyRefreshedAt);
  const now = new Date();
  // Get the Monday of each date's week
  const getMonday = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day; // adjust so Monday = 0
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };
  return getMonday(now) > getMonday(lastRefresh);
}

/** Expire stale active quests */
function expireStaleQuests(board: QuestBoardState): void {
  const now = Date.now();
  for (const quest of board.quests) {
    if (quest.status === "active" && new Date(quest.expiresAt).getTime() < now) {
      quest.status = "expired";
      board.history.unshift({
        questId: quest.id,
        templateId: quest.templateId,
        type: quest.type,
        status: "expired",
        xpEarned: 0,
        timestamp: new Date().toISOString(),
        reflectionResponse: null,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ACTIONS
// ═══════════════════════════════════════════════════════════════

/** Initialize or refresh the quest board. Always returns a valid board (never empty). */
export function refreshQuestBoard(opts?: {
  interests?: string[];
  level?: number;
}): QuestBoardState {
  let board = loadQuestBoard();

  // Build/update profile
  const interests = opts?.interests ?? board?.profile.interests ?? [];
  const level = opts?.level ?? board?.profile.level ?? 1;
  const history = board?.history ?? [];
  const profile = history.length > 0
    ? buildProfileFromData({ interests, level, history })
    : buildDefaultProfile();
  profile.interests = interests;
  profile.level = level;

  // No existing board → generate fresh
  if (!board) {
    board = generateQuestBoard(profile, history);
    saveQuestBoard(board);
    return board;
  }

  // Update profile on existing board
  board.profile = profile;

  // Expire stale quests
  expireStaleQuests(board);

  let changed = false;

  // Daily reset: replace expired/completed daily quests with fresh ones
  if (needsDailyRefresh(board)) {
    const dailyQuests = board.quests.filter((q) => q.cadence === "daily");
    const activeDailies = dailyQuests.filter((q) => q.status === "active");
    // Archive non-active dailies
    const toArchive = dailyQuests.filter((q) => q.status !== "active");
    for (const q of toArchive) {
      if (q.status === "active") q.status = "expired";
    }
    // Remove all dailies and regenerate
    board.quests = board.quests.filter((q) => q.cadence !== "daily");
    // Keep active dailies that haven't expired
    const freshDailies = refillSlots(board, "daily", QUEST_SLOTS.daily);
    board.quests.push(...freshDailies);
    board.dailyRefreshedAt = new Date().toISOString();
    changed = true;

    // Suppress unused variable — activeDailies tracked for future streak logic
    void activeDailies;
    void toArchive;
  }

  // Weekly reset: replace expired/completed weekly quests
  if (needsWeeklyRefresh(board)) {
    board.quests = board.quests.filter((q) => q.cadence !== "weekly");
    const freshWeeklies = refillSlots(board, "weekly", QUEST_SLOTS.weekly);
    board.quests.push(...freshWeeklies);
    board.weeklyRefreshedAt = new Date().toISOString();
    changed = true;
  }

  // Refill explore slot if empty
  const activeExplore = board.quests.filter((q) => q.cadence === "explore" && q.status === "active");
  if (activeExplore.length < QUEST_SLOTS.explore) {
    const needed = QUEST_SLOTS.explore - activeExplore.length;
    const fresh = refillSlots(board, "explore", needed);
    board.quests.push(...fresh);
    changed = true;
  }

  // Trim history to 50
  if (board.history.length > 50) {
    board.history = board.history.slice(0, 50);
    changed = true;
  }

  // Safety: ensure we ALWAYS have the minimum number of quests
  const counts = { daily: 0, weekly: 0, explore: 0 };
  for (const q of board.quests) {
    if (q.status === "active") counts[q.cadence]++;
  }
  for (const cadence of ["daily", "weekly", "explore"] as QuestCadence[]) {
    const needed = QUEST_SLOTS[cadence] - counts[cadence];
    if (needed > 0) {
      const fresh = refillSlots(board, cadence, needed);
      board.quests.push(...fresh);
      changed = true;
    }
  }

  if (changed) {
    saveQuestBoard(board);
  }

  return board;
}

/** Mark a quest as completed, award XP, optionally save reflection */
export function completeQuest(
  questId: string,
  reflection?: string,
): { board: QuestBoardState; quest: Quest | null; xpEarned: number } {
  const board = loadQuestBoard();
  if (!board) {
    return { board: refreshQuestBoard(), quest: null, xpEarned: 0 };
  }

  const quest = board.quests.find((q) => q.id === questId);
  if (!quest || quest.status !== "active") {
    return { board, quest: null, xpEarned: 0 };
  }

  // Complete the quest
  quest.status = "completed";
  quest.completedAt = new Date().toISOString();
  if (reflection) {
    quest.reflectionResponse = reflection;
  }

  // Add to history
  board.history.unshift({
    questId: quest.id,
    templateId: quest.templateId,
    type: quest.type,
    status: "completed",
    xpEarned: quest.xpReward,
    timestamp: new Date().toISOString(),
    reflectionResponse: reflection ?? null,
  });

  // Immediately refill the slot
  const freshQuests = refillSlots(board, quest.cadence, 1);
  board.quests.push(...freshQuests);

  // Update profile stats
  board.profile.recentCompletions++;
  board.profile.totalCompleted++;

  saveQuestBoard(board);
  return { board, quest, xpEarned: quest.xpReward };
}

/** Skip a quest — marks it as skipped and refills the slot */
export function skipQuest(questId: string): QuestBoardState {
  const board = loadQuestBoard();
  if (!board) return refreshQuestBoard();

  const quest = board.quests.find((q) => q.id === questId);
  if (!quest || quest.status !== "active") return board;

  quest.status = "skipped";

  // Add to history
  board.history.unshift({
    questId: quest.id,
    templateId: quest.templateId,
    type: quest.type,
    status: "skipped",
    xpEarned: 0,
    timestamp: new Date().toISOString(),
    reflectionResponse: null,
  });

  // Immediately refill
  const freshQuests = refillSlots(board, quest.cadence, 1);
  board.quests.push(...freshQuests);

  saveQuestBoard(board);
  return board;
}

/** Get only the active quests, grouped by cadence */
export function getActiveQuests(board: QuestBoardState): {
  daily: Quest[];
  weekly: Quest[];
  explore: Quest[];
} {
  const daily: Quest[] = [];
  const weekly: Quest[] = [];
  const explore: Quest[] = [];

  for (const q of board.quests) {
    if (q.status !== "active") continue;
    if (q.cadence === "daily") daily.push(q);
    else if (q.cadence === "weekly") weekly.push(q);
    else explore.push(q);
  }

  return { daily, weekly, explore };
}
