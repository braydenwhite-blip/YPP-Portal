"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Onboarding Tutorial — Tooltip sequence for first-time visitors
// Shows after the cinematic camera intro completes.
// Stored in localStorage so it only fires once.
// ═══════════════════════════════════════════════════════════════

const ONBOARDING_KEY = "passionworld-onboarded";

interface OnboardingStep {
  title: string;
  body: string;
  icon: string;
  /** Which area to spotlight: "world" | "island" | "landmark" | "hud" */
  spotlight: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: "Welcome to Your Passion World",
    body: "This is your personal ocean — every passion you explore becomes a living island.",
    icon: "\u{1F30A}",
    spotlight: "world",
  },
  {
    title: "Your Islands",
    body: "Each island represents a passion you\u2019re exploring. They grow as you earn XP through courses, badges, and projects.",
    icon: "\u{1F3DD}\uFE0F",
    spotlight: "island",
  },
  {
    title: "Click to Explore",
    body: "Click any island to see your detailed progress — courses, badges, challenges, and a timeline of your activity.",
    icon: "\u{1F449}",
    spotlight: "island",
  },
  {
    title: "Discover Landmarks",
    body: "Visit the Quest Board, Mentor Tower, Achievement Shrine, Chapter Town, and Events tent to discover more adventures.",
    icon: "\u{1F3F0}",
    spotlight: "landmark",
  },
  {
    title: "Track Your Growth",
    body: "Your HUD shows your global level, XP, and stats. Search for islands, check the minimap, and watch your world come alive!",
    icon: "\u{1F4CA}",
    spotlight: "hud",
  },
];

interface OnboardingProps {
  /** Should be true once the cinematic intro is complete */
  introComplete: boolean;
}

export function Onboarding({ introComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  // Check if onboarding should show
  useEffect(() => {
    if (!introComplete) return;
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        // Small delay so the cinematic camera settles
        const timer = setTimeout(() => setCurrentStep(0), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // SSR or blocked localStorage
    }
  }, [introComplete]);

  const advance = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= STEPS.length) {
        // Done — mark as onboarded
        try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
        return null;
      }
      return next;
    });
  }, []);

  const skip = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
    setCurrentStep(null);
  }, []);

  if (currentStep === null) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className={styles.onboardingOverlay}>
      {/* Dim backdrop */}
      <div className={styles.onboardingBackdrop} onClick={advance} />

      {/* Tooltip card */}
      <div className={styles.onboardingCard}>
        {/* Progress bar */}
        <div className={styles.onboardingProgress}>
          <div
            className={styles.onboardingProgressFill}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className={styles.onboardingIcon}>{step.icon}</div>
        <h3 className={styles.onboardingTitle}>{step.title}</h3>
        <p className={styles.onboardingBody}>{step.body}</p>

        <div className={styles.onboardingActions}>
          <button className={styles.onboardingSkip} onClick={skip}>
            Skip tour
          </button>
          <button className={styles.onboardingNext} onClick={advance}>
            {isLast ? "Start Exploring" : "Next"}
          </button>
        </div>

        {/* Step dots */}
        <div className={styles.onboardingDots}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`${styles.onboardingDot} ${i === currentStep ? styles.onboardingDotActive : ""} ${i < currentStep ? styles.onboardingDotDone : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
