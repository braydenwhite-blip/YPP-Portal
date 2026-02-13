// ═══════════════════════════════════════════════════════════════
// Personal Quest Generator (Step 27)
// Input: profile + history + available content
// Output: always-filled slots: 3 daily, 2 weekly, 1 explore
// Includes fallback defaults if personalization data is missing
// ═══════════════════════════════════════════════════════════════

import type {
  Quest,
  QuestProfile,
  QuestHistoryEntry,
  QuestCadence,
  QuestBoardState,
} from "./quest-types";
import { QUEST_SLOTS, QUEST_XP, BOARD_VERSION } from "./quest-types";
import { getEligibleTemplates, enforceDifficultyMix, ALL_TEMPLATES } from "./quest-templates";
import type { QuestTemplate } from "./quest-templates";

/** Generate a unique quest ID */
function genId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Get ISO string for end of today (local timezone) */
function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Get ISO string for end of this week (next Monday midnight, local) */
function endOfWeek(): string {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Pick a random passion area from the student's interests */
function pickPassionArea(interests: string[]): string | null {
  if (interests.length === 0) return null;
  return interests[Math.floor(Math.random() * interests.length)];
}

/** Build a reason string explaining why this quest was chosen */
function buildReason(template: QuestTemplate, profile: QuestProfile, passionArea: string | null): string {
  if (template.passionSpecific && passionArea) {
    return `Picked for your "${passionArea}" passion`;
  }
  if (profile.preferredTypes.includes(template.type)) {
    return `Matches your favorite quest type: ${template.type}`;
  }
  if (profile.streak >= 3) {
    return `Keep your ${profile.streak}-day streak alive!`;
  }
  if (profile.level <= 2) {
    return "Great for getting started on your journey";
  }
  return "Picked for you";
}

/** Convert a template into an active quest */
function templateToQuest(
  template: QuestTemplate,
  cadence: QuestCadence,
  profile: QuestProfile,
): Quest {
  const passionArea = template.passionSpecific ? pickPassionArea(profile.interests) : null;
  const xp = QUEST_XP[template.difficulty][cadence];
  const expiresAt = cadence === "daily" ? endOfToday() : endOfWeek();

  return {
    id: genId(),
    templateId: template.id,
    title: template.title,
    description: passionArea
      ? template.description.replace(/your passion/gi, `your "${passionArea}" passion`)
      : template.description,
    type: template.type,
    cadence,
    difficulty: template.difficulty,
    xpReward: xp,
    reason: buildReason(template, profile, passionArea),
    passionArea,
    assignedAt: new Date().toISOString(),
    expiresAt,
    status: "active",
    completedAt: null,
    reflectionPrompt: template.reflectionPrompt,
    reflectionResponse: null,
  };
}

/** Recently used template IDs (from history, last 14 days) */
function getRecentTemplateIds(history: QuestHistoryEntry[]): Set<string> {
  const cutoff = Date.now() - 14 * 86_400_000;
  const ids = new Set<string>();
  for (const entry of history) {
    if (new Date(entry.timestamp).getTime() > cutoff) {
      ids.add(entry.templateId);
    }
  }
  return ids;
}

// ═══════════════════════════════════════════════════════════════
// FALLBACK DEFAULTS — used when personalization data is missing
// ═══════════════════════════════════════════════════════════════

const FALLBACK_DAILY: QuestTemplate[] = ALL_TEMPLATES
  .filter((t) => t.validCadences.includes("daily") && t.minLevel <= 1)
  .slice(0, 5);

const FALLBACK_WEEKLY: QuestTemplate[] = ALL_TEMPLATES
  .filter((t) => t.validCadences.includes("weekly") && t.minLevel <= 1)
  .slice(0, 4);

const FALLBACK_EXPLORE: QuestTemplate[] = ALL_TEMPLATES
  .filter((t) => t.validCadences.includes("explore") && t.minLevel <= 1);

/** Pick N random items from an array */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ═══════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════

/** Generate a full set of quests for a given cadence */
function generateForCadence(
  cadence: QuestCadence,
  count: number,
  profile: QuestProfile,
  recentIds: Set<string>,
): Quest[] {
  // Get eligible templates
  let eligible = getEligibleTemplates({
    cadence,
    level: profile.level,
    excludeIds: recentIds,
    preferredTypes: profile.preferredTypes,
    avoidedTypes: profile.avoidedTypes,
  });

  // If too few, relax the avoided types filter
  if (eligible.length < count) {
    eligible = getEligibleTemplates({
      cadence,
      level: profile.level,
      excludeIds: recentIds,
    });
  }

  // If still too few, use fallbacks (remove level/repeat constraints)
  if (eligible.length < count) {
    const fallbacks =
      cadence === "daily" ? FALLBACK_DAILY :
      cadence === "weekly" ? FALLBACK_WEEKLY :
      FALLBACK_EXPLORE;
    eligible = [...eligible, ...fallbacks];
  }

  // Enforce difficulty mix
  const selected = enforceDifficultyMix(eligible, count);

  // If we still don't have enough, pad with random fallbacks
  while (selected.length < count) {
    const fallbackPool =
      cadence === "daily" ? FALLBACK_DAILY :
      cadence === "weekly" ? FALLBACK_WEEKLY :
      FALLBACK_EXPLORE;
    const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    if (pick && !selected.find((s) => s.id === pick.id)) {
      selected.push(pick);
    } else if (pick) {
      // Allow duplicate template with different quest ID
      selected.push(pick);
    }
  }

  // Convert to quests
  return selected.slice(0, count).map((t) => templateToQuest(t, cadence, profile));
}

/** Build a default profile when no data is available */
export function buildDefaultProfile(): QuestProfile {
  return {
    interests: [],
    level: 1,
    streak: 0,
    preferredTypes: [],
    avoidedTypes: [],
    recentCompletions: 0,
    totalCompleted: 0,
  };
}

/** Build a profile from WorldData-like inputs */
export function buildProfileFromData(opts: {
  interests: string[];
  level: number;
  history: QuestHistoryEntry[];
}): QuestProfile {
  const { interests, level, history } = opts;
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;

  // Count completions by type
  const typeCounts: Record<string, number> = {};
  const skipCounts: Record<string, number> = {};
  let recentCompletions = 0;

  for (const entry of history) {
    if (entry.status === "completed") {
      typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;
      if (new Date(entry.timestamp).getTime() > sevenDaysAgo) {
        recentCompletions++;
      }
    } else if (entry.status === "skipped") {
      skipCounts[entry.type] = (skipCounts[entry.type] ?? 0) + 1;
    }
  }

  // Preferred types: top 2 by completion count
  const preferredTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([t]) => t) as QuestProfile["preferredTypes"];

  // Avoided types: types skipped more than completed
  const avoidedTypes = Object.entries(skipCounts)
    .filter(([type, count]) => count > (typeCounts[type] ?? 0))
    .map(([t]) => t) as QuestProfile["avoidedTypes"];

  // Calculate streak: consecutive days with completions going backwards from today
  let streak = 0;
  const completedDays = new Set(
    history
      .filter((e) => e.status === "completed")
      .map((e) => new Date(e.timestamp).toDateString()),
  );
  const today = new Date();
  for (let d = 0; d < 30; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - d);
    if (completedDays.has(checkDate.toDateString())) {
      streak++;
    } else if (d > 0) {
      break; // Allow today to not have a completion yet
    }
  }

  return {
    interests,
    level,
    streak,
    preferredTypes,
    avoidedTypes,
    recentCompletions,
    totalCompleted: Object.values(typeCounts).reduce((a, b) => a + b, 0),
  };
}

/** Generate a complete fresh quest board */
export function generateQuestBoard(
  profile: QuestProfile,
  history: QuestHistoryEntry[],
): QuestBoardState {
  const recentIds = getRecentTemplateIds(history);
  const now = new Date().toISOString();

  const dailyQuests = generateForCadence("daily", QUEST_SLOTS.daily, profile, recentIds);
  const weeklyQuests = generateForCadence("weekly", QUEST_SLOTS.weekly, profile, recentIds);
  const exploreQuests = generateForCadence("explore", QUEST_SLOTS.explore, profile, recentIds);

  return {
    quests: [...dailyQuests, ...weeklyQuests, ...exploreQuests],
    dailyRefreshedAt: now,
    weeklyRefreshedAt: now,
    history: history.slice(0, 50),
    profile,
    version: BOARD_VERSION,
  };
}

/** Refill specific empty slots (after completion/skip) */
export function refillSlots(
  board: QuestBoardState,
  cadence: QuestCadence,
  count: number,
): Quest[] {
  const recentIds = getRecentTemplateIds(board.history);
  // Also exclude currently active quest templates
  for (const q of board.quests) {
    if (q.status === "active") recentIds.add(q.templateId);
  }
  return generateForCadence(cadence, count, board.profile, recentIds);
}
