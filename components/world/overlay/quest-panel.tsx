"use client";

import { memo } from "react";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Quest Board Panel — Shows active challenges & recent quest activity
// ═══════════════════════════════════════════════════════════════

interface QuestPanelProps {
  data: WorldData;
  onClose: () => void;
}

export const QuestPanel = memo(function QuestPanel({ data, onClose }: QuestPanelProps) {
  const challengeActivity = data.recentActivity.filter(
    (a) => a.reason.toLowerCase().includes("challenge") || a.reason.toLowerCase().includes("quest"),
  );

  return (
    <div className={styles.panel} style={{ borderColor: "#f59e0b" }}>
      <button className={styles.panelClose} onClick={onClose}>
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
            Active Challenges &amp; Quests
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* Active challenges count */}
        <div className={styles.statsGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.activeChallenges}</span>
            <span className={styles.miniLabel}>Active Challenges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalChallenges}</span>
            <span className={styles.miniLabel}>Completed</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.upcomingEventCount}</span>
            <span className={styles.miniLabel}>Upcoming Events</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalProjects}</span>
            <span className={styles.miniLabel}>Projects</span>
          </div>
        </div>

        {/* Per-island quest breakdown */}
        <div className={styles.landmarkSection}>
          <div className={styles.landmarkSectionTitle}>Island Quests</div>
          {data.islands.length === 0 ? (
            <div className={styles.landmarkEmpty}>
              No passion islands yet. Take the quiz to begin!
            </div>
          ) : (
            <div className={styles.landmarkList}>
              {data.islands.map((island) => (
                <div key={island.id} className={styles.landmarkListItem}>
                  <span className={styles.landmarkListName}>{island.name}</span>
                  <span className={styles.landmarkListValue}>
                    {island.challengeCount} challenge{island.challengeCount !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent challenge activity */}
        {challengeActivity.length > 0 && (
          <div className={styles.landmarkSection}>
            <div className={styles.landmarkSectionTitle}>Recent Quest XP</div>
            <div className={styles.landmarkList}>
              {challengeActivity.slice(0, 5).map((a) => (
                <div key={a.id} className={styles.landmarkListItem}>
                  <span className={styles.landmarkListName}>{a.reason}</span>
                  <span className={styles.landmarkListXp}>+{a.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
