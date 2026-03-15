"use client";

import { useState, useTransition } from "react";
import {
  addFormField,
  removeFormField,
  updateFormTemplate,
  deleteFormTemplate,
} from "@/lib/form-template-actions";

type Field = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string | null;
  sortOrder: number;
};

type Template = {
  id: string;
  name: string;
  roleType: string;
  isActive: boolean;
  fields: Field[];
};

const FIELD_TYPES = [
  { value: "SHORT_TEXT", label: "Short Text" },
  { value: "LONG_TEXT", label: "Long Text" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "RATING_SCALE", label: "Rating Scale (1-5)" },
  { value: "FILE_UPLOAD", label: "File Upload" },
];

export function FormTemplateBuilder({ template }: { template: Template }) {
  const [isPending, startTransition] = useTransition();
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("SHORT_TEXT");
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState("");
  const [newFieldHelpText, setNewFieldHelpText] = useState("");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAddField() {
    if (!newFieldLabel.trim()) return;
    setError(null);

    const fd = new FormData();
    fd.set("templateId", template.id);
    fd.set("label", newFieldLabel);
    fd.set("fieldType", newFieldType);
    fd.set("required", String(newFieldRequired));
    if (newFieldPlaceholder) fd.set("placeholder", newFieldPlaceholder);
    if (newFieldHelpText) fd.set("helpText", newFieldHelpText);
    if (newFieldType === "MULTIPLE_CHOICE" && newFieldOptions) {
      const optionsArray = newFieldOptions.split("\n").filter((o) => o.trim());
      fd.set("options", JSON.stringify(optionsArray));
    }

    startTransition(async () => {
      try {
        await addFormField(fd);
        setNewFieldLabel("");
        setNewFieldPlaceholder("");
        setNewFieldHelpText("");
        setNewFieldOptions("");
        setShowAddField(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add field");
      }
    });
  }

  function handleRemoveField(fieldId: string) {
    const fd = new FormData();
    fd.set("id", fieldId);
    startTransition(async () => {
      try {
        await removeFormField(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove field");
      }
    });
  }

  function handleToggleActive() {
    const fd = new FormData();
    fd.set("id", template.id);
    fd.set("isActive", String(!template.isActive));
    startTransition(async () => {
      try {
        await updateFormTemplate(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update template");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this template and all its fields?")) return;
    const fd = new FormData();
    fd.set("id", template.id);
    startTransition(async () => {
      try {
        await deleteFormTemplate(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete template");
      }
    });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Template Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>{template.name}</h3>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <span className="pill">{template.roleType.replace(/_/g, " ")}</span>
            <span className={`pill ${template.isActive ? "pill-success" : "pill-declined"}`}>
              {template.isActive ? "Active" : "Inactive"}
            </span>
            <span className="pill">{template.fields.length} field{template.fields.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="button small outline"
            onClick={handleToggleActive}
            disabled={isPending}
          >
            {template.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            className="button small ghost"
            onClick={handleDelete}
            disabled={isPending}
            style={{ color: "#dc2626" }}
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 12px" }}>{error}</p>
      )}

      {/* Fields List */}
      {template.fields.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", margin: "0 0 8px" }}>
            FORM FIELDS
          </p>
          {template.fields.map((field, i) => (
            <div
              key={field.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 4,
                background: "var(--surface-alt, #fafafa)",
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {i + 1}. {field.label}
                </span>
                {field.required && (
                  <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>
                )}
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                  {FIELD_TYPES.find((t) => t.value === field.fieldType)?.label ?? field.fieldType}
                </span>
                {field.helpText && (
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                    — {field.helpText}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="button ghost small"
                onClick={() => handleRemoveField(field.id)}
                disabled={isPending}
                style={{ fontSize: 11, color: "var(--muted)" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Field */}
      {showAddField ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Add New Field</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Label *</label>
              <input
                className="input"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g., Why do you want to lead a chapter?"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>Field Type</label>
                <select
                  className="input"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>Required?</label>
                <select
                  className="input"
                  value={String(newFieldRequired)}
                  onChange={(e) => setNewFieldRequired(e.target.value === "true")}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Placeholder (optional)</label>
              <input
                className="input"
                value={newFieldPlaceholder}
                onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                placeholder="Hint text shown in the field..."
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Help Text (optional)</label>
              <input
                className="input"
                value={newFieldHelpText}
                onChange={(e) => setNewFieldHelpText(e.target.value)}
                placeholder="Instructions for the applicant..."
              />
            </div>
            {newFieldType === "MULTIPLE_CHOICE" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>Options (one per line)</label>
                <textarea
                  className="input"
                  rows={4}
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder={"Option A\nOption B\nOption C"}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="button small"
                onClick={handleAddField}
                disabled={isPending || !newFieldLabel.trim()}
              >
                Add Field
              </button>
              <button
                type="button"
                className="button small ghost"
                onClick={() => setShowAddField(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="button small outline"
          onClick={() => setShowAddField(true)}
        >
          + Add Field
        </button>
      )}
    </div>
  );
}
