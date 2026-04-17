"use client";

import StudentJourneyVisual from "./student-journey-visual";
import {
  STUDENT_GRADE_OPTIONS,
  STUDENT_INTEREST_OPTIONS,
  STUDENT_LEARNING_STYLE_OPTIONS,
  STUDENT_PRIMARY_GOAL_OPTIONS,
  deriveAgeFromDateOfBirth,
  getMissingStudentSetupFields,
} from "@/lib/student-profile";

interface StudentStepsProps {
  currentStep: number;
  userName: string;
  chapterName?: string | null;
  profileData?: {
    school?: string | null;
    grade?: number | null;
    interests?: string[];
    parentEmail?: string | null;
    parentPhone?: string | null;
    dateOfBirth?: string | null;
    learningStyle?: string | null;
    primaryGoal?: string | null;
  } | null;
  selectedInterests: string[];
  selectedLearningStyle?: string | null;
  selectedPrimaryGoal?: string | null;
  formError?: string | null;
  onInterestToggle: (value: string) => void;
  onLearningStyleChange: (value: string) => void;
  onPrimaryGoalChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onProfileSave: (formData: FormData) => void;
  onSkip: () => void;
  isPending: boolean;
}

export default function StudentSteps({
  currentStep,
  userName,
  chapterName,
  profileData,
  selectedInterests,
  selectedLearningStyle,
  selectedPrimaryGoal,
  formError,
  onInterestToggle,
  onLearningStyleChange,
  onPrimaryGoalChange,
  onNext,
  onBack,
  onProfileSave,
  onSkip,
  isPending,
}: StudentStepsProps) {
  const firstName = userName.split(" ")[0];
  const age = deriveAgeFromDateOfBirth(profileData?.dateOfBirth);
  const missingFields = getMissingStudentSetupFields({
    school: profileData?.school,
    grade: profileData?.grade,
    parentEmail: profileData?.parentEmail,
    parentPhone: profileData?.parentPhone,
  });
  const quizIsComplete =
    selectedInterests.length > 0 &&
    Boolean(selectedLearningStyle) &&
    Boolean(selectedPrimaryGoal);

  if (currentStep === 0) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
          </svg>
        </div>
        <h1 className="onboarding-title">Welcome to YPP Pathways, {firstName}.</h1>
        <p className="onboarding-subtitle">
          We are going to keep this simple. First we will learn a little about what excites you,
          then we will show you how your YPP journey can grow from there.
        </p>

        <div className="onboarding-features-grid">
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </div>
            <h3>Short setup</h3>
            <p>Just a few quick questions so we can start from what already matters to you.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18" /><path d="M6 3h12l3 4v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7l3-4Z" /><path d="M9 12h6" /></svg>
            </div>
            <h3>Better starting points</h3>
            <p>Your answers help YPP recommend course sequences and first steps without locking you in.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 7 7l5 5 5-5-5-5Z" /><path d="M7 13l5 5 5-5" /></svg>
            </div>
            <h3>Room to grow</h3>
            <p>Classes, XP, events, teaching, and leadership can all become part of your path over time.</p>
          </div>
        </div>

        {chapterName ? (
          <p className="onboarding-chapter-note">
            You&apos;re part of the <strong>{chapterName}</strong> chapter.
          </p>
        ) : null}

        <div className="onboarding-actions">
          <button className="button" onClick={onNext} disabled={isPending}>
            Start my setup
          </button>
          <button className="onboarding-skip" onClick={onSkip} disabled={isPending}>
            Skip onboarding
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 1) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12 2.5 2.5L16 9" />
          </svg>
        </div>

        <h1 className="onboarding-title">Let&apos;s Find Your Path</h1>
        <p className="onboarding-subtitle">
          Pick what sounds most like you right now. These answers go onto your student profile and help YPP suggest
          good places to start, without making you commit to one pathway during setup.
        </p>

        <form
          className="onboarding-form onboarding-quiz-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            onProfileSave(formData);
          }}
        >
          {selectedInterests.map((interest) => (
            <input key={interest} type="hidden" name="interests" value={interest} />
          ))}
          <input type="hidden" name="learningStyle" value={selectedLearningStyle ?? ""} />
          <input type="hidden" name="primaryGoal" value={selectedPrimaryGoal ?? ""} />

          <section className="onboarding-quiz-section">
            <h2 className="onboarding-quiz-question">1. Which topics sound exciting to explore?</h2>
            <p className="onboarding-quiz-help">Choose one or more.</p>
            <div className="onboarding-choice-grid">
              {STUDENT_INTEREST_OPTIONS.map((option) => {
                const isSelected = selectedInterests.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`onboarding-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => onInterestToggle(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="onboarding-quiz-section">
            <h2 className="onboarding-quiz-question">2. How do you like to learn best?</h2>
            <div className="onboarding-choice-grid">
              {STUDENT_LEARNING_STYLE_OPTIONS.map((option) => {
                const isSelected = selectedLearningStyle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`onboarding-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => onLearningStyleChange(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="onboarding-quiz-section">
            <h2 className="onboarding-quiz-question">3. What is your biggest goal right now?</h2>
            <div className="onboarding-choice-grid">
              {STUDENT_PRIMARY_GOAL_OPTIONS.map((option) => {
                const isSelected = selectedPrimaryGoal === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`onboarding-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => onPrimaryGoalChange(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {formError ? <div className="form-error">{formError}</div> : null}

          <div className="onboarding-actions">
            <button type="submit" className="button" disabled={isPending || !quizIsComplete}>
              Save and see my journey
            </button>
            <div className="onboarding-actions-secondary">
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
                Back
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  const hasMissingBasics = missingFields.length > 0;

  return (
    <div className="onboarding-step onboarding-journey-step">
      <StudentJourneyVisual
        age={age}
        chapterName={chapterName}
        firstName={firstName}
        grade={profileData?.grade}
        interests={selectedInterests}
        learningStyle={selectedLearningStyle}
        primaryGoal={selectedPrimaryGoal}
        school={profileData?.school}
      />

      {hasMissingBasics ? (
        <form
          className="onboarding-form onboarding-legacy-complete-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            onProfileSave(formData);
          }}
        >
          <div className="onboarding-callout">
            <strong>One last quick fix.</strong> This older account is missing a few basics that new family signups
            already collect up front, so let&apos;s finish those before you head to the dashboard.
          </div>

          <div className="onboarding-legacy-fields">
            {missingFields.includes("school") ? (
              <div className="form-row">
                <label htmlFor="school">Student school</label>
                <input
                  id="school"
                  name="school"
                  className="input"
                  placeholder="e.g. Lincoln High School"
                  defaultValue={profileData?.school ?? ""}
                  required
                />
              </div>
            ) : null}

            {missingFields.includes("grade") ? (
              <div className="form-row">
                <label htmlFor="grade">Grade for current academic year</label>
                <select id="grade" name="grade" className="input" defaultValue={profileData?.grade ?? ""} required>
                  <option value="">Select a grade</option>
                  {STUDENT_GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      Grade {grade}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {missingFields.includes("parentEmail") ? (
              <div className="form-row">
                <label htmlFor="parentEmail">Parent or guardian email</label>
                <input
                  id="parentEmail"
                  name="parentEmail"
                  type="email"
                  className="input"
                  placeholder="parent@example.com"
                  defaultValue={profileData?.parentEmail ?? ""}
                  required
                />
              </div>
            ) : null}

            {missingFields.includes("parentPhone") ? (
              <div className="form-row">
                <label htmlFor="parentPhone">Parent or guardian phone</label>
                <input
                  id="parentPhone"
                  name="parentPhone"
                  type="tel"
                  className="input"
                  placeholder="(555) 123-4567"
                  defaultValue={profileData?.parentPhone ?? ""}
                  required
                />
              </div>
            ) : null}
          </div>

          {formError ? <div className="form-error">{formError}</div> : null}

          <div className="onboarding-actions">
            <button type="submit" className="button" disabled={isPending}>
              Finish onboarding
            </button>
            <div className="onboarding-actions-secondary">
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
                Back
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="onboarding-callout onboarding-callout-centered">
            Your school, grade, and parent or guardian details are already in place, so you are ready to move
            straight into the portal.
          </div>

          <div className="onboarding-actions">
            <button className="button" onClick={onNext} disabled={isPending}>
              Enter my dashboard
            </button>
            <div className="onboarding-actions-secondary">
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
                Back
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
