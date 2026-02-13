"use client";

import { memo } from "react";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Achievement Shrine Panel — Badges, certificates, achievement log
// ═══════════════════════════════════════════════════════════════

interface ShrinePanelProps {
  data: WorldData;
  onClose: () => void;
}

export const ShrinePanel = memo(function ShrinePanel({ data, onClose }: ShrinePanelProps) {
  return (
    <div className={styles.panel} style={{ borderColor: "#f59e0b" }}>
      <button className={styles.panelClose} onClick={onClose}>
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{ background: "linear-gradient(135deg, #f59e0b, #b45309)" }}
      >
        <span className={styles.panelEmoji}>{"\u{1F3C6}"}</span>
        <div>
          <h3 className={styles.panelTitle}>Achievement Shrine</h3>
          <span className={styles.panelSubtitle}>
            Your accomplishments, immortalized
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* Summary stats */}
        <div className={styles.statsGrid}>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalBadges}</span>
            <span className={styles.miniLabel}>Badges</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalCertificates}</span>
            <span className={styles.miniLabel}>Certificates</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalChallenges}</span>
            <span className={styles.miniLabel}>Challenges Won</span>
          </div>
          <div className={styles.miniStat}>
            <span className={styles.miniValue}>{data.totalProjects}</span>
            <span className={styles.miniLabel}>Projects</span>
          </div>
        </div>

        {/* Per-island achievements */}
        <div className={styles.landmarkSection}>
          <div className={styles.landmarkSectionTitle}>Island Achievements</div>
          {data.islands.length === 0 ? (
            <div className={styles.landmarkEmpty}>
              Start exploring to earn achievements!
            </div>
          ) : (
            <div className={styles.landmarkList}>
              {data.islands
                .filter((isl) => isl.badgeCount + isl.certificateCount > 0)
                .map((island) => (
                  <div key={island.id} className={styles.landmarkListItem}>
                    <span className={styles.landmarkListName}>{island.name}</span>
                    <span className={styles.landmarkListValue}>
                      {island.badgeCount}b · {island.certificateCount}c
                    </span>
                  </div>
                ))}
              {data.islands.every((isl) => isl.badgeCount + isl.certificateCount === 0) && (
                <div className={styles.landmarkEmpty}>
                  No badges or certificates earned yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shrine power level */}
        <div className={styles.landmarkSection}>
          <div className={styles.landmarkSectionTitle}>Shrine Power</div>
          <div className={styles.shrinePowerBar}>
            <div
              className={styles.shrinePowerFill}
              style={{
                width: `${Math.min(100, (data.totalBadges + data.totalCertificates) * 5)}%`,
              }}
            />
          </div>
          <div className={styles.shrinePowerLabel}>
            {data.totalBadges + data.totalCertificates === 0
              ? "Dormant — earn badges to power the shrine"
              : data.totalBadges + data.totalCertificates >= 10
                ? "Radiant — your shrine shines across the ocean"
                : data.totalBadges + data.totalCertificates >= 5
                  ? "Glowing — the shrine hums with energy"
                  : "Awakening — a faint glow grows within"}
          </div>
        </div>
      </div>
    </div>
  );
});
