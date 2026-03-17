"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { saveCurriculumDraft, submitCurriculumDraft } from "@/lib/curriculum-draft-actions";
import { ExampleCurriculumPanel } from "./components/example-curriculum-panel";
import { CurriculumBuilderPanel } from "./components/curriculum-builder-panel";
import { ActivityDetailDrawer } from "./components/activity-detail-drawer";
import { ActivityTemplates } from "./components/activity-templates";

// ── Types ──────────────────────────────────────────────────

type ActivityType =
  | "WARM_UP"
  | "INSTRUCTION"
  | "PRACTICE"
  | "DISCUSSION"
  | "ASSESSMENT"
  | "BREAK"
  | "REFLECTION"
  | "GROUP_WORK";

interface WeekActivity {
  id: string;
  title: string;
  type: ActivityType;
  durationMin: number;
  description: string | null;
  resources: string | null;
  notes: string | null;
  sortOrder: number;
}

interface WeekPlan {
  id: string;
  weekNumber: number;
  title: string;
  classDurationMin: number;
  activities: WeekActivity[];
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

function generateId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ── Component ──────────────────────────────────────────────

export function StudioClient({ userId, userName, draft }: StudioClientProps) {
  // ── State ────────────────────────────────────────────────
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [interestArea, setInterestArea] = useState(draft.interestArea);
  const [outcomes, setOutcomes] = useState<string[]>(draft.outcomes);
  const [weeklyPlans, setWeeklyPlans] = useState<WeekPlan[]>(() => {
    const plans = draft.weeklyPlans as WeekPlan[];
    return Array.isArray(plans) && plans.length > 0
      ? plans
      : [
          {
            id: generateId(),
            weekNumber: 1,
            title: "",
            classDurationMin: 60,
            activities: [],
          },
        ];
  });

  const [activeExampleTab, setActiveExampleTab] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSubmitted, setIsSubmitted] = useState(draft.status === "SUBMITTED");

  // Activity drawer state
  const [drawerWeekId, setDrawerWeekId] = useState<string | null>(null);
  const [drawerActivityId, setDrawerActivityId] = useState<string | null>(null);

  // Templates modal state
  const [templatesWeekId, setTemplatesWeekId] = useState<string | null>(null);

  // Mobile tab state
  const [mobileView, setMobileView] = useState<"examples" | "builder">("builder");

  // ── Auto-save ────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
          if (isMountedRef.current) setSaveStatus("saved");
          setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 2000);
        } catch {
          if (isMountedRef.current) setSaveStatus("error");
        }
      }, 1500);
    },
    [draft.id]
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
      // Close drawer if this activity was being edited
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
      });
    },
    [templatesWeekId, handleAddActivity]
  );

  // ── PDF export ───────────────────────────────────────────

  const handleExportPdf = useCallback(() => {
    window.open(`/instructor/lesson-design-studio/print?draftId=${draft.id}`, "_blank");
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
          {saveStatus === "saved" && <span className="cbs-status-saved">Auto-saved</span>}
          {saveStatus === "error" && <span className="cbs-status-error">Save failed</span>}
          {isSubmitted && <span className="cbs-status-submitted">Submitted</span>}
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
            onAddActivity={handleAddActivity}
            onRemoveActivity={handleRemoveActivity}
            onUpdateActivity={handleUpdateActivity}
            onReorderActivities={handleReorderActivities}
            onOpenDrawer={handleOpenDrawer}
            onOpenTemplates={handleOpenTemplates}
            saveStatus={saveStatus}
            onExportPdf={handleExportPdf}
            onSubmit={handleSubmit}
            isSubmitted={isSubmitted}
          />
        </div>
      </div>

      {/* Activity detail drawer */}
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
    </div>
  );
}
