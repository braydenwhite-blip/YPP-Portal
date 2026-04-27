"use client";

/**
 * Tabbed autosave rationale composer for the chair decision dock.
 * §7.3 of the redesign plan.
 *
 * The cockpit's draft persistence has two layers:
 *   1. Server action `saveChairDraft` (called debounced; canonical when the
 *      InstructorApplicationChairDraft Prisma model lands).
 *   2. localStorage warm cache keyed by `final-review-draft:{appId}:{chairId}`
 *      — survives reload even if the server action stub is a no-op today.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChairDecisionAction } from "@prisma/client";
import { saveChairDraft } from "@/lib/chair-draft-actions";
import SaveStateIndicator, { type SaveState } from "@/components/shared/SaveStateIndicator";
import DraftCharCounter from "./DraftCharCounter";

const DEBOUNCE_MS = 800;
const HARD_LIMIT = 10_000;

export interface DraftRationaleFieldProps {
  applicationId: string;
  actorId: string;
  initialRationale: string;
  initialComparisonNotes: string;
  initialSavedAt: string | null;
  requiredForIntent?: ChairDecisionAction | null;
  onChange?: (draft: { rationale: string; comparisonNotes: string }) => void;
  exposeQuoteHandler?: (handler: ((quote: string) => void) | null) => void;
}

type Tab = "rationale" | "notes";

function storageKey(applicationId: string, actorId: string) {
  return `final-review-draft:${applicationId}:${actorId}`;
}

interface CachedDraft {
  rationale: string;
  comparisonNotes: string;
  savedAt: string | null;
}

function readCache(applicationId: string, actorId: string): CachedDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(applicationId, actorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
      comparisonNotes:
        typeof parsed.comparisonNotes === "string" ? parsed.comparisonNotes : "",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
    };
  } catch {
    return null;
  }
}

function writeCache(applicationId: string, actorId: string, draft: CachedDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(applicationId, actorId), JSON.stringify(draft));
  } catch {
    /* ignore quota errors — server save is canonical */
  }
}

