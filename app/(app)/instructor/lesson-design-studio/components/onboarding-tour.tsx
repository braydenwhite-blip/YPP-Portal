"use client";

import { useState, useEffect, useCallback } from "react";
import { SEED_CURRICULA, type SeedCurriculum } from "../curriculum-seeds";

// ═══════════════════════════════════════════════════════════════
// Lesson Design Studio — Interactive onboarding tour
// Guides the instructor through picking an interest area and
// progressively builds a complete 8-week curriculum.
// By the end of the tour they have a fully populated curriculum.
// ═══════════════════════════════════════════════════════════════

/* ── Step definitions ──────────────────────────────────────── */

type StepKind =
  | "welcome"
  | "pick-area"
  | "seed-header"
  | "seed-weeks-1-2"
  | "seed-weeks-3-4"
  | "seed-weeks-5-6"
  | "seed-weeks-7-8"
  | "show-expand"
  | "show-details"
  | "show-nav"
  | "show-export"
  | "done";

interface TourStep {
  kind: StepKind;
  title: string;
  body: string;
  icon: string;
  /** Which weeks to seed when this step fires (inclusive, 1-indexed) */
  seedWeeks?: [number, number];
  /** If true, this step seeds the header info (title, description, outcomes) */
  seedHeader?: boolean;
}

const STEPS: TourStep[] = [
  {
    kind: "welcome",
    title: "Welcome to the Lesson Design Studio",
    body: "We're going to build a complete first curriculum together, step by step. By the end of this tour, you'll have a full draft with outcomes, session objectives, activity pacing, and at-home work across the whole course. The goal is not just to fill boxes. The goal is to leave with something you can actually teach.",
    icon: "🎨",
  },
  {
    kind: "pick-area",
    title: "What Will You Teach?",
    body: "Pick an interest area below and we'll scaffold a full starter curriculum for you. These are strong teaching models, not scripts. You can and should customize the language, examples, assignments, and pacing for your students afterward.",
    icon: "🎯",
  },
  {
    kind: "seed-header",
    title: "Setting Up Your Curriculum",
    body: "We just filled in your curriculum title, description, interest area, and learning outcomes based on your choice. These outcomes matter because they give the whole course a finish line. You can edit every word later, but keep the idea that the course should clearly lead somewhere.",
    icon: "📋",
    seedHeader: true,
  },
  {
    kind: "seed-weeks-1-2",
    title: "Building Weeks 1 & 2",
    body: "Your first two weeks are now populated with activities, a learning objective, teacher prep notes, and an at-home assignment each. Notice that the pacing is realistic, the session has a clear arc, and the homework extends the learning instead of drifting into something unrelated.",
    icon: "1️⃣",
    seedWeeks: [1, 2],
  },
  {
    kind: "seed-weeks-3-4",
    title: "Building Weeks 3 & 4",
    body: "Two more weeks added. Notice how the sequence keeps moving from foundation into application. Strong curricula do not feel like random good lessons placed beside each other. They feel like each week earns the next one.",
    icon: "2️⃣",
    seedWeeks: [3, 4],
  },
  {
    kind: "seed-weeks-5-6",
    title: "Building Weeks 5 & 6",
    body: "Weeks 5 and 6 are in. By this point, students should be using what they have learned in more independent or collaborative ways. That shift matters. It shows the course is moving toward transfer, not staying in teacher-led explanation forever.",
    icon: "3️⃣",
    seedWeeks: [5, 6],
  },
  {
    kind: "seed-weeks-7-8",
    title: "Building Weeks 7 & 8 — The Finale",
    body: "Your final two weeks are set. The ending of a course should feel earned. By now, the sequence should be carrying students toward a showcase, synthesis, or real application that proves the earlier weeks mattered.",
    icon: "4️⃣",
    seedWeeks: [7, 8],
  },
  {
    kind: "show-expand",
    title: "Customize Any Activity",
    body: "Click the ▶ arrow on any activity to expand it inline. Add detailed descriptions, materials needed, energy levels, differentiation tips, standards tags, and rubrics for assessments. This is where a lesson stops being a rough outline and starts becoming something a real instructor can run with confidence.",
    icon: "✏️",
  },
  {
    kind: "show-details",
    title: "Week Details & Homework",
    body: "Click \"▶ Details\" on any week header to edit the learning objective, teacher prep notes, materials checklist, and at-home assignment. The strongest homework here reinforces class learning, and the strongest prep notes protect the instructor from avoidable surprises on teaching day.",
    icon: "📝",
  },
  {
    kind: "show-nav",
    title: "Navigate, Duplicate & Reorder",
    body: "Use the session pills in the sidebar to jump around quickly. Click \"⧉ Duplicate\" to copy a strong pattern forward, then adapt it. Drag the ⠿ handle to reorder activities, or use \"Move to Session\" in the expanded view to shift them. Reuse thoughtfully. A repeated structure is fine if the learning purpose still changes.",
    icon: "🧭",
  },
  {
    kind: "show-export",
    title: "Export & Submit",
    body: "Use \"Export PDF\" for a Student View or a full Instructor Guide. Before submission, the studio will check that your course is fully built and that you've passed the understanding check. The goal is for your submission to be a launchable first curriculum, not just a promising idea.",
    icon: "🚀",
  },
  {
    kind: "done",
    title: "Your 8-Week Curriculum Is Ready!",
    body: "You now have a complete curriculum draft across all 8 weeks. Every week has activities, objectives, and homework. Now the real craft work begins: tighten the pacing, improve the examples, study the gold examples on the left, and make every session feel truly yours and truly teachable.",
    icon: "🎉",
  },
];

