"use client";

import { useState } from "react";

import type { InstructorGrowthTierDef } from "@/lib/instructor-growth-config";
import styles from "@/components/instructor-growth/instructor-growth.module.css";

type TierPreviewProps = {
  tiers: InstructorGrowthTierDef[];
  currentTierKey: string;
};

export function InstructorGrowthTierPreview({
  tiers,
  currentTierKey,
}: TierPreviewProps) {
  const [selectedTierKey, setSelectedTierKey] = useState(currentTierKey);
  const selectedTier =
    tiers.find((tier) => tier.key === selectedTierKey) ?? tiers[0];

  return (
    <div className={styles.sectionCard + " " + styles.surfaceCard}>
      <div className={styles.tierRail}>
        {tiers.map((tier) => {
          const isActive = tier.key === selectedTier.key;
          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => setSelectedTierKey(tier.key)}
              className={`${styles.tierButton} ${isActive ? styles.tierButtonActive : ""}`}
              style={isActive ? { borderColor: tier.accentColor } : undefined}
            >
              <span
                className={styles.tierButtonDot}
                style={{
                  background: tier.dotBackground,
                  color: tier.dotColor,
                }}
              >
                {tier.icon}
              </span>
              <span className={styles.tierButtonName}>{tier.name}</span>
              <span className={styles.tierButtonXp}>
                {tier.minXp.toLocaleString()}
                {tier.key === "FELLOW" ? "+ XP" : " XP"}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.tierPanel}>
        <div className={styles.tierPanelHeader}>
          <div>
            <p className={styles.eyebrow}>Tier Meaning</p>
            <h3 className={styles.sectionTitle} style={{ marginTop: 0 }}>
              {selectedTier.name}
            </h3>
            <p className={styles.sectionIntro}>{selectedTier.title}</p>
          </div>
          <div
            className={styles.tierBadge}
            style={{
              background: selectedTier.badgeBackground,
              color: selectedTier.dotColor,
            }}
          >
            <span
              className={styles.tierBadgeIcon}
              style={{
                background: selectedTier.dotBackground,
                color: selectedTier.dotColor,
              }}
            >
              {selectedTier.icon}
            </span>
            <span>{selectedTier.shortName}</span>
          </div>
        </div>

        <div className={styles.benefitGrid}>
          {selectedTier.benefits.map((benefit) => (
            <div key={benefit} className={styles.benefitCard}>
              {benefit}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
