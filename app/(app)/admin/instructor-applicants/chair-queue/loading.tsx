import styles from "@/app/(app)/loading.module.css";

export default function ChairQueueLoading() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading chair queue">
      {/* Page title */}
      <div className={styles.title} />

      {/* Chapter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={styles.base}
            style={{ height: 32, width: 90, borderRadius: 99 }}
          />
        ))}
      </div>

      {/* Queue rows */}
      {[1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className={styles.card}
          style={{ height: 72, marginBottom: 10, borderRadius: 10 }}
        />
      ))}
    </div>
  );
}
