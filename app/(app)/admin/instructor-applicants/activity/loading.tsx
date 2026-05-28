import styles from "@/app/(app)/loading.module.css";

export default function ActivityFeedLoading() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading activity feed">
      <div className={styles.title} />
      <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={styles.base}
            style={{ height: 32, width: 110, borderRadius: 99 }}
          />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((row) => (
        <div
          key={row}
          className={styles.card}
          style={{ height: 96, marginBottom: 10, borderRadius: 10 }}
        />
      ))}
    </div>
  );
}
