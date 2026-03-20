"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitChapterPresidentApplication } from "@/lib/chapter-president-application-actions";
import FileUpload from "./file-upload";

type FormField = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string | null;
};

type Chapter = {
  id: string;
  name: string;
};

interface CPApplicationFormProps {
  chapters: Chapter[];
  customFields?: FormField[];
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="button"
      disabled={pending}
      style={{ width: "100%" }}
    >
      {pending ? "Submitting..." : "Submit Application"}
    </button>
  );
}

export default function ChapterPresidentApplicationForm({
  chapters,
  customFields = [],
}: CPApplicationFormProps) {
  const [state, formAction] = useFormState(submitChapterPresidentApplication, {
    status: "idle" as const,
    message: "",
  });

  const [leadershipExperience, setLeadershipExperience] = useState("");
  const [chapterVision, setChapterVision] = useState("");
  const [availability, setAvailability] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  if (state.status === "success") {
    return (
      <div style={{ padding: 24, background: "#f0fdf4", borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: "0 0 8px" }}>Application Submitted</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          {"You'll receive email updates as your application progresses."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">Apply for Chapter President</div>

      <div style={{
        background: "#fef3c7",
        border: "1px solid #f59e0b",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 16,
        fontSize: 13,
      }}>
        <strong>Note:</strong> This position requires an interview. After submitting, a reviewer will
        review your application and schedule an interview.
      </div>

      {state.status === "error" && (
        <div style={{
          background: "#fee2e2",
          color: "#dc2626",
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
        }}>
          {state.message}
        </div>
      )}

      <form action={formAction} className="form-grid">
        <div className="form-row">
          <label>
            Chapter <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Select the chapter you want to lead, or leave blank if proposing a new chapter.
          </p>
          <select
            className="input"
            name="chapterId"
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
          >
            <option value="">Proposing a new chapter</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>
            Leadership Experience <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Describe your leadership experience and what qualifies you for this role.
          </p>
          <textarea
            name="leadershipExperience"
            className="input"
            rows={5}
            required
            placeholder="Share your leadership roles, team management experience, community involvement..."
            value={leadershipExperience}
            onChange={(e) => setLeadershipExperience(e.target.value)}
          />
          <span style={{ fontSize: 11, color: leadershipExperience.length > 5000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {leadershipExperience.length} / 5,000
          </span>
        </div>

        <div className="form-row">
          <label>
            Chapter Vision <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            What is your vision for the chapter? What would you focus on?
          </p>
          <textarea
            name="chapterVision"
            className="input"
            rows={5}
            required
            placeholder="Describe your goals for the chapter, programs you'd like to run, how you'd engage students..."
            value={chapterVision}
            onChange={(e) => setChapterVision(e.target.value)}
          />
          <span style={{ fontSize: 11, color: chapterVision.length > 5000 ? "#dc2626" : "var(--muted)", marginTop: 4, display: "block", textAlign: "right" }}>
            {chapterVision.length} / 5,000
          </span>
        </div>

        <div className="form-row">
          <label>
            Interview Availability <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            When are you generally available for an interview?
          </p>
          <input
            name="availability"
            className="input"
            required
            placeholder="e.g., Weekday evenings after 5pm, Saturday mornings"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          />
        </div>

        {/* Dynamic custom fields from form template */}
        {customFields.map((field) => (
          <div className="form-row" key={field.id}>
            <label>
              {field.label}
              {field.required && <span style={{ color: "#dc2626" }}> *</span>}
            </label>
            {field.helpText && (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
                {field.helpText}
              </p>
            )}

            {field.fieldType === "SHORT_TEXT" && (
              <input
                name={`custom_field_${field.id}`}
                className="input"
                required={field.required}
                placeholder={field.placeholder ?? ""}
                value={customValues[field.id] || ""}
                onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
              />
            )}

            {field.fieldType === "LONG_TEXT" && (
              <textarea
                name={`custom_field_${field.id}`}
                className="input"
                rows={4}
                required={field.required}
                placeholder={field.placeholder ?? ""}
                value={customValues[field.id] || ""}
                onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
              />
            )}

            {field.fieldType === "MULTIPLE_CHOICE" && field.options && (
              <select
                name={`custom_field_${field.id}`}
                className="input"
                required={field.required}
                value={customValues[field.id] || ""}
                onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
              >
                <option value="">Select an option...</option>
                {(() => {
                  try {
                    const opts = JSON.parse(field.options) as string[];
                    return opts.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ));
                  } catch {
                    return null;
                  }
                })()}
              </select>
            )}

            {field.fieldType === "RATING_SCALE" && (
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`custom_field_${field.id}`}
                      value={String(n)}
                      required={field.required}
                      checked={customValues[field.id] === String(n)}
                      onChange={(e) => setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))}
                    />
                    {n}
                  </label>
                ))}
              </div>
            )}

            {field.fieldType === "FILE_UPLOAD" && (
              <>
                <FileUpload
                  category="OTHER"
                  entityType="APPLICATION_CUSTOM"
                  accept="*"
                  maxSizeMB={10}
                  label="Upload File"
                  compact
                  onUploadComplete={(file) =>
                    setCustomValues((v) => ({ ...v, [field.id]: file.url }))
                  }
                />
                <input
                  type="hidden"
                  name={`custom_file_${field.id}`}
                  value={customValues[field.id] || ""}
                />
              </>
            )}
          </div>
        ))}
        <SubmitButton />
      </form>
    </div>
  );
}
