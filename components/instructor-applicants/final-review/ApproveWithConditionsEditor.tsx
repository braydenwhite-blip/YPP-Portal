"use client";

/**
 * Checklist-first conditions editor for APPROVE_WITH_CONDITIONS (§8.4).
 * Most chair-imposed conditions come from the preset vocabulary in
 * lib/condition-presets.ts; the editor exposes a custom-condition input
 * for the rare exception. Hard cap at 10 conditions, soft warning at 6.
 */

import { useState } from "react";
import { CONDITION_PRESETS, type ConditionPreset } from "@/lib/condition-presets";

export interface DecisionCondition {
  id: string;
  label: string;
  source: "preset" | "custom";
  presetId?: string;
}

export interface ApproveWithConditionsEditorProps {
  conditions: DecisionCondition[];
  onChange: (conditions: DecisionCondition[]) => void;
}

const HARD_LIMIT = 10;
const SOFT_LIMIT = 6;

function nextId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cond-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ApproveWithConditionsEditor({
  conditions,
  onChange,
}: ApproveWithConditionsEditorProps) {
  const [customDraft, setCustomDraft] = useState("");

  function togglePreset(preset: ConditionPreset) {
    const existing = conditions.find((c) => c.presetId === preset.id);
    if (existing) {
      onChange(conditions.filter((c) => c.id !== existing.id));
    } else {
      if (conditions.length >= HARD_LIMIT) return;
      onChange([
        ...conditions,
        {
          id: nextId(),
          label: preset.label,
          source: "preset",
          presetId: preset.id,
        },
      ]);
    }
  }

  function addCustom() {
    const label = customDraft.trim();
    if (label.length === 0) return;
    if (conditions.length >= HARD_LIMIT) return;
    onChange([
      ...conditions,
      { id: nextId(), label, source: "custom" },
    ]);
    setCustomDraft("");
  }

  function removeCondition(id: string) {
    onChange(conditions.filter((c) => c.id !== id));
  }

  const presetIds = new Set(conditions.map((c) => c.presetId).filter(Boolean));
  const customConditions = conditions.filter((c) => c.source === "custom");

  return (
    <fieldset
      className="approve-with-conditions-editor"
      style={{
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 12,
        padding: 14,
        margin: 0,
      }}
    >
      <legend
        style={{
          padding: "0 8px",
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Conditions ({conditions.length} / {HARD_LIMIT})
        {conditions.length >= SOFT_LIMIT ? (
          <span style={{ marginLeft: 6, color: "#a16207" }}>
            — that&apos;s a lot; consider tightening the list
          </span>
        ) : null}
      </legend>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-muted, #6b5f7a)" }}>
        Pick from the preset vocabulary or add a custom condition.
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {CONDITION_PRESETS.map((preset) => {
          const checked = presetIds.has(preset.id);
          return (
            <li key={preset.id}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: `1px solid ${checked ? "var(--ypp-purple-500, #8b3fe8)" : "var(--cockpit-line, rgba(71,85,105,0.18))"}`,
                  background: checked
                    ? "var(--ypp-purple-50, #f3ecff)"
                    : "var(--cockpit-surface, #fff)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePreset(preset)}
                  disabled={!checked && conditions.length >= HARD_LIMIT}
                  style={{ marginTop: 3 }}
                />
                <span style={{ flex: 1, color: "var(--ink-default, #1a0533)" }}>{preset.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {customConditions.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {customConditions.map((condition) => (
            <li
              key={condition.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                background: "var(--cockpit-surface-strong, #faf8ff)",
                borderRadius: 8,
                border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
                fontSize: 12,
              }}
            >
              <span style={{ flex: 1, color: "var(--ink-default, #1a0533)" }}>{condition.label}</span>
              <button
                type="button"
                onClick={() => removeCondition(condition.id)}
                aria-label="Remove custom condition"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted, #6b5f7a)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="text"
          value={customDraft}
          onChange={(event) => setCustomDraft(event.target.value.slice(0, 300))}
          placeholder="Add a custom condition…"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--cockpit-line, rgba(71,85,105,0.22))",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={customDraft.trim().length === 0 || conditions.length >= HARD_LIMIT}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--ypp-purple-600, #6b21c8)",
            background:
              customDraft.trim().length === 0 || conditions.length >= HARD_LIMIT
                ? "rgba(107, 33, 200, 0.5)"
                : "var(--ypp-purple-600, #6b21c8)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: customDraft.trim().length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
