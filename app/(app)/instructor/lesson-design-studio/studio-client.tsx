"use client";

import { useState, useCallback } from "react";
import { BootScreen } from "./components/boot-screen";
import { IntroPanel } from "./components/intro-panel";
import { ExampleViewer } from "./components/example-viewer";
import { PlanBuilderPanel } from "./components/plan-builder-panel";
import { CompletionScreen } from "./components/completion-screen";
import { OsDock } from "./components/os-dock";

// ── Types ──────────────────────────────────────────────────────

interface LessonBlueprint {
  index: number;
  topic: string;
  lessonGoal: string;
  warmUpHook: string;
  miniLesson: string;
  guidedPractice: string;
  independentBuild: string;
  exitTicket: string;
  materialsTools: string;
}

interface CurriculumData {
  id: string;
  title: string;
  interestArea: string;
  lessons: LessonBlueprint[];
}

interface SavedPlan {
  id: string;
  title: string;
  description: string | null;
  totalMinutes: number;
  classTemplateId: string | null;
  isTemplate: boolean;
  updatedAt: string;
  activities: Array<{
    id: string;
    title: string;
    description: string | null;
    type: string;
    durationMin: number;
    sortOrder: number;
    resources: string | null;
    notes: string | null;
  }>;
}

interface StudioClientProps {
  userId: string;
  userName: string;
  curriculum: CurriculumData | null;
  existingPlans: SavedPlan[];
}

// ── Phase constants ─────────────────────────────────────────────
// 0 = Boot, 1 = Intro, 2 = Good Examples, 3 = Bad Examples,
// 4 = Build Plans, 5 = Complete

const PHASE_LABELS = ["Boot", "Intro", "Good Examples", "Bad Examples", "Build Plans", "Complete"];
const DOCK_PHASES = ["Intro", "Good ✓", "Bad ✗", "Build", "Done"];

