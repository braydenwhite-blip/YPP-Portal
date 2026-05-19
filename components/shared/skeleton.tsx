import type { CSSProperties } from "react";
import s from "./skeleton.module.css";

/**
 * Shimmer placeholder block. Compose these inside a route `loading.tsx`
 * so navigations show a layout-shaped skeleton instead of a blank slot.
 */
export function Skeleton({
  width,
  height,
  radius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className={s.skeleton}
      aria-hidden
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
