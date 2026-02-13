"use client";

import { memo, useState, useCallback, useEffect, useMemo } from "react";
import type { WorldData } from "@/lib/world-actions";
import type { Quest, QuestBoardState, QuestCadence } from "@/lib/quest";
import {
  refreshQuestBoard,
  completeQuest,
  skipQuest,
  getActiveQuests,
} from "@/lib/quest";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Quest Board Panel — Personalized quests, auto-refill, reflections
// ═══════════════════════════════════════════════════════════════

interface QuestPanelProps {
  data: WorldData;
  onClose: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  learn: "\u{1F4DA}",
  practice: "\u{1F3AF}",
  build: "\u{1F528}",
  reflect: "\u{1F4AD}",
  collab: "\u{1F91D}",
  explore: "\u{1F30D}",
};

const CADENCE_LABELS: Record<QuestCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  explore: "Explore",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

function QuestCard({
  quest,
  onComplete,
  onSkip,
}: {
  quest: Quest;
  onComplete: (questId: string, reflection?: string) => void;
  onSkip: (questId: string) => void;
}) {
  const [showReflection, setShowReflection] = useState(false);
  const [reflection, setReflection] = useState("");

  const handleComplete = useCallback(() => {
    if (quest.reflectionPrompt && !showReflection) {
      setShowReflection(true);
      return;
    }
    onComplete(quest.id, reflection || undefined);
  }, [quest.id, quest.reflectionPrompt, showReflection, reflection, onComplete]);

  return (
    <div
      className={styles.questCard}
      role="article"
      aria-label={`${quest.title} quest, ${quest.difficulty} difficulty, ${quest.xpReward} XP`}
    >
      <div className={styles.questCardHeader}>
        <span className={styles.questTypeIcon} aria-hidden="true">
          {TYPE_EMOJI[quest.type] || "\u{1F4DC}"}
        </span>
        <div className={styles.questCardTitleRow}>
          <span className={styles.questCardTitle}>{quest.title}</span>
          <div className={styles.questCardTags}>
            <span
              className={styles.questDifficultyTag}
              style={{ color: DIFFICULTY_COLORS[quest.difficulty] }}
            >
              {quest.difficulty}
            </span>
            <span className={styles.questXpTag}>+{quest.xpReward} XP</span>
          </div>
        </div>
      </div>

      <p className={styles.questCardDesc}>{quest.description}</p>

      <div className={styles.questCardReason}>
        <span className={styles.questPickedBadge}>Picked for you</span>
        <span className={styles.questReasonText}>{quest.reason}</span>
      </div>

      {/* Reflection prompt (Step 31) */}
      {showReflection && quest.reflectionPrompt && (
        <div className={styles.questReflection}>
          <label className={styles.questReflectionLabel}>
            {quest.reflectionPrompt}
          </label>
          <textarea
            className={styles.questReflectionInput}
            rows={2}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Share your thoughts..."
            aria-label="Reflection response"
          />
        </div>
      )}

      <div className={styles.questCardActions}>
        <button
          className={styles.questSkipBtn}
          onClick={() => onSkip(quest.id)}
          aria-label={`Skip quest: ${quest.title}`}
        >
          Skip
        </button>
        <button
          className={styles.questCompleteBtn}
          onClick={handleComplete}
          aria-label={`Complete quest: ${quest.title}`}
        >
          {showReflection ? "Submit & Complete" : "Complete"}
        </button>
      </div>
    </div>
  );
}

export const QuestPanel = memo(function QuestPanel({ data, onClose }: QuestPanelProps) {
  const [board, setBoard] = useState<QuestBoardState | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);

  // Initialize quest board on mount
  useEffect(() => {
    const interests = data.islands.map((i) => i.name);
    const refreshed = refreshQuestBoard({ interests, level: data.level });
    setBoard(refreshed);
  }, [data.islands, data.level]);

  const activeQuests = useMemo(() => {
    if (!board) return { daily: [], weekly: [], explore: [] };
    return getActiveQuests(board);
  }, [board]);

  const handleComplete = useCallback((questId: string, reflection?: string) => {
    const result = completeQuest(questId, reflection);
    setBoard(result.board);
    if (result.xpEarned > 0) {
      setXpToast(result.xpEarned);
      setTimeout(() => setXpToast(null), 2000);
    }
  }, []);

  const handleSkip = useCallback((questId: string) => {
    const newBoard = skipQuest(questId);
    setBoard(newBoard);
  }, []);

  // Stats from board
  const totalCompleted = board?.profile.totalCompleted ?? 0;
  const streak = board?.profile.streak ?? 0;

  return (
    <div
      className={styles.panel}
      style={{ borderColor: "#f59e0b" }}
      role="dialog"
      aria-label="Quest Board"
      aria-modal="false"
    >
      {/* Drag handle for mobile */}
      <div className={styles.panelDragHandle} aria-hidden="true">
        <div className={styles.panelDragBar} />
      </div>
      <button className={styles.panelClose} onClick={onClose} aria-label="Close quest board">
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
      >
        <span className={styles.panelEmoji}>{"\u{1F4DC}"}</span>
        <div>
          <h3 className={styles.panelTitle}>Quest Board</h3>
          <span className={styles.panelSubtitle}>
            Personalized Quests &amp; Challenges
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* Stats row */}
        <div className={styles.statsGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{totalCompleted}</span>
            <span className={styles.miniLabel}>Completed</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{streak}</span>
            <span className={styles.miniLabel}>Day Streak</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.activeChallenges}</span>
            <span className={styles.miniLabel}>Active</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalChallenges}</span>
            <span className={styles.miniLabel}>Total Done</span>
          </div>
        </div>

        {/* XP toast */}
        {xpToast !== null && (
          <div className={styles.questXpToast} role="alert" aria-live="assertive">
            +{xpToast} XP earned!
          </div>
        )}

        {/* Quest sections by cadence */}
        {(["daily", "weekly", "explore"] as QuestCadence[]).map((cadence) => {
          const quests = activeQuests[cadence];
          if (quests.length === 0) return null;
          return (
            <div key={cadence} className={styles.questSection}>
              <div className={styles.questSectionHeader}>
                <span className={styles.questSectionTitle}>
                  {CADENCE_LABELS[cadence]} Quests
                </span>
                <span className={styles.questSectionCount}>
                  {quests.length} active
                </span>
              </div>
              {quests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  onComplete={handleComplete}
                  onSkip={handleSkip}
                />
              ))}
            </div>
          );
        })}

        {/* Empty state */}
        {!board && (
          <div className={styles.landmarkEmpty}>
            Loading your personalized quests...
          </div>
        )}
      </div>
    </div>
  );
});
