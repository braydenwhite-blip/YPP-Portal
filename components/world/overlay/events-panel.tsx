"use client";

import { memo } from "react";
import Link from "next/link";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Seasonal Events Panel — Challenges, events, seasonal activities
// ═══════════════════════════════════════════════════════════════

interface EventsPanelProps {
  data: WorldData;
  onClose: () => void;
}

/** Get current season name */
function getSeasonName(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
}

const SEASON_THEMES: Record<string, { color: string; emoji: string; activity: string }> = {
  Spring: { color: "#22c55e", emoji: "\u{1F338}", activity: "Growth challenges bloom" },
  Summer: { color: "#f59e0b", emoji: "\u2600\uFE0F", activity: "Summer expedition season" },
  Fall: { color: "#ef4444", emoji: "\u{1F341}", activity: "Harvest of knowledge" },
  Winter: { color: "#60a5fa", emoji: "\u2744\uFE0F", activity: "Winter reflection quests" },
};

export const EventsPanel = memo(function EventsPanel({ data, onClose }: EventsPanelProps) {
  const seasonName = getSeasonName();
  const theme = SEASON_THEMES[seasonName];
  const totalEvents = data.activeChallenges + data.upcomingEventCount;

  return (
    <div className={styles.panel} style={{ borderColor: theme.color }}>
      <button className={styles.panelClose} onClick={onClose}>
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{ background: `linear-gradient(135deg, ${theme.color}, #1e293b)` }}
      >
        <span className={styles.panelEmoji}>{theme.emoji}</span>
        <div>
          <h3 className={styles.panelTitle}>{seasonName} Events</h3>
          <span className={styles.panelSubtitle}>{theme.activity}</span>
        </div>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.statsGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.activeChallenges}</span>
            <span className={styles.miniLabel}>Active Challenges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.upcomingEventCount}</span>
            <span className={styles.miniLabel}>Upcoming Events</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalChallenges}</span>
            <span className={styles.miniLabel}>Completed</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.islands.length}</span>
            <span className={styles.miniLabel}>Islands Active</span>
          </div>
        </div>

        {/* Season progress */}
        <div className={styles.landmarkSection}>
          <div className={styles.landmarkSectionTitle}>{seasonName} Progress</div>
          <div className={styles.seasonProgressBar}>
            <div
              className={styles.seasonProgressFill}
              style={{
                width: `${Math.min(100, data.totalChallenges * 10)}%`,
                background: `linear-gradient(90deg, ${theme.color}, #fbbf24)`,
              }}
            />
          </div>
          <div className={styles.seasonProgressLabel}>
            {data.totalChallenges >= 10
              ? "Season Champion — you've conquered this season"
              : data.totalChallenges >= 5
                ? "Rising Star — impressive progress"
                : data.totalChallenges >= 1
                  ? "Explorer — your journey has begun"
                  : "Idle — join a challenge to start"}
          </div>
        </div>

        {/* Island challenge breakdown */}
        {data.islands.length > 0 && (
          <div className={styles.landmarkSection}>
            <div className={styles.landmarkSectionTitle}>Challenge Activity</div>
            <div className={styles.landmarkList}>
              {data.islands
                .filter((isl) => isl.challengeCount > 0)
                .slice(0, 5)
                .map((island) => (
                  <div key={island.id} className={styles.landmarkListItem}>
                    <span className={styles.landmarkListName}>{island.name}</span>
                    <span className={styles.landmarkListValue}>
                      {island.challengeCount} done
                    </span>
                  </div>
                ))}
              {data.islands.every((isl) => isl.challengeCount === 0) && (
                <div className={styles.landmarkEmpty}>
                  No challenges completed on any island yet.
                </div>
              )}
            </div>
          </div>
        )}

        {totalEvents === 0 && (
          <div className={styles.landmarkSection}>
            <div className={styles.eventsEmpty}>
              <div className={styles.eventsEmptyIcon}>{"\u{1F3AA}"}</div>
              <div className={styles.eventsEmptyText}>
                No active events right now. Check back soon — new {seasonName.toLowerCase()} events are always on the horizon!
              </div>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className={styles.panelActions}>
          <Link href="/events" className={styles.panelLink}>
            <span className={styles.panelLinkIcon}>{"\u{1F4C5}"}</span>
            <span className={styles.panelLinkText}>All Events</span>
            <span className={styles.panelLinkArrow}>&rarr;</span>
          </Link>
          <Link href="/activities" className={styles.panelLink}>
            <span className={styles.panelLinkIcon}>{"\u{1F9ED}"}</span>
            <span className={styles.panelLinkText}>Activity Hub</span>
            <span className={styles.panelLinkArrow}>&rarr;</span>
          </Link>
          <Link href="/challenges" className={styles.panelLink}>
            <span className={styles.panelLinkIcon}>{"\u{1F3AF}"}</span>
            <span className={styles.panelLinkText}>Challenges</span>
            <span className={styles.panelLinkArrow}>&rarr;</span>
          </Link>
          <Link href="/incubator" className={styles.panelLink}>
            <span className={styles.panelLinkIcon}>{"\u{1F680}"}</span>
            <span className={styles.panelLinkText}>Incubator</span>
            <span className={styles.panelLinkArrow}>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
});
