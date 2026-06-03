"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./guided-tour.module.css";

/* ------------------------------------------------------------------
   GuidedTour — a reusable spotlight + coachmark walkthrough that
   points at REAL DOM nodes (matched by CSS selector), not a mock
   frame. Each step dims the viewport, cuts a spotlight around the
   target, scrolls it into view, and anchors a tooltip with Next/Back.

   Reduced motion is a hard rule: no smooth scroll, no spotlight
   tween, no coachmark entrance — everything resolves instantly.
   ------------------------------------------------------------------ */

export interface TourStep {
  /** CSS selector for the real element to highlight. */
  selector: string;
  title: string;
  body: string;
}

const SPOTLIGHT_PADDING = 10;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function GuidedTour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const coachmarkRef = useRef<HTMLDivElement | null>(null);
  const [coachSize, setCoachSize] = useState({ width: 330, height: 200 });

  useEffect(() => setMounted(true), []);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // When the step changes, bring the target into view, then measure.
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.selector);
    const reduced = prefersReducedMotion();
    if (el) {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
    }
    const timer = window.setTimeout(measure, reduced ? 0 : 340);
    return () => window.clearTimeout(timer);
  }, [step, measure]);

  // Keep the spotlight locked to the target as the page scrolls/resizes.
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Measure the coachmark so we can flip it above/below the target.
  useLayoutEffect(() => {
    if (coachmarkRef.current) {
      const { width, height } = coachmarkRef.current.getBoundingClientRect();
      setCoachSize({ width, height });
    }
  }, [index, rect]);

  // Escape closes the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !step) return null;

  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  const next = () => {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));

  /* ---- geometry ---- */
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cmW = coachSize.width;
  const cmH = coachSize.height;

  let spotlightStyle: React.CSSProperties | null = null;
  let coachStyle: React.CSSProperties;

  if (rect) {
    const top = Math.max(rect.top - SPOTLIGHT_PADDING, 6);
    const left = Math.max(rect.left - SPOTLIGHT_PADDING, 6);
    const width = Math.min(rect.width + SPOTLIGHT_PADDING * 2, vw - left - 6);
    const height = Math.min(rect.height + SPOTLIGHT_PADDING * 2, vh - top - 6);
    spotlightStyle = { top, left, width, height };

    const spaceBelow = vh - (top + height);
    const placeBelow = spaceBelow >= cmH + 20 || rect.top - cmH - 20 < 0;
    const cmTop = placeBelow
      ? Math.min(top + height + 14, vh - cmH - 12)
      : Math.max(top - cmH - 14, 12);
    const cmLeft = Math.min(
      Math.max(rect.left + rect.width / 2 - cmW / 2, 12),
      vw - cmW - 12,
    );
    coachStyle = { top: cmTop, left: cmLeft };
  } else {
    // Target missing — center the coachmark over a full dim.
    coachStyle = {
      top: Math.max(vh / 2 - cmH / 2, 12),
      left: Math.max(vw / 2 - cmW / 2, 12),
    };
  }

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Portal guided tour">
      {/* block interaction with the page underneath */}
      <div className={styles.catcher} onClick={(e) => e.stopPropagation()} />

      {rect ? (
        <div className={styles.spotlight} style={spotlightStyle ?? undefined} aria-hidden />
      ) : (
        <div className={styles.dim} aria-hidden />
      )}

      <div ref={coachmarkRef} className={styles.coachmark} style={coachStyle}>
        <div className={styles.counter}>
          <span>
            Step {index + 1} of {steps.length}
          </span>
          <span className={styles.dots} aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.selector}
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
              />
            ))}
          </span>
        </div>
        <h2 className={styles.title}>{step.title}</h2>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.footer}>
          <button type="button" className={styles.skip} onClick={onClose}>
            Skip tour
          </button>
          <div className={styles.navButtons}>
            {!isFirst ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={back}>
                Back
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" onClick={next}>
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
