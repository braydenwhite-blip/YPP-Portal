"use client";

import { memo } from "react";
import Link from "next/link";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Mentor Tower Panel — Mentor info, connection status, guidance
// ═══════════════════════════════════════════════════════════════

interface MentorPanelProps {
  data: WorldData;
  onClose: () => void;
}

export const MentorPanel = memo(function MentorPanel({ data, onClose }: MentorPanelProps) {
  const hasMentor = data.hasMentor;

  return (
    <div className={styles.panel} style={{ borderColor: "#7c3aed" }}>
      <button className={styles.panelClose} onClick={onClose}>
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
      >
        <span className={styles.panelEmoji}>{"\u{1F9D9}"}</span>
        <div>
          <h3 className={styles.panelTitle}>Mentor Tower</h3>
          <span className={styles.panelSubtitle}>
            {hasMentor ? "Guided Journey" : "Seeking Guidance"}
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {hasMentor ? (
          <>
            {/* Mentor info */}
            <div className={styles.mentorCard}>
              <div className={styles.mentorAvatar}>
                {data.mentorName?.charAt(0).toUpperCase() ?? "M"}
              </div>
              <div className={styles.mentorInfo}>
                <div className={styles.mentorName}>{data.mentorName}</div>
                <div className={styles.mentorStatus}>
                  <span className={styles.mentorStatusDot} />
                  Active Mentor
                </div>
              </div>
            </div>

            {/* Connection strength based on total XP/activity */}
            <div className={styles.landmarkSection}>
              <div className={styles.landmarkSectionTitle}>Connection Strength</div>
              <div className={styles.connectionBar}>
                <div
                  className={styles.connectionFill}
                  style={{
                    width: `${Math.min(100, Math.max(20, data.recentActivity.length * 10))}%`,
                  }}
                />
              </div>
              <div className={styles.connectionLabel}>
                {data.recentActivity.length >= 8
                  ? "Strong — Active learner"
                  : data.recentActivity.length >= 4
                    ? "Growing — Keep it up"
                    : "Building — Stay engaged"}
              </div>
            </div>

            {/* Island guidance */}
            <div className={styles.landmarkSection}>
              <div className={styles.landmarkSectionTitle}>Guided Passions</div>
              <div className={styles.landmarkList}>
                {data.islands.slice(0, 5).map((island) => (
                  <div key={island.id} className={styles.landmarkListItem}>
                    <span className={styles.landmarkListName}>{island.name}</span>
                    <span className={styles.landmarkListValue}>
                      Lv.{island.currentLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* No mentor state */
          <div className={styles.mentorEmpty}>
            <div className={styles.mentorEmptyIcon}>{"\u{1F52E}"}</div>
            <div className={styles.mentorEmptyTitle}>No Mentor Assigned</div>
            <div className={styles.mentorEmptyText}>
              A mentor can guide your journey, help you level up faster,
              and unlock hidden quests across your passion islands.
            </div>
            <div className={styles.mentorEmptyHint}>
              Visit your chapter or talk to a program coordinator to get matched.
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className={styles.panelActions}>
          <Link href="/pathways" className={styles.panelLink}>
            <span className={styles.panelLinkIcon}>{"\u{1F5FA}\uFE0F"}</span>
            <span className={styles.panelLinkText}>Learning Pathways</span>
            <span className={styles.panelLinkArrow}>&rarr;</span>
          </Link>
          <Link href="/courses/recommended" className={styles.panelLink}>
            <span className={styles.panelLinkIcon}>{"\u{1F4DA}"}</span>
            <span className={styles.panelLinkText}>Recommended Courses</span>
            <span className={styles.panelLinkArrow}>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
});
