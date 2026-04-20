import styles from "@/app/(app)/loading.module.css";

export default function InstructorApplicantCockpitLoading() {
  return (
    <div aria-busy="true" aria-label="Loading applicant detail">
      {/* Header band */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "1.5rem",
        }}
      >
        <div className={styles.title} style={{ width: "min(50%, 320px)" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              className={styles.base}
              style={{ height: 22, width: 80, borderRadius: 99 }}
            />
          ))}
        </div>
      </div>

      {/* Two-column layout: main + sidebar */}
      <div
        style={{
          display: "flex",
          gap: 24,
          padding: "0 24px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.row} />
          <div className={styles.rowNarrow} />
          <div className={styles.card} style={{ height: 140 }} />
          <div style={{ marginTop: "1.5rem" }}>
            <div className={styles.row} />
            <div className={styles.card} style={{ height: 180, marginTop: 10 }} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div className={styles.card} style={{ height: 200, marginBottom: 16 }} />
          <div className={styles.card} style={{ height: 160 }} />
        </div>
      </div>
    </div>
  );
}
