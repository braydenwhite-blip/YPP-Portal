"use client";

import styles from "./instructor-onboarding-guide.module.css";

export interface OnboardingStep {
  id: string;
  /** Full label shown in the rail (e.g. "Welcome & your role"). */
  label: string;
  /** Tiny kicker above the label (e.g. "Step 1"). */
  kicker: string;
}

interface OnboardingStepperProps {
  steps: OnboardingStep[];
  activeIndex: number;
  /** Highest step index the user has reached (controls forward navigation). */
  reachedIndex: number;
  /** Per-step completion (independent of position). */
  completed: boolean[];
  onSelect: (index: number) => void;
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7L5.5 10.5L12 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Vertical, portal-native progress rail. Renders each launchpad step as a
 * numbered step with completed / current / upcoming states and full, untruncated
 * labels stacked vertically — so the instructor always knows where they are and
 * what comes next. Hidden under 720px (the launchpad swaps in a compact pill).
 */
export default function OnboardingStepper({
  steps,
  activeIndex,
  reachedIndex,
  completed,
  onSelect,
}: OnboardingStepperProps) {
  const completedCount = completed.filter(Boolean).length;
  const progress =
    steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <nav className={styles.stepper} aria-label="Onboarding progress">
      <ol className={styles.stepperList}>
        {steps.map((step, index) => {
          const isComplete = completed[index];
          const isActive = index === activeIndex;
          const reachable = index <= reachedIndex;

          const stateClass = [
            styles.stepperItem,
            isComplete ? styles.isComplete : "",
            isActive ? styles.isActive : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={step.id} className={stateClass}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => onSelect(index)}
                disabled={!reachable}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.kicker}: ${step.label}${
                  isComplete ? " (completed)" : isActive ? " (current)" : ""
                }`}
              >
                <span className={styles.stepDot} aria-hidden>
                  {isComplete ? <CheckMark /> : index + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepKicker}>{step.kicker}</span>
                  <span className={styles.stepName}>{step.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div
        className={styles.railProgress}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Overall onboarding progress"
      >
        <span className={styles.railProgressFill} style={{ width: `${progress}%` }} />
      </div>
    </nav>
  );
}
