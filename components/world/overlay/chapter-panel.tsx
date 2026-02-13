"use client";

import { memo } from "react";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Chapter Town Panel — Chapter info, member count, community stats
// ═══════════════════════════════════════════════════════════════

interface ChapterPanelProps {
  data: WorldData;
  onClose: () => void;
}

export const ChapterPanel = memo(function ChapterPanel({ data, onClose }: ChapterPanelProps) {
  const hasChapter = !!data.chapterName;

  return (
    <div className={styles.panel} style={{ borderColor: "#3b82f6" }}>
      <button className={styles.panelClose} onClick={onClose}>
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
      >
        <span className={styles.panelEmoji}>{"\u{1F3D8}\uFE0F"}</span>
        <div>
          <h3 className={styles.panelTitle}>
            {data.chapterName ?? "Chapter Town"}
          </h3>
          <span className={styles.panelSubtitle}>
            {hasChapter ? "Your community hub" : "Find your people"}
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {hasChapter ? (
          <>
            {/* Chapter stats */}
            <div className={styles.chapterCard}>
              <div className={styles.chapterIcon}>{"\u{1F3E0}"}</div>
              <div className={styles.chapterInfo}>
                <div className={styles.chapterName}>{data.chapterName}</div>
                <div className={styles.chapterMembers}>
                  {data.chapterMemberCount} explorer{data.chapterMemberCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.miniStat}>
                <span className={styles.miniValue}>{data.chapterMemberCount}</span>
                <span className={styles.miniLabel}>Members</span>
              </div>
              <div className={styles.miniStat}>
                <span className={styles.miniValue}>{data.islands.length}</span>
                <span className={styles.miniLabel}>Your Islands</span>
              </div>
            </div>

            {/* Town growth */}
            <div className={styles.landmarkSection}>
              <div className={styles.landmarkSectionTitle}>Town Size</div>
              <div className={styles.townGrowthBar}>
                <div
                  className={styles.townGrowthFill}
                  style={{
                    width: `${Math.min(100, data.chapterMemberCount * 2)}%`,
                  }}
                />
              </div>
              <div className={styles.townGrowthLabel}>
                {data.chapterMemberCount >= 50
                  ? "Metropolis — a thriving city of explorers"
                  : data.chapterMemberCount >= 20
                    ? "Town — growing strong"
                    : data.chapterMemberCount >= 5
                      ? "Village — building community"
                      : "Settlement — just getting started"}
              </div>
            </div>

            {/* Top passion areas in chapter */}
            {data.islands.length > 0 && (
              <div className={styles.landmarkSection}>
                <div className={styles.landmarkSectionTitle}>Your Passions</div>
                <div className={styles.landmarkList}>
                  {data.islands.slice(0, 5).map((island) => (
                    <div key={island.id} className={styles.landmarkListItem}>
                      <span className={styles.landmarkListName}>{island.name}</span>
                      <span className={styles.landmarkListValue}>{island.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.chapterEmpty}>
            <div className={styles.chapterEmptyIcon}>{"\u{1F3D7}\uFE0F"}</div>
            <div className={styles.chapterEmptyTitle}>No Chapter Yet</div>
            <div className={styles.chapterEmptyText}>
              Chapters are communities of explorers who learn and grow together.
              Join a chapter to unlock collaborative quests and community events.
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
