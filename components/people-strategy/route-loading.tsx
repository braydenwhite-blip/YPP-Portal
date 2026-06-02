import styles from "@/app/(app)/loading.module.css";

export function PeopleStrategyRouteLoading({
  label,
}: {
  label: string;
}) {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label={label}>
      <div className={styles.title} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className={styles.base}
            style={{ height: 32, width: 112, borderRadius: 8 }}
          />
        ))}
      </div>
      <div className={styles.row} />
      <div className={styles.rowNarrow} />
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 20 }}>
        {[1, 2, 3].map((item) => (
          <div key={item} className={styles.card} style={{ height: 104 }} />
        ))}
      </div>
    </div>
  );
}