export function StudioClient({ userId, userName, curriculum, existingPlans }: StudioClientProps) {
  // Check localStorage for saved progress so returning users skip the boot
  const progressKey = `lds-progress-${userId}`;

  function getInitialPhase() {
    if (typeof window === "undefined") return 0;
    try {
      const saved = localStorage.getItem(progressKey);
      if (saved) {
        const n = parseInt(saved, 10);
        // Return to phase 4 (Build) if they had started, else phase 0 (Boot)
        return n >= 1 ? Math.min(n, 4) : 0;
      }
    } catch {
      // ignore
    }
    return 0;
  }

  const [phase, setPhase] = useState<number>(getInitialPhase);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);

  // Track which plans have been saved this session, keyed by lesson index
  // Pre-populate from server-loaded existing plans
  const [savedPlansByLesson, setSavedPlansByLesson] = useState<Map<number, SavedPlan>>(() => {
    const map = new Map<number, SavedPlan>();
    if (curriculum) {
      existingPlans.forEach((plan, i) => {
        // Try to match existing plans to lesson indexes by order
        map.set(i, plan as SavedPlan);
      });
    } else if (existingPlans.length > 0) {
      map.set(0, existingPlans[0] as SavedPlan);
    }
    return map;
  });

  const [savedPlansForCompletion, setSavedPlansForCompletion] = useState<
    Array<{ planId: string; title: string; totalMinutes: number }>
  >(() =>
    existingPlans.map((p) => ({ planId: p.id, title: p.title, totalMinutes: p.totalMinutes }))
  );

  const advancePhase = useCallback(
    (next: number) => {
      setPhase(next);
      try {
        localStorage.setItem(progressKey, String(next));
      } catch {
        // ignore
      }
    },
    [progressKey]
  );

  const handlePlanSaved = useCallback(
    (lessonIdx: number, planId: string, title: string, totalMinutes: number) => {
      // Update savedPlansByLesson
      setSavedPlansByLesson((prev) => {
        const next = new Map(prev);
        const existing = next.get(lessonIdx);
        next.set(lessonIdx, {
          ...(existing ?? ({} as SavedPlan)),
          id: planId,
          title,
          totalMinutes,
        } as SavedPlan);
        return next;
      });

      // Update completion list
      setSavedPlansForCompletion((prev) => {
        const filtered = prev.filter((p) => p.planId !== planId);
        return [...filtered, { planId, title, totalMinutes }];
      });
    },
    []
  );

  // Determine lessons to show in the builder
  const lessons: Array<LessonBlueprint | null> = curriculum
    ? curriculum.lessons
    : [null]; // Applicant path: single blank lesson

  const totalLessons = lessons.length;

  // ── Dock items for lesson slots ───────────────────────────────
  const dockItems = curriculum
    ? lessons.map((l, i) => ({
        index: i,
        label: l?.topic.slice(0, 12) || `L${i + 1}`,
        isSaved: savedPlansByLesson.has(i),
        isActive: phase === 4 && i === activeLessonIndex,
      }))
    : [];

  // ── Render ────────────────────────────────────────────────────

  if (phase === 0) {
    return (
      <div className="lesson-design-studio">
        <BootScreen onComplete={() => advancePhase(1)} />
      </div>
    );
  }

  return (
    <div className="lesson-design-studio">
      {/* Menu bar */}
      <div className="os-menubar">
        <div className="os-menubar-logo">
          <span>🎨</span>
          <strong>Lesson Design Studio</strong>
        </div>
        {curriculum && (
          <span className="os-menubar-title">— {curriculum.title}</span>
        )}
        <div className="os-menubar-spacer" />
        <div className="os-menubar-progress">
          <div className="os-menubar-dots">
            {DOCK_PHASES.map((label, i) => {
              const phaseNum = i + 1;
              return (
                <div
                  key={label}
                  className={`os-menubar-dot ${phase > phaseNum ? "done" : phase === phaseNum ? "active" : ""}`}
                  title={label}
                />
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: "var(--os-text-dim)" }}>
            {PHASE_LABELS[phase]}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="os-content">
        {phase === 1 && (
          <IntroPanel onNext={() => advancePhase(2)} />
        )}

        {phase === 2 && (
          <ExampleViewer
            mode="good"
            onNext={() => advancePhase(3)}
            onBack={() => advancePhase(1)}
          />
        )}

        {phase === 3 && (
          <ExampleViewer
            mode="bad"
            onNext={() => advancePhase(4)}
            onBack={() => advancePhase(2)}
          />
        )}

        {phase === 4 && (
          <>
            <div className="os-phase-header">
              <div className="os-phase-eyebrow">Phase 4 of 5 — Build Your Plans</div>
              <h2 className="os-phase-title">
                {curriculum
                  ? `Build all ${totalLessons} lesson plan${totalLessons === 1 ? "" : "s"} for "${curriculum.title}"`
                  : "Build your first lesson plan"}
              </h2>
              <p className="os-phase-sub">
                {curriculum
                  ? `Your curriculum's lesson outlines are pre-loaded. Edit each one, add or adjust activities, then save. You can come back and update any plan at any time.`
                  : "Create your first lesson plan. Add activities, set durations, and save when you're ready."}
              </p>
            </div>

            <PlanBuilderPanel
              lesson={lessons[activeLessonIndex]}
              lessonIndex={activeLessonIndex}
              totalLessons={totalLessons}
              classTemplateId={curriculum?.id ?? null}
              existingPlan={(savedPlansByLesson.get(activeLessonIndex) ?? null) as SavedPlan | null}
              onSaved={(planId, title, totalMinutes) =>
                handlePlanSaved(activeLessonIndex, planId, title, totalMinutes)
              }
              onSelectLesson={(i) => setActiveLessonIndex(i)}
              allLessons={lessons}
              savedPlansByLesson={savedPlansByLesson}
            />

            <div className="os-nav-actions">
              <button
                className="os-btn os-btn-secondary"
                onClick={() => advancePhase(3)}
                type="button"
              >
                ← Back to Examples
              </button>
              <button
                className="os-btn os-btn-primary"
                onClick={() => advancePhase(5)}
                type="button"
              >
                Finish →
              </button>
            </div>
          </>
        )}

        {phase === 5 && (
          <CompletionScreen
            savedPlans={savedPlansForCompletion}
            curriculumId={curriculum?.id ?? null}
            curriculumTitle={curriculum?.title ?? null}
          />
        )}
      </div>

      {/* Dock — only show from phase 1+ */}
      {phase >= 1 && (
        <OsDock
          items={dockItems}
          onSelect={(i) => {
            setActiveLessonIndex(i);
            if (phase !== 4) advancePhase(4);
          }}
          phase={phase - 1}
          phases={DOCK_PHASES}
        />
      )}
    </div>
  );
}
