"use client";

import { useState, useEffect, useCallback } from "react";
import { SEED_CURRICULA, type SeedCurriculum } from "../curriculum-seeds";

// ═══════════════════════════════════════════════════════════════
// Lesson Design Studio — Interactive onboarding tour
// Guides the instructor through picking an interest area and
// progressively builds a complete 8-week curriculum.
// By the end of the tour they have a fully populated curriculum.
// ═══════════════════════════════════════════════════════════════

const ONBOARDING_KEY = "lds_onboarding_done";

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
    body: "We're going to build your complete 8-week curriculum together, step by step. By the end of this tour, you'll have a fully planned curriculum with activities, objectives, and homework for every single week. Ready?",
    icon: "🎨",
  },
  {
    kind: "pick-area",
    title: "What Will You Teach?",
    body: "Pick an interest area below and we'll scaffold a full 8-week curriculum for you. Don't worry — you can customize every detail afterward.",
    icon: "🎯",
  },
  {
    kind: "seed-header",
    title: "Setting Up Your Curriculum",
    body: "We just filled in your curriculum title, description, interest area, and 4 learning outcomes based on your choice. You can edit any of these later — scroll up to see them in the builder.",
    icon: "📋",
    seedHeader: true,
  },
  {
    kind: "seed-weeks-1-2",
    title: "Building Weeks 1 & 2",
    body: "Your first two weeks are now populated with activities, a learning objective, teacher prep notes, and an at-home assignment each. Each week has 3-5 activities with realistic timing that fits your class duration.",
    icon: "1️⃣",
    seedWeeks: [1, 2],
  },
  {
    kind: "seed-weeks-3-4",
    title: "Building Weeks 3 & 4",
    body: "Two more weeks added! Notice how the activities build on previous weeks — your curriculum has a natural progression from foundational concepts to applied skills.",
    icon: "2️⃣",
    seedWeeks: [3, 4],
  },
  {
    kind: "seed-weeks-5-6",
    title: "Building Weeks 5 & 6",
    body: "Weeks 5 and 6 are in. By now students are applying what they've learned through hands-on projects and group work. Check out the sidebar on the left — you can click any week pill to jump right to it.",
    icon: "3️⃣",
    seedWeeks: [5, 6],
  },
  {
    kind: "seed-weeks-7-8",
    title: "Building Weeks 7 & 8 — The Finale",
    body: "Your final two weeks are set! Week 7 wraps up the project work and Week 8 is the showcase/presentation. You now have a complete 8-week curriculum with activities, objectives, and homework on every week.",
    icon: "4️⃣",
    seedWeeks: [7, 8],
  },
  {
    kind: "show-expand",
    title: "Customize Any Activity",
    body: "Click the ▶ arrow on any activity to expand it inline. Add detailed descriptions, materials needed, energy levels, differentiation tips, standards tags, and rubrics (for assessments). Every field auto-saves.",
    icon: "✏️",
  },
  {
    kind: "show-details",
    title: "Week Details & Homework",
    body: "Click \"▶ Details\" on any week header to edit the learning objective, teacher prep notes, materials checklist, and at-home assignment. All 8 weeks already have these filled in from the template — customize them to fit your style.",
    icon: "📝",
  },
  {
    kind: "show-nav",
    title: "Navigate, Duplicate & Reorder",
    body: "Use the W1-W8 sidebar pills to jump between weeks. Click \"⧉ Duplicate\" to copy any week. Drag the ⠿ handle to reorder activities, or use \"Move to Week\" in the expanded view to shift them between weeks. Your work auto-saves and you can browse version history from the menu bar.",
    icon: "🧭",
  },
  {
    kind: "show-export",
    title: "Export & Submit",
    body: "Use \"Export PDF\" for a Student View (clean schedule) or full Instructor Guide (with prep notes and rubrics). When everything looks good, click \"Submit Curriculum\" — a checklist will verify you're ready. This is your final training module!",
    icon: "🚀",
  },
  {
    kind: "done",
    title: "Your 8-Week Curriculum Is Ready!",
    body: "You now have a complete curriculum with all 8 weeks built out. Every week has activities, objectives, and homework. Browse the examples panel on the left for more inspiration, or start customizing your weeks right now. Make it yours!",
    icon: "🎉",
  },
];

/* ── Component ─────────────────────────────────────────────── */

interface OnboardingTourProps {
  /** Callback to seed the curriculum header (title, description, etc.) */
  onSeedHeader?: (info: {
    title: string;
    description: string;
    interestArea: string;
    outcomes: string[];
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
}

export function OnboardingTour({
  onSeedHeader,
  onSeedWeeks,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [selectedSeed, setSelectedSeed] = useState<SeedCurriculum | null>(null);

  // Check if onboarding should show
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        const timer = setTimeout(() => setCurrentStep(0), 600);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

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

        <div className="lds-tour-icon" aria-hidden="true">{step.icon}</div>
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
                <span className="lds-tour-picker-icon">{seed.icon}</span>
                <span className="lds-tour-picker-label">{seed.label}</span>
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
