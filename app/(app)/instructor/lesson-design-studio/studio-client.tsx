"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { saveCurriculumDraft, submitCurriculumDraft } from "@/lib/curriculum-draft-actions";
import { ExampleCurriculumPanel } from "./components/example-curriculum-panel";
import { CurriculumBuilderPanel } from "./components/curriculum-builder-panel";
import { ActivityDetailDrawer } from "./components/activity-detail-drawer";
import { ActivityTemplates } from "./components/activity-templates";
import type { ExampleWeek } from "./examples-data";
import { OnboardingTour } from "./components/onboarding-tour";

// ── Types ──────────────────────────────────────────────────

export type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

export type EnergyLevel = "HIGH" | "MEDIUM" | "LOW";

export type AtHomeAssignmentType =
  | "REFLECTION_PROMPT"
  | "PRACTICE_TASK"
  | "QUIZ"
  | "PRE_READING";

export interface AtHomeAssignment {
  type: AtHomeAssignmentType;
  title: string;
  description: string;
}

export interface WeekActivity {
  id: string;
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string | null;
  resources: string | null;
  notes: string | null;
  sortOrder: number;
  // Enhanced fields
  materials: string | null;
  differentiationTips: string | null;
  energyLevel: EnergyLevel | null;
  standardsTags: string[];
  rubric: string | null;
}

export interface WeekPlan {
  id: string;
  weekNumber: number;
  title: string;
  classDurationMin: number;
  activities: WeekActivity[];
  // Enhanced fields
  objective: string | null;
  teacherPrepNotes: string | null;
  materialsChecklist: string[];
  atHomeAssignment: AtHomeAssignment | null;
}

interface DraftData {
  id: string;
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  weeklyPlans: unknown[];
  status: string;
  updatedAt: string;
}

interface StudioClientProps {
  userId: string;
  userName: string;
  draft: DraftData;
}

interface HistoryVersion {
  savedAt: string;
  snapshot: {
    title: string;
    description: string;
    interestArea: string;
    outcomes: string[];
    weeklyPlans: WeekPlan[];
  };
}

function generateId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normalizeActivity(a: any): WeekActivity {
  return {
    id: a.id ?? generateId(),
    title: a.title ?? "",
    type: a.type ?? "WARM_UP",
    durationMin: a.durationMin ?? 10,
    description: a.description ?? null,
    resources: a.resources ?? null,
    notes: a.notes ?? null,
    sortOrder: a.sortOrder ?? 0,
    materials: a.materials ?? null,
    differentiationTips: a.differentiationTips ?? null,
    energyLevel: a.energyLevel ?? null,
    standardsTags: Array.isArray(a.standardsTags) ? a.standardsTags : [],
    rubric: a.rubric ?? null,
  };
}

function normalizeWeek(w: any): WeekPlan {
  return {
    id: w.id ?? generateId(),
    weekNumber: w.weekNumber ?? 1,
    title: w.title ?? "",
    classDurationMin: w.classDurationMin ?? 60,
    activities: Array.isArray(w.activities) ? w.activities.map(normalizeActivity) : [],
    objective: w.objective ?? null,
    teacherPrepNotes: w.teacherPrepNotes ?? null,
    materialsChecklist: Array.isArray(w.materialsChecklist) ? w.materialsChecklist : [],
    atHomeAssignment: w.atHomeAssignment ?? null,
  };
}

// ── Component ──────────────────────────────────────────────

