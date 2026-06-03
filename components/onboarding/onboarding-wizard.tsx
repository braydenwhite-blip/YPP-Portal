"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingStep, saveOnboardingProfile, completeOnboarding } from "@/lib/onboarding-actions";
import {
  STUDENT_INTEREST_OPTIONS,
  STUDENT_LEARNING_STYLE_OPTIONS,
  STUDENT_PRIMARY_GOAL_OPTIONS,
} from "@/lib/student-profile";
import StudentSteps from "./student-steps";

interface OnboardingWizardProps {
  userName: string;
  chapterName?: string | null;
  initialStep: number;
  profileData?: {
    bio?: string | null;
    school?: string | null;
    grade?: number | null;
    interests?: string[];
    parentEmail?: string | null;
    parentPhone?: string | null;
    dateOfBirth?: string | null;
    learningStyle?: string | null;
    primaryGoal?: string | null;
    curriculumUrl?: string | null;
  } | null;
}

// Student onboarding wizard. The instructor variant was retired in favor of the
// unified Instructor Launchpad (/instructor-onboarding); instructors are
// redirected there before they ever reach this component.
export default function OnboardingWizard({
  userName,
  chapterName,
  initialStep,
  profileData,
}: OnboardingWizardProps) {
  const totalSteps = 3;
  const [currentStep, setCurrentStep] = useState(normalizeStudentStep(initialStep));
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState(() => {
    const allowed = new Set<string>(STUDENT_INTEREST_OPTIONS.map((option) => option.value));
    return (profileData?.interests ?? []).filter((interest) => allowed.has(interest));
  });
  const [selectedLearningStyle, setSelectedLearningStyle] = useState(() => {
    const allowed = new Set<string>(STUDENT_LEARNING_STYLE_OPTIONS.map((option) => option.value));
    return allowed.has(profileData?.learningStyle ?? "") ? profileData?.learningStyle ?? null : null;
  });
  const [selectedPrimaryGoal, setSelectedPrimaryGoal] = useState(() => {
    const allowed = new Set<string>(STUDENT_PRIMARY_GOAL_OPTIONS.map((option) => option.value));
    return allowed.has(profileData?.primaryGoal ?? "") ? profileData?.primaryGoal ?? null : null;
  });
  const router = useRouter();

  async function finishOnboarding() {
    const result = await completeOnboarding();
    if (result?.error) {
      setFormError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  function goNext() {
    setFormError(null);
    const nextStep = currentStep + 1;
    if (nextStep >= totalSteps) {
      startTransition(async () => {
        await finishOnboarding();
      });
      return;
    }
    setCurrentStep(nextStep);
    startTransition(async () => {
      await saveOnboardingStep(nextStep);
    });
  }

  function goBack() {
    setFormError(null);
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      startTransition(async () => {
        await saveOnboardingStep(prevStep);
      });
    }
  }

  function handleProfileSave(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await saveOnboardingProfile(formData);
        if (result?.error) {
          setFormError(result.error);
          return;
        }

        const nextStep = currentStep + 1;
        if (nextStep >= totalSteps) {
          await finishOnboarding();
          return;
        }

        setCurrentStep(nextStep);
        await saveOnboardingStep(nextStep);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "We could not save that yet.");
      }
    });
  }

  function handleInterestToggle(interest: string) {
    setFormError(null);
    setSelectedInterests((previous) => {
      if (previous.includes(interest)) {
        return previous.filter((item) => item !== interest);
      }

      return [...previous, interest];
    });
  }

  function handleLearningStyleChange(value: string) {
    setFormError(null);
    setSelectedLearningStyle((previous) => {
      if (previous === value) {
        return null;
      } else {
        return value;
      }
    });
  }

  function handlePrimaryGoalChange(value: string) {
    setFormError(null);
    setSelectedPrimaryGoal((previous) => {
      if (previous === value) {
        return null;
      } else {
        return value;
      }
    });
  }

  function handleSkip() {
    setFormError(null);
    startTransition(async () => {
      await finishOnboarding();
    });
  }

  const stepLabels = ["Welcome", "Your Path", "Your Journey"];

  return (
    <div className="onboarding-shell">
      <div className="onboarding-container">
        {/* Progress bar */}
        <div className="onboarding-progress">
          <div className="onboarding-progress-bar">
            <div
              className="onboarding-progress-fill"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <div className="onboarding-steps-indicator">
            {stepLabels.map((label, idx) => (
              <div
                key={label}
                className={`onboarding-step-dot ${idx <= currentStep ? "active" : ""} ${idx === currentStep ? "current" : ""}`}
              >
                <div className="dot-circle">
                  {idx < currentStep ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span className="dot-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          Step {currentStep + 1} of {totalSteps}: {stepLabels[currentStep]}
        </div>

        {/* Step content */}
        <div className="onboarding-content">
          <StudentSteps
            currentStep={currentStep}
            userName={userName}
            chapterName={chapterName}
            profileData={profileData}
            selectedInterests={selectedInterests}
            selectedLearningStyle={selectedLearningStyle}
            selectedPrimaryGoal={selectedPrimaryGoal}
            formError={formError}
            onInterestToggle={handleInterestToggle}
            onLearningStyleChange={handleLearningStyleChange}
            onPrimaryGoalChange={handlePrimaryGoalChange}
            onNext={goNext}
            onBack={goBack}
            onProfileSave={handleProfileSave}
            onSkip={handleSkip}
            isPending={isPending}
          />
        </div>
      </div>
    </div>
  );
}

function normalizeStudentStep(step: number) {
  if (step <= 0) {
    return 0;
  }

  if (step === 1) {
    return 1;
  }

  return 2;
}
