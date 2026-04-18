"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkingCopyFromCurriculumDraft,
  markLessonDesignStudioTourComplete,
  saveCurriculumDraft,
  submitCurriculumDraft,
} from "@/lib/curriculum-draft-actions";
import {
  createComment,
  deleteComment,
  listComments,
  resolveComment,
} from "@/lib/curriculum-comment-actions";
import { isEditableCurriculumDraftStatus } from "@/lib/curriculum-draft-lifecycle";
import {
  buildSessionLabel,
  getWeeklyPlansInput,
  getCurriculumDraftProgress,
  normalizeCourseConfig,
  normalizeReviewRubric,
  normalizeUnderstandingChecks,
  syncSessionPlansToCourseConfig,
  buildUnderstandingChecksState,
  type CurriculumDraftProgress,
} from "@/lib/curriculum-draft-progress";
import {
  buildGuidedStudioJourney,
  buildLessonDesignStudioHref,
  getStudioPhaseIndex,
  type StudioEntryContext,
  type StudioPhase,
} from "@/lib/lesson-design-studio";
import { ActivityTemplates } from "./components/activity-templates";
import { ExamplesLibrary } from "./components/examples-library";
import { GuidedStudioShell } from "./components/guided-studio-shell";
import { StudioNavTips } from "./components/studio-nav-tips";
import { CommentSidebar } from "./components/comment-sidebar";
import { StudioCourseMapStep } from "./components/studio-course-map-step";
import { StudioReadinessStep } from "./components/studio-readiness-step";
import { StudioReviewLaunchStep } from "./components/studio-review-launch-step";
import { StudioSessionsStep } from "./components/studio-sessions-step";
import { StudioStartStep } from "./components/studio-start-step";
import { QuickStartWizard } from "./components/quick-start-wizard";
import { StudentPreviewPanel } from "./components/student-preview-panel";
import { SEED_CURRICULA, type SeedCurriculum } from "./curriculum-seeds";
import type { ExampleWeek } from "./examples-data";
import {
  normalizeActivityType,
  normalizeAtHomeAssignmentType,
} from "./types";
import type {
  CurriculumCommentAnchor,
  CurriculumCommentRecord,
  LessonDesignDraftData,
  LessonDesignHistoryVersion,
  LessonDesignSnapshot,
  StudioViewerAccess,
  StudioCourseConfig,
  StudioReviewRubric,
  StudioUnderstandingChecks,
  WeekActivity,
  WeekPlan,
} from "./types";

interface StudioClientProps {
  userId: string;
  userName: string;
  draft: LessonDesignDraftData;
  viewerAccess: StudioViewerAccess;
  entryContext?: StudioEntryContext;
  notice?: string | null;
  /** Active editor page (URL-driven). */
  studioPhase: StudioPhase;
  progress?: CurriculumDraftProgress;
}

function generateId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type ToastState = {
  kind: "error" | "success";
  message: string;
} | null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeTextList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeEnergyLevel(value: unknown): WeekActivity["energyLevel"] {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW"
    ? value
    : null;
}

function normalizeActivity(activity: unknown): WeekActivity {
  const activityRecord = asRecord(activity);
  return {
    id:
      typeof activityRecord.id === "string" && activityRecord.id.trim().length > 0
        ? activityRecord.id
        : generateId(),
    title: typeof activityRecord.title === "string" ? activityRecord.title : "",
    type: normalizeActivityType(activityRecord.type),
    durationMin:
      typeof activityRecord.durationMin === "number" &&
      Number.isFinite(activityRecord.durationMin) &&
      activityRecord.durationMin > 0
        ? Math.round(activityRecord.durationMin)
        : 10,
    description: normalizeNullableText(activityRecord.description),
    resources: normalizeNullableText(activityRecord.resources),
    notes: normalizeNullableText(activityRecord.notes),
    sortOrder:
      typeof activityRecord.sortOrder === "number" &&
      Number.isFinite(activityRecord.sortOrder) &&
      activityRecord.sortOrder >= 0
        ? Math.round(activityRecord.sortOrder)
        : 0,
    materials: normalizeNullableText(activityRecord.materials),
    differentiationTips: normalizeNullableText(
      activityRecord.differentiationTips
    ),
    energyLevel: normalizeEnergyLevel(activityRecord.energyLevel),
    standardsTags: normalizeTextList(activityRecord.standardsTags),
    rubric: normalizeNullableText(activityRecord.rubric),
  };
}

function normalizeWeek(week: unknown): WeekPlan {
  const weekRecord = asRecord(week);
  const rawAtHomeAssignment = asRecord(weekRecord.atHomeAssignment);
  const hasValidAtHomeAssignment =
    typeof rawAtHomeAssignment.title === "string" &&
    rawAtHomeAssignment.title.trim().length > 0 &&
    typeof rawAtHomeAssignment.description === "string" &&
    rawAtHomeAssignment.description.trim().length > 0;

  return {
    id:
      typeof weekRecord.id === "string" && weekRecord.id.trim().length > 0
        ? weekRecord.id
        : generateId(),
    weekNumber:
      typeof weekRecord.weekNumber === "number" &&
      Number.isFinite(weekRecord.weekNumber) &&
      weekRecord.weekNumber > 0
        ? Math.round(weekRecord.weekNumber)
        : 1,
    sessionNumber:
      typeof weekRecord.sessionNumber === "number" &&
      Number.isFinite(weekRecord.sessionNumber) &&
      weekRecord.sessionNumber > 0
        ? Math.round(weekRecord.sessionNumber)
        : 1,
    title: typeof weekRecord.title === "string" ? weekRecord.title : "",
    classDurationMin:
      typeof weekRecord.classDurationMin === "number" &&
      Number.isFinite(weekRecord.classDurationMin) &&
      weekRecord.classDurationMin > 0
        ? Math.round(weekRecord.classDurationMin)
        : 60,
    activities: Array.isArray(weekRecord.activities)
      ? weekRecord.activities.map(normalizeActivity)
      : [],
    objective: normalizeNullableText(weekRecord.objective),
    teacherPrepNotes: normalizeNullableText(weekRecord.teacherPrepNotes),
    materialsChecklist: normalizeTextList(weekRecord.materialsChecklist),
    atHomeAssignment: hasValidAtHomeAssignment
      ? {
          type: normalizeAtHomeAssignmentType(rawAtHomeAssignment.type),
          title: String(rawAtHomeAssignment.title).trim(),
          description: String(rawAtHomeAssignment.description).trim(),
        }
      : null,
  };
}

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isBlankWeekPlan(week: WeekPlan) {
  return (
    !week.title.trim() &&
    week.activities.length === 0 &&
    !(week.objective ?? "").trim() &&
    !(week.teacherPrepNotes ?? "").trim() &&
    week.materialsChecklist.length === 0 &&
    week.atHomeAssignment === null
  );
}