export function StudioClient({ userId, userName, draft }: StudioClientProps) {
  // ── State ────────────────────────────────────────────────
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [interestArea, setInterestArea] = useState(draft.interestArea);
  const [outcomes, setOutcomes] = useState<string[]>(draft.outcomes);
  const [weeklyPlans, setWeeklyPlans] = useState<WeekPlan[]>(() => {
    const plans = draft.weeklyPlans as any[];
    return Array.isArray(plans) && plans.length > 0
      ? plans.map(normalizeWeek)
      : [
          {
            id: generateId(),
            weekNumber: 1,
            title: "",
            classDurationMin: 60,
            activities: [],
            objective: null,
            teacherPrepNotes: null,
            materialsChecklist: [],
            atHomeAssignment: null,
          },
        ];
  });

  const [activeExampleTab, setActiveExampleTab] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSubmitted, setIsSubmitted] = useState(draft.status === "SUBMITTED");

  // Activity drawer state (kept for mobile fallback)
  const [drawerWeekId, setDrawerWeekId] = useState<string | null>(null);
  const [drawerActivityId, setDrawerActivityId] = useState<string | null>(null);

  // Templates modal state
  const [templatesWeekId, setTemplatesWeekId] = useState<string | null>(null);

  // Mobile tab state
  const [mobileView, setMobileView] = useState<"examples" | "builder">("builder");

  // Onboarding tour state
  const [tourKey, setTourKey] = useState(0);

  // Version history state
  const [showHistory, setShowHistory] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<HistoryVersion[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`lds_history_${draft.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // ── Auto-save ────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const pushToHistory = useCallback(
    (t: string, d: string, ia: string, oc: string[], wp: WeekPlan[]) => {
      const version: HistoryVersion = {
        savedAt: new Date().toISOString(),
        snapshot: { title: t, description: d, interestArea: ia, outcomes: oc, weeklyPlans: wp },
      };
      setHistoryVersions((prev) => {
        const next = [version, ...prev].slice(0, 10);
        try {
          localStorage.setItem(`lds_history_${draft.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [draft.id]
  );

  const triggerAutoSave = useCallback(
    (t: string, d: string, ia: string, oc: string[], wp: WeekPlan[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        setSaveStatus("saving");
        try {
          await saveCurriculumDraft({
            draftId: draft.id,
            title: t,
            description: d,
            interestArea: ia,
            outcomes: oc,
            weeklyPlans: wp,
          });
          if (isMountedRef.current) {
            setSaveStatus("saved");
            pushToHistory(t, d, ia, oc, wp);
          }
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 2000);
        } catch {
          if (isMountedRef.current) setSaveStatus("error");
        }
      }, 1500);
    },
    [draft.id, pushToHistory]
  );

  // ── Field update handlers ────────────────────────────────

  const handleUpdate = useCallback(
    (field: string, value: unknown) => {
      let nextTitle = title;
      let nextDesc = description;
      let nextIA = interestArea;
      let nextOC = outcomes;

      switch (field) {
        case "title":
          nextTitle = value as string;
          setTitle(nextTitle);
          break;
        case "description":
          nextDesc = value as string;
          setDescription(nextDesc);
          break;
        case "interestArea":
          nextIA = value as string;
          setInterestArea(nextIA);
          break;
        case "outcomes":
          nextOC = value as string[];
          setOutcomes(nextOC);
          break;
      }
      triggerAutoSave(nextTitle, nextDesc, nextIA, nextOC, weeklyPlans);
    },
    [title, description, interestArea, outcomes, weeklyPlans, triggerAutoSave]
  );

  const handleUpdateWeek = useCallback(
    (weekId: string, field: string, value: unknown) => {
      setWeeklyPlans((prev) => {
        const next = prev.map((w) =>
          w.id === weekId ? { ...w, [field]: value } : w
        );
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleAddWeek = useCallback(() => {
    setWeeklyPlans((prev) => {
      const next = [
        ...prev,
        {
          id: generateId(),
          weekNumber: prev.length + 1,
          title: "",
          classDurationMin: 60,
          activities: [],
          objective: null,
          teacherPrepNotes: null,
          materialsChecklist: [],
          atHomeAssignment: null,
        },
      ];
      triggerAutoSave(title, description, interestArea, outcomes, next);
      return next;
    });
  }, [title, description, interestArea, outcomes, triggerAutoSave]);

  const handleRemoveWeek = useCallback(
    (weekId: string) => {
      setWeeklyPlans((prev) => {
        const next = prev
          .filter((w) => w.id !== weekId)
          .map((w, i) => ({ ...w, weekNumber: i + 1 }));
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleDuplicateWeek = useCallback(
    (weekId: string) => {
      setWeeklyPlans((prev) => {
        const sourceIndex = prev.findIndex((w) => w.id === weekId);
        if (sourceIndex === -1) return prev;
        const source = prev[sourceIndex];
        const duplicate: WeekPlan = {
          ...source,
          id: generateId(),
          title: source.title ? `${source.title} (Copy)` : "Copy",
          activities: source.activities.map((a) => ({ ...a, id: generateId() })),
          weekNumber: sourceIndex + 2,
        };
        const next = [
          ...prev.slice(0, sourceIndex + 1),
          duplicate,
          ...prev.slice(sourceIndex + 1),
        ].map((w, i) => ({ ...w, weekNumber: i + 1 }));
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleAddActivity = useCallback(
    (weekId: string, activity: Omit<WeekActivity, "id" | "sortOrder">) => {
      setWeeklyPlans((prev) => {
        const next = prev.map((w) => {
          if (w.id !== weekId) return w;
          const newActivity: WeekActivity = {
            ...activity,
            id: generateId(),
            sortOrder: w.activities.length,
          };
          return { ...w, activities: [...w.activities, newActivity] };
        });
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleRemoveActivity = useCallback(
    (weekId: string, activityId: string) => {
      setWeeklyPlans((prev) => {
        const next = prev.map((w) => {
          if (w.id !== weekId) return w;
          return {
            ...w,
            activities: w.activities
              .filter((a) => a.id !== activityId)
              .map((a, i) => ({ ...a, sortOrder: i })),
          };
        });
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
      if (drawerActivityId === activityId) {
        setDrawerWeekId(null);
        setDrawerActivityId(null);
      }
    },
    [title, description, interestArea, outcomes, triggerAutoSave, drawerActivityId]
  );

  const handleUpdateActivity = useCallback(
    (weekId: string, activityId: string, fields: Partial<WeekActivity>) => {
      setWeeklyPlans((prev) => {
        const next = prev.map((w) => {
          if (w.id !== weekId) return w;
          return {
            ...w,
            activities: w.activities.map((a) =>
              a.id === activityId ? { ...a, ...fields } : a
            ),
          };
        });
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleReorderActivities = useCallback(
    (weekId: string, activeId: string, overId: string) => {
      setWeeklyPlans((prev) => {
        const next = prev.map((w) => {
          if (w.id !== weekId) return w;
          const oldIndex = w.activities.findIndex((a) => a.id === activeId);
          const newIndex = w.activities.findIndex((a) => a.id === overId);
          if (oldIndex === -1 || newIndex === -1) return w;
          const items = [...w.activities];
          const [moved] = items.splice(oldIndex, 1);
          items.splice(newIndex, 0, moved);
          return { ...w, activities: items.map((a, i) => ({ ...a, sortOrder: i })) };
        });
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleMoveActivityToWeek = useCallback(
    (fromWeekId: string, activityId: string, toWeekId: string) => {
      setWeeklyPlans((prev) => {
        const fromWeek = prev.find((w) => w.id === fromWeekId);
        const activity = fromWeek?.activities.find((a) => a.id === activityId);
        if (!activity) return prev;
        const next = prev.map((w) => {
          if (w.id === fromWeekId) {
            return {
              ...w,
              activities: w.activities
                .filter((a) => a.id !== activityId)
                .map((a, i) => ({ ...a, sortOrder: i })),
            };
          }
          if (w.id === toWeekId) {
            return {
              ...w,
              activities: [...w.activities, { ...activity, sortOrder: w.activities.length }],
            };
          }
          return w;
        });
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  const handleImportWeek = useCallback(
    (week: ExampleWeek) => {
      setWeeklyPlans((prev) => {
        const newWeek: WeekPlan = {
          id: generateId(),
          weekNumber: prev.length + 1,
          title: week.title,
          classDurationMin: 60,
          activities: week.activities.map((a, i) => ({
            id: generateId(),
            title: a.title,
            type: a.type,
            durationMin: a.durationMin,
            description: a.description,
            resources: null,
            notes: null,
            sortOrder: i,
            materials: null,
            differentiationTips: null,
            energyLevel: null,
            standardsTags: [],
            rubric: null,
          })),
          objective: week.goal,
          teacherPrepNotes: week.teachingTips ?? null,
          materialsChecklist: [],
          atHomeAssignment: week.atHomeAssignment
            ? {
                type: week.atHomeAssignment.type,
                title: week.atHomeAssignment.title,
                description: week.atHomeAssignment.description,
              }
            : null,
        };
        const next = [...prev, newWeek];
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  // ── Tour seed handlers ─────────────────────────────────────

  const handleTourSeedHeader = useCallback(
    (info: { title: string; description: string; interestArea: string; outcomes: string[] }) => {
      setTitle(info.title);
      setDescription(info.description);
      setInterestArea(info.interestArea);
      setOutcomes(info.outcomes);
      // Clear existing default empty week so seed weeks start fresh
      setWeeklyPlans((prev) => {
        // Only clear if there's just 1 empty untitled week
        if (prev.length === 1 && !prev[0].title && prev[0].activities.length === 0) {
          return [];
        }
        return prev;
      });
      triggerAutoSave(info.title, info.description, info.interestArea, info.outcomes, weeklyPlans);
    },
    [weeklyPlans, triggerAutoSave]
  );

  const handleTourSeedWeeks = useCallback(
    (
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
    ) => {
      setWeeklyPlans((prev) => {
        const newWeeks: WeekPlan[] = weeks.map((w, idx) => ({
          id: generateId(),
          weekNumber: prev.length + idx + 1,
          title: w.title,
          classDurationMin: w.classDurationMin,
          activities: w.activities.map((a, ai) => ({
            id: generateId(),
            title: a.title,
            type: a.type as ActivityType,
            durationMin: a.durationMin,
            description: a.description,
            resources: null,
            notes: null,
            sortOrder: ai,
            materials: null,
            differentiationTips: null,
            energyLevel: null,
            standardsTags: [],
            rubric: null,
          })),
          objective: w.objective,
          teacherPrepNotes: w.teacherPrepNotes,
          materialsChecklist: [],
          atHomeAssignment: {
            type: w.atHomeAssignment.type as AtHomeAssignmentType,
            title: w.atHomeAssignment.title,
            description: w.atHomeAssignment.description,
          },
        }));
        const next = [...prev, ...newWeeks];
        triggerAutoSave(title, description, interestArea, outcomes, next);
        return next;
      });
    },
    [title, description, interestArea, outcomes, triggerAutoSave]
  );

  // ── Drawer ───────────────────────────────────────────────

  const handleOpenDrawer = useCallback((weekId: string, activityId: string) => {
    setDrawerWeekId(weekId);
    setDrawerActivityId(activityId);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerWeekId(null);
    setDrawerActivityId(null);
  }, []);

  const drawerActivity = (() => {
    if (!drawerWeekId || !drawerActivityId) return null;
    const week = weeklyPlans.find((w) => w.id === drawerWeekId);
    return week?.activities.find((a) => a.id === drawerActivityId) ?? null;
  })();

  // ── Templates modal ──────────────────────────────────────

  const handleOpenTemplates = useCallback((weekId: string) => {
    setTemplatesWeekId(weekId);
  }, []);

  const handleInsertTemplate = useCallback(
    (template: { title: string; type: ActivityType; durationMin: number; description: string }) => {
      if (!templatesWeekId) return;
      handleAddActivity(templatesWeekId, {
        title: template.title,
        type: template.type,
        durationMin: template.durationMin,
        description: template.description,
        resources: null,
        notes: null,
        materials: null,
        differentiationTips: null,
        energyLevel: null,
        standardsTags: [],
        rubric: null,
      });
    },
    [templatesWeekId, handleAddActivity]
  );

  // ── PDF export ───────────────────────────────────────────

  const handleExportPdf = useCallback((type: "student" | "instructor") => {
    window.open(
      `/instructor/lesson-design-studio/print?draftId=${draft.id}&type=${type}`,
      "_blank"
    );
  }, [draft.id]);

  // ── Submit ───────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    try {
      await submitCurriculumDraft(draft.id);
      setIsSubmitted(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit");
    }
  }, [draft.id]);

  // ── Version history restore ──────────────────────────────

  const handleRestoreVersion = useCallback(
    (version: HistoryVersion) => {
      const { snapshot } = version;
      setTitle(snapshot.title);
      setDescription(snapshot.description);
      setInterestArea(snapshot.interestArea);
      setOutcomes(snapshot.outcomes);
      setWeeklyPlans(snapshot.weeklyPlans);
      setShowHistory(false);
      triggerAutoSave(
        snapshot.title,
        snapshot.description,
        snapshot.interestArea,
        snapshot.outcomes,
        snapshot.weeklyPlans
      );
    },
    [triggerAutoSave]
  );

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="cbs-studio">
      {/* Menu bar */}
      <div className="cbs-menubar">
        <div className="cbs-menubar-logo">
          <span className="cbs-menubar-icon">📚</span>
          <strong>Curriculum Builder Studio</strong>
        </div>
        <div className="cbs-menubar-spacer" />
        <div className="cbs-menubar-status">
          {saveStatus === "saving" && <span className="cbs-status-saving">Saving...</span>}
          {saveStatus === "saved" && <span className="cbs-status-saved">✓ Auto-saved</span>}
          {saveStatus === "error" && <span className="cbs-status-error">Save failed</span>}
          {isSubmitted && <span className="cbs-status-submitted">✓ Submitted</span>}
          <button
            className="cbs-menubar-tour-btn"
            onClick={() => {
              try { localStorage.removeItem("lds_onboarding_done"); } catch {}
              setTourKey((k) => k + 1);
            }}
            type="button"
          >
            ? Tour
          </button>
          {historyVersions.length > 0 && (
            <button
              className="cbs-menubar-history-btn"
              onClick={() => setShowHistory(true)}
              type="button"
            >
              History
            </button>
          )}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="cbs-mobile-tabs">
        <button
          className={`cbs-mobile-tab ${mobileView === "examples" ? "active" : ""}`}
          onClick={() => setMobileView("examples")}
          type="button"
        >
          Examples
        </button>
        <button
          className={`cbs-mobile-tab ${mobileView === "builder" ? "active" : ""}`}
          onClick={() => setMobileView("builder")}
          type="button"
        >
          My Curriculum
        </button>
      </div>

      {/* Split screen */}
      <div className="cbs-split">
        <div className={`cbs-split-left ${mobileView === "examples" ? "cbs-mobile-visible" : "cbs-mobile-hidden"}`}>
          <ExampleCurriculumPanel
            activeTab={activeExampleTab}
            onTabChange={setActiveExampleTab}
            onImportWeek={handleImportWeek}
          />
        </div>

        <div className={`cbs-split-right ${mobileView === "builder" ? "cbs-mobile-visible" : "cbs-mobile-hidden"}`}>
          <CurriculumBuilderPanel
            title={title}
            description={description}
            interestArea={interestArea}
            outcomes={outcomes}
            weeklyPlans={weeklyPlans}
            onUpdate={handleUpdate}
            onUpdateWeek={handleUpdateWeek}
            onAddWeek={handleAddWeek}
            onRemoveWeek={handleRemoveWeek}
            onDuplicateWeek={handleDuplicateWeek}
            onAddActivity={handleAddActivity}
            onRemoveActivity={handleRemoveActivity}
            onUpdateActivity={handleUpdateActivity}
            onReorderActivities={handleReorderActivities}
            onMoveActivityToWeek={handleMoveActivityToWeek}
            onOpenDrawer={handleOpenDrawer}
            onOpenTemplates={handleOpenTemplates}
            saveStatus={saveStatus}
            onExportPdf={handleExportPdf}
            onSubmit={handleSubmit}
            isSubmitted={isSubmitted}
          />
        </div>
      </div>

      {/* Activity detail drawer (mobile fallback) */}
      <ActivityDetailDrawer
        activity={drawerActivity}
        onUpdate={(id, fields) => {
          if (drawerWeekId) handleUpdateActivity(drawerWeekId, id, fields);
        }}
        onClose={handleCloseDrawer}
      />

      {/* Activity templates modal */}
      <ActivityTemplates
        open={templatesWeekId !== null}
        onClose={() => setTemplatesWeekId(null)}
        onInsert={handleInsertTemplate}
      />

      {/* Onboarding tour */}
      <OnboardingTour
        key={tourKey}
        onSeedHeader={handleTourSeedHeader}
        onSeedWeeks={handleTourSeedWeeks}
      />

      {/* Version history modal */}
      {showHistory && (
        <div className="cbs-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="cbs-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cbs-history-header">
              <h3 className="cbs-history-title">Version History</h3>
              <button className="cbs-modal-close" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="cbs-history-body">
              {historyVersions.length === 0 ? (
                <p className="cbs-history-empty">No saved versions yet. Versions are saved automatically as you work.</p>
              ) : (
                historyVersions.map((v, i) => (
                  <div key={i} className="cbs-history-item">
                    <div className="cbs-history-item-info">
                      <span className="cbs-history-item-title">{v.snapshot.title || "Untitled"}</span>
                      <span className="cbs-history-item-time">
                        {new Date(v.savedAt).toLocaleString()}
                      </span>
                      <span className="cbs-history-item-meta">
                        {v.snapshot.weeklyPlans.length} week{v.snapshot.weeklyPlans.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      className="cbs-btn cbs-btn-secondary"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => handleRestoreVersion(v)}
                      type="button"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
