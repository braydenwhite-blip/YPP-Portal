import type { ReactNode } from "react";
import styles from "./training-banner.module.css";

export type TrainingBannerVariant = "info" | "success" | "warning";

/**
 * TrainingBanner — the single token-based status banner for the Instructor
 * Academy. Replaces the old inline-hex `.card` banners on the training hub
 * (`#a78bfa`, `#16a34a`, `#f59e0b`…) so every status reads from the design
 * system. Server-safe (no client hooks) — banners are Links-only content.
 */
export default function TrainingBanner({
  variant = "info",
  title,
  children,
}: {
  variant?: TrainingBannerVariant;
  title: string;
  children?: ReactNode;
}) {
  const variantClass =
    variant === "success"
      ? styles.success
      : variant === "warning"
        ? styles.warning
        : styles.info;

  return (
    <div className={`${styles.banner} ${variantClass}`} role="status">
      <p className={styles.body}>
        <strong className={styles.title}>{title}</strong>{" "}
        {children}
      </p>
    </div>
  );
}
