"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingStep, saveOnboardingProfile, completeOnboarding, selectPathways } from "@/lib/onboarding-actions";
import StudentSteps from "./student-steps";
import InstructorSteps from "./instructor-steps";

export interface PathwayOption {
  id: string;
  name: string;
  description: string;
  interestArea: string;
  steps: {
    id: string;
    courseId: string;
    courseTitle: string;
    courseLevel: string | null;
    courseFormat: string;
    stepOrder: number;
  }[];
}

interface OnboardingWizardProps {
  userName: string;
  primaryRole: string;
  roles: string[];
  chapterName?: string | null;
  initialStep: number;
  profileData?: {
    bio?: string | null;
    school?: string | null;
    grade?: number | null;
    interests?: string[];
    parentEmail?: string | null;
    parentPhone?: string | null;
    curriculumUrl?: string | null;
  } | null;
  pathways: PathwayOption[];
  enrolledCourseIds: string[];
  instructorNextAction?: {
    title: string;
    detail: string;
    href: string;
  } | null;
}

export default function OnboardingWizard({
  userName,
  primaryRole,
  roles,
  chapterName,
  initialStep,
  profileData,
  pathways,
  enrolledCourseIds,
  instructorNextAction,
}: OnboardingWizardProps) {
  const isInstructor = primaryRole === "INSTRUCTOR" || roles.includes("INSTRUCTOR");
  const totalSteps = 5;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isPending, startTransition] = useTransition();
  const [selectedPathwayIds, setSelectedPathwayIds] = useState<Set<string>>(new Set());
  // Interest quiz state: answers map topic → true, used to suggest pathways
  const [quizAnswers, setQuizAnswers] = useState<Set<string>>(new Set());
  const router = useRouter();

  function goNext() {
    const nextStep = currentStep + 1;
    if (nextStep >= totalSteps) {
      startTransition(async () => {
        await completeOnboarding();
        router.push("/");
        router.refresh();
      });
      return;
    }
    setCurrentStep(nextStep);
    startTransition(async () => {
      await saveOnboardingStep(nextStep);
    });
  }

  function goBack() {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      startTransition(async () => {
        await saveOnboardingStep(prevStep);
      });
    }
  }

  function handleProfileSave(formData: FormData) {
    startTransition(async () => {
      await saveOnboardingProfile(formData);
      setCurrentStep(currentStep + 1);
    });
  }

  function handlePathwaySelect(pathwayId: string) {
    setSelectedPathwayIds((prev) => {
      const next = new Set(prev);
      if (next.has(pathwayId)) {
        next.delete(pathwayId);
      } else {
        next.add(pathwayId);
      }
      return next;
    });
  }

  function handlePathwayContinue() {
    startTransition(async () => {
      if (selectedPathwayIds.size > 0) {
        await selectPathways(Array.from(selectedPathwayIds));
      }
      const nextStep = currentStep + 1;
      await saveOnboardingStep(nextStep);
      setCurrentStep(nextStep);
    });
  }

  function handleSkip() {
    startTransition(async () => {
      await completeOnboarding();
      router.push("/");
      router.refresh();
    });
  }

  const stepLabels = isInstructor
    ? ["Welcome", "Your Profile", "Training", "Teaching", "Ready!"]
    : ["Welcome", "Your Pathway", "Your Profile", "Your Goals", "Ready!"];

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

        {/* Step content */}
        <div className="onboarding-content">
          {isInstructor ? (
            <InstructorSteps
              currentStep={currentStep}
              userName={userName}
              chapterName={chapterName}
              profileData={profileData}
              nextReadinessAction={instructorNextAction}
              onNext={goNext}
              onBack={goBack}
              onProfileSave={handleProfileSave}
              onSkip={handleSkip}
              isPending={isPending}
            />
          ) : (
            <StudentSteps
              currentStep={currentStep}
              userName={userName}
              chapterName={chapterName}
              profileData={profileData}
              pathways={pathways}
              selectedPathwayIds={selectedPathwayIds}
              quizAnswers={quizAnswers}
              onQuizAnswerToggle={(answer) => {
                setQuizAnswers((prev) => {
                  const next = new Set(prev);
                  if (next.has(answer)) next.delete(answer);
                  else next.add(answer);
                  return next;
                });
              }}
              onPathwaySelect={handlePathwaySelect}
              onPathwayContinue={handlePathwayContinue}
              onNext={goNext}
              onBack={goBack}
              onProfileSave={handleProfileSave}
              onSkip={handleSkip}
              isPending={isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
