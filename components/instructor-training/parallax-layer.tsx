"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { type CSSProperties, type ReactNode, type RefObject } from "react";
import { useTrainingScrollRef } from "./training-scroll-context";

/**
 * Restrained, portal-native scroll parallax. Wraps a decorative depth layer
 * that drifts slower than the foreground as the content pane scrolls, adding
 * depth without motion noise.
 *
 * SSR-safe: the same `motion.div` renders on the server and on first client
 * paint (scroll progress starts at 0 → zero offset), so there is no hydration
 * mismatch. Under `prefers-reduced-motion` the transform is dropped entirely.
 */
export default function ParallaxLayer({
  children,
  depth = 36,
  className,
  style,
}: {
  children: ReactNode;
  /** Pixels the layer travels across the full scroll range. */
  depth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion() ?? false;
  const scrollRef = useTrainingScrollRef();
  const { scrollYProgress } = useScroll(
    scrollRef ? { container: scrollRef as RefObject<HTMLElement> } : undefined,
  );
  const y = useTransform(scrollYProgress, [0, 1], [0, depth]);

  return (
    <motion.div
      aria-hidden
      className={className}
      style={reduced ? style : { ...style, y }}
    >
      {children}
    </motion.div>
  );
}
