"use client";

import styles from "./instructor-onboarding-guide.module.css";

export interface OnboardingStep {
  id: string;
  /** Short label shown in the rail (e.g. "About"). */
  label: string;
  /** Tiny kicker above the label (e.g. "Step 1"). */
  kicker: string;
}

interface OnboardingStepperProps {
  steps: OnboardingStep[];
  activeIndex: number;
  /** Highest step index the user has reached (controls forward navigation). */
  reachedIndex: number;
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
 * Horizontal, portal-native progress stepper. Renders each onboarding
 * section as a numbered step with completed / current / upcoming states,
 * a connector line, and an overall progress bar — so the instructor always
 * knows where they are and what comes next.
 */
export default function OnboardingStepper({
  steps,
  activeIndex,
  reachedIndex,
  onSelect,
}: OnboardingStepperProps) {
  const progress = steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 0;

  return (
    <nav className={styles.stepper} aria-label="Onboarding progress">
      <ol className={styles.stepperList}>
        {steps.map((step, index) => {
          const isComplete = index < activeIndex;
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
