"use client";

import { memo } from "react";
import type { WorldData } from "@/lib/world-actions";
import styles from "../passion-world.module.css";

export const ActivityLog = memo(function ActivityLog({
  activities,
}: {
  activities: WorldData["recentActivity"];
}) {
  if (activities.length === 0) return null;

  return (
    <div className={styles.activity}>
      <div className={styles.activityTitle}>Recent Activity</div>
      {activities.slice(0, 5).map((a) => (
        <div key={a.id} className={styles.activityItem}>
          <span className={styles.activityXp}>+{a.amount} XP</span>
          <span className={styles.activityReason}>{a.reason}</span>
        </div>
      ))}
    </div>
  );
});
