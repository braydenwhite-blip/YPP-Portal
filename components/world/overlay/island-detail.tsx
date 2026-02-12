"use client";

import type { PassionIsland } from "@/lib/world-actions";
import { LEVEL_LABELS, getTheme } from "../constants";
import styles from "../passion-world.module.css";

export function IslandDetail({
  island,
  onClose,
}: {
  island: PassionIsland;
  onClose: () => void;
}) {
  const theme = getTheme(island.category);
  const levelConfig = LEVEL_LABELS[island.level] ?? LEVEL_LABELS.EXPLORING;

  return (
    <div className={styles.panel} style={{ borderColor: theme.gradient[0] }}>
      <button className={styles.panelClose} onClick={onClose}>
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{
          background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
        }}
      >
        <span className={styles.panelEmoji}>{theme.emoji}</span>
        <div>
          <h3 className={styles.panelTitle}>{island.name}</h3>
          <span className={styles.panelSubtitle}>
            {levelConfig.label} · Level {island.currentLevel}
            {island.isPrimary && " · Primary Passion"}
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Passion XP</span>
          <span className={styles.statValue} style={{ color: theme.accent }}>
            {island.xpPoints}
          </span>
        </div>
        <div className={styles.xpBar}>
          <div
            className={styles.xpFill}
            style={{
              width: `${Math.min(100, (island.xpPoints / Math.max(island.xpPoints + 50, 100)) * 100)}%`,
              background: `linear-gradient(90deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
            }}
          />
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.courseCount}</span>
            <span className={styles.miniLabel}>Courses</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.badgeCount}</span>
            <span className={styles.miniLabel}>Badges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.challengeCount}</span>
            <span className={styles.miniLabel}>Challenges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{island.projectCount}</span>
            <span className={styles.miniLabel}>Projects</span>
          </div>
        </div>

        <div className={styles.panelMeta}>
          Started {new Date(island.startedAt).toLocaleDateString()} · Last active{" "}
          {new Date(island.lastActiveAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