export default function DraftRationaleField({
  applicationId,
  actorId,
  initialRationale,
  initialComparisonNotes,
  initialSavedAt,
  requiredForIntent,
  onChange,
  exposeQuoteHandler,
}: DraftRationaleFieldProps) {
  const [activeTab, setActiveTab] = useState<Tab>("rationale");
  const [rationale, setRationale] = useState(initialRationale);
  const [comparisonNotes, setComparisonNotes] = useState(initialComparisonNotes);
  const [saveState, setSaveState] = useState<SaveState>(initialSavedAt ? "saved" : "idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialSavedAt);
  const debounceRef = useRef<number | null>(null);
  const latestDraftRef = useRef({ rationale, comparisonNotes });

  // Hydrate from the warm cache on mount when the server returned no draft.
  useEffect(() => {
    if (initialSavedAt) return;
    const cached = readCache(applicationId, actorId);
    if (!cached) return;
    if (cached.rationale && !initialRationale) setRationale(cached.rationale);
    if (cached.comparisonNotes && !initialComparisonNotes) {
      setComparisonNotes(cached.comparisonNotes);
    }
    if (cached.savedAt) {
      setLastSavedAt(cached.savedAt);
      setSaveState("saved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, actorId]);

  const triggerSave = useCallback(
    async (next: { rationale: string; comparisonNotes: string }) => {
      setSaveState("saving");
      try {
        const formData = new FormData();
        formData.set("applicationId", applicationId);
        formData.set("rationale", next.rationale);
        formData.set("comparisonNotes", next.comparisonNotes);
        const result = await saveChairDraft(formData);
        if (!result.success) {
          setSaveState("error");
          return;
        }
        const savedAt = result.savedAt;
        setLastSavedAt(savedAt);
        setSaveState("saved");
        writeCache(applicationId, actorId, {
          rationale: next.rationale,
          comparisonNotes: next.comparisonNotes,
          savedAt,
        });
      } catch {
        setSaveState("error");
      }
    },
    [applicationId, actorId]
  );

  const scheduleSave = useCallback(
    (next: { rationale: string; comparisonNotes: string }) => {
      latestDraftRef.current = next;
      writeCache(applicationId, actorId, {
        rationale: next.rationale,
        comparisonNotes: next.comparisonNotes,
        savedAt: lastSavedAt,
      });
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        triggerSave(latestDraftRef.current);
      }, DEBOUNCE_MS);
    },
    [applicationId, actorId, lastSavedAt, triggerSave]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    []
  );

  // Warn the chair if they navigate away with unsaved characters.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState === "saved" || saveState === "idle") return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  // Quote-into-rationale wiring used by Phase 3's pinned signals.
  const insertQuote = useCallback(
    (quote: string) => {
      setActiveTab("rationale");
      setRationale((prev) => {
        const trimmed = prev.trimEnd();
        const next = trimmed ? `${trimmed}\n\n> ${quote}` : `> ${quote}`;
        const draft = { rationale: next, comparisonNotes };
        onChange?.(draft);
        scheduleSave(draft);
        return next;
      });
    },
    [comparisonNotes, onChange, scheduleSave]
  );

  useEffect(() => {
    exposeQuoteHandler?.(insertQuote);
    return () => exposeQuoteHandler?.(null);
  }, [exposeQuoteHandler, insertQuote]);

  const handleRationaleChange = (value: string) => {
    if (value.length > HARD_LIMIT) return;
    setRationale(value);
    const next = { rationale: value, comparisonNotes };
    onChange?.(next);
    scheduleSave(next);
  };

  const handleNotesChange = (value: string) => {
    if (value.length > HARD_LIMIT) return;
    setComparisonNotes(value);
    const next = { rationale, comparisonNotes: value };
    onChange?.(next);
    scheduleSave(next);
  };

  const required =
    requiredForIntent === "REJECT" || requiredForIntent === "REQUEST_INFO";
  const placeholder =
    required && requiredForIntent === "REJECT"
      ? "Required — explain why this applicant is being rejected."
      : required && requiredForIntent === "REQUEST_INFO"
        ? "Required — describe the information you're requesting."
        : "Summarise your decision so reviewers and the candidate know why.";

  return (
    <div
      className="draft-rationale-field"
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <div
        role="tablist"
        aria-label="Draft sections"
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 2,
          background: "var(--cockpit-surface-strong, #faf8ff)",
          border: "1px solid var(--cockpit-line, rgba(71,85,105,0.16))",
          borderRadius: 8,
          width: "fit-content",
        }}
      >
        {(["rationale", "notes"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          const label = tab === "rationale" ? "Rationale" : "Comparison notes";
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "4px 10px",
                background: active ? "var(--cockpit-surface, #fff)" : "transparent",
                border: active
                  ? "1px solid var(--cockpit-line, rgba(71,85,105,0.18))"
                  : "1px solid transparent",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                color: active ? "var(--ink-default, #1a0533)" : "var(--ink-muted, #6b5f7a)",
              }}
            >
              {label}
              {tab === "rationale" && required ? (
                <span aria-hidden="true" style={{ color: "#b91c1c", marginLeft: 4 }}>
                  *
                </span>
              ) : null}
              {tab === "notes" ? (
                <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 500, color: "var(--ink-faint, #a89cb8)" }}>
                  (internal)
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <textarea
        value={activeTab === "rationale" ? rationale : comparisonNotes}
        onChange={(e) =>
          activeTab === "rationale"
            ? handleRationaleChange(e.target.value)
            : handleNotesChange(e.target.value)
        }
        placeholder={placeholder}
        aria-label={activeTab === "rationale" ? "Rationale" : "Comparison notes"}
        aria-required={activeTab === "rationale" ? required : undefined}
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 13,
          lineHeight: 1.45,
          borderRadius: 10,
          border: "1px solid var(--cockpit-line, rgba(71,85,105,0.22))",
          resize: "vertical",
          minHeight: 72,
          background: "var(--cockpit-surface, #fff)",
          color: "var(--ink-default, #1a0533)",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <SaveStateIndicator
          state={saveState}
          lastSavedAt={lastSavedAt}
          onRetry={() => triggerSave(latestDraftRef.current)}
        />
        <DraftCharCounter text={activeTab === "rationale" ? rationale : comparisonNotes} />
      </div>
    </div>
  );
}
