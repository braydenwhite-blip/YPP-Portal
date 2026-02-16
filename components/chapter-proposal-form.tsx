"use client";

import { useState, useCallback, useEffect } from "react";
import { submitChapterProposal } from "@/lib/application-actions";
import { chapterProposalSchema, getFieldError } from "@/lib/application-schemas";
import type { z } from "zod";

interface ChapterProposalFormProps {
  disabled: boolean;
}

const STORAGE_KEY = "ypp-chapter-proposal-draft";

type FormFields = {
  chapterName: string;
  partnerSchool: string;
  city: string;
  region: string;
  chapterVision: string;
  launchPlan: string;
  recruitmentPlan: string;
  leadershipBio: string;
  resumeUrl: string;
  additionalContext: string;
};

const EMPTY_FIELDS: FormFields = {
  chapterName: "",
  partnerSchool: "",
  city: "",
  region: "",
  chapterVision: "",
  launchPlan: "",
  recruitmentPlan: "",
  leadershipBio: "",
  resumeUrl: "",
  additionalContext: "",
};

const STEPS = [
  {
    id: "basics",
    title: "Chapter Basics",
    description: "Name and location for your proposed chapter",
    fields: ["chapterName", "partnerSchool", "city", "region"] as (keyof FormFields)[],
  },
  {
    id: "vision",
    title: "Chapter Vision",
    description: "Why this chapter should exist",
    fields: ["chapterVision"] as (keyof FormFields)[],
  },
  {
    id: "launch",
    title: "Launch Plan",
    description: "Your 90-day roadmap",
    fields: ["launchPlan"] as (keyof FormFields)[],
  },
  {
    id: "operations",
    title: "Recruitment & Operations",
    description: "How you will recruit and run the chapter",
    fields: ["recruitmentPlan"] as (keyof FormFields)[],
  },
  {
    id: "leadership",
    title: "Your Leadership",
    description: "Why you should lead this chapter",
    fields: ["leadershipBio"] as (keyof FormFields)[],
  },
  {
    id: "extras",
    title: "Final Details",
    description: "Resume and additional context",
    fields: ["resumeUrl", "additionalContext"] as (keyof FormFields)[],
  },
];

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return (
    <span style={{ fontSize: 11, color: len > max ? "#dc2626" : "var(--muted)" }}>
      {len} / {max.toLocaleString()}
    </span>
  );
}

function FieldHint({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 6px" }}>
      {text}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span style={{ fontSize: 12, color: "#dc2626", display: "block", marginTop: 4 }}>
      {message}
    </span>
  );
}