function scoreSeedMatch(seed: SeedCurriculum, topic: string) {
  const draft = normalizeTopic(topic);
  const seedTopic = normalizeTopic(seed.interestArea);
  if (!draft) return 0;
  if (seedTopic === draft) return 100;
  if (seedTopic.includes(draft) || draft.includes(seedTopic)) return 80;

  const draftWords = new Set(draft.split(" ").filter(Boolean));
  return seedTopic
    .split(" ")
    .filter((word) => draftWords.has(word)).length * 20;
}

function getStatusPill(status: string) {
  switch (status) {
    case "APPROVED":
      return { label: "Launch Ready", className: "pill pill-success" };
    case "NEEDS_REVISION":
      return { label: "Revision Requested", className: "pill pill-pending" };
    case "SUBMITTED":
      return { label: "Submitted", className: "pill pill-info" };
    case "COMPLETED":
      return { label: "Ready to Submit", className: "pill pill-purple" };
    case "REJECTED":
      return { label: "Decision Returned", className: "pill" };
    default:
      return { label: "In Progress", className: "pill" };
  }
}

function matchesCommentAnchor(
  comment: CurriculumCommentRecord,
  anchor: {
    anchorType: string;
    anchorId?: string | null;
    anchorField?: string | null;
  }
) {
  return (
    comment.anchorType === anchor.anchorType &&
    (comment.anchorId ?? null) === (anchor.anchorId ?? null) &&
    (comment.anchorField ?? null) === (anchor.anchorField ?? null)
  );
}

function loadLessonDesignHistoryFromStorage(
  storageKey: string
): LessonDesignHistoryVersion[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as Array<{
      savedAt?: string;
      snapshot?: Partial<LessonDesignHistoryVersion["snapshot"]>;
    }>;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((version) => version && typeof version === "object")
      .map((version) => ({
        savedAt: String(version.savedAt ?? new Date().toISOString()),
        snapshot: {
          title: String(version.snapshot?.title ?? ""),
          description: String(version.snapshot?.description ?? ""),
          interestArea: String(version.snapshot?.interestArea ?? ""),
          outcomes: Array.isArray(version.snapshot?.outcomes)
            ? version.snapshot.outcomes.filter(
                (item): item is string => typeof item === "string"
              )
            : [],
          courseConfig: normalizeCourseConfig(version.snapshot?.courseConfig),
          weeklyPlans: getWeeklyPlansInput(version.snapshot?.weeklyPlans).map(
            normalizeWeek
          ),
          understandingChecks: normalizeUnderstandingChecks(
            version.snapshot?.understandingChecks
          ),
        },
      }));
  } catch (error) {
    console.error("Failed to restore Lesson Design Studio history.", error);
    return [];
  }
}

