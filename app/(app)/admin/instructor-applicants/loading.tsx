import styles from "@/app/(app)/loading.module.css";

export default function InstructorApplicantsLoading() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading instructor applicants">
      {/* Page title */}
      <div className={styles.title} />

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={styles.base}
            style={{ height: 32, width: 100, borderRadius: 6 }}
          />
        ))}
      </div>

      {/* Kanban columns */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
        {[1, 2, 3, 4, 5, 6].map((col) => (
          <div
            key={col}
            style={{ minWidth: 220, flex: "0 0 220px" }}
          >
            {/* Column header */}
            <div
              className={styles.base}
              style={{ height: 18, width: "70%", marginBottom: 12, borderRadius: 4 }}
            />
            {/* Cards */}
            {[1, 2].map((card) => (
              <div
                key={card}
                className={styles.card}
                style={{ marginBottom: 10, height: 96, borderRadius: 10 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