/* ── Component ─────────────────────────────────────────────── */

interface OnboardingTourProps {
  storageKey: string;
  /** Callback to seed the curriculum header (title, description, etc.) */
  onSeedHeader?: (info: {
    title: string;
    description: string;
    interestArea: string;
    outcomes: string[];
    durationWeeks: number;
    classDurationMin: number;
  }) => void;
  /** Callback to seed specific weeks into the curriculum */
  onSeedWeeks?: (
    weeks: Array<{
      title: string;
      objective: string;
      teacherPrepNotes: string;
      classDurationMin: number;
      activities: Array<{
        title: string;
        type: string;
        durationMin: number;
        description: string;
      }>;
      atHomeAssignment: {
        type: string;
        title: string;
        description: string;
      };
    }>
  ) => void;
  onComplete?: () => void | Promise<void>;
}

export function OnboardingTour({
  storageKey,
  onSeedHeader,
  onSeedWeeks,
  onComplete,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [selectedSeed, setSelectedSeed] = useState<SeedCurriculum | null>(null);

  // Check if onboarding should show
  useEffect(() => {
    try {
      const onboardingState = localStorage.getItem(storageKey);
      if (onboardingState) {
        return;
      }
      const timer = setTimeout(() => setCurrentStep(0), 600);
      return () => clearTimeout(timer);
    } catch {
      setCurrentStep(0);
    }
  }, [storageKey]);

  // Fire seed actions when advancing to certain steps
  useEffect(() => {
    if (currentStep === null || !selectedSeed) return;
    const step = STEPS[currentStep];

    if (step.seedHeader && onSeedHeader) {
      onSeedHeader({
        title: selectedSeed.title,
        description: selectedSeed.description,
        interestArea: selectedSeed.interestArea,
        outcomes: selectedSeed.outcomes,
        durationWeeks: selectedSeed.weeks.length,
        classDurationMin: selectedSeed.classDurationMin,
      });
    }

    if (step.seedWeeks && onSeedWeeks) {
      const [from, to] = step.seedWeeks;
      const weeksToSeed = selectedSeed.weeks.slice(from - 1, to);
      onSeedWeeks(
        weeksToSeed.map((w) => ({
          title: w.title,
          objective: w.objective,
          teacherPrepNotes: w.teacherPrepNotes,
          classDurationMin: selectedSeed.classDurationMin,
          activities: w.activities.map((a) => ({
            title: a.title,
            type: a.type,
            durationMin: a.durationMin,
            description: a.description,
          })),
          atHomeAssignment: w.atHomeAssignment,
        }))
      );
    }
  }, [currentStep, selectedSeed, onSeedHeader, onSeedWeeks]);

  const advance = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= STEPS.length) {
        try {
          localStorage.setItem(storageKey, "completed");
        } catch {}
        void onComplete?.();
        return null;
      }
      return next;
    });
  }, [onComplete, storageKey]);

  const skip = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "skipped");
    } catch {}
    setCurrentStep(null);
  }, [storageKey]);

  const handlePickArea = useCallback(
    (seed: SeedCurriculum) => {
      setSelectedSeed(seed);
      // Advance past the "pick-area" step
      setCurrentStep((prev) => (prev !== null ? prev + 1 : null));
    },
    []
  );

  if (currentStep === null) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isPicker = step.kind === "pick-area";
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Count how many weeks have been seeded so far
  const seededCount = (() => {
    if (!selectedSeed) return 0;
    let count = 0;
    for (let i = 0; i <= currentStep; i++) {
      const s = STEPS[i];
      if (s.seedWeeks) count += s.seedWeeks[1] - s.seedWeeks[0] + 1;
    }
    return count;
  })();

  return (
    <div
      className="lds-tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Studio onboarding tour"
    >
      <div className="lds-tour-backdrop" onClick={isPicker ? undefined : advance} />

      <div className="lds-tour-card" aria-live="polite">
        {/* Progress bar */}
        <div
          className="lds-tour-progress"
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <div
            className="lds-tour-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="lds-tour-step-eyebrow">
          {selectedSeed ? selectedSeed.label : "Studio onboarding"}
        </div>
        <div className="lds-tour-icon" aria-hidden="true">{step.icon}</div>
        <div className="lds-tour-step-meta">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          {selectedSeed ? (
            <>
              <span aria-hidden="true">•</span>
              <span>{selectedSeed.classDurationMin} minute sessions</span>
            </>
          ) : null}
        </div>
        <h3 className="lds-tour-title">{step.title}</h3>
        <p className="lds-tour-body">{step.body}</p>

        {/* Week progress indicator (show after picking area) */}
        {selectedSeed && seededCount > 0 && !isPicker && (
          <div className="lds-tour-week-progress">
            <div className="lds-tour-week-bar">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className={`lds-tour-week-pip${i < seededCount ? " lds-tour-week-pip-done" : ""}`}
                >
                  W{i + 1}
                </div>
              ))}
            </div>
            <div className="lds-tour-week-label">
              {seededCount}/8 weeks built
            </div>
          </div>
        )}

        {/* Interest area picker */}
        {isPicker ? (
          <div className="lds-tour-picker">
            {SEED_CURRICULA.map((seed) => (
              <button
                key={seed.id}
                type="button"
                className="lds-tour-picker-btn"
                onClick={() => handlePickArea(seed)}
              >
                <div className="lds-tour-picker-top">
                  <span className="lds-tour-picker-icon">{seed.icon}</span>
                  <span className="lds-tour-picker-meta">
                    <span>{seed.weeks.length} weeks</span>
                    <span>{seed.classDurationMin} min</span>
                  </span>
                </div>
                <span className="lds-tour-picker-title">{seed.label}</span>
                <span className="lds-tour-picker-desc">{seed.description}</span>
                <div className="lds-tour-picker-preview" aria-hidden="true">
                  {seed.weeks.slice(0, 3).map((week, index) => (
                    <span key={`${seed.id}-${week.title}`} className="lds-tour-picker-preview-row">
                      <span className="lds-tour-picker-preview-index">W{index + 1}</span>
                      <span className="lds-tour-picker-preview-line" />
                      <span className="lds-tour-picker-preview-title">{week.title}</span>
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="lds-tour-actions">
            <button
              className="lds-tour-skip"
              onClick={skip}
              type="button"
            >
              {selectedSeed && seededCount < 8 ? "Skip (keep what's built)" : "Skip tour"}
            </button>
            <button
              className="lds-tour-next"
              onClick={advance}
              type="button"
            >
              {isLast ? "Start Customizing!" : "Next"}
            </button>
          </div>
        )}

        {/* Step dots */}
        <div className="lds-tour-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`lds-tour-dot${i === currentStep ? " lds-tour-dot-active" : ""}${i < currentStep ? " lds-tour-dot-done" : ""}`}
            />
          ))}
        </div>

        <div className="lds-tour-counter">
          {currentStep + 1} / {STEPS.length}
        </div>
      </div>
    </div>
  );
}