export function StudioClient({
  userId,
  userName,
  draft,
  viewerAccess,
  entryContext = "DIRECT",
  notice = null,
  studioPhase,
  progress: initialProgress,
}: StudioClientProps) {
  const router = useRouter();
  const historyStorageKey = `lds_history_${draft.id}`;

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [interestArea, setInterestArea] = useState(draft.interestArea);
  const [outcomes, setOutcomes] = useState<string[]>(draft.outcomes);
  const [courseConfig, setCourseConfig] = useState<StudioCourseConfig>(() =>
    normalizeCourseConfig(draft.courseConfig)
  );
  const [weeklyPlans, setWeeklyPlans] = useState<WeekPlan[]>(() =>
    syncSessionPlansToCourseConfig(draft.weeklyPlans, draft.courseConfig).map(
      normalizeWeek
    )
  );
  const [understandingChecks, setUnderstandingChecks] =
    useState<StudioUnderstandingChecks>(() =>
      normalizeUnderstandingChecks(draft.understandingChecks)
    );
  const [activeExampleTab, setActiveExampleTab] = useState(0);
  const [currentStatus, setCurrentStatus] = useState(draft.status);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isFlushing, setIsFlushing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQuickStartWizard, setShowQuickStartWizard] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [showCommentSidebar, setShowCommentSidebar] = useState(false);
  const [templatesWeekId, setTemplatesWeekId] = useState<string | null>(null);
  const [showExamplesLibrary, setShowExamplesLibrary] = useState(false);
  const [comments, setComments] = useState<CurriculumCommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [activeCommentAnchor, setActiveCommentAnchor] =
    useState<CurriculumCommentAnchor | null>(null);
  const [examplesLibraryError, setExamplesLibraryError] = useState<string | null>(
    null
  );
  const [hasManuallySelectedExampleTab, setHasManuallySelectedExampleTab] =
    useState(false);
  const [libraryTargetPlanId, setLibraryTargetPlanId] = useState<string | null>(
    null
  );
  const [showNavTips, setShowNavTips] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(draft.updatedAt);
  const [toast, setToast] = useState<ToastState>(null);
  const [historyVersions, setHistoryVersions] = useState<
    LessonDesignHistoryVersion[]
  >([]);

  useEffect(() => {
    setHistoryVersions(loadLessonDesignHistoryFromStorage(historyStorageKey));
  }, [historyStorageKey]);

  const reviewRubric: StudioReviewRubric = normalizeReviewRubric(
    draft.reviewRubric
  );
  type DraftSnapshot = LessonDesignSnapshot;
  const reviewStatus = currentStatus;
  const isDraftEditable =
    viewerAccess.canEdit && isEditableCurriculumDraftStatus(reviewStatus);
  const isDraftReadOnly = !isDraftEditable;
  const isApproved = reviewStatus === "APPROVED";
  const needsRevision = reviewStatus === "NEEDS_REVISION";
  const isReviewControlledStatus =
    reviewStatus === "SUBMITTED" ||
    reviewStatus === "APPROVED" ||
    reviewStatus === "NEEDS_REVISION" ||
    reviewStatus === "REJECTED";
  const isWorkflowActionPending = isFlushing || isSubmitting || isExporting;
  const workflowNotice =
    notice === "active-draft-reused"
      ? "Reopened your existing editable draft (only one at a time)."
      : notice === "draft-unavailable"
        ? "That draft changed; you were returned to the draft list."
        : null;

  const progress = useMemo(
    () =>
      getCurriculumDraftProgress({
        title,
        interestArea,
        outcomes,
        courseConfig,
        weeklyPlans,
        understandingChecks,
      }),
    [title, interestArea, outcomes, courseConfig, weeklyPlans, understandingChecks]
  );

  const activePhase = studioPhase;

  const goToPhase = useCallback(
    (phase: StudioPhase) => {
      router.push(
        buildLessonDesignStudioHref({
          draftId: draft.id,
          phase,
          entryContext,
        })
      );
    },
    [draft.id, entryContext, router]
  );
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(
    weeklyPlans[0]?.id ?? null
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const lastSavedSnapshotSignatureRef = useRef<string | null>(null);
  const inFlightSaveSignatureRef = useRef<string | null>(null);
  const lastQueuedSaveSignatureRef = useRef<string | null>(null);
  const lastKnownUpdatedAtRef = useRef(draft.updatedAt);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const normalizePlansForConfig = useCallback(
    (plans: unknown, config: StudioCourseConfig) =>
      syncSessionPlansToCourseConfig(plans, config).map(normalizeWeek),
    []
  );

  const getSnapshotSignature = useCallback((snapshot: DraftSnapshot) => {
    return JSON.stringify(snapshot);
  }, []);

  const showToast = useCallback((kind: "error" | "success", message: string) => {
    setToast({ kind, message });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setToast(null);
      }
    }, kind === "error" ? 6000 : 3000);
  }, []);

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    return error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  }, []);

  const pushToHistory = useCallback(
    (snapshot: DraftSnapshot) => {
      const version: LessonDesignHistoryVersion = {
        savedAt: new Date().toISOString(),
        snapshot: {
          title: snapshot.title,
          description: snapshot.description,
          interestArea: snapshot.interestArea,
          outcomes: snapshot.outcomes,
          courseConfig: snapshot.courseConfig,
          weeklyPlans: snapshot.weeklyPlans,
          understandingChecks: snapshot.understandingChecks,
        },
      };

      setHistoryVersions((prev) => {
        const next = [version, ...prev].slice(0, 10);
        try {
          localStorage.setItem(historyStorageKey, JSON.stringify(next));
        } catch (error) {
          console.error("Failed to store Lesson Design Studio history.", error);
          showToast(
            "error",
            "Version history could not be saved on this device."
          );
        }
        return next;
      });
    },
    [historyStorageKey, showToast]
  );

  const buildSnapshot = useCallback(
    (overrides: Partial<DraftSnapshot> = {}): DraftSnapshot => ({
      title,
      description,
      interestArea,
      outcomes,
      courseConfig,
      weeklyPlans,
      understandingChecks,
      ...overrides,
    }),
    [title, description, interestArea, outcomes, courseConfig, weeklyPlans, understandingChecks]
  );

  useEffect(() => {
    if (lastSavedSnapshotSignatureRef.current !== null) return;
    lastSavedSnapshotSignatureRef.current = getSnapshotSignature(buildSnapshot());
  }, [buildSnapshot, getSnapshotSignature]);

  const queueSaveSnapshot = useCallback(
    async (snapshot: DraftSnapshot) => {
      const signature = getSnapshotSignature(snapshot);
      if (signature === lastSavedSnapshotSignatureRef.current) {
        return true;
      }

      if (
        signature === inFlightSaveSignatureRef.current ||
        signature === lastQueuedSaveSignatureRef.current
      ) {
        return saveChainRef.current.catch(() => false);
      }

      lastQueuedSaveSignatureRef.current = signature;

      const runSave = async () => {
        if (!isMountedRef.current) return false;
        if (!isDraftEditable) return true;

        inFlightSaveSignatureRef.current = signature;
        setSaveStatus("saving");

        try {
          const result = await saveCurriculumDraft({
            draftId: draft.id,
            title: snapshot.title,
            description: snapshot.description,
            interestArea: snapshot.interestArea,
            outcomes: snapshot.outcomes,
            courseConfig: snapshot.courseConfig,
            weeklyPlans: snapshot.weeklyPlans,
            understandingChecks: snapshot.understandingChecks,
            lastKnownUpdatedAt: lastKnownUpdatedAtRef.current,
          });

          if (!isMountedRef.current) return true;

          if (lastSavedSnapshotSignatureRef.current !== signature) {
            pushToHistory(snapshot);
            lastSavedSnapshotSignatureRef.current = signature;
          }

          if (typeof result.updatedAt === "string" && result.updatedAt.trim().length > 0) {
            lastKnownUpdatedAtRef.current = result.updatedAt;
          }

          setSaveStatus("saved");
          setToast(null);
          setLastSavedAt(result.updatedAt ?? new Date().toISOString());
          setCurrentStatus(
            result.status ??
              (getCurriculumDraftProgress({
                title: snapshot.title,
                interestArea: snapshot.interestArea,
                outcomes: snapshot.outcomes,
                courseConfig: snapshot.courseConfig,
                weeklyPlans: snapshot.weeklyPlans,
                understandingChecks: snapshot.understandingChecks,
              }).readyForSubmission
                ? "COMPLETED"
                : "IN_PROGRESS")
          );

          if (saveStatusTimerRef.current) {
            clearTimeout(saveStatusTimerRef.current);
          }

          saveStatusTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 2000);

          return true;
        } catch (error) {
          if (isMountedRef.current) {
            setSaveStatus("error");
          }

          const message = getErrorMessage(error, "Failed to save draft.");
          console.error("Lesson Design Studio save failed.", error);
          showToast("error", message);
          if (
            message.includes("Draft not found or unauthorized") ||
            message.includes("locked for review history")
          ) {
            router.push(
              buildLessonDesignStudioHref({
                entryContext,
                notice: "draft-unavailable",
              })
            );
          }
          return false;
        } finally {
          if (inFlightSaveSignatureRef.current === signature) {
            inFlightSaveSignatureRef.current = null;
          }
          if (lastQueuedSaveSignatureRef.current === signature) {
            lastQueuedSaveSignatureRef.current = null;
          }
        }
      };

      const queuedSave = saveChainRef.current.catch((err) => { console.warn("[studio] Previous save failed:", err); return true; }).then(runSave);
      saveChainRef.current = queuedSave;
      return queuedSave;
    },
    [
      draft.id,
      entryContext,
      getErrorMessage,
      getSnapshotSignature,
      isDraftEditable,
      pushToHistory,
      router,
      showToast,
    ]
  );

  const triggerAutoSave = useCallback(
    (snapshot: DraftSnapshot) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        void queueSaveSnapshot(snapshot);
      }, 1500);
    },
    [queueSaveSnapshot]
  );

  const flushDraftNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    setIsFlushing(true);
    const didSave = await queueSaveSnapshot(buildSnapshot());
    if (isMountedRef.current) {
      setIsFlushing(false);
    }
    return didSave;
  }, [buildSnapshot, queueSaveSnapshot]);

  const handleUpdate = useCallback(
    (field: string, value: unknown) => {
      if (!isDraftEditable) return;
      let nextSnapshot = buildSnapshot();

      switch (field) {
        case "title":
          if (typeof value !== 'string') break;
          nextSnapshot = { ...nextSnapshot, title: value as string };
          setTitle(nextSnapshot.title);
          break;
        case "description":
          if (typeof value !== 'string') break;
          nextSnapshot = { ...nextSnapshot, description: value as string };
          setDescription(nextSnapshot.description);
          break;
        case "interestArea":
          if (typeof value !== 'string') break;
          nextSnapshot = { ...nextSnapshot, interestArea: value as string };
          setInterestArea(nextSnapshot.interestArea);
          break;
        case "outcomes":
          if (!Array.isArray(value)) break;
          nextSnapshot = { ...nextSnapshot, outcomes: value as string[] };
          setOutcomes(nextSnapshot.outcomes);
          break;
        case "courseConfig": {
          const normalizedCourseConfig = normalizeCourseConfig(value);
          const syncedPlans = normalizePlansForConfig(
            weeklyPlans,
            normalizedCourseConfig
          );
          nextSnapshot = {
            ...nextSnapshot,
            courseConfig: normalizedCourseConfig,
            weeklyPlans: syncedPlans,
          };
          setCourseConfig(normalizedCourseConfig);
          setWeeklyPlans(syncedPlans);
          break;
        }
        case "understandingChecks":
          nextSnapshot = {
            ...nextSnapshot,
            understandingChecks: normalizeUnderstandingChecks(value),
          };
          setUnderstandingChecks(nextSnapshot.understandingChecks);
          break;
      }

      triggerAutoSave(nextSnapshot);
    },
    [buildSnapshot, isDraftEditable, normalizePlansForConfig, triggerAutoSave, weeklyPlans]
  );

  const handleUpdateWeek = useCallback(
    (weekId: string, field: string, value: unknown) => {
      if (!isDraftEditable) return;
      setWeeklyPlans((prev) => {
        const next = prev.map((week) =>
          week.id === weekId ? { ...week, [field]: value } : week
        );
        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const handleAnswerUnderstandingCheck = useCallback(
    (questionId: string, answer: string) => {
      if (!isDraftEditable) return;
      const nextChecks = buildUnderstandingChecksState({
        ...understandingChecks.answers,
        [questionId]: answer,
      });
      setUnderstandingChecks(nextChecks);
      triggerAutoSave(buildSnapshot({ understandingChecks: nextChecks }));
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave, understandingChecks.answers]
  );

  const handleRemoveWeek = useCallback(
    (weekId: string) => {
      if (!isDraftEditable) return;
      setWeeklyPlans((prev) => {
        const next = prev.map((week) =>
          week.id === weekId
            ? {
                ...week,
                title: "",
                activities: [],
                objective: null,
                teacherPrepNotes: null,
                materialsChecklist: [],
                atHomeAssignment: null,
              }
            : week
        );
        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const handleDuplicateWeek = useCallback(
    (weekId: string) => {
      if (!isDraftEditable) return;
      const sourceIndex = weeklyPlans.findIndex((week) => week.id === weekId);
      if (sourceIndex === -1) {
        return;
      }

      const source = weeklyPlans[sourceIndex];
      const targetIndex = weeklyPlans.findIndex(
        (plan, index) => index !== sourceIndex && isBlankWeekPlan(plan)
      );

      if (targetIndex === -1) {
        alert(
          "There is not an empty session available to duplicate into yet. Clear a session first, then duplicate the pattern forward."
        );
        return;
      }

      const duplicatedTargetWeekId = weeklyPlans[targetIndex]?.id ?? null;
      if (!duplicatedTargetWeekId) {
        return;
      }

      setWeeklyPlans((prev) => {
        const next = prev.map((plan, index) =>
          index === targetIndex
            ? {
                ...plan,
                title: source.title ? `${source.title} (Copy)` : "Copy",
                activities: source.activities.map((activity) => ({
                  ...activity,
                  id: generateId(),
                })),
                objective: source.objective,
                teacherPrepNotes: source.teacherPrepNotes,
                materialsChecklist: [...source.materialsChecklist],
                atHomeAssignment: source.atHomeAssignment
                  ? { ...source.atHomeAssignment }
                  : null,
              }
            : plan
        );

        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });

      setSelectedWeekId(duplicatedTargetWeekId);
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave, weeklyPlans]
  );

  const handleAddActivity = useCallback(
    (weekId: string, activity: Omit<WeekActivity, "id" | "sortOrder">) => {
      if (!isDraftEditable) return;
      setWeeklyPlans((prev) => {
        const next = prev.map((week) => {
          if (week.id !== weekId) return week;
          const nextActivityId = generateId();
          return {
            ...week,
            activities: [
              ...week.activities,
              {
                ...activity,
                id: nextActivityId,
                sortOrder: week.activities.length,
              },
            ],
          };
        });

        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const handleRemoveActivity = useCallback(
    (weekId: string, activityId: string) => {
      if (!isDraftEditable) return;
      setWeeklyPlans((prev) => {
        const next = prev.map((week) => {
          if (week.id !== weekId) return week;
          return {
            ...week,
            activities: week.activities
              .filter((activity) => activity.id !== activityId)
              .map((activity, index) => ({ ...activity, sortOrder: index })),
          };
        });

        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const handleUpdateActivity = useCallback(
    (weekId: string, activityId: string, fields: Partial<WeekActivity>) => {
      if (!isDraftEditable) return;
      setWeeklyPlans((prev) => {
        const next = prev.map((week) => {
          if (week.id !== weekId) return week;
          return {
            ...week,
            activities: week.activities.map((activity) =>
              activity.id === activityId ? { ...activity, ...fields } : activity
            ),
          };
        });

        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const handleReorderActivities = useCallback(
    (weekId: string, activeId: string, overId: string) => {
      if (!isDraftEditable) return;
      setWeeklyPlans((prev) => {
        const next = prev.map((week) => {
          if (week.id !== weekId) return week;
          const sortedActivities = [...week.activities].sort(
            (left, right) => left.sortOrder - right.sortOrder
          );
          const oldIndex = sortedActivities.findIndex(
            (item) => item.id === activeId
          );
          const newIndex = sortedActivities.findIndex(
            (item) => item.id === overId
          );
          if (oldIndex === -1 || newIndex === -1) return week;

          const items = [...sortedActivities];
          const [moved] = items.splice(oldIndex, 1);
          items.splice(newIndex, 0, moved);

          return {
            ...week,
            activities: items.map((item, index) => ({
              ...item,
              sortOrder: index,
            })),
          };
        });

        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const handleImportWeek = useCallback(
    (week: ExampleWeek, targetPlanId?: string | null) => {
      if (!isDraftEditable) {
        return false;
      }

      let imported = false;

      setWeeklyPlans((prev) => {
        const explicitTargetIndex =
          targetPlanId != null
            ? prev.findIndex((plan) => plan.id === targetPlanId)
            : -1;

        if (targetPlanId != null && explicitTargetIndex === -1) {
          setExamplesLibraryError(
            "That session changed while the library was open. Pick a session again before importing."
          );
          return prev;
        }

        const blankTargetIndex =
          targetPlanId == null
            ? prev.findIndex((plan) => isBlankWeekPlan(plan))
            : -1;

        if (targetPlanId == null && blankTargetIndex === -1) {
          setExamplesLibraryError(
            "There is no empty session left to import into. Use a session-level import button so you can choose the exact destination."
          );
          return prev;
        }

        const resolvedIndex =
          explicitTargetIndex >= 0 ? explicitTargetIndex : blankTargetIndex;
        const target = resolvedIndex >= 0 ? prev[resolvedIndex] : null;
        if (!target) return prev;

        const nextWeek: WeekPlan = {
          ...target,
          title: week.title,
          classDurationMin: courseConfig.classDurationMin,
          activities: week.activities.map((activity, index) => ({
            id: generateId(),
            title: activity.title,
            type: activity.type,
            durationMin: activity.durationMin,
            description: activity.description,
            resources: null,
            notes: null,
            sortOrder: index,
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

        const next = prev.map((plan, index) =>
          index === resolvedIndex ? nextWeek : plan
        );
        imported = true;
        setExamplesLibraryError(null);
        triggerAutoSave(buildSnapshot({ weeklyPlans: next }));
        return next;
      });

      if (!imported) {
        return false;
      }

      setShowExamplesLibrary(false);
      setLibraryTargetPlanId(null);
      goToPhase("SESSIONS");
      return true;
    },
    [buildSnapshot, courseConfig.classDurationMin, goToPhase, isDraftEditable, triggerAutoSave]
  );

  const handleApplyStarterScaffold = useCallback(
    (seed: SeedCurriculum) => {
      if (!isDraftEditable) return;
      pushToHistory(buildSnapshot());

      const nextCourseConfig = normalizeCourseConfig({
        ...courseConfig,
        durationWeeks: seed.weeks.length,
        sessionsPerWeek: 1,
        classDurationMin: seed.classDurationMin,
      });
      const seededPlans = syncSessionPlansToCourseConfig([], nextCourseConfig).map(
        (plan, index) => {
          const sourceWeek = seed.weeks[index];
          if (!sourceWeek) return normalizeWeek(plan);

          return {
            ...normalizeWeek(plan),
            title: sourceWeek.title,
            classDurationMin: seed.classDurationMin,
            objective: sourceWeek.objective,
            teacherPrepNotes: sourceWeek.teacherPrepNotes,
            materialsChecklist: [],
            atHomeAssignment: sourceWeek.atHomeAssignment
              ? {
                  type: sourceWeek.atHomeAssignment.type,
                  title: sourceWeek.atHomeAssignment.title,
                  description: sourceWeek.atHomeAssignment.description,
                }
              : null,
            activities: sourceWeek.activities.map((activity, activityIndex) => ({
              id: generateId(),
              title: activity.title,
              type: activity.type,
              durationMin: activity.durationMin,
              description: activity.description,
              resources: null,
              notes: null,
              sortOrder: activityIndex,
              materials: null,
              differentiationTips: null,
              energyLevel: null,
              standardsTags: [],
              rubric: null,
            })),
          };
        }
      );

      const nextSnapshot = buildSnapshot({
        title: seed.title,
        description: seed.description,
        interestArea: seed.interestArea,
        outcomes: seed.outcomes,
        courseConfig: nextCourseConfig,
        weeklyPlans: seededPlans,
      });

      setTitle(seed.title);
      setDescription(seed.description);
      setInterestArea(seed.interestArea);
      setOutcomes(seed.outcomes);
      setCourseConfig(nextCourseConfig);
      setWeeklyPlans(seededPlans);
      goToPhase("COURSE_MAP");
      triggerAutoSave(nextSnapshot);
    },
    [buildSnapshot, courseConfig, goToPhase, isDraftEditable, pushToHistory, triggerAutoSave]
  );

  const handleGenerateQuickStart = useCallback(
    (seed: SeedCurriculum) => {
      setShowQuickStartWizard(false);
      handleApplyStarterScaffold(seed);
      showToast(
        "success",
        `${seed.label} starter generated. Now tune the course promise before you refine sessions.`
      );
    },
    [handleApplyStarterScaffold, showToast]
  );

  const handleExportPdf = useCallback(
    async (type: "student" | "instructor") => {
      if (isExporting || isSubmitting || isFlushing) return false;

      const exportWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!exportWindow) {
        alert("Allow pop-ups to open the PDF export.");
        return false;
      }

      setIsExporting(true);

      try {
        if (isDraftEditable) {
          const didSave = await flushDraftNow();
          if (!didSave) {
            exportWindow.close();
            alert("Please fix the save error before exporting.");
            return false;
          }
        }

        exportWindow.location.href = `/instructor/lesson-design-studio/print?draftId=${draft.id}&type=${type}`;
        return true;
      } finally {
        if (isMountedRef.current) {
          setIsExporting(false);
        }
      }
    },
    [draft.id, flushDraftNow, isDraftEditable, isExporting, isFlushing, isSubmitting]
  );

  const handleSubmit = useCallback(async () => {
    if (!isDraftEditable) return false;
    if (isSubmitting || isExporting || isFlushing) return false;

    setIsSubmitting(true);

    try {
      const didSave = await flushDraftNow();
      if (!didSave) {
        alert("Please fix the save error before submitting.");
        return false;
      }

      await submitCurriculumDraft(draft.id);
      setCurrentStatus("SUBMITTED");
      setLastSavedAt(new Date().toISOString());
      goToPhase("REVIEW_LAUNCH");
      router.refresh();
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to submit");
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [
    draft.id,
    flushDraftNow,
    goToPhase,
    isDraftEditable,
    isExporting,
    isFlushing,
    isSubmitting,
    router,
  ]);

  const handleRestoreVersion = useCallback(
    (version: LessonDesignHistoryVersion) => {
      if (!isDraftEditable) return;
      const { snapshot } = version;
      const nextUnderstandingChecks = normalizeUnderstandingChecks(
        snapshot.understandingChecks
      );
      setTitle(snapshot.title);
      setDescription(snapshot.description);
      setInterestArea(snapshot.interestArea);
      setOutcomes(snapshot.outcomes);
      setCourseConfig(snapshot.courseConfig);
      setWeeklyPlans(snapshot.weeklyPlans);
      setUnderstandingChecks(nextUnderstandingChecks);
      setShowHistory(false);

      triggerAutoSave({
        ...buildSnapshot(),
        title: snapshot.title,
        description: snapshot.description,
        interestArea: snapshot.interestArea,
        outcomes: snapshot.outcomes,
        courseConfig: snapshot.courseConfig,
        weeklyPlans: snapshot.weeklyPlans,
        understandingChecks: nextUnderstandingChecks,
      });
    },
    [buildSnapshot, isDraftEditable, triggerAutoSave]
  );

  const openExamplesLibrary = useCallback((targetPlanId?: string | null) => {
    if (!isDraftEditable) return;
    setExamplesLibraryError(null);
    setHasManuallySelectedExampleTab(false);
    setLibraryTargetPlanId(targetPlanId ?? null);
    setShowExamplesLibrary(true);
  }, [isDraftEditable]);

  const handleExamplesTabChange = useCallback(
    (index: number, source?: "auto" | "user") => {
      if (source === "auto" && hasManuallySelectedExampleTab) {
        return;
      }

      if (source === "user") {
        setHasManuallySelectedExampleTab(true);
      }

      setActiveExampleTab(index);
    },
    [hasManuallySelectedExampleTab]
  );

  const handleMarkTrainingOrientationComplete = useCallback(async () => {
    const didSave = await flushDraftNow();
    if (!didSave) {
      alert("Please fix the save error before recording orientation.");
      return;
    }

    try {
      await markLessonDesignStudioTourComplete(draft.id);
      setShowNavTips(false);
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to record orientation completion"
      );
    }
  }, [draft.id, flushDraftNow, router]);

  const handleCreateWorkingCopy = useCallback(async () => {
    if (isWorkflowActionPending) return;

    try {
      const result = await createWorkingCopyFromCurriculumDraft(draft.id);
      router.push(
        buildLessonDesignStudioHref({
          entryContext,
          draftId: result.draftId,
          phase: "START",
          notice: result.reusedExisting ? "active-draft-reused" : null,
        })
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to open a working copy."
      );
    }
  }, [draft.id, entryContext, isWorkflowActionPending, router]);

  const resolveCommentAnchorLabel = useCallback(
    (
      anchorType: string,
      anchorId: string | null,
      anchorField: string | null
    ): CurriculumCommentAnchor => {
      switch (anchorType) {
        case "ACTIVITY": {
          for (const week of weeklyPlans) {
            const activity = week.activities.find((item) => item.id === anchorId);
            if (!activity) {
              continue;
            }

            return {
              anchorType: "ACTIVITY",
              anchorId,
              anchorField,
              label: `Activity: ${activity.title || "Untitled activity"}`,
              detail: buildSessionLabel(week, courseConfig),
            };
          }

          return {
            anchorType: "ACTIVITY",
            anchorId,
            anchorField,
            label: "Activity feedback",
            detail: null,
          };
        }
        case "SESSION": {
          const week = weeklyPlans.find((item) => item.id === anchorId);
          const sessionLabel = week
            ? buildSessionLabel(week, courseConfig)
            : "Session";
          const fieldLabel =
            anchorField === "objective"
              ? "Session objective"
              : anchorField === "title"
                ? "Session title"
                : "Session";

          return {
            anchorType: "SESSION",
            anchorId,
            anchorField,
            label: `${sessionLabel}: ${fieldLabel}`,
            detail: week?.title || null,
          };
        }
        case "OUTCOME": {
          const index = Number(anchorId ?? -1);
          const outcomeNumber = Number.isFinite(index) && index >= 0 ? index + 1 : null;
          return {
            anchorType: "OUTCOME",
            anchorId,
            anchorField,
            label: outcomeNumber ? `Outcome ${outcomeNumber}` : "Learning outcome",
            detail:
              outcomeNumber && outcomes[index]
                ? outcomes[index]
                : "Review feedback for this learning outcome.",
          };
        }
        case "COURSE":
        default: {
          const label =
            anchorField === "title"
              ? "Course title"
              : anchorField === "interestArea"
                ? "Interest area"
                : anchorField === "description"
                  ? "Why this course matters"
                  : "Course overview";

          return {
            anchorType: "COURSE",
            anchorId,
            anchorField,
            label,
            detail: null,
          };
        }
      }
    },
    [courseConfig, outcomes, weeklyPlans]
  );

  const openCommentsForAnchor = useCallback((anchor: CurriculumCommentAnchor) => {
    setActiveCommentAnchor(anchor);
    setShowCommentSidebar(true);
  }, []);

  const clearCommentAnchorFocus = useCallback(() => {
    setActiveCommentAnchor(null);
  }, []);

  const getCommentStatsForAnchor = useCallback(
    (anchor: {
      anchorType: string;
      anchorId?: string | null;
      anchorField?: string | null;
    }) => {
      const matchingComments = comments.filter((comment) =>
        matchesCommentAnchor(comment, anchor)
      );

      return {
        comments: matchingComments,
        count: matchingComments.length,
        unresolvedCount: matchingComments.filter((comment) => !comment.resolved)
          .length,
      };
    },
    [comments]
  );

  const loadComments = useCallback(async () => {
    if (!viewerAccess.canView) {
      setComments([]);
      setCommentsError(null);
      setCommentsLoading(false);
      return;
    }

    setCommentsLoading(true);
    setCommentsError(null);

    try {
      const nextComments = await listComments(draft.id);
      if (!isMountedRef.current) {
        return;
      }

      setComments(nextComments);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = getErrorMessage(
        error,
        "Comments could not be loaded for this draft."
      );
      setCommentsError(message);
      showToast("error", message);
    } finally {
      if (isMountedRef.current) {
        setCommentsLoading(false);
      }
    }
  }, [draft.id, getErrorMessage, showToast, viewerAccess.canView]);

  const handleCreateComment = useCallback(
    async (
      anchor: CurriculumCommentAnchor,
      body: string,
      parentId?: string | null
    ) => {
      try {
        const createdComment = await createComment({
          draftId: draft.id,
          anchorType: anchor.anchorType,
          anchorId: anchor.anchorId ?? null,
          anchorField: anchor.anchorField ?? null,
          body,
          parentId: parentId ?? null,
        });

        if (!isMountedRef.current) {
          return;
        }

        setComments((current) =>
          [...current, createdComment].sort((left, right) =>
            left.createdAt.localeCompare(right.createdAt)
          )
        );
        setCommentsError(null);
        setActiveCommentAnchor(anchor);
        setShowCommentSidebar(true);
      } catch (error) {
        showToast(
          "error",
          getErrorMessage(error, "This comment could not be saved.")
        );
      }
    },
    [draft.id, getErrorMessage, showToast]
  );

  const handleResolveComment = useCallback(
    async (commentId: string, resolved: boolean) => {
      try {
        await resolveComment(commentId, resolved);

        if (!isMountedRef.current) {
          return;
        }

        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId || comment.parentId === commentId
              ? {
                  ...comment,
                  resolved,
                  resolvedById: resolved ? userId : null,
                  resolvedAt: resolved ? new Date().toISOString() : null,
                  resolvedBy: resolved
                    ? {
                        id: userId,
                        name: userName,
                      }
                    : null,
                }
              : comment
          )
        );
        setCommentsError(null);
      } catch (error) {
        showToast(
          "error",
          getErrorMessage(error, "This comment could not be updated.")
        );
      }
    },
    [getErrorMessage, showToast, userId, userName]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        await deleteComment(commentId);

        if (!isMountedRef.current) {
          return;
        }

        setComments((current) =>
          current.filter(
            (comment) => comment.id !== commentId && comment.parentId !== commentId
          )
        );
        setCommentsError(null);
      } catch (error) {
        showToast(
          "error",
          getErrorMessage(error, "This comment could not be removed.")
        );
      }
    },
    [getErrorMessage, showToast]
  );

  const openStudioNavTips = useCallback(() => {
    setShowNavTips(true);
  }, []);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    const normalized = normalizePlansForConfig(weeklyPlans, courseConfig);
    const changed = JSON.stringify(normalized) !== JSON.stringify(weeklyPlans);
    if (changed) {
      setWeeklyPlans(normalized);
    }
  }, [courseConfig, normalizePlansForConfig, weeklyPlans]);

  useEffect(() => {
    if (weeklyPlans.length === 0) {
      if (selectedWeekId !== null) {
        setSelectedWeekId(null);
      }
      return;
    }

    if (
      selectedWeekId === null ||
      !weeklyPlans.some((plan) => plan.id === selectedWeekId)
    ) {
      setSelectedWeekId(weeklyPlans[0]?.id ?? null);
    }
  }, [selectedWeekId, weeklyPlans]);

  useEffect(() => {
    if (!showHistory) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowHistory(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showHistory]);

  const selectedWeek =
    weeklyPlans.find((plan) => plan.id === selectedWeekId) ?? weeklyPlans[0] ?? null;

  useEffect(() => {
    if (activePhase !== "SESSIONS") {
      setShowStudentPreview(false);
    }
  }, [activePhase]);

  useEffect(() => {
    if (!showStudentPreview) return;
    if (!selectedWeek) {
      setShowStudentPreview(false);
    }
  }, [selectedWeek, showStudentPreview]);

  const nonEmptyOutcomes = outcomes.filter((outcome) => outcome.trim().length > 0);
  const isDraftBlank =
    title.trim().length === 0 &&
    description.trim().length === 0 &&
    interestArea.trim().length === 0 &&
    nonEmptyOutcomes.length === 0 &&
    weeklyPlans.every((plan) => isBlankWeekPlan(plan));
  const hasStartedDraft = !isDraftBlank;
  const statusPill = getStatusPill(reviewStatus);
  const journey = buildGuidedStudioJourney({
    activePhase,
    status: reviewStatus,
    title,
    interestArea,
    outcomes,
    courseConfig,
    weeklyPlans,
    understandingChecks,
    progress,
    reviewNotes: draft.reviewNotes,
    reviewRubric: reviewRubric,
  });
  const recommendedSeed =
    SEED_CURRICULA.reduce<{ seed: SeedCurriculum; score: number } | null>(
      (best, seed) => {
        const score = scoreSeedMatch(seed, interestArea);
        if (!best || score > best.score) {
          return { seed, score };
        }
        return best;
      },
      null
    )?.seed ?? SEED_CURRICULA[0];
  const blockerCount = journey.blockerCount;
  const targetPlanLabel = libraryTargetPlanId
    ? (() => {
        const targetPlan = weeklyPlans.find((plan) => plan.id === libraryTargetPlanId);
        return targetPlan
          ? buildSessionLabel(targetPlan, courseConfig)
          : null;
      })()
    : null;
  const unresolvedCommentCount = comments.filter(
    (comment) => !comment.resolved
  ).length;
  const isReviewerView = viewerAccess.viewerKind === "REVIEWER";
  const readOnlyNotice = isDraftReadOnly
    ? isReviewerView
      ? "Review mode."
      : reviewStatus === "SUBMITTED"
        ? "Under review."
        : reviewStatus === "APPROVED"
          ? "Approved."
          : "Read-only history."
    : null;
  const readOnlyBody = isDraftReadOnly
    ? isReviewerView
      ? "Comments only; curriculum fields are locked."
      : "Browse and export; use a working copy to edit."
    : null;
  const heroActions =
    isDraftEditable || (isDraftReadOnly && !isReviewerView) ? (
      <>
        {isDraftEditable ? (
          <button
            type="button"
            className="button secondary"
            aria-label="Examples library"
            title="Example curricula"
            onClick={() => {
              openExamplesLibrary(null);
            }}
          >
            Library
          </button>
        ) : null}
        {isDraftReadOnly && !isReviewerView ? (
          <button
            type="button"
            className="button"
            onClick={() => void handleCreateWorkingCopy()}
            disabled={isWorkflowActionPending}
          >
            {isApproved
              ? "Build another from this"
              : reviewStatus === "REJECTED"
                ? "Start over from this draft"
                : "Use as starting point"}
          </button>
        ) : null}
        {isDraftEditable ? (
          <button
            type="button"
            className="button secondary"
            aria-label="Studio tips"
            title="Studio tips"
            onClick={openStudioNavTips}
          >
            Tips
          </button>
        ) : null}
        {isDraftEditable ? (
          <button
            type="button"
            className="button secondary"
            aria-label="Draft history"
            title="Open saved versions from this browser (after auto-save)"
            onClick={() => setShowHistory(true)}
          >
            Log
          </button>
        ) : null}
      </>
    ) : null;

  const hasToolbarActions =
    viewerAccess.canComment || (activePhase === "SESSIONS" && selectedWeek);
  const toolbarActions = hasToolbarActions ? (
    <>
      {viewerAccess.canComment ? (
        <button
          type="button"
          className="button secondary lds-toolbar-comments-btn"
          title={commentsError ?? undefined}
          onClick={() => {
            setActiveCommentAnchor(null);
            setShowCommentSidebar(true);
          }}
        >
          {commentsLoading
            ? "Comments..."
            : unresolvedCommentCount > 0
              ? `Comments (${unresolvedCommentCount} open)`
              : comments.length > 0
                ? `Comments (${comments.length})`
                : "Comments"}
        </button>
      ) : null}
      {activePhase === "SESSIONS" && selectedWeek ? (
        <button
          type="button"
          className="button secondary"
          onClick={() => setShowStudentPreview(true)}
        >
          Preview session
        </button>
      ) : null}
    </>
  ) : null;

  const stepContent =
    activePhase === "START" ? (
      <StudioStartStep
        starterScaffolds={SEED_CURRICULA}
        recommendedScaffoldId={recommendedSeed.id}
        isReadOnly={isDraftReadOnly}
        hasStartedDraft={hasStartedDraft}
        onApplyStarterScaffold={handleApplyStarterScaffold}
        onMoveForward={() => goToPhase("COURSE_MAP")}
        onOpenQuickStartWizard={() => setShowQuickStartWizard(true)}
      />
    ) : activePhase === "COURSE_MAP" ? (
      <StudioCourseMapStep
        title={title}
        description={description}
        interestArea={interestArea}
        outcomes={outcomes}
        courseConfig={courseConfig}
        currentUserId={userId}
        canComment={viewerAccess.canComment}
        canResolveComments={viewerAccess.canResolveComments}
        getCommentStats={getCommentStatsForAnchor}
        blockers={journey.blockers}
        understandingChecks={understandingChecks}
        isReadOnly={isDraftReadOnly}
        onUpdate={handleUpdate}
        onPhaseChange={goToPhase}
        onAnswerUnderstandingCheck={handleAnswerUnderstandingCheck}
        onOpenExamplesLibrary={() => openExamplesLibrary(null)}
        onOpenComments={openCommentsForAnchor}
        onCreateComment={handleCreateComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
      />
    ) : activePhase === "SESSIONS" ? (
      <StudioSessionsStep
        courseConfig={courseConfig}
        weeklyPlans={weeklyPlans}
        currentUserId={userId}
        canComment={viewerAccess.canComment}
        canResolveComments={viewerAccess.canResolveComments}
        getCommentStats={getCommentStatsForAnchor}
        blockers={journey.blockers}
        understandingChecks={understandingChecks}
        selectedWeekId={selectedWeekId}
        isReadOnly={isDraftReadOnly}
        onSelectWeek={setSelectedWeekId}
        onUpdateWeek={handleUpdateWeek}
        onDuplicateWeek={handleDuplicateWeek}
        onRemoveWeek={handleRemoveWeek}
        onAddActivity={handleAddActivity}
        onRemoveActivity={handleRemoveActivity}
        onUpdateActivity={handleUpdateActivity}
        onReorderActivities={handleReorderActivities}
        onOpenTemplates={setTemplatesWeekId}
        onOpenExamplesLibrary={openExamplesLibrary}
        onImportExampleWeek={handleImportWeek}
        onPhaseChange={goToPhase}
        onAnswerUnderstandingCheck={handleAnswerUnderstandingCheck}
        onOpenComments={openCommentsForAnchor}
        onCreateComment={handleCreateComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
      />
    ) : activePhase === "READINESS" ? (
      <StudioReadinessStep
        progress={progress}
        blockers={journey.blockers}
        understandingChecks={understandingChecks}
        isReadOnly={isDraftReadOnly}
        onPhaseChange={goToPhase}
        onAnswerUnderstandingCheck={handleAnswerUnderstandingCheck}
      />
    ) : (
      <StudioReviewLaunchStep
        reviewStatus={reviewStatus}
        reviewRubric={reviewRubric}
        reviewNotes={draft.reviewNotes}
        blockers={journey.blockers}
        progress={progress}
        generatedTemplateId={draft.generatedTemplateId}
        isReadOnly={isDraftReadOnly}
        isApproved={isApproved}
        needsRevision={needsRevision}
        isActionPending={isWorkflowActionPending}
        canCreateWorkingCopy={!isReviewerView}
        onPhaseChange={goToPhase}
        onExportPdf={handleExportPdf}
        onSubmit={handleSubmit}
        onCreateWorkingCopy={handleCreateWorkingCopy}
      />
    );

  return (
    <GuidedStudioShell
      curriculumTitle={title.trim() || "Untitled curriculum"}
      draftId={draft.id}
      entryContext={entryContext}
      activePhase={activePhase}
      statusLabel={statusPill.label}
      statusClassName={statusPill.className}
      saveStatus={isDraftEditable ? saveStatus : "idle"}
      updatedAtLabel={`Last saved ${new Date(lastSavedAt).toLocaleString()}`}
      workflowNotice={workflowNotice}
      readOnlyNotice={readOnlyNotice}
      readOnlyBody={readOnlyBody}
      toast={toast}
      toolbarActions={toolbarActions}
      heroActions={heroActions}
      globalOverlays={
        <>
      <ExamplesLibrary
        open={showExamplesLibrary}
        activeTab={activeExampleTab}
        interestArea={interestArea}
        targetLabel={targetPlanLabel}
        errorMessage={examplesLibraryError}
        autoRecommendEnabled={!hasManuallySelectedExampleTab}
        onClose={() => {
          setShowExamplesLibrary(false);
          setLibraryTargetPlanId(null);
          setExamplesLibraryError(null);
        }}
        onTabChange={handleExamplesTabChange}
        onImportWeek={(week) => handleImportWeek(week, libraryTargetPlanId)}
      />

      <ActivityTemplates
        open={templatesWeekId !== null}
        onClose={() => setTemplatesWeekId(null)}
        onInsert={(template) => {
          if (!templatesWeekId) return;
          setTemplatesWeekId(null);
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
        }}
      />

      <QuickStartWizard
        open={showQuickStartWizard}
        seeds={SEED_CURRICULA}
        recommendedSeedId={recommendedSeed.id}
        readOnly={isDraftReadOnly}
        onClose={() => setShowQuickStartWizard(false)}
        onGenerate={(seed) => handleGenerateQuickStart(seed)}
      />

      <StudentPreviewPanel
        open={showStudentPreview}
        week={selectedWeek}
        courseConfig={courseConfig}
        onClose={() => setShowStudentPreview(false)}
      />

      <CommentSidebar
        open={showCommentSidebar}
        comments={comments}
        currentUserId={userId}
        canComment={viewerAccess.canComment}
        canResolveComments={viewerAccess.canResolveComments}
        activeAnchor={activeCommentAnchor}
        onClose={() => setShowCommentSidebar(false)}
        onClearAnchorFocus={clearCommentAnchorFocus}
        onCreateComment={handleCreateComment}
        onResolveComment={handleResolveComment}
        onDeleteComment={handleDeleteComment}
        resolveAnchorLabel={resolveCommentAnchorLabel}
      />

      <StudioNavTips
        open={showNavTips}
        onClose={() => setShowNavTips(false)}
        showTrainingOrientationAction={isDraftEditable && !isReviewControlledStatus}
        onMarkTrainingOrientation={handleMarkTrainingOrientationComplete}
      />

      {showHistory ? (
        <div className="cbs-modal-overlay" onClick={() => setShowHistory(false)}>
          <div
            className="cbs-history-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cbs-history-header">
              <h3 className="cbs-history-title">Version History</h3>
              <button
                type="button"
                className="lds-library-close"
                onClick={() => setShowHistory(false)}
                aria-label="Close version history"
              >
                ×
              </button>
            </div>
            <div className="cbs-history-body">
              {historyVersions.length === 0 ? (
                <p className="cbs-history-empty">
                  Your saved versions will appear here after auto-save runs.
                </p>
              ) : (
                historyVersions.map((version) => (
                  <button
                    key={version.savedAt}
                    type="button"
                    className="cbs-history-item"
                    onClick={() => handleRestoreVersion(version)}
                  >
                    <div className="cbs-history-item-info">
                      <span className="cbs-history-item-title">
                        {version.snapshot.title || "Untitled curriculum"}
                      </span>
                      <span className="cbs-history-item-time">
                        {new Date(version.savedAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="cbs-history-item-meta">
                      {version.snapshot.weeklyPlans.filter((plan) => plan.title.trim()).length}{" "}
                      session titles
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
        </>
      }
    >
      {stepContent}
    </GuidedStudioShell>
  );
}
