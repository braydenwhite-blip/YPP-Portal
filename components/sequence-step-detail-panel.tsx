"use client";

import { useCallback, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepDetail {
  id: string;
  title: string;
  type: "class" | "lab" | "standalone";
  unlockType: "AUTO" | "MANUAL";
  prerequisites: { id: string; title: string }[];
  stepDetails?: {
    purpose?: string;
    expectedEvidence?: string;
    estimatedDuration?: string;
    coachSupportNote?: string;
    unlockRationale?: string;
    [key: string]: unknown;
  } | null;
}

export interface AvailableStep {
  id: string;
  title: string;
}

interface SequenceStepDetailPanelProps {
  step: StepDetail;
  availablePrerequisites: AvailableStep[]; // steps that can be added without cycles
  onUpdate?: (stepId: string, data: Record<string, unknown>) => void;
  onRemovePrerequisite?: (stepId: string, prereqId: string) => void;
  onAddPrerequisite?: (stepId: string, prereqId: string) => void;
  onDelete?: (stepId: string) => void;
  onChangeUnlockType?: (stepId: string, type: "AUTO" | "MANUAL") => void;
  onClose?: () => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted, #6b7280)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: "var(--radius-md, 8px)",
  background: "var(--surface, #fff)",
  color: "var(--foreground, #111)",
  outline: "none",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 60,
  resize: "vertical",
  fontFamily: "inherit",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
};

const TYPE_ICONS: Record<string, string> = {
  class: "\u{1F4DA}",
  lab: "\u{1F52C}",
  standalone: "\u{1F4DD}",
};

const TYPE_LABELS: Record<string, string> = {
  class: "Class",
  lab: "Passion Lab",
  standalone: "Standalone",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SequenceStepDetailPanel({
  step,
  availablePrerequisites,
  onUpdate,
  onRemovePrerequisite,
  onAddPrerequisite,
  onDelete,
  onChangeUnlockType,
  onClose,
}: SequenceStepDetailPanelProps) {
  const [addPrereqId, setAddPrereqId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const details = step.stepDetails ?? {};

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      onUpdate?.(step.id, {
        stepDetails: {
          ...details,
          [field]: value,
        },
      });
    },
    [step.id, details, onUpdate]
  );

  const handleAddPrereq = useCallback(() => {
    if (!addPrereqId) return;
    onAddPrerequisite?.(step.id, addPrereqId);
    setAddPrereqId("");
  }, [step.id, addPrereqId, onAddPrerequisite]);

  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        borderLeft: "1px solid var(--border, #e5e7eb)",
        background: "#fff",
        padding: 20,
        overflowY: "auto",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{TYPE_ICONS[step.type] ?? ""}</span>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--foreground, #111)",
              }}
            >
              {step.title || "Untitled Step"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted, #6b7280)",
                fontWeight: 500,
              }}
            >
              {TYPE_LABELS[step.type] ?? step.type}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--muted, #6b7280)",
              padding: 4,
              lineHeight: 1,
            }}
            title="Close panel"
          >
            &times;
          </button>
        )}
      </div>

      {/* Editable fields */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Purpose</label>
        <textarea
          style={textareaStyle}
          value={details.purpose ?? ""}
          onChange={(e) => handleFieldChange("purpose", e.target.value)}
          placeholder="What students will learn or achieve..."
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Expected Evidence</label>
        <textarea
          style={textareaStyle}
          value={details.expectedEvidence ?? ""}
          onChange={(e) =>
            handleFieldChange("expectedEvidence", e.target.value)
          }
          placeholder="How completion will be demonstrated..."
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Estimated Duration</label>
        <input
          type="text"
          style={inputStyle}
          value={details.estimatedDuration ?? ""}
          onChange={(e) =>
            handleFieldChange("estimatedDuration", e.target.value)
          }
          placeholder="e.g. 2 weeks, 4 sessions"
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Coach Support Note</label>
        <textarea
          style={textareaStyle}
          value={details.coachSupportNote ?? ""}
          onChange={(e) =>
            handleFieldChange("coachSupportNote", e.target.value)
          }
          placeholder="Notes for coaches supporting this step..."
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Unlock Rationale</label>
        <textarea
          style={textareaStyle}
          value={details.unlockRationale ?? ""}
          onChange={(e) =>
            handleFieldChange("unlockRationale", e.target.value)
          }
          placeholder="Why this step unlocks when it does..."
        />
      </div>

      {/* Unlock Type Toggle */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Unlock Type</label>
        <div
          style={{
            display: "flex",
            background: "var(--surface, #f4f4f5)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "var(--radius-md, 8px)",
            padding: 3,
            gap: 3,
          }}
        >
          {(["AUTO", "MANUAL"] as const).map((type) => (
            <button
              key={type}
              onClick={() => onChangeUnlockType?.(step.id, type)}
              style={{
                flex: 1,
                padding: "6px 0",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                background:
                  step.unlockType === type ? "#fff" : "transparent",
                color:
                  step.unlockType === type
                    ? "var(--foreground, #111)"
                    : "var(--muted, #6b7280)",
                boxShadow:
                  step.unlockType === type
                    ? "0 1px 2px rgba(0,0,0,0.06)"
                    : "none",
                transition: "all 0.15s ease",
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Prerequisites */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Prerequisites</label>
        {step.prerequisites.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: "var(--muted, #6b7280)",
              margin: "4px 0 8px",
              fontStyle: "italic",
            }}
          >
            No prerequisites (entry point)
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginBottom: 8,
            }}
          >
            {step.prerequisites.map((prereq) => (
              <div
                key={prereq.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  background: "var(--surface, #f4f4f5)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    color: "var(--foreground, #111)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {prereq.title || "Untitled"}
                </span>
                <button
                  onClick={() =>
                    onRemovePrerequisite?.(step.id, prereq.id)
                  }
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 14,
                    cursor: "pointer",
                    color: "#ef4444",
                    padding: "0 4px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title="Remove prerequisite"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Prerequisite dropdown */}
        {availablePrerequisites.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            <select
              value={addPrereqId}
              onChange={(e) => setAddPrereqId(e.target.value)}
              style={{
                ...inputStyle,
                flex: 1,
                cursor: "pointer",
              }}
            >
              <option value="">Add prerequisite...</option>
              {availablePrerequisites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled"}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddPrereq}
              disabled={!addPrereqId}
              style={{
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: addPrereqId
                  ? "var(--ypp-purple, #7c3aed)"
                  : "var(--surface, #f4f4f5)",
                color: addPrereqId ? "#fff" : "var(--muted, #6b7280)",
                border: "none",
                borderRadius: "var(--radius-md, 8px)",
                cursor: addPrereqId ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Delete Step */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid var(--border, #e5e7eb)",
        }}
      >
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              width: "100%",
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "#ef4444",
              background: "none",
              border: "1px solid #fecaca",
              borderRadius: "var(--radius-md, 8px)",
              cursor: "pointer",
            }}
          >
            Delete Step
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                onDelete?.(step.id);
                setConfirmDelete(false);
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "#ef4444",
                border: "none",
                borderRadius: "var(--radius-md, 8px)",
                cursor: "pointer",
              }}
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--foreground, #111)",
                background: "var(--surface, #f4f4f5)",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: "var(--radius-md, 8px)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