function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  completedSteps,
}: {
  steps: typeof STEPS;
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps: Set<number>;
}) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = completedSteps.has(index);
        return (
          <button
            type="button"
            key={step.id}
            onClick={() => onStepClick(index)}
            style={{
              flex: 1,
              padding: "8px 4px",
              border: "none",
              borderBottom: `3px solid ${isActive ? "#7c3aed" : isComplete ? "#10b981" : "var(--border)"}`,
              background: isActive ? "#f5f3ff" : "transparent",
              cursor: "pointer",
              borderRadius: "4px 4px 0 0",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#7c3aed" : isComplete ? "#10b981" : "var(--muted)" }}>
              {isComplete ? "\u2713" : index + 1}
            </div>
            <div style={{ fontSize: 11, color: isActive ? "#1f2937" : "var(--muted)", marginTop: 2 }}>
              {step.title}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function ChapterProposalForm({ disabled }: ChapterProposalFormProps) {
  const [errors, setErrors] = useState<z.ZodError | null>(null);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);

  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setFields((prev) => ({ ...prev, ...parsed }));
          setHasDraft(true);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Auto-save to localStorage on field change
  useEffect(() => {
    const hasContent = Object.values(fields).some((v) => v.trim().length > 0);
    if (hasContent) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
        setHasDraft(true);
      } catch {
        // Storage full or unavailable
      }
    }
  }, [fields]);

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setFields(EMPTY_FIELDS);
    setCurrentStep(0);
    setHasDraft(false);
    setErrors(null);
  }

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const validate = useCallback(() => {
    const result = chapterProposalSchema.safeParse(fields);
    if (!result.success) {
      setErrors(result.error);
      return false;
    }
    setErrors(null);
    return true;
  }, [fields]);

  // Check which steps have all required fields filled
  const completedSteps = new Set<number>();
  const REQUIRED_FIELDS = ["chapterName", "chapterVision", "launchPlan", "recruitmentPlan", "leadershipBio"];
  STEPS.forEach((step, index) => {
    const requiredInStep = step.fields.filter((f) => REQUIRED_FIELDS.includes(f));
    if (requiredInStep.length === 0) {
      // No required fields in this step - complete if any field has content
      const hasAny = step.fields.some((f) => fields[f].trim().length > 0);
      if (hasAny) completedSteps.add(index);
    } else {
      const allFilled = requiredInStep.every((f) => fields[f].trim().length > 0);
      if (allFilled) completedSteps.add(index);
    }
  });

  // Completion percentage
  const filledRequired = REQUIRED_FIELDS.filter((f) => fields[f as keyof FormFields].trim().length > 0).length;
  const completionPct = Math.round((filledRequired / REQUIRED_FIELDS.length) * 100);

  function goNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }

  function goPrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  async function handleSubmit(formData: FormData) {
    setServerError("");
    if (!validate()) {
      // Jump to first step with errors
      if (errors) {
        const errorFields = errors.issues.map((i) => i.path[0] as string);
        const firstErrorStep = STEPS.findIndex((step) =>
          step.fields.some((f) => errorFields.includes(f))
        );
        if (firstErrorStep >= 0) setCurrentStep(firstErrorStep);
      }
      return;
    }

    setSubmitting(true);
    try {
      await submitChapterProposal(formData);
      setSubmitted(true);
      clearDraft();
    } catch (e: any) {
      setServerError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 24, background: "#f0fdf4", borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: "0 0 8px" }}>Chapter Proposal Submitted</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          An admin will review your proposal and reach out to schedule an interview.
        </p>
      </div>
    );
  }

  const err = (field: string) => getFieldError(errors, field);
  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Chapter Proposal Form</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: completionPct === 100 ? "#10b981" : "var(--muted)" }}>
            {completionPct}% complete
          </div>
          <div style={{ width: 80, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${completionPct}%`, height: "100%", background: completionPct === 100 ? "#10b981" : "#7c3aed", transition: "width 0.3s", borderRadius: 3 }} />
          </div>
          {hasDraft && (
            <button
              type="button"
              className="button small ghost"
              onClick={clearDraft}
              style={{ fontSize: 11 }}
            >
              Clear Draft
            </button>
          )}
        </div>
      </div>

      {hasDraft && currentStep === 0 && (
        <div style={{
          background: "#eff6ff",
          border: "1px solid #93c5fd",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 16,
          fontSize: 13,
          color: "#1e40af",
        }}>
          Draft restored from your previous session. Your progress is saved automatically.
        </div>
      )}

      {serverError && (
        <div style={{
          background: "#fee2e2",
          color: "#dc2626",
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
        }}>
          {serverError}
        </div>
      )}

      <StepIndicator
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        completedSteps={completedSteps}
      />

      <div style={{ marginBottom: 8 }}>
        <h4 style={{ margin: "0 0 4px" }}>
          Step {currentStep + 1}: {step.title}
        </h4>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          {step.description}
        </p>
      </div>

      <form action={handleSubmit} className="form-grid">
        {/* Hidden fields to ensure FormData has all values */}
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        {/* Step: Basics */}
        {step.id === "basics" && (
          <>
            <div className="grid two">
              <div className="form-row">
                <label>
                  Proposed Chapter Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <FieldHint text="e.g., YPP Austin, YPP Bay Area" />
                <input
                  className="input"
                  placeholder="YPP Austin"
                  value={fields.chapterName}
                  onChange={(e) => updateField("chapterName", e.target.value)}
                  style={err("chapterName") ? { borderColor: "#dc2626" } : undefined}
                />
                <FieldError message={err("chapterName")} />
              </div>
              <div className="form-row">
                <label>Partner School / Organization (optional)</label>
                <FieldHint text="School or org you plan to partner with" />
                <input
                  className="input"
                  placeholder="Austin High School"
                  value={fields.partnerSchool}
                  onChange={(e) => updateField("partnerSchool", e.target.value)}
                />
              </div>
            </div>

            <div className="grid two">
              <div className="form-row">
                <label>City</label>
                <input
                  className="input"
                  placeholder="Austin"
                  value={fields.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Region / State</label>
                <input
                  className="input"
                  placeholder="TX"
                  value={fields.region}
                  onChange={(e) => updateField("region", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* Step: Vision */}
        {step.id === "vision" && (
          <div className="form-row">
            <label>
              Why this chapter should exist <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <FieldHint text="What local student need does this chapter solve? Aim for 200-500 words." />
            <textarea
              className="input"
              rows={8}
              placeholder="Describe the student population you'd serve, the gap in current offerings, and how YPP can uniquely help..."
              value={fields.chapterVision}
              onChange={(e) => updateField("chapterVision", e.target.value)}
              style={err("chapterVision") ? { borderColor: "#dc2626" } : undefined}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <FieldError message={err("chapterVision")} />
              <CharCount value={fields.chapterVision} max={3000} />
            </div>
          </div>
        )}

        {/* Step: Launch Plan */}
        {step.id === "launch" && (
          <div className="form-row">
            <label>
              90-day launch plan <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <FieldHint text="First cohort plan, class pilots, milestones, and timeline. Aim for 200-500 words." />
            <textarea
              className="input"
              rows={8}
              placeholder={"Week 1-2: Recruit founding team\nWeek 3-4: Set up first class pilot\nMonth 2: Launch first cohort\nMonth 3: Review and iterate..."}
              value={fields.launchPlan}
              onChange={(e) => updateField("launchPlan", e.target.value)}
              style={err("launchPlan") ? { borderColor: "#dc2626" } : undefined}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <FieldError message={err("launchPlan")} />
              <CharCount value={fields.launchPlan} max={3000} />
            </div>
          </div>
        )}

        {/* Step: Recruitment & Operations */}
        {step.id === "operations" && (
          <div className="form-row">
            <label>
              Recruitment and operations plan <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <FieldHint text="How will you recruit instructors and students? What does day-to-day ops look like?" />
            <textarea
              className="input"
              rows={8}
              placeholder="Describe your plan for finding instructors, reaching students, and running weekly operations..."
              value={fields.recruitmentPlan}
              onChange={(e) => updateField("recruitmentPlan", e.target.value)}
              style={err("recruitmentPlan") ? { borderColor: "#dc2626" } : undefined}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <FieldError message={err("recruitmentPlan")} />
              <CharCount value={fields.recruitmentPlan} max={3000} />
            </div>
          </div>
        )}

        {/* Step: Leadership */}
        {step.id === "leadership" && (
          <div className="form-row">
            <label>
              Why you should be chapter president <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <FieldHint text="Share your leadership background, local relationships, and readiness to lead. Aim for 150-300 words." />
            <textarea
              className="input"
              rows={8}
              placeholder="Describe your leadership experience, relevant skills, and what drives you to lead this chapter..."
              value={fields.leadershipBio}
              onChange={(e) => updateField("leadershipBio", e.target.value)}
              style={err("leadershipBio") ? { borderColor: "#dc2626" } : undefined}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <FieldError message={err("leadershipBio")} />
              <CharCount value={fields.leadershipBio} max={3000} />
            </div>
          </div>
        )}

        {/* Step: Final Details */}
        {step.id === "extras" && (
          <>
            <div className="form-row">
              <label>Resume URL (optional)</label>
              <FieldHint text="Link to your resume on Google Drive, Dropbox, or LinkedIn." />
              <input
                type="url"
                className="input"
                placeholder="https://..."
                value={fields.resumeUrl}
                onChange={(e) => updateField("resumeUrl", e.target.value)}
                style={err("resumeUrl") ? { borderColor: "#dc2626" } : undefined}
              />
              <FieldError message={err("resumeUrl")} />
            </div>

            <div className="form-row">
              <label>Additional context (optional)</label>
              <FieldHint text="Anything else reviewers should know about you or the proposed chapter." />
              <textarea
                className="input"
                rows={4}
                placeholder="Anything else reviewers should know."
                value={fields.additionalContext}
                onChange={(e) => updateField("additionalContext", e.target.value)}
              />
            </div>
          </>
        )}

        {/* Navigation buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button
            type="button"
            className="button small ghost"
            onClick={goPrev}
            disabled={currentStep === 0}
          >
            &larr; Back
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {!isLastStep && (
              <button
                type="button"
                className="button small"
                onClick={goNext}
              >
                Next &rarr;
              </button>
            )}
            {isLastStep && (
              <button type="submit" className="button" disabled={disabled || submitting}>
                {submitting ? "Submitting..." : "Submit Chapter Proposal"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
