"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui-v2";
import { useResolvedReducedMotion } from "@/lib/motion-preference";

/**
 * RiseOnScroll — a tasteful, accessible scroll reveal. Cards rise + fade in as
 * they enter the viewport, then stay put (no parallax jitter on every scroll).
 * Honors the resolved reduced-motion preference: when motion is reduced the
 * content is simply present, no transform, no transition.
 */
export function RiseOnScroll({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const reduce = useResolvedReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduce) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduce]);

  return (
    <div
      ref={ref}
      style={!reduce && shown ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn(
        "transition-all duration-500 ease-out will-change-transform",
        reduce || shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
