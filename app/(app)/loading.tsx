import styles from "./loading.module.css";

/**
 * Shown while a nested (app) route segment is resolving. Layout + shell stay mounted;
 * this only replaces the main page slot so navigations feel faster.
 */
export default function AppRouteLoading() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading page">
      <div className={styles.title} />
      <div className={styles.row} />
      <div className={styles.rowNarrow} />
      <div className={styles.row} />
      <div className={styles.card} />
    </div>
  );
}
